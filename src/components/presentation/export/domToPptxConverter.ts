/**
 * DOM-based PPTX Converter
 * Converts scanned slide DOM data to PPTX using pptxgenjs
 */

import PptxGenJS from "pptxgenjs";

import { type PlateSlide } from "@/components/notebook/presentation/utils/parser";
import {
  calculateHeightFromRatio,
  getSlideBaseWidth,
} from "@/config/slideFormats";
import {
  resolveExportImageSource,
  type ExportImageSource,
} from "@/lib/image-proxy";
import {
  type BackgroundRectExportElement,
  type DecorExportElement,
  type ElementPosition,
  type ExportElement,
  type ImageExportElement,
  type PresentationStyles,
  type RootImageData,
  type ScanResult,
  type ShapeExportElement,
  type TableExportElement,
  type TextExportElement,
} from "./types";

// Fallback canvas size (16:9) used only if no slide could be measured.
const DEFAULT_SLIDE_WIDTH_INCHES = 10;
const DEFAULT_SLIDE_HEIGHT_INCHES = 5.625;

/**
 * Fixed reference width for font-size conversion, matching the Fabric
 * converter. Presentation slides use em-based typography (e.g.
 * h1 = 3em = 48px at base 16px), so the computed CSS px values are identical
 * regardless of the slide's configured base width (896/1024/1152 for S/M/L).
 * Using a fixed reference avoids inflating font sizes for narrower slides.
 */
const FONT_REFERENCE_WIDTH_PX = 1280;

/**
 * Pixels-per-inch at the reference width.
 * 1280px / 10in = 128 px/in.
 */
const PX_PER_INCH = FONT_REFERENCE_WIDTH_PX / DEFAULT_SLIDE_WIDTH_INCHES;

/**
 * Fixed conversion factor: CSS px → PPTX points.
 * 72 pt/in ÷ 128 px/in = 0.5625 pt/px.
 * Shared conversion constant for presentation export.
 */
const POINTS_PER_PIXEL = 72 / PX_PER_INCH;

type ImageDimensions = {
  width: number;
  height: number;
};

/**
 * PPTX has a single canvas size for the whole file (unlike the editor,
 * where each slide can have its own aspect ratio). Deriving it from a
 * slide's *configured* aspectRatio/formatCategory (the same source
 * SlideWrapper uses on screen) instead of its rendered DOM box keeps the
 * exported file's proportions matching whatever ratio was actually chosen
 * for the deck (4:3, 1:1, 9:16, A4, ...) reliably -- a scanned DOM box can
 * be taller/wider than intended when a slide's content (e.g. an oversized
 * picture) grows it past its configured min-height, which would otherwise
 * skew the whole deck's canvas off whatever slide happened to be scanned
 * first.
 */
function getDeckCanvasInches(
  slides: PlateSlide[],
  scanResults: ScanResult[],
): {
  widthInches: number;
  heightInches: number;
} {
  const configuredSlide = slides.find(
    (slide) => slide.aspectRatio && slide.aspectRatio.type !== "fluid",
  );

  if (configuredSlide?.aspectRatio) {
    const baseWidthPx = getSlideBaseWidth(
      configuredSlide.formatCategory ?? "presentation",
      (configuredSlide.width as "S" | "M" | "L" | undefined) ?? "M",
      configuredSlide.aspectRatio,
    );
    const heightConfig = calculateHeightFromRatio(
      baseWidthPx,
      configuredSlide.aspectRatio,
    );

    if (heightConfig.minHeightPx) {
      return {
        widthInches: DEFAULT_SLIDE_WIDTH_INCHES,
        heightInches:
          DEFAULT_SLIDE_WIDTH_INCHES * (heightConfig.minHeightPx / baseWidthPx),
      };
    }
  }

  // No fixed ratio configured (e.g. "Dynamic" deck) -- there's no single
  // "correct" ratio to derive from configuration, so fall back to the
  // first measurable rendered slide as a best-effort approximation.
  const reference = scanResults.find(
    (result) => result.width > 0 && result.height > 0,
  );

  if (!reference) {
    return {
      widthInches: DEFAULT_SLIDE_WIDTH_INCHES,
      heightInches: DEFAULT_SLIDE_HEIGHT_INCHES,
    };
  }

  return {
    widthInches: DEFAULT_SLIDE_WIDTH_INCHES,
    heightInches:
      DEFAULT_SLIDE_WIDTH_INCHES * (reference.height / reference.width),
  };
}

/**
 * Convert scanned slides to PPTX
 */
async function convertToPptx(
  scanResults: ScanResult[],
  slides: PlateSlide[],
): Promise<ArrayBuffer> {
  const pptx = new PptxGenJS();
  const { widthInches, heightInches } = getDeckCanvasInches(
    slides,
    scanResults,
  );
  pptx.defineLayout({ name: "DECK_LAYOUT", width: widthInches, height: heightInches });
  pptx.layout = "DECK_LAYOUT";

  // Process each slide
  for (let i = 0; i < scanResults.length; i++) {
    const scanResult = scanResults[i];
    const slideData = slides.find((slide) => slide.id === scanResult?.slideId);

    if (!scanResult || !slideData) continue;

    await addSlide(pptx, scanResult, slideData, widthInches, heightInches);
  }

  // Generate the file
  const data = await pptx.write({ outputType: "arraybuffer" });
  return data as ArrayBuffer;
}

/**
 * Add a single slide to the presentation
 */
async function addSlide(
  pptx: PptxGenJS,
  scanResult: ScanResult,
  slideData: PlateSlide,
  slideWidthInches: number,
  slideHeightInches: number,
): Promise<void> {
  const slide = pptx.addSlide();

  // SPECIAL HANDLING: Image Slide
  // If this is an image slide, we just want the image to fill the slide completely
  // and ignore all other content
  if (slideData.isImageSlide && slideData.rootImage?.url) {
    const imageSource = await resolveExportImageSource(
      slideData.rootImage.url,
      slideData.rootImage,
    );
    const imageDimensions = await loadImageDimensionsFromSource(imageSource);
    const sourceSize = getPptSourceSizeForCover(imageDimensions);

    // Use 'data' for base64 images, 'path' for URLs
    const imageProps: PptxGenJS.ImageProps = {
      x: 0,
      y: 0,
      w: sourceSize.w,
      h: sourceSize.h,
      sizing: {
        type: "cover",
        w: slideWidthInches,
        h: slideHeightInches,
      },
    };

    if (imageSource.type === "data") {
      imageProps.data = imageSource.value;
    } else {
      imageProps.path = imageSource.value;
    }

    try {
      slide.addImage(imageProps);
    } catch (error) {
      console.warn("Failed to add image slide image:", error);
    }

    // Stop processing this slide
    return;
  }

  const {
    styles,
    elements,
    rootImage: scannedRootImage,
    backgroundImageUrl,
  } = scanResult;

  // Set slide background color ONLY if it's a non-white, non-black color
  // (black "000000" is the default fallback which we don't want)
  // (white "FFFFFF" is the standard slide background)
  const bgColor = styles.backgroundColor;
  const skipColors = ["000000", "FFFFFF", ""];
  if (bgColor && !skipColors.includes(bgColor.toUpperCase())) {
    slide.background = { color: bgColor };
  }

  // Handle background image (layout type "background")
  if (backgroundImageUrl) {
    try {
      const backgroundSource =
        await resolveExportImageSource(backgroundImageUrl);
      if (backgroundSource.type === "data") {
        slide.addImage({
          data: backgroundSource.value,
          x: 0,
          y: 0,
          w: slideWidthInches,
          h: slideHeightInches,
          sizing: {
            type: "crop",
            w: slideWidthInches,
            h: slideHeightInches,
          },
        });
      } else {
        slide.background = {
          path: backgroundSource.value,
        };
      }
    } catch (error) {
      console.warn("Failed to set background image:", error);
    }
  }

  if (scannedRootImage?.url) {
    // Use DOM-scanned position for accurate placement
    const position = scalePosition(
      scannedRootImage.position,
      slideWidthInches,
      slideHeightInches,
    );
    await addRootImage(slide, scannedRootImage, position);
  }

  // Add all scanned elements (includes in-editor images from contentWalker)
  for (const element of elements) {
    await addElement(slide, element, slideWidthInches, slideHeightInches, styles);
  }
}

/**
 * Add root image to slide.
 * Prefer originalUrl (the actual source URL) over the captured base64 snapshot.
 * The captures can be identical across slides when toPng hits CORS/timing
 * issues, causing pptxgenjs to deduplicate all slides onto the first image.
 */
async function addRootImage(
  slide: PptxGenJS.Slide,
  rootImage: RootImageData,
  position: { x: number; y: number; w: number; h: number },
): Promise<void> {
  const urlToUse = rootImage.originalUrl ?? rootImage.url;
  const imageSource = urlToUse.startsWith("data:")
    ? ({ type: "data", value: urlToUse } satisfies ExportImageSource)
    : await resolveExportImageSource(urlToUse, rootImage);
  const imageDimensions = await loadImageDimensionsFromSource(imageSource);
  const sourceSize = getPptSourceSizeForCover(imageDimensions);

  const imageOptions: PptxGenJS.ImageProps = {
    x: position.x,
    y: position.y,
    w: sourceSize.w,
    h: sourceSize.h,
    sizing: {
      type: "cover",
      w: position.w,
      h: position.h,
    },
  };

  if (imageSource.type === "data") {
    imageOptions.data = imageSource.value;
  } else {
    imageOptions.path = imageSource.value;
  }

  try {
    slide.addImage(imageOptions);
  } catch (error) {
    console.warn("Failed to add root image:", error);
  }
}

function getPptSourceSizeForCover(dimensions: ImageDimensions | null): {
  w: number;
  h: number;
} {
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    return { w: 1, h: 1 };
  }

  return {
    w: dimensions.width / dimensions.height,
    h: 1,
  };
}

function loadImageDimensionsFromSource(
  source: ExportImageSource,
): Promise<ImageDimensions | null> {
  return loadImageDimensions(source.value).catch((error: unknown) => {
    console.warn("Failed to load export image dimensions:", error);
    return null;
  });
}

function loadImageDimensions(url: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        return;
      }

      reject(new Error("Image loaded without natural dimensions."));
    };
    img.onerror = () => reject(new Error(`Unable to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Add a scanned element to the slide
 */
async function addElement(
  slide: PptxGenJS.Slide,
  element: ExportElement,
  slideWidthInches: number,
  slideHeightInches: number,
  styles: PresentationStyles,
): Promise<void> {
  const position = scalePosition(
    element.position,
    slideWidthInches,
    slideHeightInches,
  );

  switch (element.type) {
    case "text":
      addTextElement(slide, element, position, styles);
      break;
    case "table":
      addTable(slide, element, position, styles);
      break;
    case "image":
      await addImageElement(slide, element, position);
      break;
    case "decor":
      addDecorElement(slide, element, position);
      break;
    case "shape":
      addShapeElement(slide, element, position);
      break;
    case "backgroundRect":
      addBackgroundRectElement(slide, element, position);
      break;
  }
}

/**
 * Convert position from percentage (0-100) to inches
 * ContentWalker returns positions as percentages relative to slide dimensions
 * If aspectRatio is present, preserve proportions while fitting inside
 * the original measured box so export never grows beyond DOM bounds.
 */
function scalePosition(
  position: ElementPosition,
  slideWidthInches: number,
  slideHeightInches: number,
): { x: number; y: number; w: number; h: number } {
  let x = (position.x / 100) * slideWidthInches;
  let y = (position.y / 100) * slideHeightInches;
  let w = (position.width / 100) * slideWidthInches;
  let h = (position.height / 100) * slideHeightInches;

  const originalW = w;
  const originalH = h;

  // Preserve aspect ratio while constraining to original measured bounds.
  // This prevents wide charts from expanding outside the slide.
  if (position.aspectRatio !== undefined && position.aspectRatio > 0) {
    if (position.aspectRatioBase === "height") {
      // Start from height, then clamp into the original box.
      w = h * position.aspectRatio;
      if (w > originalW) {
        w = originalW;
        h = w / position.aspectRatio;
      }
    } else {
      // Start from width, then clamp into the original box.
      h = w / position.aspectRatio;
      if (h > originalH) {
        h = originalH;
        w = h * position.aspectRatio;
      }
    }
  }

  if (position.centerAspectRatio) {
    x += (originalW - w) / 2;
    y += (originalH - h) / 2;
  }

  return { x, y, w, h };
}

/**
 * Fallback CSS font sizes (px) for Plate text nodes.
 * Used only when the browser returns an invalid computed font size.
 */
const FALLBACK_FONT_SIZES_PX: Record<string, number> = {
  h1: 48,
  h2: 30,
  h3: 24,
  h4: 20,
  h5: 18,
  h6: 16,
  p: 16,
  blockquote: 16,
  code_block: 16,
  li: 16,
  ul: 16,
  ol: 16,
};

/**
 * Get fallback CSS font size based on node type.
 */
function getFallbackFontSizePx(nodeType?: string): number {
  if (!nodeType) return FALLBACK_FONT_SIZES_PX.p!;
  return FALLBACK_FONT_SIZES_PX[nodeType] ?? FALLBACK_FONT_SIZES_PX.p!;
}

/**
 * Convert a CSS px font size to PPTX points using the fixed conversion factor.
 * Converts with `fontSize = fontSizePx * POINTS_PER_PIXEL`.
 */
function fontSizePxToPptPoints(fontSizePx: number): number {
  return Math.max(1, fontSizePx * POINTS_PER_PIXEL);
}

function getMeasuredFontSizePx(
  fontSizePx: number | undefined,
  nodeType?: string,
): number {
  if (fontSizePx && Number.isFinite(fontSizePx) && fontSizePx > 0) {
    return fontSizePx;
  }

  return getFallbackFontSizePx(nodeType);
}

/**
 * Add text element
 */
function addTextElement(
  slide: PptxGenJS.Slide,
  element: TextExportElement,
  position: { x: number; y: number; w: number; h: number },
  styles: PresentationStyles,
): void {
  const { textContent, textStyles, nodeType } = element;

  if (!textContent.trim()) return;

  const fontSizePx = getMeasuredFontSizePx(textStyles.fontSize, nodeType);
  const fontSizePt = fontSizePxToPptPoints(fontSizePx);
  const lineHeightPx = textStyles.lineHeight;
  const lineSpacingMultiple =
    lineHeightPx && Number.isFinite(lineHeightPx) && fontSizePx > 0
      ? Math.max(0.1, Math.min(9.99, lineHeightPx / fontSizePx))
      : undefined;

  // Check if this is a heading type
  const isHeading = nodeType && /^h[1-6]$/.test(nodeType);

  const textOptions: PptxGenJS.TextPropsOptions = {
    x: position.x,
    y: position.y,
    w: position.w,
    h: position.h,
    fontSize: fontSizePt,
    fontFace: isHeading
      ? styles.headingFont || textStyles.fontFamily
      : textStyles.fontFamily || styles.bodyFont,
    color: isHeading
      ? styles.headingColor || textStyles.color
      : textStyles.color || styles.textColor,
    align: textStyles.textAlign || "left",
    valign: "top",
    wrap: true,
    // Auto-shrink text to fit within the bounding box if it overflows
    // This ensures text that fits in HTML also fits in the exported PPT
    fit: "shrink",
    lineSpacingMultiple,
  };

  // Add bold for headings or if specified
  if (
    isHeading ||
    (textStyles.fontWeight &&
      (textStyles.fontWeight === "bold" ||
        Number(textStyles.fontWeight) >= 700))
  ) {
    textOptions.bold = true;
  }
  if (textStyles.fontStyle === "italic") {
    textOptions.italic = true;
  }
  if (textStyles.textDecoration?.includes("underline")) {
    textOptions.underline = { style: "sng" };
  }

  // Add background if present
  if (element.backgroundColor) {
    textOptions.fill = { color: element.backgroundColor.replace("#", "") };
  }

  slide.addText(textContent, textOptions);
}

/**
 * Add SVG element as image
 */

/**
 * Add chart element as image
 */

/**
 * Add decorative element
 */
function addDecorElement(
  slide: PptxGenJS.Slide,
  element: DecorExportElement,
  position: { x: number; y: number; w: number; h: number },
): void {
  if (!element.base64Data) return;

  try {
    slide.addImage({
      data: element.base64Data,
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      sizing: {
        type: "contain",
        w: position.w,
        h: position.h,
      },
    });
  } catch (error) {
    console.warn("Failed to add decor element:", error);
  }
}

/**
 * Add shape element
 */

/**
 * Add native shape element (arrow, pill, parallelogram)
 */
function addShapeElement(
  slide: PptxGenJS.Slide,
  element: ShapeExportElement,
  position: { x: number; y: number; w: number; h: number },
): void {
  try {
    // Use string literals cast to the correct type to ensure runtime compatibility
    // while satisfying the type checker.
    let shapeType: PptxGenJS.SHAPE_NAME = "rect";
    let rotate = 0;
    let rectRadius = 0;

    const isHorizontal = element.orientation === "horizontal";

    switch (element.shapeType) {
      case "arrow":
        // Use rightArrow for horizontal, downArrow (or rotated) for vertical
        if (isHorizontal) {
          shapeType = "rightArrow";
        } else {
          shapeType = "downArrow";
        }
        break;
      case "pill":
        shapeType = "roundRect";
        // Fully rounded for pill effect (pptxgenjs maps 1.0 to fully rounded)
        rectRadius = 1.0;
        break;
      case "parallelogram":
        shapeType = "parallelogram";
        // Vertical parallelogram needs rotation to match look
        if (!isHorizontal) {
          rotate = 90;
        }
        break;
      case "ellipse":
        shapeType = "ellipse";
        break;
      case "rect":
        shapeType = "rect";
        break;
    }

    slide.addShape(shapeType, {
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      fill: { color: element.fillColor.replace("#", "") },
      rotate: rotate,
      rectRadius: rectRadius > 0 ? rectRadius : undefined,
      line: { type: "none" }, // Minimal/no border for these shapes
    });

    if (element.textContent?.trim()) {
      slide.addText(element.textContent, {
        x: position.x,
        y: position.y + position.h * 0.27,
        w: position.w,
        h: position.h * 0.5,
        fontSize: Math.min(Math.max(position.h * 72 * 0.42, 8), 14),
        bold: true,
        color: (element.textColor ?? "FFFFFF").replace("#", ""),
        align: "center",
        margin: 0,
        fit: "shrink",
      });
    }
  } catch (error) {
    console.warn("Failed to add shape element:", error);
  }
}

/**
 * Add background rectangle element (renders as PPT shape with fill color)
 */
function addBackgroundRectElement(
  slide: PptxGenJS.Slide,
  element: BackgroundRectExportElement,
  position: { x: number; y: number; w: number; h: number },
): void {
  try {
    // Calculate rectRadius (pptxgenjs uses 0-1 scale, where 1 = fully rounded)
    // cornerRadius from DOM is in pixels, position.h is in inches
    // Convert: pixels / (inches * 96 dpi) gives us ratio, then cap at 0.5
    const heightInPx = position.h * 96;
    const rectRadius = element.cornerRadius
      ? Math.min(element.cornerRadius / heightInPx, 0.5)
      : 0;

    // Parse gradient if present
    const gradientFill = parseGradientToFill(element.background);

    // Use "roundRect" when there's a corner radius, "rect" otherwise
    // IMPORTANT: rectRadius property ONLY works with "roundRect" shape type!
    const shapeType = rectRadius > 0 ? "roundRect" : "rect";

    slide.addShape(shapeType, {
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      fill: gradientFill || { color: element.fillColor.replace("#", "") },
      rectRadius: rectRadius > 0 ? rectRadius : undefined,
      line: element.borderWidth
        ? {
            color: element.borderColor?.replace("#", "") || "000000",
            width: element.borderWidth,
          }
        : { type: "none" }, // Completely remove border - { width: 0 } still renders a faint line
    });
  } catch (error) {
    console.warn("Failed to add background rect element:", error);
  }
}

/**
 * Parse CSS gradient string to pptxgenjs fill object
 * Since pptxgenjs shapes don't support gradient fills, we extract the first
 * color from the gradient and use it as a solid fill.
 *
 * Handles full computed CSS background property like:
 * "rgba(0, 0, 0, 0) linear-gradient(135deg, rgb(231, 76, 60) 0%, rgb(192, 57, 43) 100%) repeat scroll 0% 0% / auto padding-box border-box"
 */
function parseGradientToFill(
  background?: string,
): PptxGenJS.ShapeFillProps | null {
  if (!background || !background.includes("linear-gradient")) {
    return null;
  }

  // Extract just the linear-gradient(...) portion from the full background string
  // Match: linear-gradient( ... balanced parentheses ... )
  const gradientExtractRegex =
    /linear-gradient\(([^()]*(?:\([^()]*\)[^()]*)*)\)/;
  const extractMatch = background.match(gradientExtractRegex);

  if (!extractMatch || !extractMatch[1]) {
    return null;
  }

  // Extract the first color from the gradient content
  // Matches hex colors and rgb/rgba formats
  const colorRegex =
    /#[0-9a-fA-F]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/;
  const colorMatch = extractMatch[1].match(colorRegex);

  if (!colorMatch || !colorMatch[0]) {
    return null;
  }

  // Use the first color as a solid fill (pptxgenjs shapes don't support gradients)
  const firstColor = colorToHexSimple(colorMatch[0]);

  return {
    type: "solid",
    color: firstColor,
  };
}

/**
 * Simple hex color converter helper
 * Converts CSS color formats to hex (without #)
 */
function colorToHexSimple(color: string): string {
  if (!color) return "FFFFFF";

  // Already hex
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    // Handle shorthand hex (#abc -> AABBCC)
    if (hex.length === 3) {
      return (
        hex[0]! +
        hex[0]! +
        hex[1]! +
        hex[1]! +
        hex[2]! +
        hex[2]!
      ).toUpperCase();
    }
    return hex.toUpperCase();
  }

  // Handle rgb/rgba
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]!, 10);
    const g = parseInt(rgbMatch[2]!, 10);
    const b = parseInt(rgbMatch[3]!, 10);
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  return "FFFFFF";
}

/**
 * Add bullet list element
 */

/**
 * Add table element
 */
function addTable(
  slide: PptxGenJS.Slide,
  element: TableExportElement,
  position: { x: number; y: number; w: number; h: number },
  styles: PresentationStyles,
): void {
  const rows = element.rows.map((row) =>
    row.cells.map((cell) => ({
      text: cell.text,
      options: {
        fill: cell.isHeader
          ? { color: styles.cardBackground.replace("#", "") }
          : cell.backgroundColor
            ? { color: cell.backgroundColor.replace("#", "") }
            : undefined,
        bold: cell.isHeader,
        color: cell.textStyles?.color || styles.textColor,
        fontFace: cell.textStyles?.fontFamily || styles.bodyFont,
        fontSize: fontSizePxToPptPoints(
          getMeasuredFontSizePx(cell.textStyles?.fontSize, "p"),
        ),
        colspan: cell.colSpan,
        rowspan: cell.rowSpan,
      },
    })),
  );

  slide.addTable(rows, {
    x: position.x,
    y: position.y,
    w: position.w,
    // Auto-calculate row height or let PPTX handle it
  });
}

/**
 * Add image element (in-editor)
 */
async function addImageElement(
  slide: PptxGenJS.Slide,
  element: ImageExportElement,
  position: { x: number; y: number; w: number; h: number },
): Promise<void> {
  try {
    const imageSizing = {
      type: (element.sizing === "fill" ? "crop" : element.sizing) || "contain",
      w: position.w,
      h: position.h,
    } as const;

    // html-to-image returns chart snapshots as data URLs; these must use `data`
    // in pptxgenjs, not `path`, otherwise media metadata/targets can be invalid.
    const isBase64Image =
      element.url.startsWith("data:image/") ||
      (element.url.startsWith("image/") && element.url.includes("base64,"));

    if (isBase64Image) {
      slide.addImage({
        data: element.url,
        x: position.x,
        y: position.y,
        w: position.w,
        h: position.h,
        sizing: imageSizing,
      });
      return;
    }

    const imageSource = await resolveExportImageSource(element.url, element);
    const imageOptions: PptxGenJS.ImageProps = {
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      sizing: imageSizing,
    };

    if (imageSource.type === "data") {
      imageOptions.data = imageSource.value;
    } else {
      imageOptions.path = imageSource.value;
    }

    slide.addImage(imageOptions);
  } catch (error) {
    console.warn("Failed to add image element:", error);
  }
}

/**
 * Export function for client-side use
 * Returns the blob and fileName for manual download handling
 */
export async function exportPresentationToPptx(
  scanResults: ScanResult[],
  slides: PlateSlide[],
  fileName: string = "presentation",
): Promise<{ blob: Blob; fileName: string }> {
  const arrayBuffer = await convertToPptx(scanResults, slides);

  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });

  return { blob, fileName: `${fileName}.pptx` };
}
