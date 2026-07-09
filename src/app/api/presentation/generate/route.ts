import { toUIMessageStream } from "@ai-sdk/langchain";
import { RunnableSequence } from "@langchain/core/runnables";
import { createUIMessageStreamResponse } from "ai";
import { NextResponse } from "next/server";

import {
  assertModelIsConfigured,
  DEFAULT_OLLAMA_MODEL,
  ensureModelIsReady,
  modelPicker,
} from "@/lib/modelPicker";
import { createLogger } from "@/lib/observability/logger";
import {
  buildPresentationPromptValues,
  presentationGenerationPromptTemplate,
  type PresentationGenerationPromptInput,
} from "@/lib/presentation/generation-prompt";
import { getLanguageDisplayName } from "@/lib/presentation/languages";
import { auth } from "@/server/auth";

// Vercel Hobby caps serverless functions at 60s. Deck generation on a free
// (rate-limited) provider can run long, so claim the full budget.
export const maxDuration = 60;

type SlidesRequest = Omit<PresentationGenerationPromptInput, "currentDate"> & {
  modelId?: string;
  modelProvider?: "ollama";
  presentationId?: string;
};

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const routeLogger = createLogger("api:presentation-generate");

  try {
    routeLogger.info("Presentation generation request received", { requestId });
    const session = await auth();
    if (!session) {
      routeLogger.warn("Presentation generation request rejected: unauthorized", {
        requestId,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const request = (await req.json()) as SlidesRequest;
    const { modelId, modelProvider = "ollama" } = request;

    if (
      !request.title ||
      !request.outline ||
      !Array.isArray(request.outline) ||
      !request.language
    ) {
      routeLogger.warn(
        "Presentation generation request rejected: missing required fields",
        {
          requestId,
          hasTitle: Boolean(request.title),
          hasOutline: Array.isArray(request.outline),
          language: request.language,
        },
      );
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const totalSlides = request.outline.length;
    const templateCount = request.selectedTemplateCount ?? 0;

    const currentDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    routeLogger.info("Validated presentation generation request", {
      requestId,
      title: request.title,
      totalSlides,
      language: request.language,
      tone: request.tone,
      modelProvider,
      modelId: modelId || DEFAULT_OLLAMA_MODEL,
      imageSource: request.imageSource || "automatic",
      templateCount,
      searchResultGroupCount: request.searchResults?.length ?? 0,
      imageSearchResultGroupCount: request.imageSearchResults?.length ?? 0,
      selectedChunkCount: request.selectedChunks?.length ?? 0,
      presentationId: request.presentationId,
    });

    try {
      assertModelIsConfigured(modelProvider, modelId);
    } catch (error) {
      routeLogger.error(
        "Presentation generation request rejected: invalid model configuration",
        error,
        {
          requestId,
          modelProvider,
          modelId: modelId || DEFAULT_OLLAMA_MODEL,
        },
      );
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid model configuration",
        },
        { status: 400 },
      );
    }

    try {
      await ensureModelIsReady(modelProvider, modelId);
    } catch (error) {
      routeLogger.error(
        "Presentation generation request rejected: selected model could not be prepared",
        error,
        {
          requestId,
          modelProvider,
          modelId: modelId || DEFAULT_OLLAMA_MODEL,
        },
      );
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to prepare selected model",
        },
        { status: 503 },
      );
    }

    const model = modelPicker(modelProvider, modelId);
    const chain = RunnableSequence.from([
      presentationGenerationPromptTemplate,
      model,
    ]);

    routeLogger.info("Presentation generation started", {
      requestId,
      title: request.title,
      totalSlides,
      modelProvider,
      modelId: modelId || DEFAULT_OLLAMA_MODEL,
    });

    const stream = await chain.stream(
      buildPresentationPromptValues({
        ...request,
        language: getLanguageDisplayName(request.language),
        currentDate,
      }),
    );

    routeLogger.info("Presentation generation stream created", {
      requestId,
      title: request.title,
      totalSlides,
    });

    return createUIMessageStreamResponse({ stream: toUIMessageStream(stream) });
  } catch (error) {
    routeLogger.error("Presentation generation failed", error, { requestId });
    return NextResponse.json(
      { error: "Failed to generate presentation slides" },
      { status: 500 },
    );
  }
}
