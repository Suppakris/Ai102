import os
import json
import re
from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

SYSTEM_PROMPT = """You are a presentation designer AI. Your job is to convert raw document text into clean, concise presentation slides.

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- Each slide must have a short punchy title (max 8 words)
- Bullets must be concise (max 15 words each)
- Extract 3-5 key bullet points per page
- Skip filler content, focus on key insights
- If a page has no meaningful content, return null"""

SLIDE_PROMPT = """Convert this document page into a slide.

Return ONLY this JSON format (nothing else):
{{"title": "Slide Title Here", "bullets": ["Point one", "Point two", "Point three"]}}

Page content:
{text}"""


def summarize_page_to_slide(page_text: str, page_number: int) -> dict | None:
    """Call Groq API to convert a page of text into slide content."""
    try:
        response = client.chat.completions.create(
            model="llama3-8b-8192",
            max_tokens=500,
            temperature=0.4,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": SLIDE_PROMPT.format(text=page_text)}
            ]
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown code fences if model adds them
        raw = re.sub(r"```json|```", "", raw).strip()

        if raw == "null" or not raw:
            return None

        parsed = json.loads(raw)

        # Validate structure
        if "title" not in parsed or "bullets" not in parsed:
            return None

        return {
            "page": page_number,
            "title": parsed["title"],
            "bullets": parsed["bullets"][:5]  # max 5 bullets
        }

    except json.JSONDecodeError:
        # Fallback: try to extract content even if JSON is malformed
        return {
            "page": page_number,
            "title": f"Page {page_number}",
            "bullets": ["Content extracted from this page"]
        }
    except Exception as e:
        print(f"Groq error on page {page_number}: {e}")
        return None


def generate_presentation_title(pdf_title: str, first_page_text: str) -> str:
    """Use Groq to generate a good presentation title."""
    try:
        response = client.chat.completions.create(
            model="llama3-8b-8192",
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
    except Exception:
        return pdf_title or "Presentation"