"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import React, { useEffect, useMemo } from "react";

import { usePresentationTheme } from "@/components/presentation/providers/PresentationThemeProvider";
import { Button } from "@/components/ui/button";
import { useSlideContentScaling } from "@/hooks/presentation/useSlideContentScaling";
import { useSlideOperations } from "@/hooks/presentation/useSlideOperations";
import { DEFAULT_PRESENTATION_SLIDE_ASPECT_RATIO } from "@/lib/presentation/aspect-ratio";
import { resolvePresentationThemeData } from "@/lib/presentation/theme-resolution";
import { cn } from "@/lib/utils";
import { usePresentationState } from "@/states/presentation-state";
import {
  getPresentModeOverlayClasses,
  getPresentModeSlideClasses,
} from "../present-mode/present-mode-styles";
import { SlideEditor } from "./SlideEditor";

interface SlideWrapperProps {
  children: React.ReactNode;
  id: string;
  className?: string;
  isReadOnly?: boolean;
  slideWidth?: string;
  slidesCount?: number;
}

export function SlideWrapper({
  children,
  id,
  className,
  isReadOnly = false,
  slideWidth,
}: SlideWrapperProps) {
  const isPresenting = usePresentationState((s) => s.isPresenting);
  const isReorderingSlides = usePresentationState((s) => s.isReorderingSlides);
  const currentSlideId = usePresentationState((s) => s.currentSlideId);
  const isFirstSlide = usePresentationState((s) => s.slides[0]?.id === id);
  // All slides stay mounted while presenting (just translated off-screen),
  // so every SlideWrapper subscribes here. The offset used to be computed
  // with two array.findIndex calls *inside* the zustand selector, which
  // zustand re-runs on every single store update regardless of relevance --
  // an O(slide count) cost paid by every mounted slide on every update
  // (scale-lock toggles, zoom, etc), not just ones where slide order or the
  // current slide actually changed. Selecting the cheap primitives and
  // deriving the offset in a memo means the findIndex work only reruns when
  // its actual inputs change.
  const slides = usePresentationState((s) => s.slides);
  const presentModeSlideOffset = useMemo(() => {
    const slideIndex = slides.findIndex((slide) => slide.id === id);
    const currentSlideIndex = slides.findIndex(
      (slide) => slide.id === currentSlideId,
    );

    if (slideIndex < 0 || currentSlideIndex < 0) {
      return 0;
    }

    return slideIndex - currentSlideIndex;
  }, [slides, currentSlideId, id]);
  // setSlides no longer needed after extracting operations
  // Select only this slide's data so other slides don't re-render on unrelated changes
  const currentSlide = usePresentationState((s) =>
    s.slides.find((slide) => slide.id === id),
  );
  // Resolve format category and aspect ratio with defaults
  // If not set, default to presentation format with fluid aspect ratio
  const formatCategory = currentSlide?.formatCategory ?? "presentation";
  const aspectRatio =
    currentSlide?.aspectRatio ?? DEFAULT_PRESENTATION_SLIDE_ASPECT_RATIO;
  const zoomLevel = usePresentationState((s) => s.zoomLevel);

  // Get theme data for computing overlay background (same as ThemeBackground)
  const presentationTheme = usePresentationState((s) => s.theme);
  const customThemeData = usePresentationState((s) => s.customThemeData);
  const pageBackground = usePresentationState((s) => s.pageBackground);
  const { resolvedTheme } = usePresentationTheme();
  const isDark = resolvedTheme === "dark";

  // Compute the theme background (same logic as ThemeBackground component)
  const themeBackground = useMemo((): string => {
    const currentTheme = resolvePresentationThemeData({
      customThemeData,
      theme: presentationTheme,
    });

    const bgOverride = pageBackground.backgroundOverride;
    const themeBgOverride = currentTheme?.background?.override;

    // Ensure we return a valid string
    if (typeof bgOverride === "string" && bgOverride) return bgOverride;
    if (typeof themeBgOverride === "string" && themeBgOverride)
      return themeBgOverride;
    return isDark ? "#0a0a0a" : "#ffffff";
  }, [
    customThemeData,
    presentationTheme,
    pageBackground.backgroundOverride,
    isDark,
  ]);

  const scalingConfig = useSlideContentScaling(
    (slideWidth ?? currentSlide?.width ?? "M") as "S" | "M" | "L",
    isPresenting,
    formatCategory,
    aspectRatio,
    undefined, // containerRefOverride
    zoomLevel,
  );
  const setPresentingScaleLock = usePresentationState(
    (s) => s.setPresentingScaleLock,
  );

  const { contentRef, scaledHeight } = scalingConfig;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: isPresenting || isReadOnly,
  });

  const presentModeTranslateY =
    presentModeSlideOffset === 0
      ? "0"
      : presentModeSlideOffset > 0
        ? "100dvh"
        : "-100dvh";
  const style = {
    transform: isPresenting
      ? `translate3d(0, ${presentModeTranslateY}, 0)`
      : CSS.Transform.toString(transform),
    transition: isPresenting
      ? "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)"
      : transition,
  };

  const [dragTransparent, setDragTransparent] = React.useState(false);
  const [areSlideControlsActive, setAreSlideControlsActive] =
    React.useState(false);
  const slideControlsHideTimeoutRef = React.useRef<number | null>(null);

  const showSlideControls = React.useCallback(() => {
    if (slideControlsHideTimeoutRef.current !== null) {
      window.clearTimeout(slideControlsHideTimeoutRef.current);
      slideControlsHideTimeoutRef.current = null;
    }
    setAreSlideControlsActive(true);
  }, []);

  const hideSlideControls = React.useCallback(() => {
    if (slideControlsHideTimeoutRef.current !== null) {
      window.clearTimeout(slideControlsHideTimeoutRef.current);
    }
    slideControlsHideTimeoutRef.current = window.setTimeout(() => {
      setAreSlideControlsActive(false);
      slideControlsHideTimeoutRef.current = null;
    }, 180);
  }, []);

  useEffect(() => {
    let timeout: number;

    if (isDragging) {
      timeout = window.setTimeout(() => {
        setDragTransparent(true);
      }, 200);
    } else {
      timeout = window.setTimeout(() => {
        setDragTransparent(false);
      }, 0);
    }

    return () => window.clearTimeout(timeout);
  }, [isDragging]);

  useEffect(() => {
    return () => {
      if (slideControlsHideTimeoutRef.current !== null) {
        window.clearTimeout(slideControlsHideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isPresenting) return;
    if (!scalingConfig.isScaleLocked) return;
    setPresentingScaleLock(id, true);
  }, [id, isPresenting, scalingConfig.isScaleLocked, setPresentingScaleLock]);

  const { addSlide, deleteSlide: deleteSlideWithId } = useSlideOperations();

  const deleteSlide = () => {
    deleteSlideWithId(id);
  };

  const presentWidth = Math.round(
    scalingConfig.slideWidth * Math.max(scalingConfig.scale, 0.1),
  );
  const editModeScaledWidth = Math.round(
    scalingConfig.slideWidth * Math.max(scalingConfig.scale, 0.1),
  );

  // When presentFitScale < 1, the content needs to shrink to fit the viewport.
  // We render the content at full viewport width (presentWidth) but apply a
  // CSS transform to scale it down visually. The outer wrapper is sized to
  // the scaled dimensions so the layout (overflow, centering) is correct.
  const fitScale = isPresenting ? scalingConfig.presentFitScale : 1;
  const needsFitScaling = isPresenting && fitScale < 1;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        // Ensure the parent participates in layout with the scaled height
        ...(scaledHeight ? { height: `${scaledHeight}px` } : {}),
        // Apply theme background for present mode overlay
        ...(isPresenting ? { background: themeBackground } : {}),
      }}
      className={cn(
        "group/card-container relative z-10 flex w-full flex-col pb-6",
        `slide-container-${id}`,
        isDragging && "z-50 opacity-50",
        dragTransparent && "opacity-30",
        isPresenting && getPresentModeOverlayClasses(formatCategory),
        id === currentSlideId && isPresenting && "z-999",
        id !== currentSlideId && isPresenting && "pointer-events-none",
      )}
      onPointerEnter={showSlideControls}
      onPointerLeave={hideSlideControls}
      {...attributes}
    >
      <div
        className={cn(
          "relative w-full",
          !isPresenting && "flex justify-center",
        )}
      >
        <div
          className="relative"
          style={
            !isPresenting
              ? {
                  width: `${editModeScaledWidth}px`,
                  maxWidth: "100%",
                }
              : needsFitScaling
                ? {
                    // Set explicit dimensions to the scaled size so the
                    // grid/overflow parent sees the correct layout box.
                    width: `${Math.ceil(presentWidth * fitScale)}px`,
                    height: `${Math.ceil(scalingConfig.contentHeight * fitScale)}px`,
                    overflow: "hidden",
                  }
                : undefined
          }
        >
          <div
            ref={contentRef}
            className={cn(
              "relative origin-[top_left]",
              isPresenting && getPresentModeSlideClasses(formatCategory),
              className,
            )}
            style={{
              ...(!isPresenting && {
                width: `${scalingConfig.slideWidth}px`,
                transform: `scale(${scalingConfig.scale})`,
              }),
              ...(isPresenting && {
                width: `${presentWidth}px`,
                fontSize: `${scalingConfig.fontSize}px`,
                ...(needsFitScaling && {
                  transform: `scale(${fitScale})`,
                  transformOrigin: "top left",
                }),
              }),
            }}
          >
            {/* Overlay to prevent accidental editor/element drops during slide reordering */}
            {isReorderingSlides && !isPresenting && (
              <div className="absolute inset-0 z-101 cursor-grabbing bg-transparent" />
            )}

            {!isPresenting && !isReadOnly && (
              <div
                className={cn(
                  "absolute top-2 left-4 z-999999 flex opacity-0 transition-opacity duration-200 group-hover/card-container:opacity-100",
                  areSlideControlsActive && "opacity-100",
                )}
                style={{
                  transform: `scale(${0.6 + 0.4 / scalingConfig.scale})`,
                  transformOrigin: "center center",
                }}
              >
                <SlideEditor
                  slideId={id}
                  dragListeners={listeners}
                  onDuplicate={() => addSlide("after", id, currentSlide)}
                  onDelete={deleteSlide}
                />
              </div>
            )}

            {children}
          </div>
        </div>
      </div>

      {!isPresenting && !isReadOnly && isFirstSlide && (
        <div
          className={cn(
            "absolute top-0 left-1/2 z-999999 -translate-x-1/2 -translate-y-[calc(100%-0.25rem)] opacity-0 transition-opacity duration-200 group-hover/card-container:opacity-100",
            areSlideControlsActive && "opacity-100",
          )}
        >
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full bg-background shadow-md"
            onClick={() => addSlide("before", id)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!isPresenting && !isReadOnly && (
        <div
          className={cn(
            "absolute bottom-0 left-1/2 z-999999 -translate-x-1/2 translate-y-[calc(100%-0.25rem)] opacity-0 transition-opacity duration-200 group-hover/card-container:opacity-100",
            areSlideControlsActive && "opacity-100",
          )}
        >
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full bg-background shadow-md"
            onClick={() => addSlide("after", id)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
