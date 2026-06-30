import os
import json
import re
import time
from groq import Groq, RateLimitError

_client: Groq | None = None

# ---------------------------------------------------------------------------
# Centralized model config.
# Groq's FREE tier (no credit card -> you literally cannot be charged) gives
# access to these models, gated only by rate limits. On the free tier
# gpt-oss-120b and gpt-oss-20b have IDENTICAL limits, so default to the bigger,
# higher-quality 120B — it costs the same ($0) and is smarter.
#
# Free-tier limits per model (verified Jun 2026 - https://console.groq.com/docs/rate-limits):
#   openai/gpt-oss-120b -> 30 RPM | 1K RPD | 8K TPM | 200K TPD   (default, best free quality)
#   openai/gpt-oss-20b  -> 30 RPM | 1K RPD | 8K TPM | 200K TPD   (~2x faster, slightly lower quality)
#   llama-3.1-8b-instant-> 30 RPM | 14.4K RPD | 6K TPM | 500K TPD (highest daily request cap)
#
# Switch any time without touching code:  GROQ_MODEL=openai/gpt-oss-20b
# ---------------------------------------------------------------------------
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

# How many times to retry a single request when we hit a 429 rate limit.
MAX_RETRIES = int(os.environ.get("GROQ_MAX_RETRIES", "4"))


def get_client() -> Groq:
    """Lazily create the Groq client. Raises a clear error if key is missing."""
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set. Create backend/.env from "
                "backend/.env.example and add your key from console.groq.com"
            )
        _client = Groq(api_key=api_key)
    return _client


def _chat_with_retry(**kwargs):
    """Call Groq chat completion, retrying on 429 rate limits.

    The free tier is mostly bound by the 8K tokens/minute limit, so big PDFs
    will hit 429s. Instead of silently degrading to raw-text fallback slides,
    we wait (honoring the Retry-After header when present) and try again.
    """
    last_err = None
    for attempt in range(MAX_RETRIES):
        try:
            return get_client().chat.completions.create(**kwargs)
        except RateLimitError as e:
            last_err = e
            wait = None
            try:
                wait = float(e.response.headers.get("retry-after"))
            except (AttributeError, TypeError, ValueError):
                wait = None
            if wait is None:
                wait = 2 ** attempt  # exponential backoff: 1, 2, 4, 8s
            print(
                f"[Groq] Rate limited (429) on free tier. "
                f"Waiting {wait:.1f}s, retry {attempt + 1}/{MAX_RETRIES}..."
            )
            time.sleep(wait)
    if last_err:
        raise last_err


SYSTEM_PROMPT = """You are a presentation designer AI. Your job is to convert raw document text into clean, concise presentation slides.

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- Each slide must have a short punchy title (max 8 words)
- Bullets must be concise (max 15 words each)
- Extract 1-5 key bullet points per page depending on how much content exists
- Even short or sparse text must be turned into a slide — never return null
- If the page is very short (a greeting, a single sentence, a name, etc.), still create a slide that captures it as-is
- Only skip a page if it is completely blank"""

SLIDE_PROMPT = """Convert this document page into a slide.

Return ONLY this JSON format (nothing else):
{{"title": "Slide Title Here", "bullets": ["Point one", "Point two", "Point three"]}}

Page content:
{text}"""


def _extract_json(raw: str) -> dict:
    """Parse a JSON object from a model response, tolerating extra text.

    Reasoning models (like gpt-oss) can occasionally wrap the answer in code
    fences or prepend stray text, so we strip fences first and, as a last
    resort, grab the outermost {...} block before giving up.
    """
    raw = re.sub(r"```json|```", "", raw).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(raw[start:end + 1])
        raise


def summarize_page_to_slide(page_text: str, page_number: int) -> dict | None:
    """Call Groq API to convert a page of text into slide content."""
    try:
        response = _chat_with_retry(
            model=GROQ_MODEL,
            max_tokens=500,
            temperature=0.4,
            response_format={"type": "json_object"},  # force valid JSON, fewer parse failures
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": SLIDE_PROMPT.format(text=page_text)}
            ]
        )

        raw = response.choices[0].message.content.strip()

        if raw == "null" or not raw:
            # Fallback: never drop a page — build a basic slide from raw text
            return _fallback_slide(page_text, page_number)

        parsed = _extract_json(raw)

        # Validate structure
        if "title" not in parsed or not parsed.get("bullets"):
            return _fallback_slide(page_text, page_number)

        bullets = parsed["bullets"]
        if isinstance(bullets, str):          # be tolerant if model returns a string
            bullets = [bullets]

        return {
            "page": page_number,
            "title": parsed["title"],
            "bullets": bullets[:5]  # max 5 bullets
        }

    except json.JSONDecodeError:
        # Fallback: try to extract content even if JSON is malformed
        return _fallback_slide(page_text, page_number)
    except Exception as e:
        msg = str(e)
        if "model_decommissioned" in msg or "decommissioned" in msg:
            print(
                f"[Groq] Model '{GROQ_MODEL}' has been decommissioned. "
                f"Set the GROQ_MODEL env var to a current model "
                f"(see https://console.groq.com/docs/models). "
                f"Page {page_number} used a raw-text fallback."
            )
        else:
            print(f"Groq error on page {page_number}: {e}")
        return _fallback_slide(page_text, page_number)


def _fallback_slide(page_text: str, page_number: int) -> dict | None:
    """Build a basic slide directly from raw text when the AI fails or refuses."""
    text = page_text.strip()
    if not text:
        return None

    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines:
        return None

    title = lines[0][:60]
    bullets = lines[1:6] if len(lines) > 1 else [text[:200]]

    return {
        "page": page_number,
        "title": title,
        "bullets": bullets
    }


def generate_presentation_title(pdf_title: str, first_page_text: str) -> str:
    """Use Groq to generate a good presentation title."""
    try:
        response = _chat_with_retry(
            model=GROQ_MODEL,
            max_tokens=50,
            temperature=0.3,
            messages=[{
                "role": "user",
                "content": f"""Generate a short, professional presentation title (max 6 words).
PDF name: {pdf_title}
First page content: {first_page_text[:500]}
Return ONLY the title text, nothing else."""
            }]
        )
        return response.choices[0].message.content.strip().strip('"').strip("'")
    except Exception as e:
        print(f"Groq error generating title: {e}")
        return pdf_title or "Presentation"