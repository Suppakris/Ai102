/**
 * DOM-based PDF export.
 * Rasterizes each rendered slide (same capture path used for root images
 * and thumbnails) and assembles a multi-page PDF, one page per slide,
 * sized to match that slide's actual rendered aspect ratio.
 */

import { toPng } from "html-to-image";
import { PDFDocument } from "pdf-lib";

import { type PlateSlide } from "@/components/notebook/presentation/utils/parser";
import { proxyPresentationImageUrl } from "@/lib/image-proxy";
import { getOptimalPixelRatio } from "./utils";

const IMAGE_LOAD_TIMEOUT_MS = 10_000;

// No timeout here previously: if a proxied image never fired load/error
// (a network hiccup, a stalled proxy request), this promise -- and the
// whole export -- hung forever with no error surfaced anywhere, which
// looked like "nothing happens" to the user. Time out and move on instead;
// worst case that one image renders blank rather than blocking the export.
function waitForImageLoad(image: HTMLImageElement): Promise<void> {
  if (image.complete && image.naturalWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, IMAGE_LOAD_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      image.removeEventListener("load", finish);
      image.removeEventListener("error", finish);
    };

    const finish = () => {
      cleanup();
      resolve();
    };

    image.addEventListener("load", finish);
    image.addEventListener("error", finish);
  });
}

/**
 * Route every image in the slide through the CORS-safe image proxy before
 * rasterizing. Most slide images (AI-generated, Unsplash, etc.) live on
 * external hosts that don't send permissive CORS headers, which taints the
 * canvas and makes html-to-image throw instead of producing an image --
 * the same problem the PPTX export already works around for root images.
 */
async function captureSlideAsPng(slideId: string): Promise<string | null> {
  const slideElement = document.querySelector(
    `#presentation-root-${slideId}`,
  );
  if (!slideElement || !(slideElement instanceof HTMLElement)) {
    console.warn(`Slide container not found for slide: ${slideId}`);
    return null;
  }

  const imageElements = Array.from(slideElement.querySelectorAll("img"));
  const replacements: Array<{
    crossOrigin: string | null;
    image: HTMLImageElement;
    src: string;
  }> = [];

  try {
    for (const imageElement of imageElements) {
      const originalSrc = imageElement.currentSrc || imageElement.src;
      const proxiedSrc = proxyPresentationImageUrl(originalSrc, {}, {
        absolute: true,
      });

      if (!proxiedSrc || proxiedSrc === originalSrc) {
        continue;
      }

      replacements.push({
        crossOrigin: imageElement.crossOrigin,
        image: imageElement,
        src: imageElement.src,
      });
      imageElement.crossOrigin = "anonymous";
      imageElement.src = proxiedSrc;
    }

    await Promise.all(
      replacements.map((replacement) => waitForImageLoad(replacement.image)),
    );

    return await toPng(slideElement, {
      cacheBust: true,
      quality: 1,
      pixelRatio: getOptimalPixelRatio(),
      skipFonts: true,
    });
  } finally {
    for (const replacement of replacements) {
      replacement.image.crossOrigin = replacement.crossOrigin;
      replacement.image.src = replacement.src;
    }
  }
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
