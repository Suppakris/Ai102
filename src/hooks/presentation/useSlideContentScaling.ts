"use client";

import debounce from "lodash.debounce";
import { useCallback, useEffect, useRef, useState } from "react";

import { type PlateSlide } from "@/components/notebook/presentation/utils/parser";
import { getSlideBaseWidth } from "@/config/slideFormats";
import { DEFAULT_PRESENTATION_SLIDE_ASPECT_RATIO } from "@/lib/presentation/aspect-ratio";
import { type SlideScalingConfig } from "./scaling";
import { getPresentModeViewportDimensions } from "./usePresentModeOrientation";

// Re-export for backward compatibility
/**
 * useSlideContentScaling
 *
 * Computes responsive scaling for a slide based on the available content area,
 * and exposes utilities to keep the parent layout height in sync when the slide
 * is visually scaled via CSS transforms.
 *
 * Why this exists:
 * - CSS `transform: scale(...)` changes how the slide looks but does not affect
 *   layout calculations (height) of parent elements. This can cause the
 *   parent container to have an incorrect height when the slide is scaled down.
 * - This hook measures the unscaled content element and returns a calculated
 *   `scaledHeight` so parents can set an explicit height that matches the visual
 *   scale.
 *
 * Behavior by mode:
 * - Edit mode (isPresenting = false):
 *   - Determines a scale factor based on the actual `.presentation-slides`
 *     container size (or a viewport fallback) and the configured base width.
 *   - Keeps font size at the base 16px for readability while editing.
 *   - Measures the unscaled content via `contentRef` and returns `scaledHeight`
 *     so the outer wrapper can adopt the correct layout height.
 * - Present mode (isPresenting = true):
 *   - Scales the slide frame width to the viewport.
 *   - Keeps presentation-format text at the base font size because the editor
 *     surface applies region-aware transform scaling for present mode.
 *   - `scaledHeight` is undefined (full-screen layout is expected in present mode).
 *   - Only the active slide performs calculations to reduce memory usage.
 */
/**
 * Calculate slide scaling based on the actual content container width.
 * Accounts for sidebars/UI by querying `.presentation-slides` instead of only
 * using the viewport.
 *
 * @param slideWidthSize - Base logical slide width preset: "S" | "M" | "L".
 * @param isPresenting - Whether the slide is in present mode.
 * @param formatCategory - Format category for the slide.
 * @param aspectRatio - Aspect ratio configuration.
 * @param containerRefOverride - Optional container ref override.
 * @param zoomLevel - Zoom multiplier (1 = 100%, 1.4 = 140%, etc.).
 * @returns SlideScalingConfig with scale, dimensions, and refs.
 */

/**
 * Calculate slide scaling based on the actual content container width.
 * Accounts for sidebars/UI by querying `.presentation-slides` instead of only
 * using the viewport.
 *
 * @param slideWidthSize - Base logical slide width preset: "S" | "M" | "L".
 * @param isPresenting - Whether the slide is in present mode.
 * @param customBaseWidth - Custom base width override.
 * @param customBaseWidth - Custom base width override.
 * @returns An object containing:
 *  - `scale`: number applied to CSS `transform: scale(...)` on the content node
 *  - `slideWidth`: resolved base pixel width for the slide
 *  - `fontSize`: base font size (scaled in present mode, 16px in edit mode)
 *  - `scaledHeight?`: computed scaled height for parent layout in edit mode
 *  - `contentRef`: ref that must be attached to the transformed content element
 *
 * Usage:
 * ```tsx
 * const { scale, slideWidth, fontSize, scaledHeight, contentRef } =
 *   useSlideContentScaling("M", isPresenting);
 *
 * return (
 *   <div style={{ height: scaledHeight ? `${scaledHeight}px` : undefined }}>
 *     <div
 *       ref={contentRef}
 *       style={{ width: `${slideWidth}px`, transform: `scale(${scale})` }}
 *     />
 *   </div>
 * );
 * ```
 */
export function useSlideContentScaling(
  slideWidthSize: "S" | "M" | "L" = "M",
  isPresenting: boolean = false,
  formatCategory: PlateSlide["formatCategory"] = "presentation",
  aspectRatio: PlateSlide["aspectRatio"] = DEFAULT_PRESENTATION_SLIDE_ASPECT_RATIO,
  containerRefOverride?: React.RefObject<HTMLDivElement | null>,
  zoomLevel: number = 1, // Zoom multiplier (1 = 100%, 1.4 = 140%, etc.)
): SlideScalingConfig {
  // Use centralized config to get slide width
  const slideWidth = getSlideBaseWidth(
    formatCategory,
    slideWidthSize,
    aspectRatio,
  );

  const contentRef = useRef<HTMLDivElement | null>(null);
  const [measuredContentHeight, setMeasuredContentHeight] = useState<number>(0);
  const measuredContentHeightRef = useRef(0);
  const containerRef = useRef<HTMLElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // Track if we've already locked the font scale in present mode (prevents feedback loop)
  const hasSettledScaleRef = useRef<boolean>(false);
  const scaleLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [isScaleLocked, setIsScaleLocked] = useState(false);

  const resetPresentingScaleLock = useCallback(() => {
    hasSettledScaleRef.current = false;
    setIsScaleLocked((prev) => (prev ? false : prev));
    if (scaleLockTimeoutRef.current) {
      clearTimeout(scaleLockTimeoutRef.current);
      scaleLockTimeoutRef.current = null;
    }
  }, []);

  // In present mode, only calculate for the active slide

  const [scaling, setScaling] = useState<
    Omit<SlideScalingConfig, "scaledHeight" | "contentRef" | "contentHeight">
  >({
    scale: 1,
    slideWidth,
    minHeight: undefined,
    fontSize: 16,
    presentFitScale: 1,
  });
  const scalingRef = useRef(scaling);

  useEffect(() => {
    scalingRef.current = scaling;
  }, [scaling]);

  // Memoize the calculation function to avoid recreating it
  const calculateScaling = useCallback(() => {
    // Skip calculation for inactive slides in present mode
    // Skip if we've already locked the scale in present mode
    if (isPresenting && hasSettledScaleRef.current) {
      return;
    }

    let scale = 1;
    let fontSize = 16;
    const presentFitScale = 1;

    // Get base width using centralized config
    const slideWidth = getSlideBaseWidth(
      formatCategory,
      slideWidthSize,
      aspectRatio,
    );

    if (isPresenting) {
      const { width: viewportWidth } = getPresentModeViewportDimensions();
      const availableWidth = Math.max(1, viewportWidth);
      const widthScale = availableWidth / slideWidth;

      // For social format: cap scale so slide fits within viewport but doesn't stretch
      // beyond its natural size. This keeps the slide centered and proportional.
      // For presentation/fluid: scale to fill viewport width as before.
      if (formatCategory === "social") {
        // Cap scale at 1 to prevent stretching beyond the base width
        scale = Math.min(widthScale, 1);
        fontSize = 16 * scale;
        // Social format allows scroll for tall content, no presentFitScale adjustment needed
      } else {
        scale = widthScale;
        fontSize = 16;
      }
    } else {
      // Apply the user's chosen zoom level directly. The container scrolls
      // horizontally (see `.presentation-slides`) so zooming in beyond the
      // available width is fine; it used to be silently clamped back down
      // to whatever already fit, which made the zoom control a no-op.
      scale = zoomLevel;

      // Keep base font size in edit mode (don't scale text)
      fontSize = 16;
    }

    const nextScaling = {
      scale: Math.max(scale, 0.1),
      slideWidth,
      fontSize,
      presentFitScale,
    };
    const currentScaling = scalingRef.current;

    if (
      currentScaling.scale !== nextScaling.scale ||
      currentScaling.fontSize !== nextScaling.fontSize ||
      currentScaling.slideWidth !== nextScaling.slideWidth ||
      currentScaling.presentFitScale !== nextScaling.presentFitScale
    ) {
      scalingRef.current = nextScaling;
      setScaling(nextScaling);
    }
  }, [
    isPresenting,
    formatCategory,
    slideWidthSize,
    aspectRatio,
    containerRefOverride,
    zoomLevel,
  ]);

  // Reset the settled flag when entering/exiting present mode
  useEffect(() => {
    resetPresentingScaleLock();
  }, [isPresenting, resetPresentingScaleLock]);

  // Setup resize listeners only for active slides
  useEffect(() => {
    calculateScaling();

    // Use ResizeObserver on the presentation-slides container only for edit mode
    if (!isPresenting) {
      // Disconnect existing observer if it exists
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      // Use containerRefOverride if provided, otherwise fall back to querying DOM
      const presentationContainer =
        containerRefOverride?.current ??
        (containerRef.current ||
          document.querySelector(".presentation-slides"));

      if (presentationContainer) {
        resizeObserverRef.current = new ResizeObserver(calculateScaling);
        resizeObserverRef.current.observe(presentationContainer);
      }
    }

    const handleViewportResize = () => {
      if (isPresenting) {
        resetPresentingScaleLock();
      }
      calculateScaling();
    };

    // For present mode, react to viewport changes including mobile rotation.
    window.addEventListener("resize", handleViewportResize, {
      passive: true,
    });
    window.addEventListener("orientationchange", handleViewportResize);
    window.visualViewport?.addEventListener("resize", handleViewportResize);

    return () => {
      window.removeEventListener("resize", handleViewportResize);
      window.removeEventListener("orientationchange", handleViewportResize);
      window.visualViewport?.removeEventListener(
        "resize",
        handleViewportResize,
      );
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [
    isPresenting,
    calculateScaling,
    containerRefOverride,
    resetPresentingScaleLock,
  ]);

  // Measure unscaled content height; in edit mode, compute scaledHeight for layout.
  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    const updateHeight = () => {
      // Use scrollHeight in present mode to get true content height (ignoring overflow clip)
      const height = isPresenting
        ? node.scrollHeight || 0
        : node.offsetHeight || 0;
      if (measuredContentHeightRef.current !== height) {
        measuredContentHeightRef.current = height;
        setMeasuredContentHeight(height);
      }
    };

    updateHeight();

    // Debounce height updates too
    const debouncedUpdateHeight = debounce(updateHeight, 100);
    const ro = new ResizeObserver(debouncedUpdateHeight);
    ro.observe(node);
    window.addEventListener("resize", debouncedUpdateHeight, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", debouncedUpdateHeight);
    };
  }, [isPresenting]);

  // Mark scale as locked for loader state once measurements and scaling settle in present mode.
  useEffect(() => {
    if (!isPresenting) return;
    if (isScaleLocked) return;
    if (measuredContentHeight <= 0) return;

    if (scaleLockTimeoutRef.current) {
      clearTimeout(scaleLockTimeoutRef.current);
    }

    scaleLockTimeoutRef.current = setTimeout(() => {
      setIsScaleLocked((prev) => (prev ? prev : true));
    }, 250);

    return () => {
      if (scaleLockTimeoutRef.current) {
        clearTimeout(scaleLockTimeoutRef.current);
        scaleLockTimeoutRef.current = null;
      }
    };
  }, [
    isPresenting,
    measuredContentHeight,
    scaling.scale,
    scaling.fontSize,
    scaling.presentFitScale,
    isScaleLocked,
  ]);

  const scaledHeight = !isPresenting
    ? Math.max(0, Math.ceil(measuredContentHeight * (scaling.scale || 1)))
    : undefined;

  // In present mode, if the content at full-width exceeds viewport height,
  // compute a fit scale so the entire slide is visible without scrolling.
  // This is applied as a CSS transform in SlideWrapper (not just fontSize).
  let computedPresentFitScale = scaling.presentFitScale;
  if (
    isPresenting &&
    measuredContentHeight > 0 &&
    formatCategory !== "social"
  ) {
    const { height: vpHeight } = getPresentModeViewportDimensions();
    if (vpHeight > 0 && measuredContentHeight > vpHeight) {
      computedPresentFitScale = vpHeight / measuredContentHeight;
    }
  }

  return {
    ...scaling,
    presentFitScale: computedPresentFitScale,
    scaledHeight,
    contentHeight: measuredContentHeight,
    contentRef,
    isScaleLocked,
  };
}
