import { runVerificationLoop } from "@/ai/agents/verification/pipeline";
import {
  assertModelIsConfigured,
  DEFAULT_OLLAMA_MODEL,
  ensureModelIsReady,
} from "@/lib/modelPicker";
import { createLogger } from "@/lib/observability/logger";
import { getLanguageDisplayName } from "@/lib/presentation/languages";
import { auth } from "@/server/auth";
import { NextResponse } from "next/server";

// Vercel Hobby caps serverless functions at 60s. The loop makes up to
// (2 * maxAttempts + 1) model calls, so callers on slow local models should
// lower maxAttempts rather than raise it.
export const maxDuration = 60;

interface VerifyRequest {
  slideXml?: string;
  /** Source material (outline item, PDF extract, prompt) to ground claims in. */
  context?: string;
  language?: string;
  /** Minimum passing overall score, 1-10. Default 7. */
  threshold?: number;
  /** Max verify→improve rounds, 1-5. Default 3. */
  maxAttempts?: number;
  modelProvider?: string;
  modelId?: string;
}

const MAX_SLIDE_XML_CHARS = 30_000;
const MAX_CONTEXT_CHARS = 8_000;

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
  const routeLogger = createLogger("api:presentation-verify");

  try {
    routeLogger.info("Slide verification request received", { requestId });
    const session = await auth();
    if (!session) {
      routeLogger.warn("Slide verification request rejected: unauthorized", {
        requestId,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const request = (await req.json()) as VerifyRequest;
    const slideXml = request.slideXml?.trim() ?? "";

    if (!slideXml || !slideXml.includes("<SECTION")) {
      routeLogger.warn(
        "Slide verification request rejected: missing or invalid slideXml",
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

    const threshold = clampInt(request.threshold, 7, 1, 10);
    const maxAttempts = clampInt(request.maxAttempts, 3, 1, 5);
    const modelProvider = request.modelProvider ?? "ollama";
    const context = (request.context ?? "").slice(0, MAX_CONTEXT_CHARS);
    const language = getLanguageDisplayName(request.language || "en-US");

    routeLogger.info("Validated slide verification request", {
      requestId,
      slideXmlLength: slideXml.length,
      contextLength: context.length,
      language,
      threshold,
      maxAttempts,
      modelProvider,
      modelId: request.modelId || DEFAULT_OLLAMA_MODEL,
    });

    try {
      assertModelIsConfigured(modelProvider, request.modelId);
      await ensureModelIsReady(modelProvider, request.modelId);
    } catch (error) {
      routeLogger.error(
        "Slide verification request rejected: model not available",
        error,
        { requestId, modelProvider, modelId: request.modelId },
      );
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Model is not configured for verification",
        },
        { status: 503 },
      );
    }

    const result = await runVerificationLoop({
      slideXml,
      context,
      language,
      threshold,
      maxAttempts,
      modelProviderOrModel: modelProvider,
      modelId: request.modelId,
    });

    routeLogger.info("Slide verification completed", {
      requestId,
      passed: result.passed,
      finalScore: result.verdict.score,
      attemptCount: result.attempts.length,
      reviewerVerdict: result.review.verdict,
    });

    return NextResponse.json(result);
  } catch (error) {
    routeLogger.error("Slide verification failed", error, { requestId });
    return NextResponse.json(
      { error: "Failed to verify slide" },
      { status: 500 },
    );
  }
}
