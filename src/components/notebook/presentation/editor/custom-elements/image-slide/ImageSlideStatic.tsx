"use client";

import Image from "next/image";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { usePresentationState } from "@/states/presentation-state";
import { type RootImage } from "../../../utils/parser";

interface ImageSlideStaticProps {
  image: RootImage;
  slideId: string;
  isPresenting?: boolean;
}

export default function ImageSlideStatic({
  image,
  slideId,
  isPresenting = false,
}: ImageSlideStaticProps) {
  const rootImageGeneration = usePresentationState(
    (s) => s.rootImageGeneration,
  );
  const rawComputedGen = rootImageGeneration[slideId];
  const imageQuery = image.query.trim();
  const computedGen =
    rawComputedGen &&
    (!imageQuery || rawComputedGen.query.trim() === imageQuery)
      ? rawComputedGen
      : undefined;
  const computedImageUrl = computedGen?.url ?? image.url;
  const isGenerating =
    image.isQueryStreaming ||
    computedGen?.status === "queued" ||
    computedGen?.status === "generating";

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center",
        // Present mode already sizes/centers the slide to the viewport; a
        // fixed 16:9 box here fights that on any non-16:9 viewport, leaving
        // the image at edit-mode size instead of filling the screen.
        isPresenting ? "h-full" : "aspect-video",
        "relative overflow-hidden",
      )}
      data-slide-id={slideId}
    >
      {isGenerating ? (
        <div className="absolute inset-0 z-10 flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/30 p-4 text-center">
          <Spinner className="size-8" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Generating image
            </p>
            <p className="text-xs text-muted-foreground">
              This can take a moment.
            </p>
          </div>
        </div>
      ) : computedImageUrl ? (
        <Image
          unoptimized
          width={400}
          height={300}
          src={computedImageUrl}
          alt={image.query}
          className="h-full w-full"
          style={{
            objectFit: image.cropSettings?.objectFit ?? "cover",
            objectPosition: image.cropSettings?.objectPosition
              ? `${image.cropSettings.objectPosition.x}% ${image.cropSettings.objectPosition.y}%`
              : "center",
          }}
        />
      ) : (
        <div className="flex items-center justify-center text-muted-foreground">
          <span>
            {computedGen?.status === "error" ? "Image not found" : "No image"}
          </span>
        </div>
      )}
    </div>
  );
}
