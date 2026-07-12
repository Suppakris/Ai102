import { pdfjs } from "react-pdf";

import {
  estimateTokenCount,
  MAX_SOURCE_TOKEN_ESTIMATE,
  truncateToTokenBudget,
  type PresentationSourceDocument,
} from "@/lib/presentation/source-document";

// Client-side only: extraction runs in the browser so PDFs never hit the
// server (no upload service, no serverless body-size limits).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// CID-keyed fonts (the norm in Thai/CJK PDFs exported from Word, InDesign,
// etc.) need external cMaps to map glyphs back to Unicode; without them
// getTextContent() returns empty or garbage text. pdfjs-dist doesn't bundle
// them into the app chunk, so they are fetched on demand, version-pinned to
// the exact pdfjs build react-pdf ships.
const PDFJS_ASSET_BASE_URL = `https://unpkg.com/pdfjs-dist@${pdfjs.version}`;

export async function extractPdfSource(
  file: File,
): Promise<PresentationSourceDocument> {
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data,
    cMapUrl: `${PDFJS_ASSET_BASE_URL}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_ASSET_BASE_URL}/standard_fonts/`,
  });
  const pdf = await loadingTask.promise;

  try {
    const pages: string[] = [];
    let estimatedTokens = 0;
    let processedPages = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      page.cleanup();

      let pageText = "";
      for (const item of content.items) {
        if ("str" in item) {
          pageText += item.str;
          pageText += item.hasEOL ? "\n" : " ";
        }
      }

      const trimmed = pageText.replace(/[ \t]+\n/g, "\n").trim();
      if (trimmed) {
        pages.push(trimmed);
        estimatedTokens += estimateTokenCount(trimmed);
      }
      processedPages = pageNumber;

      // Stop paging through huge documents once the budget is exceeded.
      if (estimatedTokens > MAX_SOURCE_TOKEN_ESTIMATE) {
        break;
      }
    }

    const bounded = truncateToTokenBudget(pages.join("\n\n").trim());

    return {
      name: file.name,
      text: bounded.text,
      pageCount: pdf.numPages,
      truncated: bounded.truncated || processedPages < pdf.numPages,
    };
  } finally {
    await loadingTask.destroy();
  }
}
