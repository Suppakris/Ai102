import type React from "react";

import {
  calculateHeightFromRatio,
  getSlideBaseWidth,
} from "@/config/slideFormats";
import { type PlateSlide } from "../../utils/parser";
import { getTypographyCSSVariables } from "./typography";

/**
 * Get layout flex direction classes based on layout type.
 */
export function getLayoutClasses(layoutType: PlateSlide["layoutType"]): string {
  switch (layoutType) {
    case "right":
      return "flex-row";
    case "vertical":
      return "flex-col-reverse justify-end";
    case "left":
      return "flex-row-reverse";
    case "background":
      return "flex-col";
    case "none":
    case undefined:
      return "flex-col";
    default:
      return "flex-col";
  }
}

/**
 * Get present mode specific classes.
 * @param isPresenting - Whether in present mode
 * @param formatCategory - The slide format category (affects how width is handled)
 */
export function getPresentingClasses(
  isPresenting: boolean,
  formatCategory?: PlateSlide["formatCategory"],
): string {
  if (!isPresenting) {
    return "min-h-125 border border-(--presentation-accent)";
  }

  // For social format, don't force w-full so the aspect ratio is preserved
  // The width will come from the slide's defined dimensions (via styleByFormat)
  if (formatCategory === "social") {
    return "border-0";
  }

  // For presentation/fluid formats, take full width.
  // On larger screens (md+), force min-h-dvh so slide fills the viewport.
  // On phones (below md), maintain a 16:9 aspect ratio so the slide acts
  // like `object-fit: contain` and preserves its layout.
  return "w-full border-0 md:min-h-dvh max-md:aspect-video";
}

/**
 * Calculate slide format styles (width/height) for the presentation root.
 */
export function getSlideFormatStyles(
  category: PlateSlide["formatCategory"],
  width: PlateSlide["width"],
  aspectRatio: PlateSlide["aspectRatio"],
): React.CSSProperties {
  const slideWidthSize = width ?? "M";
  const formatCategory = category ?? "presentation";
  const aspect = aspectRatio ?? { type: "fluid", value: "" };

  const baseWidth = getSlideBaseWidth(
    formatCategory,
    slideWidthSize as "S" | "M" | "L",
    aspect,
  );

  const heightConfig = calculateHeightFromRatio(baseWidth, aspect);

  return {
    ...(aspect.type !== "fluid" ? { width: `${baseWidth}px` } : {}),
    ...(heightConfig.minHeightCSS
      ? {
          minHeight: heightConfig.minHeightCSS,
          // Exposed so children (e.g. the root image) can cap their own
          // size against the slide's fixed ratio height instead of
          // growing the slide past its aspect ratio.
          ["--slide-fixed-height" as string]: heightConfig.minHeightCSS,
        }
      : {}),
  };
}

/**
 * Get custom inline styles for the slide based on content settings.
 */
export function getSlideCustomStyles(
  initialContent: PlateSlide | undefined,
  isPresenting: boolean,
  styleByFormat: React.CSSProperties,
): React.CSSProperties {
  // Determine if we should apply format dimensions in present mode
  // For social format, we WANT strict dimensions to preserve aspect ratio
  // For presentation format, we rely on the CSS classes (min-h-dvh! w-full)
  const shouldApplyDimensions =
    !isPresenting || initialContent?.formatCategory === "social";

  return {
    borderRadius: isPresenting
      ? "0"
      : "var(--presentation-slide-border-radius)",
    boxShadow: isPresenting ? "none" : "var(--presentation-slide-shadow)",

    // Apply dimensions if not presenting OR if it's social format
    ...(shouldApplyDimensions && styleByFormat),

    // Background color override
    ...(initialContent?.bgColor && {
      "--presentation-background": initialContent.bgColor as string,
      backgroundColor: initialContent.bgColor as string,
    }),
    // Background image for background layout
    backgroundImage:
      initialContent?.layoutType === "background" &&
      initialContent?.rootImage?.url
        ? `url(${initialContent.rootImage.url})`
        : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    // Typography
    ...getTypographyCSSVariables(initialContent?.fontSize),
    ...(initialContent?.fontFamily?.body && {
      "--presentation-body-font": initialContent.fontFamily.body as string,
    }),
    ...(initialContent?.fontFamily?.heading && {
      "--presentation-heading-font": initialContent.fontFamily
        .heading as string,
    }),
    fontFamily: "var(--presentation-body-font)",
  } as React.CSSProperties;
}
