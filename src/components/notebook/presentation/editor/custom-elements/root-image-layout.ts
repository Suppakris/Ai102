import type React from "react";

import { type RootImage as RootImageType } from "../../utils/parser";
import { type ImageCropSettings } from "../../utils/types";

export const BASE_WIDTH_PERCENTAGE = "45%";
export const BASE_HEIGHT = 384;
export const MIN_WIDTH_PERCENTAGE = 20;
export const MAX_WIDTH_PERCENTAGE = 80;
export const MIN_HEIGHT = 200;
export const MAX_HEIGHT = 800;

export function getRootImageCropSettings(
  image: RootImageType,
): ImageCropSettings {
  return (
    image.cropSettings ?? {
      objectFit: "cover",
      objectPosition: { x: 50, y: 50 },
      zoom: 1,
    }
  );
}

export function getRootImageObjectStyles(
  image: RootImageType,
): React.CSSProperties {
  const cropSettings = getRootImageCropSettings(image);

  return {
    objectFit: cropSettings.objectFit,
    objectPosition: `${cropSettings.objectPosition.x}% ${cropSettings.objectPosition.y}%`,
    transform: `scale(${cropSettings.zoom ?? 1})`,
    transformOrigin: `${cropSettings.objectPosition.x}% ${cropSettings.objectPosition.y}%`,
    height: "100%",
    width: "100%",
    display: "block",
  };
}

/**
 * Cap image height against the slide's fixed ratio height (exposed as
 * --slide-fixed-height by getSlideFormatStyles). Without a cap, a tall
 * image grows the slide past its configured aspect ratio in the editor
 * (height "auto" resolves to the image's intrinsic height; the fixed
 * vertical-layout height ignores the ratio entirely), and exports then
 * have to squash the overflowing slide back into the ratio canvas.
 * On fluid slides the variable is unset and the fallback keeps these
 * caps inert. objectFit is cover, so capping crops instead of distorting.
 */
const VERTICAL_IMAGE_SLIDE_FRACTION = 0.55;
const SIDE_IMAGE_PADDING_ALLOWANCE_PX = 96;

function capHeightPx(heightPx: number, fraction: number): string {
  return `min(${heightPx}px, calc(var(--slide-fixed-height, 99999px) * ${fraction}))`;
}

const SIDE_IMAGE_MAX_HEIGHT = `calc(var(--slide-fixed-height, 99999px) - ${SIDE_IMAGE_PADDING_ALLOWANCE_PX}px)`;

export function getRootImageSizeStyle(
  image: RootImageType,
  layoutType?: string,
): React.CSSProperties {
  const hasExplicitHeight = Boolean(image.size?.h);
  const hasExplicitWidth = Boolean(image.size?.w);

  if (!hasExplicitHeight && !hasExplicitWidth) {
    if (layoutType === "vertical") {
      return {
        height: capHeightPx(BASE_HEIGHT, VERTICAL_IMAGE_SLIDE_FRACTION),
        width: "100%",
      };
    }
    return {
      width: BASE_WIDTH_PERCENTAGE,
      height: "auto",
      maxHeight: SIDE_IMAGE_MAX_HEIGHT,
    };
  }

  if (layoutType === "vertical") {
    return {
      height: capHeightPx(
        image.size?.h ?? BASE_HEIGHT,
        VERTICAL_IMAGE_SLIDE_FRACTION,
      ),
      width: "100%",
    };
  }

  return {
    width: image.size?.w ?? BASE_WIDTH_PERCENTAGE,
    height: "auto",
    maxHeight: SIDE_IMAGE_MAX_HEIGHT,
  };
}
