/**
 * Splits full-deck generation into multiple smaller sequential requests
 * instead of one large call.
 *
 * Why: a single request generating every slide at once can take longer
 * than a serverless platform's hard execution-time limit (e.g. Vercel
 * Hobby's 60s cap on /api/presentation/generate), especially against a
 * slow/remote Ollama host — that failure mode kills the whole deck with
 * zero slides produced. Smaller batches each do far less work, so they
 * reliably finish within the time limit even when total deck generation
 * would not have.
 */
export const PRESENTATION_GENERATION_BATCH_SIZE = 2;

export interface OutlineGenerationBatch {
  outline: string[];
  startIndex: number;
}

export function chunkOutlineForGeneration(
  outline: string[],
  batchSize: number = PRESENTATION_GENERATION_BATCH_SIZE,
): OutlineGenerationBatch[] {
  const batches: OutlineGenerationBatch[] = [];

  for (let i = 0; i < outline.length; i += batchSize) {
    batches.push({ outline: outline.slice(i, i + batchSize), startIndex: i });
  }

  return batches;
}

/**
 * Per-slide template hints are keyed by absolute outline index. When a
 * batch only covers a slice of the outline, the hints for that slice need
 * to be remapped to indices relative to the batch (index 0 = first slide
 * of this batch), since each batch's request is generated as if it were
 * a complete, standalone deck of just that slice.
 */
export function sliceTemplateHintsForBatch(
  hints: Record<number, string> | undefined,
  startIndex: number,
  batchLength: number,
): Record<number, string> | undefined {
  if (!hints) {
    return undefined;
  }

  const sliced: Record<number, string> = {};

  for (const [key, value] of Object.entries(hints)) {
    const globalIndex = Number(key);
    if (globalIndex >= startIndex && globalIndex < startIndex + batchLength) {
      sliced[globalIndex - startIndex] = value;
    }
  }

  return Object.keys(sliced).length > 0 ? sliced : undefined;
}
