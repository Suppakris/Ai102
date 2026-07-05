import { env } from "@/env";
import { createLogger } from "@/lib/observability/logger";
import { auth } from "@/server/auth";
import { NextResponse } from "next/server";

interface LocalModelInfo {
  id: string;
  name: string;
  provider: "ollama";
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

const routeLogger = createLogger("api:presentation-local-models");
const OLLAMA_BASE_URL = env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_TAGS_URL = `${OLLAMA_BASE_URL}/api/tags`;
const LOCAL_FETCH_TIMEOUT_MS = 15_000;

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener("abort", () => clearTimeout(timeout), {
    once: true,
  });
  return controller.signal;
}

function dedupeModels(models: LocalModelInfo[]): LocalModelInfo[] {
  const seen = new Set<string>();

  return models.filter((model) => {
    if (seen.has(model.id)) {
      return false;
    }

    seen.add(model.id);
    return true;
  });
}

async function fetchOllamaModels(): Promise<LocalModelInfo[]> {
  try {
    const response = await fetch(OLLAMA_TAGS_URL, {
      cache: "no-store",
      signal: createTimeoutSignal(LOCAL_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status}`);
    }

    const data = (await response.json()) as OllamaTagsResponse;
    return (data.models ?? [])
      .map((model) => model.name?.trim())
      .filter((name): name is string => Boolean(name))
      .map((name) => ({
        id: `ollama-${name}`,
        name,
        provider: "ollama" as const,
      }));
  } catch (error) {
    routeLogger.warn("Failed to fetch Ollama models", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ollamaModels = await fetchOllamaModels();

  return NextResponse.json(
    {
      models: dedupeModels(ollamaModels),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
