import "server-only";

import { NextResponse } from "next/server";

import {
  type ReviewSlidesInput,
  reviewAndRevise,
  reviewSlides,
} from "@/backend/ai/reviewSlides";
import { auth } from "@/backend/auth";
import { checkRateLimit, rateLimitResponse } from "@/backend/rate-limit";
import { logger } from "@/lib/observability/server/logger";

type ReviewDeckRequest = {
  document_id: string;
  slides: Array<{ slide_number: number; content: string }>;
  source_context?: string;
  /** When true, a failing deck gets one corrective pass (reviewAndRevise). */
  revise?: boolean;
  modelProvider?: string;
  modelId?: string;
};

function isReviewDeckRequest(value: unknown): value is ReviewDeckRequest {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ReviewDeckRequest>;
  return (
    typeof candidate.document_id === "string" &&
    Array.isArray(candidate.slides) &&
    candidate.slides.every(
      (slide) =>
        !!slide &&
        typeof slide === "object" &&
        typeof (slide as { slide_number?: unknown }).slide_number ===
          "number" &&
        typeof (slide as { content?: unknown }).content === "string",
    ) &&
    (candidate.source_context === undefined ||
      typeof candidate.source_context === "string") &&
    (candidate.revise === undefined || typeof candidate.revise === "boolean") &&
    (candidate.modelProvider === undefined ||
      typeof candidate.modelProvider === "string") &&
    (candidate.modelId === undefined || typeof candidate.modelId === "string")
  );
}

/**
 * The Ollama backend lives behind a tunnel that can go down at any time; a
 * connection-level failure means "backend offline", not a bug in this route.
 */
function isUpstreamUnreachable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = [error.message, String(error.cause ?? "")].join(" ");
  return /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|UND_ERR|socket hang up/i.test(
    text,
  );
}

export async function POST(req: Request) {
  const actionName = "presentation.review_deck.post";
  const span = logger.startSpan(`allweone.api.${actionName}`, {
    attributes: {
      "allweone.scope": "api",
      "allweone.action.type": "api_route",
      "allweone.action.name": actionName,
      "http.method": "POST",
      "http.route": "/api/presentation/review-deck",
    },
  });

  try {
    const session = await auth();
    if (!session) {
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // A review is 1-2 LLM calls (3 with revision), so the window is tighter
    // than the generation routes'.
    const rateLimit = await checkRateLimit(
      `presentation-review-deck:${session.user.id}`,
      { max: 10, windowSeconds: 300 },
    );
    if (!rateLimit.allowed) {
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "rate_limited",
      });
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const body: unknown = await req.json();
    if (!isReviewDeckRequest(body) || body.slides.length === 0) {
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "invalid_body",
      });
      return NextResponse.json(
        {
          error:
            "Body must include document_id and a non-empty slides array of { slide_number, content }",
        },
        { status: 400 },
      );
    }

    const input: ReviewSlidesInput = {
      // Identity comes from the session, never from the request body.
      user_id: session.user.id,
      document_id: body.document_id,
      slides: body.slides,
      source_context: body.source_context,
    };
    const opts =
      body.modelProvider || body.modelId
        ? { modelProvider: body.modelProvider, modelId: body.modelId }
        : undefined;

    const result = body.revise
      ? await reviewAndRevise(input, opts)
      : await reviewSlides(input, opts);

    span.event("allweone.api.review_completed", {
      "allweone.review.needs_revision": result.needs_revision,
    });
    return NextResponse.json(result);
  } catch (error) {
    span.error(error);
    if (isUpstreamUnreachable(error)) {
      return NextResponse.json(
        {
          error:
            "The AI review server is unreachable right now. It may be offline — try again in a few minutes.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Failed to review the deck" },
      { status: 500 },
    );
  } finally {
    span.end();
  }
}
