import { type PlateSlide } from "@/components/notebook/presentation/utils/parser";

/**
 * Deterministic cleanup for model-generated decks.
 *
 * Prompt instructions alone ("every slide needs a heading and body",
 * "never repeat a slide") demonstrably don't hold on small local models —
 * decks still come back with image-only slides and near-identical
 * repeats. This enforces those two rules in code after parsing, where
 * compliance doesn't depend on the model:
 *
 * - Slides with no text content at all (typically a bare root image) are
 *   dropped. A deck slide with zero words is never intentional output of
 *   this app's generation flow.
 * - Slides whose full normalized text matches an earlier slide's are
 *   dropped as duplicates. Batched generation makes this more likely,
 *   since each batch re-derives content from overlapping outline context.
 */

function collectNodeText(node: unknown, parts: string[]): void {
  if (node === null || typeof node !== "object") {
    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      collectNodeText(child, parts);
    }
    return;
  }

  const record = node as Record<string, unknown>;

  if (typeof record.text === "string" && record.text.trim()) {
    parts.push(record.text);
  }

  if (Array.isArray(record.children)) {
    collectNodeText(record.children, parts);
  }
}

function getSlideTextFingerprint(slide: PlateSlide): string {
  const parts: string[] = [];
  collectNodeText(slide.content, parts);
  return parts.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
}

export function sanitizeGeneratedSlides(slides: PlateSlide[]): PlateSlide[] {
  const seenFingerprints = new Set<string>();
  const sanitized: PlateSlide[] = [];

  for (const slide of slides) {
    const fingerprint = getSlideTextFingerprint(slide);

    if (!fingerprint) {
      continue;
    }

    if (seenFingerprints.has(fingerprint)) {
      continue;
    }

    seenFingerprints.add(fingerprint);
    sanitized.push(slide);
  }

  // If sanitization would wipe the whole deck (e.g. a deliberately
  // image-only deck), keep the original rather than showing nothing.
  return sanitized.length > 0 ? sanitized : slides;
}
