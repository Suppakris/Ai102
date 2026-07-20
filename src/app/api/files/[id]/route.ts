import "server-only";

import { NextResponse } from "next/server";

import { db } from "@/backend/db";
import { logger } from "@/lib/observability/server/logger";

/**
 * Serves uploaded file bytes.
 *
 * Deliberately unauthenticated: these URLs are embedded in slide content and
 * rendered by the editor, exported decks, thumbnails, and @font-face rules —
 * requiring a session would break all of those. Ids are cuids, so they are not
 * guessable, which is the same "unguessable URL" model the previous
 * third-party host used. Do not use this route for genuinely private files.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let file: { data: Uint8Array; mimeType: string; name: string | null } | null;
  try {
    file = await db.uploadedFile.findUnique({
      where: { id },
      select: { data: true, mimeType: true, name: true },
    });
  } catch (error) {
    // A database outage here would otherwise surface as an unhandled error in
    // an <img> request, which is hard to diagnose from the browser.
    logger.error("Failed to load uploaded file", { error });
    return NextResponse.json({ error: "File unavailable" }, { status: 500 });
  }

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": file.mimeType,
    // Rows are immutable once written, so this can be cached indefinitely.
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Length": String(file.data.byteLength),
    // Fonts are fetched cross-origin by @font-face in exported/preview decks.
    "Access-Control-Allow-Origin": "*",
  };

  // Render images/PDFs inline; anything else downloads under its real name.
  const isInline =
    file.mimeType.startsWith("image/") ||
    file.mimeType.startsWith("font/") ||
    file.mimeType === "application/pdf";
  if (!isInline && file.name) {
    headers["Content-Disposition"] =
      `attachment; filename="${encodeURIComponent(file.name)}"`;
  }

  return new NextResponse(new Uint8Array(file.data), { headers });
}
