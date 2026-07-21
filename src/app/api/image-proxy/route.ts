import "server-only";

import { NextResponse } from "next/server";

import { auth } from "@/backend/auth";
import { checkRateLimit, rateLimitResponse } from "@/backend/rate-limit";
import { logger } from "@/lib/observability/server/logger";

// Slide export (pptxgenjs/canvas capture) needs remote images as bytes it can
// embed directly -- fetching them from the browser either taints the canvas
// or silently fails when the source doesn't send permissive CORS headers
// (Pollinations, Google image search results, etc.). This route fetches on
// the server instead, where CORS doesn't apply, and hands the bytes back.
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fc[0-9a-f][0-9a-f]:/i,
  /^\[?fd[0-9a-f][0-9a-f]:/i,
  /\.local$/i,
  /\.internal$/i,
];

function isBlockedHostname(hostname: string): boolean {
  return BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}

function parseAllowedUrl(rawUrl: string | null): URL | null {
  if (!rawUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (isBlockedHostname(parsed.hostname)) {
    return null;
  }

  return parsed;
}

export async function GET(req: Request) {
  const actionName = "presentation.image_proxy.get";
  const span = logger.startSpan(`allweone.api.${actionName}`, {
    attributes: {
      "allweone.scope": "api",
      "allweone.action.type": "api_route",
      "allweone.action.name": actionName,
      "http.method": "GET",
      "http.route": "/api/image-proxy",
    },
  });

  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(
      `image-proxy:${session.user.id}`,
      { max: 120, windowSeconds: 300 },
    );
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const { searchParams } = new URL(req.url);
    const target = parseAllowedUrl(searchParams.get("url"));
    if (!target) {
      return NextResponse.json(
        { error: "A valid http(s) image url is required." },
        { status: 400 },
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let upstream: Response;
    try {
      upstream = await fetch(target, {
        signal: controller.signal,
        headers: { Accept: "image/*" },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream image request failed with status ${upstream.status}.` },
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Upstream response was not an image." },
        { status: 502 },
      );
    }

    const contentLength = upstream.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large." }, { status: 502 });
    }

    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large." }, { status: 502 });
    }

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    span.error(error);
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      { error: isTimeout ? "Image request timed out." : "Failed to proxy image." },
      { status: isTimeout ? 504 : 500 },
    );
  } finally {
    span.end();
  }
}
