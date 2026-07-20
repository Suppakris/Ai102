import "server-only";

import { NextResponse } from "next/server";

import { auth } from "@/backend/auth";
import { db } from "@/backend/db";
import { checkRateLimit, rateLimitResponse } from "@/backend/rate-limit";
import { logger } from "@/lib/observability/server/logger";

/**
 * Hard ceiling on what this route will store.
 *
 * Vercel caps serverless request bodies at ~4.5MB. Self-hosted uploads pass
 * through this function (unlike a third-party uploader, where bytes go
 * straight to the vendor), so that platform limit is also our limit — it
 * cannot be raised by changing this constant alone. Images are shrunk
 * client-side before upload and normally land far below it.
 */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Video is deliberately absent. A 64MB upload cannot fit through the request
 * body limit above, so accepting it here would only produce confusing
 * failures — see the 415 message below.
 */
const ALLOWED_MIME_TYPES = new Set([
  // Images (slide art, theme backgrounds, thumbnails)
  "image/webp",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
  // Fonts (custom theme builder)
  "font/woff",
  "font/woff2",
  "font/ttf",
  "font/otf",
  "application/font-woff",
  "application/x-font-ttf",
  "application/x-font-otf",
  "application/vnd.ms-opentype",
  // Documents (editor attachments / source material)
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

// Some browsers report fonts as octet-stream; fall back to the extension.
const EXTENSION_MIME_TYPES: Record<string, string> = {
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};

function resolveMimeType(file: File): string {
  if (ALLOWED_MIME_TYPES.has(file.type)) return file.type;

  const extension = file.name.split(".").pop()?.toLowerCase();
  return (extension && EXTENSION_MIME_TYPES[extension]) || file.type;
}

export async function POST(req: Request) {
  const actionName = "files.upload.post";
  const span = logger.startSpan(`allweone.api.${actionName}`, {
    attributes: {
      "allweone.scope": "api",
      "allweone.action.type": "api_route",
      "allweone.action.name": actionName,
      "http.method": "POST",
      "http.route": "/api/files/upload",
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

    const rateLimit = await checkRateLimit(`files-upload:${session.user.id}`, {
      max: 30,
      windowSeconds: 300,
    });
    if (!rateLimit.allowed) {
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "rate_limited",
      });
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "missing_file",
      });
      return NextResponse.json(
        { error: "Body must be multipart/form-data with a 'file' field" },
        { status: 400 },
      );
    }

    const mimeType = resolveMimeType(file);

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "unsupported_type",
      });
      const isVideo = mimeType.startsWith("video/");
      return NextResponse.json(
        {
          error: isVideo
            ? "Video upload isn't supported. Files are stored on this server, which limits uploads to 4MB — embed a video link instead."
            : `Unsupported file type: ${mimeType || "unknown"}`,
        },
        { status: 415 },
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "too_large",
      });
      return NextResponse.json(
        {
          error: `File is too large (${Math.round(file.size / 1024)}KB). Maximum is ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`,
        },
        { status: 413 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // file.size is client-reported; trust the bytes actually received.
    if (bytes.byteLength === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large" }, { status: 413 });
    }

    const created = await db.uploadedFile.create({
      data: {
        data: bytes,
        mimeType,
        size: bytes.byteLength,
        name: file.name || null,
        userId: session.user.id,
      },
      select: { id: true },
    });

    span.event("allweone.api.file_uploaded", {
      "allweone.file.id": created.id,
      "allweone.file.size": bytes.byteLength,
      "allweone.file.mime_type": mimeType,
    });

    return NextResponse.json({
      id: created.id,
      url: `/api/files/${created.id}`,
      name: file.name || null,
      size: bytes.byteLength,
      type: mimeType,
    });
  } catch (error) {
    span.error(error);
    logger.error("File upload failed", { error });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  } finally {
    span.end();
  }
}
