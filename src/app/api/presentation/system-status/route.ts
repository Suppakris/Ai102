import { env } from "@/env";
import { createLogger } from "@/lib/observability/logger";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { NextResponse } from "next/server";

const routeLogger = createLogger("api:presentation-system-status");
const OLLAMA_BASE_URL = env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_TAGS_URL = `${OLLAMA_BASE_URL}/api/tags`;
const STATUS_FETCH_TIMEOUT_MS = 5_000;

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener("abort", () => clearTimeout(timeout), {
    once: true,
  });
  return controller.signal;
}

async function checkOllama(): Promise<{ online: boolean; error?: string }> {
  try {
    const response = await fetch(OLLAMA_TAGS_URL, {
      cache: "no-store",
      signal: createTimeoutSignal(STATUS_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status}`);
    }

    return { online: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    routeLogger.warn("Ollama status check failed", { error: message });
    return { online: false, error: message };
  }
}

async function checkDatabase(): Promise<{ online: boolean; error?: string }> {
  try {
    await db.$queryRaw`SELECT 1`;
    return { online: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    routeLogger.warn("Database status check failed", { error: message });
    return { online: false, error: message };
  }
}

// Config-presence checks, not live pings: these are optional integrations
// that degrade gracefully when unset (see src/lib/env/optional-integrations.ts),
// so "is it configured" is the actionable signal, not "is it reachable".
function checkIntegrationConfig() {
  return {
    falImages: Boolean(env.FAL_API_KEY),
    togetherAiImages: Boolean(env.TOGETHER_AI_API_KEY),
    uploadthing: Boolean(env.UPLOADTHING_TOKEN),
    tavilySearch: Boolean(env.TAVILY_API_KEY),
    unsplashImages: Boolean(env.UNSPLASH_ACCESS_KEY),
    googleImageSearch: Boolean(
      env.GOOGLE_CUSTOM_SEARCH_API_KEY && env.SEARCH_ENGINE_CX,
    ),
  };
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();
  const [ollama, database] = await Promise.all([
    checkOllama(),
    checkDatabase(),
  ]);

  return NextResponse.json(
    {
      checkedAt,
      ollama,
      database,
      integrations: checkIntegrationConfig(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
