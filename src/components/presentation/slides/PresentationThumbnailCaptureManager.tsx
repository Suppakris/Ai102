"use client";

import { toBlob } from "html-to-image";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import { updatePresentationThumbnailUrl } from "@/app/_actions/presentation/presentation-thumbnail-actions";
import StaticPresentationEditor from "@/components/notebook/presentation/editor/presentation-editor-static";
import { slideSignature } from "@/components/notebook/presentation/editor/utils/slideSignature";
import { uploadFiles } from "@/hooks/globals/useUpload";
import { getPresentationImageGenerationKey } from "@/lib/presentation/image-generation";
import { usePresentationState } from "@/states/presentation-state";

const THUMBNAIL_WIDTH = 1280;
const THUMBNAIL_HEIGHT = 720;
const THUMBNAIL_CAPTURE_DELAY_MS = 900;

type PresentationGenerationSnapshot = Pick<
  ReturnType<typeof usePresentationState.getState>,
  | "isGeneratingPresentation"
  | "shouldStartImageSlideGeneration"
  | "shouldStartPresentationGeneration"
>;

function isPresentationGenerationPending(
  state: PresentationGenerationSnapshot,
): boolean {
  return (
    state.isGeneratingPresentation ||
    state.shouldStartPresentationGeneration ||
    state.shouldStartImageSlideGeneration
  );
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

async function waitForImageElement(image: HTMLImageElement): Promise<void> {
  if (!image.complete) {
    await new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
  }

  if (typeof image.decode === "function") {
    await image.decode().catch(() => undefined);
  }
}

async function waitForRenderableAssets(element: HTMLElement): Promise<void> {
  await document.fonts.ready.catch(() => undefined);

  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(images.map((image) => waitForImageElement(image)));
  await waitForAnimationFrame();
}

function hasActiveImageGenerationForSlide(
  presentationId: string,
  slideId: string,
): boolean {
  const { rootImageGeneration } = usePresentationState.getState();

  return Object.entries(rootImageGeneration).some(([key, job]) => {
    if (job.presentationId !== presentationId) {
      return false;
    }

    if (job.target.slideId !== slideId) {
      return false;
    }

    if (getPresentationImageGenerationKey(job.target) !== key) {
      return false;
    }

    return job.status === "queued" || job.status === "generating";
  });
}

async function captureSlideThumbnailBlob(
  element: HTMLElement,
): Promise<Blob> {
  await waitForRenderableAssets(element);

  const blob = await toBlob(element, {
    cacheBust: true,
    fontEmbedCSS: "",
    height: THUMBNAIL_HEIGHT,
    pixelRatio: 1,
    quality: 0.95,
    skipFonts: true,
    skipAutoScale: true,
    width: THUMBNAIL_WIDTH,
    filter: (node) => {
      if (!(node instanceof HTMLElement)) {
        return true;
      }

      return node.tagName !== "IFRAME" && node.tagName !== "VIDEO";
    },
  });

  if (!blob) {
    throw new Error("Failed to capture presentation thumbnail");
  }

  return blob;
}

export function PresentationThumbnailCaptureManager() {
  const queryClient = useQueryClient();
  const captureElementRef = useRef<HTMLDivElement | null>(null);
  const activeCaptureKeyRef = useRef<string | null>(null);
  const completedCaptureKeyRef = useRef<string | null>(null);
  const initializedPresentationIdRef = useRef<string | null>(null);
  const wasThumbnailCaptureBlockedRef = useRef(false);

  const currentPresentationId = usePresentationState(
    (state) => state.currentPresentationId,
  );
  const firstSlide = usePresentationState((state) => state.slides[0]);
  const isGeneratingPresentation = usePresentationState(
    (state) => state.isGeneratingPresentation,
  );
  const shouldStartPresentationGeneration = usePresentationState(
    (state) => state.shouldStartPresentationGeneration,
  );
  const shouldStartImageSlideGeneration = usePresentationState(
    (state) => state.shouldStartImageSlideGeneration,
  );
  const thumbnailUrl = usePresentationState((state) => state.thumbnailUrl);
  const setThumbnailUrl = usePresentationState((state) => state.setThumbnailUrl);
  const rootImageGeneration = usePresentationState(
    (state) => state.rootImageGeneration,
  );

  const firstSlideSignature = useMemo(
    () => slideSignature(firstSlide),
    [firstSlide],
  );
  const captureKey =
    currentPresentationId && firstSlide
      ? `${currentPresentationId}:${firstSlideSignature}`
      : null;
  const isThumbnailCaptureBlockedByGeneration =
    isPresentationGenerationPending({
      isGeneratingPresentation,
      shouldStartImageSlideGeneration,
      shouldStartPresentationGeneration,
    });

  useEffect(() => {
    if (!currentPresentationId) {
      initializedPresentationIdRef.current = null;
      completedCaptureKeyRef.current = null;
      wasThumbnailCaptureBlockedRef.current = false;
      return;
    }

    if (
      captureKey &&
      thumbnailUrl &&
      initializedPresentationIdRef.current !== currentPresentationId
    ) {
      initializedPresentationIdRef.current = currentPresentationId;
      completedCaptureKeyRef.current = captureKey;
    }
  }, [captureKey, currentPresentationId, thumbnailUrl]);

  useEffect(() => {
    if (!currentPresentationId) {
      wasThumbnailCaptureBlockedRef.current = false;
      return;
    }

    if (
      wasThumbnailCaptureBlockedRef.current &&
      !isThumbnailCaptureBlockedByGeneration &&
      captureKey
    ) {
      completedCaptureKeyRef.current = null;
    }

    wasThumbnailCaptureBlockedRef.current =
      isThumbnailCaptureBlockedByGeneration;
  }, [
    captureKey,
    currentPresentationId,
    isThumbnailCaptureBlockedByGeneration,
  ]);

  useEffect(() => {
    if (
      !currentPresentationId ||
      !firstSlide ||
      !captureKey ||
      isThumbnailCaptureBlockedByGeneration
    ) {
      return;
    }

    if (
      activeCaptureKeyRef.current === captureKey ||
      completedCaptureKeyRef.current === captureKey
    ) {
      return;
    }

    if (hasActiveImageGenerationForSlide(currentPresentationId, firstSlide.id)) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const expectedCaptureKey = captureKey;
      const expectedPresentationId = currentPresentationId;
      const expectedSlideId = firstSlide.id;

      void (async () => {
        const captureElement = captureElementRef.current;
        const latestState = usePresentationState.getState();

        if (
          !captureElement ||
          latestState.currentPresentationId !== expectedPresentationId ||
          latestState.slides[0]?.id !== expectedSlideId ||
          isPresentationGenerationPending(latestState) ||
          hasActiveImageGenerationForSlide(
            expectedPresentationId,
            expectedSlideId,
          )
        ) {
          return;
        }

        activeCaptureKeyRef.current = expectedCaptureKey;

        try {
          const blob = await captureSlideThumbnailBlob(captureElement);
          const stateAfterCapture = usePresentationState.getState();

          if (
            stateAfterCapture.currentPresentationId !==
              expectedPresentationId ||
            stateAfterCapture.slides[0]?.id !== expectedSlideId ||
            isPresentationGenerationPending(stateAfterCapture) ||
            hasActiveImageGenerationForSlide(
              expectedPresentationId,
              expectedSlideId,
            )
          ) {
            return;
          }

          const file = new File(
            [blob],
            `presentation-thumbnail-${expectedPresentationId}.png`,
            { type: "image/png" },
          );

          const uploadedFiles = await uploadFiles("imageUploader", {
            files: [file],
          });

          const uploadedUrl = uploadedFiles?.[0]?.ufsUrl;
          if (!uploadedUrl) {
            throw new Error("Failed to upload presentation thumbnail");
          }

          const stateAfterUpload = usePresentationState.getState();
          if (
            stateAfterUpload.currentPresentationId !== expectedPresentationId ||
            stateAfterUpload.slides[0]?.id !== expectedSlideId ||
            isPresentationGenerationPending(stateAfterUpload)
          ) {
            return;
          }

          const result = await updatePresentationThumbnailUrl({
            id: expectedPresentationId,
            thumbnailUrl: uploadedUrl,
          });

          if (!result.success) {
            throw new Error(result.message);
          }

          if (
            usePresentationState.getState().currentPresentationId ===
            expectedPresentationId
          ) {
            completedCaptureKeyRef.current = expectedCaptureKey;
            setThumbnailUrl(uploadedUrl);
            void Promise.all([
              queryClient.invalidateQueries({
                queryKey: ["presentation", expectedPresentationId],
              }),
              queryClient.invalidateQueries({ queryKey: ["presentations"] }),
              queryClient.invalidateQueries({ queryKey: ["presentations-all"] }),
              queryClient.invalidateQueries({ queryKey: ["recent-items"] }),
            ]);
          }
        } catch (error) {
          console.error("Failed to generate presentation thumbnail:", error);
        } finally {
          if (activeCaptureKeyRef.current === expectedCaptureKey) {
            activeCaptureKeyRef.current = null;
          }
        }
      })();
    }, THUMBNAIL_CAPTURE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [
    captureKey,
    currentPresentationId,
    firstSlide,
    firstSlideSignature,
    isThumbnailCaptureBlockedByGeneration,
    queryClient,
    rootImageGeneration,
    setThumbnailUrl,
  ]);

  if (!firstSlide) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 -left-[10000px] -z-50 overflow-hidden"
      style={{
        height: THUMBNAIL_HEIGHT,
        width: THUMBNAIL_WIDTH,
      }}
    >
      <div
        ref={captureElementRef}
        className="overflow-hidden bg-(--presentation-background)"
        style={{
          height: THUMBNAIL_HEIGHT,
          width: THUMBNAIL_WIDTH,
        }}
      >
        <StaticPresentationEditor
          id={`thumbnail-${firstSlide.id}`}
          initialContent={firstSlide}
          isPresenting
          className="!h-[720px] !min-h-[720px] !w-[1280px] !border-0"
        />
      </div>
    </div>
  );
}
