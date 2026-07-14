import {
  type ClarifyAnswer,
  runClarify,
} from "@/ai/agents/clarify/clarify";
import {
  assertModelIsConfigured,
  ensureModelIsReady,
  isOpenRouterAvailable,
} from "@/lib/modelPicker";
import { createLogger } from "@/lib/observability/logger";
import { auth } from "@/server/auth";
import { NextResponse } from "next/server";

export const maxDuration = 60;

interface ClarifyRequest {
  prompt?: string;
  sourceDocumentName?: string;
  /** Empty/absent on the first call (returns questions); filled on the second (returns the refined brief). */
  answers?: ClarifyAnswer[];
  modelProvider?: string;
  modelId?: string;
}

const MAX_PROMPT_CHARS = 4_000;
const MAX_ANSWERS = 6;

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const routeLogger = createLogger("api:presentation-clarify");

  try {
    routeLogger.info("Clarify request received", { requestId });
    const session = await auth();
    if (!session) {
      routeLogger.warn("Clarify request rejected: unauthorized", { requestId });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const request = (await req.json()) as ClarifyRequest;
    const prompt = (request.prompt ?? "").slice(0, MAX_PROMPT_CHARS);
    const sourceDocumentName = request.sourceDocumentName?.slice(0, 300);

    if (!prompt.trim() && !sourceDocumentName) {
      return NextResponse.json(
        { error: "prompt or sourceDocumentName is required" },
        { status: 400 },
      );
    }

    const answers: ClarifyAnswer[] = Array.isArray(request.answers)
      ? request.answers
          .map((a) => ({
            question: String(a?.question ?? "").slice(0, 500),
            answer: String(a?.answer ?? "").slice(0, 500),
          }))
          .filter((a) => a.question && a.answer)
          .slice(0, MAX_ANSWERS)
      : [];

    // Same auto-pick as the audit route: hosted model when a key exists,
    // local Ollama otherwise. Explicit request wins.
    const modelProvider =
      request.modelProvider ??
      (isOpenRouterAvailable() ? "openrouter" : "ollama");

    routeLogger.info("Validated clarify request", {
      requestId,
      promptLength: prompt.length,
      answerCount: answers.length,
      modelProvider,
      modelId: request.modelId,
    });

    try {
      assertModelIsConfigured(modelProvider, request.modelId);
      await ensureModelIsReady(modelProvider, request.modelId);
    } catch (error) {
      routeLogger.error("Clarify request rejected: model not available", error, {
        requestId,
        modelProvider,
      });
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Model is not configured for clarification",
        },
        { status: 503 },
      );
    }

    const result = await runClarify({
      prompt,
      sourceDocumentName,
      answers,
      modelProviderOrModel: modelProvider,
      modelId: request.modelId,
    });

    routeLogger.info("Clarify completed", {
      requestId,
      ready: result.ready,
      ...(result.ready
        ? { refinedPromptLength: result.refinedPrompt.length }
        : { questionCount: result.questions.length }),
    });

    return NextResponse.json(result);
  } catch (error) {
    routeLogger.error("Clarify failed", error, { requestId });
    return NextResponse.json(
      { error: "Failed to clarify the topic" },
      { status: 500 },
    );
  }
}
