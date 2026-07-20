"use client";

import { useCallback, useState } from "react";

import {
  type UploadedFileResult,
  type UploadProgressEvent,
  uploadFilesToServer,
} from "@/lib/upload/client";

/**
 * Replacement for the third-party uploader's React helpers, backed by this
 * app's own /api/files/upload route.
 *
 * The signatures deliberately mirror the old ones (route slug first, results
 * carrying `ufsUrl`) so existing call sites keep working — the storage moved,
 * the calling convention did not.
 */

/**
 * Route slugs kept from the previous uploader. They no longer select a
 * server-side route — one endpoint handles everything and validates by MIME
 * type — but they still tell us whether to shrink the file.
 */
export type UploadRoute = "imageUploader" | "editorUploader" | "fontUploader";

/** Fonts and documents must be byte-exact; only images get re-encoded. */
function shouldSkipShrink(route: UploadRoute): boolean {
  return route === "fontUploader";
}

export type UploadCallbacks = {
  onClientUploadComplete?: (results: UploadedFileResult[]) => void;
  onUploadError?: (error: Error) => void;
  onUploadProgress?: (event: UploadProgressEvent) => void;
};

export async function uploadFiles(
  route: UploadRoute,
  {
    files,
    onUploadProgress,
  }: { files: File[]; onUploadProgress?: (event: UploadProgressEvent) => void },
): Promise<UploadedFileResult[]> {
  return uploadFilesToServer(files, {
    onUploadProgress,
    skipShrink: shouldSkipShrink(route),
  });
}

export function useUploadThing(
  route: UploadRoute,
  callbacks: UploadCallbacks = {},
) {
  const [isUploading, setIsUploading] = useState(false);
  const { onClientUploadComplete, onUploadError, onUploadProgress } = callbacks;

  const startUpload = useCallback(
    async (files: File[]): Promise<UploadedFileResult[] | undefined> => {
      setIsUploading(true);
      try {
        const results = await uploadFilesToServer(files, {
          onUploadProgress,
          skipShrink: shouldSkipShrink(route),
        });
        onClientUploadComplete?.(results);
        return results;
      } catch (error) {
        const normalized =
          error instanceof Error ? error : new Error("Upload failed");
        // Callers that pass onUploadError handle it themselves; those that
        // don't should still see the failure rather than a silent no-op.
        if (onUploadError) {
          onUploadError(normalized);
          return undefined;
        }
        throw normalized;
      } finally {
        setIsUploading(false);
      }
    },
    [route, onClientUploadComplete, onUploadError, onUploadProgress],
  );

  return { startUpload, isUploading };
}

export type { UploadedFileResult };
