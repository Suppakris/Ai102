import * as React from "react";
import { toast } from "sonner";
import * as z from "zod";

import {
  type UploadedFileResult,
  type UploadProgressEvent,
  uploadFile as uploadToServer,
} from "@/lib/upload/client";

export type UploadedFile = UploadedFileResult;

interface UseUploadFileProps {
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadError?: (error: unknown) => void;
  onUploadBegin?: (fileName: string) => void;
  onUploadProgress?: (event: UploadProgressEvent) => void;
}

export function useUploadFile({
  onUploadComplete,
  onUploadError,
  onUploadBegin,
  onUploadProgress,
}: UseUploadFileProps = {}) {
  const [uploadedFile, setUploadedFile] = React.useState<UploadedFile>();
  const [uploadingFile, setUploadingFile] = React.useState<File>();
  const [progress, setProgress] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState(false);

  async function uploadFile(file: File) {
    setIsUploading(true);
    setUploadingFile(file);
    onUploadBegin?.(file.name);

    try {
      const result = await uploadToServer(file, {
        onUploadProgress: (event) => {
          setProgress(Math.min(event.progress, 100));
          onUploadProgress?.(event);
        },
      });

      setUploadedFile(result);
      onUploadComplete?.(result);

      return result;
    } catch (error) {
      // Previously this fell back to a mock upload backed by
      // URL.createObjectURL, which looked like success but produced a URL that
      // only existed in the current tab — the image silently disappeared on
      // reload. Surfacing the real failure is the honest behaviour.
      toast.error(getErrorMessage(error));
      onUploadError?.(error);

      return undefined;
    } finally {
      setProgress(0);
      setIsUploading(false);
      setUploadingFile(undefined);
    }
  }

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadFile,
    uploadingFile,
  };
}

export function showErrorToast(error: unknown) {
  toast.error(getErrorMessage(error));
}

export function getErrorMessage(err: unknown) {
  const unknownError = "Something went wrong, please try again later.";

  if (err instanceof z.ZodError) {
    const errors = err.issues.map((issue) => {
      return issue.message;
    });

    return errors.join("\n");
  } else if (err instanceof Error) {
    return err.message;
  } else {
    return unknownError;
  }
}
