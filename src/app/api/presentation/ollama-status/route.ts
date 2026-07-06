import { env } from "@/env";
import { createLogger } from "@/lib/observability/logger";
import { auth } from "@/server/auth";
import { NextResponse } from "next/server";

const routeLogger = createLogger("api:presentation-ollama-status");
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

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(OLLAMA_TAGS_URL, {
      cache: "no-store",
      signal: createTimeoutSignal(STATUS_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status}`);
    }

    return NextResponse.json(
      { online: true, checkedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    routeLogger.warn("Ollama status check failed", { error: message });

    return NextResponse.json(
      { online: false, checkedAt, error: message },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
