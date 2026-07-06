import { env } from "@/env";
import { createLogger } from "@/lib/observability/logger";
import { ChatOpenAI } from "@langchain/openai";

const modelLogger = createLogger("model-picker");
const OLLAMA_BASE_URL = env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_TAGS_URL = `${OLLAMA_BASE_URL}/api/tags`;
const OLLAMA_PULL_URL = `${OLLAMA_BASE_URL}/api/pull`;

/**
 * The Ollama model used whenever a request does not carry an explicit model
 * selection (internal features like diagrams and single-slide regeneration,
 * or stale clients still sending a removed cloud provider).
 */
export const DEFAULT_OLLAMA_MODEL =
  env.OLLAMA_DEFAULT_MODEL?.trim() || "llama3.2:3b";

/**
 * Ollama loads most local models with a small default context window
 * (often 2048 tokens) regardless of what the model architecture supports,
 * which can truncate a long presentation generation mid-deck. Raising it
 * helps that, but also makes each token slower to generate — on a slow or
 * CPU-only host this can push a deck generation past the platform's hard
 * request-duration limit (e.g. Vercel Hobby's 60s cap), turning a partial
 * result into a total failure. There's no safe one-size-fits-all default
 * since it depends entirely on the host machine's speed, so these are
 * opt-in only: unset (the default), Ollama's own defaults apply unchanged.
 */
const OLLAMA_NUM_CTX = env.OLLAMA_NUM_CTX;
const OLLAMA_MAX_OUTPUT_TOKENS = env.OLLAMA_MAX_OUTPUT_TOKENS;

/** Provider names older clients may still send from persisted state. */
const LEGACY_PROVIDERS = new Set(["openai", "lmstudio"]);

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

interface OllamaPullProgressChunk {
  status?: string;
  error?: string;
  completed?: number;
  total?: number;
}

function resolveModelId(
  modelProviderOrModel: string,
  modelId?: string,
): string {
  if (modelProviderOrModel === "ollama") {
    return modelId?.trim() || DEFAULT_OLLAMA_MODEL;
  }

  if (LEGACY_PROVIDERS.has(modelProviderOrModel)) {
    modelLogger.warn(
      "Received a removed model provider; falling back to the default Ollama model",
      {
        legacyProvider: modelProviderOrModel,
        legacyModelId: modelId,
        modelId: DEFAULT_OLLAMA_MODEL,
      },
    );
    return DEFAULT_OLLAMA_MODEL;
  }

  // A bare model id (no provider) — treat it as an Ollama model.
  return modelProviderOrModel.trim() || DEFAULT_OLLAMA_MODEL;
}

async function fetchInstalledOllamaModels(): Promise<Set<string>> {
  let response: Response;
  try {
    response = await fetch(OLLAMA_TAGS_URL, { method: "GET", cache: "no-store" });
  } catch (error) {
    modelLogger.error("Ollama tags request threw", error, { url: OLLAMA_TAGS_URL });
    throw new Error(
      `Failed to reach Ollama at ${OLLAMA_TAGS_URL}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    modelLogger.error("Ollama tags request failed", undefined, {
      url: OLLAMA_TAGS_URL,
      status: response.status,
      statusText: response.statusText,
      bodySnippet: bodyText.slice(0, 300),
    });
    throw new Error(
      `Ollama is not available (status ${response.status}: ${response.statusText}). ${bodyText.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as OllamaTagsResponse;
  const installedModels = new Set(
    (data.models ?? [])
      .map((model) => model.name?.trim())
      .filter((name): name is string => Boolean(name)),
  );

  return installedModels;
}

async function ensureOllamaModelIsReady(modelId: string): Promise<void> {
  const installedModels = await fetchInstalledOllamaModels();
  if (installedModels.has(modelId)) {
    modelLogger.info("Ollama model already installed", {
      provider: "ollama",
      modelId,
    });
    return;
  }

  modelLogger.info("Ollama model missing; starting download", {
    provider: "ollama",
    modelId,
  });

  const response = await fetch(OLLAMA_PULL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: modelId,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download Ollama model "${modelId}". Ensure Ollama is running and try again.`,
    );
  }

  if (!response.body) {
    throw new Error(
      `Ollama did not return a download stream for model "${modelId}".`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastStatus: string | undefined;
  const processProgressLine = (line: string): void => {
    let chunk: OllamaPullProgressChunk;
    try {
      chunk = JSON.parse(line) as OllamaPullProgressChunk;
    } catch (error) {
      modelLogger.warn("Failed to parse Ollama pull progress chunk", {
        provider: "ollama",
        modelId,
        line,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    if (chunk.error) {
      throw new Error(
        `Failed to download Ollama model "${modelId}": ${chunk.error}`,
      );
    }

    if (chunk.status) {
      lastStatus = chunk.status;
    }
  };

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }
      processProgressLine(line);
    }
  }

  if (buffer.trim()) {
    processProgressLine(buffer.trim());
  }

  const refreshedModels = await fetchInstalledOllamaModels();
  if (!refreshedModels.has(modelId)) {
    throw new Error(
      `Ollama finished downloading "${modelId}" but the model is still unavailable. Last status: ${lastStatus ?? "unknown"}.`,
    );
  }

  modelLogger.info("Ollama model download completed", {
    provider: "ollama",
    modelId,
    lastStatus: lastStatus ?? "unknown",
  });
}

export function assertModelIsConfigured(
  modelProviderOrModel: string,
  modelId?: string,
) {
  const resolvedModelId = resolveModelId(modelProviderOrModel, modelId);

  modelLogger.info("Model configuration validated", {
    provider: "ollama",
    modelId: resolvedModelId,
  });
}

export async function ensureModelIsReady(
  modelProviderOrModel: string,
  modelId?: string,
) {
  const resolvedModelId = resolveModelId(modelProviderOrModel, modelId);
  await ensureOllamaModelIsReady(resolvedModelId);
}

/**
 * Centralized model picker for LangChain-based presentation routes.
 * Ollama-only: every selection resolves to a model served from
 * OLLAMA_BASE_URL's OpenAI-compatible endpoint.
 */
export function modelPicker(modelProviderOrModel: string, modelId?: string) {
  const resolvedModelId = resolveModelId(modelProviderOrModel, modelId);

  modelLogger.info("Creating Ollama model client", {
    provider: "ollama",
    modelId: resolvedModelId,
    baseUrl: `${OLLAMA_BASE_URL}/v1`,
  });

  return new ChatOpenAI({
    model: resolvedModelId,
    apiKey: "ollama",
    ...(OLLAMA_MAX_OUTPUT_TOKENS !== undefined && {
      maxTokens: OLLAMA_MAX_OUTPUT_TOKENS,
    }),
    configuration: {
      baseURL: `${OLLAMA_BASE_URL}/v1`,
    },
    ...(OLLAMA_NUM_CTX !== undefined && {
      modelKwargs: {
        options: {
          num_ctx: OLLAMA_NUM_CTX,
        },
      },
    }),
  });
}
//0