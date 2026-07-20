import { type PlateSlide } from "@/components/notebook/presentation/utils/parser";

export type PresentationGenerationAspectRatio =
  | "dynamic"
  | "16:9"
  | "4:3"
  | "1:1"
  | "9:16"
  | "a4";

export const DEFAULT_PRESENTATION_GENERATION_ASPECT_RATIO: PresentationGenerationAspectRatio =
  "16:9";

export const DEFAULT_PRESENTATION_SLIDE_ASPECT_RATIO: NonNullable<
  PlateSlide["aspectRatio"]
> = { type: "ratio", value: "16:9" };

export const PRESENTATION_GENERATION_ASPECT_RATIO_OPTIONS = [
  {
    label: "16:9 (Widescreen)",
    shortLabel: "16:9",
    value: "16:9",
  },
  {
    label: "4:3 (Standard)",
    shortLabel: "4:3",
    value: "4:3",
  },
  {
    label: "1:1 (Square)",
    shortLabel: "1:1",
    value: "1:1",
  },
  {
    label: "9:16 (Vertical)",
    shortLabel: "9:16",
    value: "9:16",
  },
  {
    label: "A4 (Document/PDF)",
    shortLabel: "A4",
    value: "a4",
  },
  {
    label: "Dynamic (fits content)",
    shortLabel: "Dynamic",
    value: "dynamic",
  },
] as const;

const ASPECT_RATIO_VALUES = new Set<PresentationGenerationAspectRatio>([
  "dynamic",
  "16:9",
  "4:3",
  "1:1",
  "9:16",
  "a4",
]);

export function normalizePresentationGenerationAspectRatio(
  value: unknown,
): PresentationGenerationAspectRatio {
  return typeof value === "string" &&
    ASPECT_RATIO_VALUES.has(value as PresentationGenerationAspectRatio)
    ? (value as PresentationGenerationAspectRatio)
    : DEFAULT_PRESENTATION_GENERATION_ASPECT_RATIO;
}

export function getPresentationGenerationAspectRatioLabel(
  value: PresentationGenerationAspectRatio,
): string {
  return (
    PRESENTATION_GENERATION_ASPECT_RATIO_OPTIONS.find(
      (option) => option.value === value,
    )?.shortLabel ?? "16:9"
  );
}

export function getSlideAspectRatioForGenerationAspectRatio(
  value: PresentationGenerationAspectRatio,
): NonNullable<PlateSlide["aspectRatio"]> {
  switch (value) {
    case "dynamic":
      return { type: "fluid" };
    case "a4":
      return { type: "preset", value: "A4" };
    case "16:9":
    case "4:3":
    case "1:1":
    case "9:16":
      return { type: "ratio", value };
    default:
      return DEFAULT_PRESENTATION_SLIDE_ASPECT_RATIO;
  }
}

export function applyGenerationAspectRatioToSlides(
  slides: PlateSlide[],
  value: PresentationGenerationAspectRatio,
): PlateSlide[] {
  const aspectRatio = getSlideAspectRatioForGenerationAspectRatio(value);

  // Slides that already carry the target ratio are returned by reference
  // rather than cloned. This runs on every frame of a streaming generation,
  // where cloning every slide invalidated the memoized slide components and
  // re-rendered the whole deck even though only the last slide had changed.
  return slides.map((slide) => {
    if (
      slide.formatCategory === "presentation" &&
      slide.aspectRatio?.type === aspectRatio.type &&
      slide.aspectRatio?.value === aspectRatio.value
    ) {
      return slide;
    }

    return {
      ...slide,
      formatCategory: "presentation",
      aspectRatio,
    };
  });
}
