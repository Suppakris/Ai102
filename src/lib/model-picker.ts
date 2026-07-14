import { env } from "@/env";
import { createLogger } from "@/lib/observability/logger";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";

const modelLogger = createLogger("model-picker");

/**
 * Which backend serves text generation. Ollama remains the local default;
 * setting LLM_PROVIDER=openrouter routes every text request through
 * OpenRouter's OpenAI-compatible API instead — same prompts, same routes,
 * reproducible hosted models for prompt testing. A request may also opt
 * into OpenRouter explicitly by sending modelProvider "openrouter" (used
 * by the slide audit agents) without flipping the whole deployment.
 */
export type TextProvider = "ollama" | "openrouter";

export const TEXT_PROVIDER: TextProvider =
  env.LLM_PROVIDER === "openrouter" ? "openrouter" : "ollama";

function resolveProvider(modelProviderOrModel: string): TextProvider {
  return modelProviderOrModel === "openrouter" ? "openrouter" : TEXT_PROVIDER;
}

const OPENROUTER_BASE_URL =
  env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

/**
 * OpenRouter model used when the client didn't pick one, or picked an
 * Ollama-style id (e.g. "llama3.2:3b") that doesn't exist on OpenRouter.
 * The default is a free-tier model so prompt testing costs nothing.
 */
export const DEFAULT_OPENROUTER_MODEL =
  env.OPENROUTER_DEFAULT_MODEL?.trim() ||
  "meta-llama/llama-3.3-70b-instruct:free";

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
 * (often 2048 tokens) regardless of what the model architecture supports.
 * This app's generation system prompt alone exceeds that, so at Ollama's
 * default the model sees a *truncated* version of its own instructions —
 * a direct cause of format-rule violations (blank slides, duplicated
 * content, ignored density settings).
 *
 * An earlier attempt at raising this was reverted because it pushed a
 * single full-deck request past Vercel Hobby's 60s cap. Generation has
 * since been split into small per-batch requests (2 slides each,
 * finishing in seconds), so the time cost of a larger context no longer
 * threatens the request budget. Default to 8192; OLLAMA_NUM_CTX still
 * overrides for hosts that need something else.
 */
const OLLAMA_NUM_CTX = env.OLLAMA_NUM_CTX ?? 8192;
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

/**
 * OpenRouter model ids are namespaced ("vendor/model"); Ollama tags are not.
 * A client on the openrouter backend may still send a persisted Ollama model
 * selection — map those to the configured OpenRouter default instead of
 * sending an id OpenRouter has never heard of.
 */
function resolveOpenRouterModelId(
  modelProviderOrModel: string,
  modelId?: string,
): string {
  // When a provider name was sent, the model lives in modelId; otherwise the
  // first argument is itself a bare model id.
  const requested =
    modelProviderOrModel === "openrouter" ||
    modelProviderOrModel === "ollama" ||
    LEGACY_PROVIDERS.has(modelProviderOrModel)
      ? modelId?.trim()
      : modelProviderOrModel.trim();

  if (requested?.includes("/")) {
    return requested;
  }
  return DEFAULT_OPENROUTER_MODEL;
}

export function assertModelIsConfigured(
  modelProviderOrModel: string,
  modelId?: string,
) {
  if (resolveProvider(modelProviderOrModel) === "openrouter") {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error(
        "The openrouter provider was selected but OPENROUTER_API_KEY is not configured.",
      );
    }
    modelLogger.info("Model configuration validated", {
      provider: "openrouter",
      modelId: resolveOpenRouterModelId(modelProviderOrModel, modelId),
    });
    return;
  }

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
  if (resolveProvider(modelProviderOrModel) === "openrouter") {
    // Hosted models need no local pull; the key check happens in
    // assertModelIsConfigured and per-request errors surface from the API.
    return;
  }
  const resolvedModelId = resolveModelId(modelProviderOrModel, modelId);
  await ensureOllamaModelIsReady(resolvedModelId);
}

/**
 * Centralized model picker for LangChain-based presentation routes.
 * Ollama-only: every selection resolves to a model served from
 * OLLAMA_BASE_URL's native API.
 *
 * This intentionally uses the native Ollama client, not the OpenAI-compat
 * endpoint: /v1 silently drops Ollama options like num_ctx, so the model
 * always ran at Ollama's default context (4096) no matter what
 * OLLAMA_NUM_CTX was set to. The native API honors numCtx per request.
 */
/** True when a request can opt into the openrouter provider. */
export function isOpenRouterAvailable(): boolean {
  return Boolean(env.OPENROUTER_API_KEY);
}

export function modelPicker(modelProviderOrModel: string, modelId?: string) {
  if (resolveProvider(modelProviderOrModel) === "openrouter") {
    const openRouterModelId = resolveOpenRouterModelId(
      modelProviderOrModel,
      modelId,
    );

    modelLogger.info("Creating OpenRouter model client", {
      provider: "openrouter",
      modelId: openRouterModelId,
      baseUrl: OPENROUTER_BASE_URL,
    });

    return new ChatOpenAI({
      model: openRouterModelId,
      apiKey: env.OPENROUTER_API_KEY,
      configuration: {
        baseURL: OPENROUTER_BASE_URL,
      },
    });
  }

  const resolvedModelId = resolveModelId(modelProviderOrModel, modelId);

  modelLogger.info("Creating Ollama model client", {
    provider: "ollama",
    modelId: resolvedModelId,
    baseUrl: OLLAMA_BASE_URL,
  });

  return new ChatOllama({
    model: resolvedModelId,
    baseUrl: OLLAMA_BASE_URL,
    numCtx: OLLAMA_NUM_CTX,
    ...(OLLAMA_MAX_OUTPUT_TOKENS !== undefined && {
      numPredict: OLLAMA_MAX_OUTPUT_TOKENS,
    }),
  });
}
//0