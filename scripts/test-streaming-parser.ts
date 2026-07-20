/**
 * Verifies the incremental streaming parse path against the previous
 * reset-and-reparse-everything behavior.
 *
 * The generation manager used to reset the parser and re-parse the entire
 * accumulated stream on every animation frame. It now appends only the newly
 * streamed text. This script replays a deck through both strategies at a
 * range of chunk sizes and asserts they agree, since a divergence here would
 * corrupt generated decks.
 */

import {
  SlideParser,
  type PlateSlide,
} from "../src/components/notebook/presentation/utils/parser";

const DECK = `<PRESENTATION>
<SECTION layout="left">
  <H1>Gemini 3.5 Flash: Speed and Capabilities</H1>
  <BULLETS>
    <DIV><H3>First release of the 3.5 model series</H3><P>Introduces frontier-level intelligence while targeting rapid agentic and coding workloads.</P></DIV>
    <DIV><H3>Optimized for fast agentic and coding tasks</H3><P>Architectural tweaks reduce latency for real-time code generation.</P></DIV>
  </BULLETS>
  <IMG query="fast neural network visualization" />
</SECTION>
<SECTION layout="vertical">
  <H1>Agent Mode and Autonomous Task Execution</H1>
  <P>Agents can now plan and execute multi-step tasks with minimal supervision.</P>
  <BULLETS>
    <DIV><H3>Planning</H3><P>Breaks goals into ordered steps.</P></DIV>
    <DIV><H3>Recovery</H3><P>Retries failed steps with adjusted strategies.</P></DIV>
  </BULLETS>
</SECTION>
<SECTION layout="right">
  <H1>Multimodal Innovations: Video, Image, Audio</H1>
  <COLUMNS>
    <DIV><H3>Video</H3><P>Native long-form video understanding.</P></DIV>
    <DIV><H3>Audio</H3><P>Real-time speech with emotion preservation.</P></DIV>
  </COLUMNS>
  <IMG query="multimodal ai concept art" />
</SECTION>
<SECTION>
  <H1>Developer Tools: Gemini API and Managed Agents</H1>
  <P>A managed runtime removes most of the orchestration boilerplate.</P>
</SECTION>
</PRESENTATION>`;

function stripXmlCodeBlock(input: string): string {
  let result = input.trim();
  if (result.startsWith("```xml")) result = result.slice(6).trimStart();
  if (result.endsWith("```")) result = result.slice(0, -3).trimEnd();
  return result;
}

/** The old behavior: reset and re-parse the whole stream every frame. */
function parseWithResetStrategy(chunks: string[]): PlateSlide[] {
  const parser = new SlideParser();
  let accumulated = "";
  let slides: PlateSlide[] = [];

  for (const chunk of chunks) {
    accumulated += chunk;
    parser.reset();
    parser.parseChunk(stripXmlCodeBlock(accumulated));
    parser.finalize();
    slides = parser.getAllSlides();
  }

  return slides;
}

/** The new behavior: append deltas, preview the pending tail separately. */
function parseWithIncrementalStrategy(chunks: string[]): {
  slides: PlateSlide[];
  maxPreviewCount: number;
  identityChurn: number;
} {
  const parser = new SlideParser();
  let maxPreviewCount = 0;
  let identityChurn = 0;
  let previousCompleted: PlateSlide[] = [];

  for (const chunk of chunks) {
    parser.appendChunk(chunk);
    const completed = parser.getAllSlides();

    // Any already-completed slide that changed object identity between frames
    // would re-render its memoized component — the regression being fixed.
    for (let i = 0; i < previousCompleted.length; i++) {
      if (previousCompleted[i] !== completed[i]) identityChurn++;
    }
    previousCompleted = [...completed];

    const pending = parser.getPendingBuffer();
    if (pending.includes("<SECTION")) {
      const previewParser = new SlideParser();
      previewParser.parseChunk(stripXmlCodeBlock(pending));
      previewParser.finalize();
      maxPreviewCount = Math.max(
        maxPreviewCount,
        previewParser.getAllSlides().length,
      );
    }
  }

  // Generation ends by parsing the batch's final text with a fresh parser
  // (unchanged behavior), so mirror that for the terminal state.
  return { slides: parser.getAllSlides(), maxPreviewCount, identityChurn };
}

function splitIntoChunks(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function summarize(slides: PlateSlide[]): string {
  return JSON.stringify(
    slides.map((slide) => ({
      layoutType: slide.layoutType,
      alignment: slide.alignment,
      rootImageQuery: slide.rootImage?.query,
      content: slide.content,
    })),
  );
}

let failures = 0;
function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// A single token can straddle any tag boundary, so vary the chunk size to
// cover splits mid-tag, mid-attribute and mid-text.
const CHUNK_SIZES = [1, 3, 7, 16, 64, 257, DECK.length];
const EXPECTED_SLIDES = 4;

console.log("Streaming parser: incremental vs reset-and-reparse\n");

for (const size of CHUNK_SIZES) {
  console.log(`chunk size ${size}:`);
  const chunks = splitIntoChunks(DECK, size);

  const resetSlides = parseWithResetStrategy(chunks);
  const { slides, maxPreviewCount, identityChurn } =
    parseWithIncrementalStrategy(chunks);

  check(
    `produces ${EXPECTED_SLIDES} slides`,
    slides.length === EXPECTED_SLIDES,
    `got ${slides.length}`,
  );
  check(
    "matches the previous strategy's output",
    summarize(slides) === summarize(resetSlides),
    `incremental=${slides.length} slides, reset=${resetSlides.length} slides`,
  );
  check(
    "no duplicate slides",
    new Set(slides.map((s) => s.id)).size === slides.length,
    `${slides.length - new Set(slides.map((s) => s.id)).size} duplicates`,
  );
  check(
    "completed slides keep object identity across frames",
    identityChurn === 0,
    `${identityChurn} identity changes`,
  );
  check(
    "preview never exceeds one in-progress slide",
    maxPreviewCount <= 1,
    `saw ${maxPreviewCount}`,
  );
  console.log("");
}

// Guard the specific failure that made reset() necessary in the first place:
// feeding the full accumulated stream to a non-reset parser duplicates slides.
const naiveParser = new SlideParser();
let accumulated = "";
for (const chunk of splitIntoChunks(DECK, 64)) {
  accumulated += chunk;
  naiveParser.parseChunk(accumulated);
}
naiveParser.finalize();
console.log("regression guard:");
check(
  "appendChunk avoids the duplication that full-stream parseChunk causes",
  naiveParser.getAllSlides().length > EXPECTED_SLIDES,
  `naive parseChunk produced ${naiveParser.getAllSlides().length} slides ` +
    `(expected duplication above ${EXPECTED_SLIDES}); if this now equals ` +
    `${EXPECTED_SLIDES}, parseChunk's diffing changed and the comment in ` +
    `appendChunk should be revisited`,
);

console.log(
  failures === 0
    ? "\nAll checks passed."
    : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
