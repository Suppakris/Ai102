import { pdfjs } from "react-pdf";

import { type PresentationSourceDocument } from "@/lib/presentation/source-document";

// Client-side only: extraction runs in the browser so PDFs never hit the
// server (no upload service, no serverless body-size limits).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// The whole document (system prompt + user prompt + source text) has to fit in
// OLLAMA_NUM_CTX (default 8192 tokens), so the source text is capped hard.
// Thai tokenizes at roughly 1-2 tokens per character on llama-family models,
// which is why this is conservative.
const MAX_SOURCE_TEXT_LENGTH = 8000;

export async function extractPdfSource(
  file: File,
): Promise<PresentationSourceDocument> {
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  try {
    const pages: string[] = [];
    let totalLength = 0;
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
        totalLength += trimmed.length;
      }
      processedPages = pageNumber;

      // Stop paging through huge documents once the cap is already exceeded.
      if (totalLength > MAX_SOURCE_TEXT_LENGTH) {
        break;
      }
    }

    const fullText = pages.join("\n\n").trim();
    const truncated =
      fullText.length > MAX_SOURCE_TEXT_LENGTH || processedPages < pdf.numPages;

    return {
      name: file.name,
      text: fullText.slice(0, MAX_SOURCE_TEXT_LENGTH),
      pageCount: pdf.numPages,
      truncated,
    };
  } finally {
    await loadingTask.destroy();
  }
}
