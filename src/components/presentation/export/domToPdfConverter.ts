/**
 * DOM-based PDF export.
 * Rasterizes each rendered slide (same capture path used for root images
 * and thumbnails) and assembles a multi-page PDF, one page per slide,
 * sized to match that slide's actual rendered aspect ratio.
 */

import { toPng } from "html-to-image";
import { PDFDocument } from "pdf-lib";

import { type PlateSlide } from "@/components/notebook/presentation/utils/parser";
import { getOptimalPixelRatio } from "./utils";

async function captureSlideAsPng(slideId: string): Promise<string | null> {
  const slideElement = document.querySelector(
    `#presentation-root-${slideId}`,
  );
  if (!slideElement || !(slideElement instanceof HTMLElement)) {
    console.warn(`Slide container not found for slide: ${slideId}`);
    return null;
  }

  return toPng(slideElement, {
    cacheBust: true,
    quality: 1,
    pixelRatio: getOptimalPixelRatio(),
    skipFonts: true,
  });
}

/**
 * Export the presentation as a multi-page PDF (one rasterized page per slide).
 * Returns the blob and fileName for manual download handling.
 */
export async function exportPresentationToPdf(
  slides: PlateSlide[],
  fileName: string = "presentation",
  onProgress?: (completed: number, total: number) => void,
): Promise<{ blob: Blob; fileName: string }> {
  const pdfDoc = await PDFDocument.create();
  const total = slides.length;
  let completed = 0;

  for (const slide of slides) {
    const pngDataUrl = await captureSlideAsPng(slide.id);
    completed++;
    onProgress?.(completed, total);

    if (!pngDataUrl) continue;

    const pngImage = await pdfDoc.embedPng(pngDataUrl);
    const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: pngImage.width,
      height: pngImage.height,
    });
  }

  if (pdfDoc.getPageCount() === 0) {
    throw new Error("Failed to render any slides for PDF export.");
  }

  const pdfBytes = await pdfDoc.save();
  const arrayBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });

  return { blob, fileName: `${fileName}.pdf` };
}
