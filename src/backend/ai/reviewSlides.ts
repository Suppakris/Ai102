import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z } from "zod";

import { DEFAULT_OLLAMA_MODEL, modelPicker } from "@/lib/modelPicker";
import { createLogger } from "@/lib/observability/logger";

const reviewLogger = createLogger("review-slides");

/** Average score (0-10) at or above which a deck passes without revision. */
export const PASS_THRESHOLD = 7;

/**
 * Below this many characters of total slide text there is nothing real to
 * review — skip the LLM call entirely and return clarifying questions
 * instead of letting the model invent feedback about content it never saw.
 */
const MIN_REVIEWABLE_CHARS = 120;

/** Input contract agreed with Dev A for the /review endpoint. */
export interface ReviewSlidesInput {
  user_id: string;
  document_id: string;
  slides: Array<{ slide_number: number; content: string }>;
  /**
   * Optional outline/source material to fact-check slide claims against.
   * Without it, factual claims can only be marked INSUFFICIENT_CONTEXT,
   * never SUPPORTED.
   */
  source_context?: string;
}

const claimStatus = z.enum(["SUPPORTED", "UNSUPPORTED", "INSUFFICIENT_CONTEXT"]);

/**
 * Model-facing output schema. `claim_audit` deliberately comes first: the
 * model must enumerate and verify claims before it is allowed to score,
 * which measurably reduces invented "looks fine" verdicts.
 */
const reviewOutputSchema = z.object({
  claim_audit: z
    .array(
      z.object({
        slide_number: z.number().int(),
        claim: z.string(),
        status: claimStatus,
      }),
    )
    .describe(
      "Every factual claim, statistic, or named entity on the slides, verified against source_context BEFORE scoring",
    ),
  score: z.object({
    clarity: z.number().min(0).max(10),
    design: z.number().min(0).max(10),
    content_accuracy: z.number().min(0).max(10),
  }),
  feedback: z
    .string()
    .describe("Concrete, actionable overall feedback in 2-5 sentences"),
  clarifying_questions: z
    .array(z.string())
    .describe(
      "Questions to ask when the slide data is too sparse or ambiguous to review confidently; empty when context is sufficient",
    ),
});

/** Response contract agreed with Dev A: schema output + computed gate. */
export type ReviewSlidesResult = z.infer<typeof reviewOutputSchema> & {
  needs_revision: boolean;
};

export const REVIEWER_SYSTEM_PROMPT = `You are an expert slide reviewer and presentation auditor. You evaluate presentation slides for visual hierarchy, layout structure, data accuracy, and presentation flow.

Follow this process IN ORDER:

Step 1 — Audit claims. List every factual claim, statistic, or named entity on the slides. Mark each one:
- SUPPORTED: directly backed by the provided source_context
- UNSUPPORTED: contradicts the source_context, or is a specific factual assertion presented with no backing
- INSUFFICIENT_CONTEXT: cannot be verified from what you were given
Never guess. If you cannot verify a claim from the provided material, it is INSUFFICIENT_CONTEXT, not SUPPORTED.

Step 2 — Score each dimension 0-10 only after the audit:
- clarity: is the message of each slide obvious in one read? 9-10 = every slide has one clear takeaway; 7 = mostly clear with minor clutter; 4 = key points buried or rambling; 1 = unreadable.
- design: structural design as evident from the text — text density per slide, one idea per slide, parallel bullet structure, logical ordering. 9-10 = tight and consistent; 7 = decent with some overloaded slides; 4 = walls of text or chaotic ordering; 1 = no structure.
- content_accuracy: 9-10 = all claims SUPPORTED or clearly framed as opinion; 7 = minor unverifiable details; 4 = several UNSUPPORTED claims; 1 = mostly fabricated.
Score the same input the same way every time; do not vary scores for identical content.

Step 3 — Write feedback: 2-5 sentences of concrete, actionable advice referencing specific slide numbers.

Step 4 — Clarifying questions: if the slide data is too sparse, ambiguous, or missing context to review confidently, put the questions you would need answered in clarifying_questions. Asking is always better than inventing an assessment.`;

/**
 * Reviews a slide deck and returns structured scores plus a revision gate.
 *
 * Runs on the free Ollama default; pass { modelProvider: "openrouter" } to
 * route through the admin-funded cloud upgrade (OpenAI, Claude, etc. via
 * one OpenRouter key) with no other code change.
 */
export async function reviewSlides(
  input: ReviewSlidesInput,
  opts?: { modelProvider?: string; modelId?: string },
): Promise<ReviewSlidesResult> {
  const totalChars = input.slides.reduce(
    (sum, slide) => sum + slide.content.trim().length,
    0,
  );

  if (totalChars < MIN_REVIEWABLE_CHARS) {
    reviewLogger.info("Slide content too sparse to review; asking instead", {
      documentId: input.document_id,
      totalChars,
    });
    return {
      claim_audit: [],
      score: { clarity: 0, design: 0, content_accuracy: 0 },
      feedback:
        "The slide content provided is too sparse to review meaningfully. Please answer the clarifying questions or resubmit with fuller slide content.",
      clarifying_questions: [
        "The slides contain almost no text — can you provide the full slide content, including titles and body text?",
        "What is the topic and target audience of this presentation?",
      ],
      needs_revision: true,
    };
  }

  const llm =
    opts?.modelProvider === "openrouter"
      ? modelPicker("openrouter", opts.modelId)
      : modelPicker(opts?.modelId ?? DEFAULT_OLLAMA_MODEL);

  // Scoring must be repeatable across runs; both ChatOllama and ChatOpenAI
  // otherwise default to a sampling temperature that shifts scores between
  // identical inputs.
  llm.temperature = 0;

  // Both providers share BaseChatModel; the cast collapses the union so the
  // overloaded withStructuredOutput signature is callable.
  const structuredLlm = (llm as BaseChatModel).withStructuredOutput<
    z.infer<typeof reviewOutputSchema>
  >(reviewOutputSchema);

  const review = await structuredLlm.invoke([
    { role: "system", content: REVIEWER_SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        slides: input.slides,
        source_context: input.source_context ?? null,
      }),
    },
  ]);

  const { clarity, design, content_accuracy } = review.score;
  const average = (clarity + design + content_accuracy) / 3;
  const hasUnsupportedClaims = review.claim_audit.some(
    (claim) => claim.status === "UNSUPPORTED",
  );
  const needsMoreContext = review.clarifying_questions.length > 0;

  reviewLogger.info("Slide review completed", {
    documentId: input.document_id,
    average,
    hasUnsupportedClaims,
    needsMoreContext,
  });

  return {
    ...review,
    needs_revision:
      average < PASS_THRESHOLD || hasUnsupportedClaims || needsMoreContext,
  };
}
