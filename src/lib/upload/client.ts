/**
 * Client-side upload against this app's own storage (POST /api/files/upload).
 *
 * Replaces the third-party uploader the project used to depend on. The
 * important behavioural difference: bytes travel through our own serverless
 * function, which Vercel limits to ~4.5MB per request, so images are shrunk
 * in the browser before being sent.
 */

export type UploadedFileResult = {
  key: string;
  name: string | null;
  size: number;
  type: string;
  url: string;
  /**
   * Kept for compatibility with the call sites written against the previous
   * uploader, which read `ufsUrl`. Same value as `url`.
   */
  ufsUrl: string;
  appUrl: string;
};

/** Longest edge, in pixels, an uploaded raster image is resized down to. */
const MAX_IMAGE_DIMENSION = 1600;
const WEBP_QUALITY = 0.85;

/**
 * Formats that must not be re-encoded: SVG is vector (rasterising it loses
 * that), and GIF would lose its animation.
 */
const NON_RESIZABLE_IMAGE_TYPES = new Set(["image/svg+xml", "image/gif"]);

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Resizes an image to fit MAX_IMAGE_DIMENSION and re-encodes it as WebP.
 *
 * Returns the original file unchanged if it isn't a resizable image, or if
 * anything goes wrong — a failed optimisation should never block an upload
 * that would otherwise have succeeded.
 */
export async function shrinkImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (NON_RESIZABLE_IMAGE_TYPES.has(file.type)) return file;
  if (typeof document === "undefined") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
    if (!blob) return file;

    // Re-encoding can occasionally produce a *larger* file than the original
    // (already-optimised JPEGs, mostly). Keep whichever is smaller.
    if (blob.size >= file.size && scale === 1) return file;

    const renamed = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${renamed}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

export type UploadProgressEvent = { file: string; progress: number };

export type UploadOptions = {
  onUploadProgress?: (event: UploadProgressEvent) => void;
  /** Skip client-side shrinking (e.g. for fonts and documents). */
  skipShrink?: boolean;
};

async function readErrorMessage(xhr: XMLHttpRequest): Promise<string> {
  try {
    const parsed: unknown = JSON.parse(xhr.responseText);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { error?: unknown }).error === "string"
    ) {
      return (parsed as { error: string }).error;
    }
  } catch {
    // fall through to the generic message below
  }

  if (xhr.status === 401) return "You need to be signed in to upload files.";
  if (xhr.status === 429) return "Too many uploads. Please wait and try again.";
  return `Upload failed (${xhr.status})`;
}

/**
 * Uploads one file. Uses XMLHttpRequest rather than fetch because the call
 * sites display a progress bar, and fetch cannot report upload progress.
 */
export async function uploadFile(
  file: File,
  options: UploadOptions = {},
): Promise<UploadedFileResult> {
  const prepared = options.skipShrink ? file : await shrinkImageFile(file);

  const formData = new FormData();
  formData.append("file", prepared);

  return new Promise<UploadedFileResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files/upload");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      options.onUploadProgress?.({
        file: prepared.name,
        progress: Math.min(100, Math.round((event.loaded / event.total) * 100)),
      });
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        void readErrorMessage(xhr).then((message) =>
          reject(new Error(message)),
        );
        return;
      }

      try {
        const body = JSON.parse(xhr.responseText) as {
          id: string;
          url: string;
          name: string | null;
          size: number;
          type: string;
        };

        options.onUploadProgress?.({ file: prepared.name, progress: 100 });
        resolve({
          key: body.id,
          name: body.name,
          size: body.size,
          type: body.type,
          url: body.url,
          ufsUrl: body.url,
          appUrl: body.url,
        });
      } catch {
        reject(new Error("Upload succeeded but the response was unreadable"));
      }
    };

    xhr.onerror = () =>
      reject(new Error("Network error while uploading. Check your connection."));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));

    xhr.send(formData);
  });
}

export async function uploadFilesToServer(
  files: File[],
  options: UploadOptions = {},
): Promise<UploadedFileResult[]> {
  const results: UploadedFileResult[] = [];
  for (const file of files) {
    results.push(await uploadFile(file, options));
  }
  return results;
}
