import { runVerificationLoop } from "@/ai/agents/verification/pipeline";
import {
  assertModelIsConfigured,
  ensureModelIsReady,
  isOpenRouterAvailable,
} from "@/lib/modelPicker";
import { createLogger } from "@/lib/observability/logger";
import { getLanguageDisplayName } from "@/lib/presentation/languages";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { NextResponse } from "next/server";

// Vercel Hobby caps serverless functions at 60s. The loop makes up to
// (2 * maxAttempts + 1) model calls, so callers on slow local models should
// lower maxAttempts rather than raise it.
export const maxDuration = 60;

interface AuditSlideRequest {
  slideXml?: string;
  /** The outline item this slide was generated from. */
  outline?: string;
  /** Source material (PDF extract, prompt, research) to ground claims in. */
  sourceContext?: string;
  /** Back-compat alias for sourceContext. */
  context?: string;
  language?: string;
  /** Minimum passing overall score, 0-100. Default 80. */
  threshold?: number;
  /** Max audit→improve rounds, 1-5. Default 3. */
  maxAttempts?: number;
  modelProvider?: string;
  modelId?: string;
  /** When set, every audit round is persisted to the SlideAudit table. */
  slideId?: string;
}

const MAX_SLIDE_XML_CHARS = 30_000;
const MAX_CONTEXT_CHARS = 8_000;
// Below this much combined outline + source material there is nothing to
// check claims against — auditing anyway just invites the model to guess.
const MIN_CONTEXT_CHARS = 200;

function clampInt(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const routeLogger = createLogger("api:presentation-audit-slide");

  try {
    routeLogger.info("Slide audit request received", { requestId });
    const session = await auth();
    if (!session) {
      routeLogger.warn("Slide audit request rejected: unauthorized", {
        requestId,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const request = (await req.json()) as AuditSlideRequest;
    const slideXml = request.slideXml?.trim() ?? "";

    if (!slideXml || !slideXml.includes("<SECTION")) {
      routeLogger.warn(
        "Slide audit request rejected: missing or invalid slideXml",
        { requestId, slideXmlLength: slideXml.length },
      );
      return NextResponse.json(
        { error: "slideXml must contain a <SECTION> element" },
        { status: 400 },
      );
    }
    if (slideXml.length > MAX_SLIDE_XML_CHARS) {
      return NextResponse.json(
        { error: `slideXml exceeds ${MAX_SLIDE_XML_CHARS} characters` },
        { status: 400 },
      );
    }

    const threshold = clampInt(request.threshold, 80, 1, 100);
    const maxAttempts = clampInt(request.maxAttempts, 3, 1, 5);
    const outline = (request.outline ?? "").slice(0, MAX_CONTEXT_CHARS);
    const context = (request.sourceContext ?? request.context ?? "").slice(
      0,
      MAX_CONTEXT_CHARS,
    );
    const language = getLanguageDisplayName(request.language || "en-US");
    // The audit agents run on OpenRouter whenever a key is configured —
    // audit quality benefits more from a stronger model than generation
    // does, and it's a low-volume call. Explicit request wins.
    const modelProvider =
      request.modelProvider ??
      (isOpenRouterAvailable() ? "openrouter" : "ollama");

    // Anti-hallucination guard: refuse to audit without enough material to
    // check claims against, instead of letting the model guess.
    if (outline.trim().length + context.trim().length < MIN_CONTEXT_CHARS) {
      routeLogger.warn("Slide audit skipped: insufficient context", {
        requestId,
        outlineLength: outline.trim().length,
        contextLength: context.trim().length,
      });
      return NextResponse.json({
        score: null,
        passed: false,
        insufficientContext: true,
        revisionNotes: [
          "Insufficient outline/source context supplied for audit — generate with more detail or attach source material first.",
        ],
      });
    }

    routeLogger.info("Validated slide audit request", {
      requestId,
      slideXmlLength: slideXml.length,
      outlineLength: outline.length,
      contextLength: context.length,
      language,
      threshold,
      maxAttempts,
      modelProvider,
      modelId: request.modelId,
      slideId: request.slideId,
    });

    try {
      assertModelIsConfigured(modelProvider, request.modelId);
      await ensureModelIsReady(modelProvider, request.modelId);
    } catch (error) {
      routeLogger.error(
        "Slide audit request rejected: model not available",
        error,
        { requestId, modelProvider, modelId: request.modelId },
      );
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Model is not configured for slide auditing",
        },
        { status: 503 },
      );
    }

    const result = await runVerificationLoop({
      slideXml,
      outline,
      context,
      language,
      threshold,
      maxAttempts,
      modelProviderOrModel: modelProvider,
      modelId: request.modelId,
    });

    if (request.slideId) {
      // One SlideAudit row per audit round; the reviewer report lands on
      // the final round's row. A failed insert must not fail the audit —
      // the report is still returned to the caller.
      try {
        await db.slideAudit.createMany({
          data: result.attempts.map((attempt, index) => ({
            slideId: request.slideId as string,
            round: attempt.attempt,
            score: attempt.score,
            pass: attempt.passed,
            claims: JSON.parse(JSON.stringify(attempt.claims)),
            revisionNotes: JSON.parse(JSON.stringify(attempt.issues)),
            reviewerNotes:
              index === result.attempts.length - 1
                ? JSON.parse(JSON.stringify(result.review))
                : undefined,
          })),
        });
      } catch (error) {
        routeLogger.error("Failed to persist slide audit rounds", error, {
          requestId,
          slideId: request.slideId,
        });
      }
    }

    routeLogger.info("Slide audit completed", {
      requestId,
      passed: result.passed,
      finalScore: result.verdict.score,
      attemptCount: result.attempts.length,
      reviewerAgreement: result.review.agreement,
      adjustedScore: result.review.adjustedScore,
    });

    return NextResponse.json(result);
  } catch (error) {
    routeLogger.error("Slide audit failed", error, { requestId });
    return NextResponse.json(
      { error: "Failed to audit slide" },
      { status: 500 },
    );
  }
}
