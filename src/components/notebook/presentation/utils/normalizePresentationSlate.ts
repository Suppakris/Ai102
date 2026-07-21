import { nanoid } from "nanoid";
import {
  type Descendant,
  type TElement,
  type TText,
  type Value,
} from "platejs";

import { type PlateSlide } from "./parser";

const COLUMN_GROUP_TYPE = "column_group";
const COLUMN_TYPE = "column";
const TABLE_TYPE = "table";
const TABLE_ROW_TYPE = "tr";
const TABLE_CELL_TYPES = new Set(["td", "th"]);
const MIN_COLUMN_WIDTH_PERCENT = 10;

const emptyText = (): TText => ({ text: "" });

const emptyParagraph = (): Descendant =>
  ({
    type: "p",
    children: [emptyText()],
  }) as TElement;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTextNode(node: Record<string, unknown>): TText {
  const { children: _children, text, ...rest } = node;

  return {
    ...rest,
    text: typeof text === "string" ? text : "",
  } as TText;
}

function distributeColumnWidths(widths: Array<number | null>): string[] {
  if (widths.length === 0) {
    return [];
  }

  const validWidths = widths.filter((width) => width !== null);
  const shouldResetWidths =
    validWidths.length !== widths.length ||
    validWidths.some((width) => width < MIN_COLUMN_WIDTH_PERCENT);

  return createExactPercentageWidths(
    shouldResetWidths ? widths.map(() => 1) : validWidths,
  );
}

function createExactPercentageWidths(weights: number[]): string[] {
  if (weights.length === 0) {
    return [];
  }

  const safeWeights = weights.map((weight) =>
    Number.isFinite(weight) && weight > 0 ? weight : 0,
  );
  const total = safeWeights.reduce((sum, weight) => sum + weight, 0);
  const percentages =
    total > 0
      ? safeWeights.map((weight) => (weight / total) * 100)
      : safeWeights.map(() => 100 / safeWeights.length);
  let assignedTotal = 0;

  return percentages.map((percentage, index) => {
    const width =
      index === percentages.length - 1 ? 100 - assignedTotal : percentage;

    assignedTotal += width;
    return `${width}%`;
  });
}

function normalizeColumnGroupChildren(children: Descendant[]): Descendant[] {
  const columnWidths = children
    .filter((child) => isRecord(child) && child.type === COLUMN_TYPE)
    .map((child) => parseColumnWidth(child.width));
  const normalizedWidths = distributeColumnWidths(columnWidths);
  let columnIndex = 0;

  return children.map((child) => {
    if (!isRecord(child) || child.type !== COLUMN_TYPE) {
      return child;
    }

    const width = normalizedWidths[columnIndex];
    columnIndex += 1;

    return width ? ({ ...child, width } as TElement) : (child as TElement);
  });
}

function getNodeType(node: Record<string, unknown>): string | undefined {
  return typeof node.type === "string" ? node.type : undefined;
}

function isTableCellType(type: string | undefined): boolean {
  return type !== undefined && TABLE_CELL_TYPES.has(type);
}

function normalizeTableCellContent(child: unknown): Descendant[] {
  if (isRecord(child) && "text" in child) {
    return [normalizeTextNode(child)];
  }

  return [normalizeDescendant(child, "element")];
}

function normalizeTableCellChild(child: unknown): Descendant {
  const normalizedChild = normalizeDescendant(child, "element");

  if (isRecord(normalizedChild) && "text" in normalizedChild) {
    return {
      type: "p",
      children: [normalizedChild],
    } as TElement;
  }

  return normalizedChild;
}

function normalizeTableCellChildren(children: unknown): Descendant[] {
  if (!Array.isArray(children) || children.length === 0) {
    return [emptyParagraph()];
  }

  return children
    .flatMap(normalizeTableCellContent)
    .map(normalizeTableCellChild);
}

function createTableCellFromChild(child: unknown): TElement {
  const normalizedChild = normalizeDescendant(child, "element");
  const children =
    isRecord(normalizedChild) && "text" in normalizedChild
      ? [
          {
            type: "p",
            children: [normalizedChild],
          } as TElement,
        ]
      : [normalizedChild];

  return {
    type: "td",
    id: nanoid(),
    children,
  } as TElement;
}

function normalizeTableRowChildren(children: unknown): Descendant[] {
  if (!Array.isArray(children) || children.length === 0) {
    return [
      {
        type: "td",
        id: nanoid(),
        children: [emptyParagraph()],
      } as TElement,
    ];
  }

  return children.map((child) => {
    if (!isRecord(child) || !isTableCellType(getNodeType(child))) {
      return createTableCellFromChild(child);
    }

    return normalizeElementNode(child);
  });
}

function createTableRowFromChild(child: unknown): TElement {
  const children =
    isRecord(child) && isTableCellType(getNodeType(child))
      ? [normalizeElementNode(child)]
      : [createTableCellFromChild(child)];

  return {
    type: TABLE_ROW_TYPE,
    id: nanoid(),
    children,
  } as TElement;
}

function normalizeTableChildren(children: unknown): Descendant[] {
  if (!Array.isArray(children) || children.length === 0) {
    return [
      {
        type: TABLE_ROW_TYPE,
        id: nanoid(),
        children: [
          {
            type: "td",
            id: nanoid(),
            children: [emptyParagraph()],
          } as TElement,
        ],
      } as TElement,
    ];
  }

  return children.map((child) => {
    if (!isRecord(child) || getNodeType(child) !== TABLE_ROW_TYPE) {
      return createTableRowFromChild(child);
    }

    return normalizeElementNode(child);
  });
}

function parseColumnWidth(width: unknown): number | null {
  if (width === undefined || width === null) return null;

  const parsed = Number.parseFloat(String(width));

  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return Math.round(parsed * 100) / 100;
}

function normalizeElementNode(node: Record<string, unknown>): TElement {
  const type = typeof node.type === "string" ? node.type : "p";
  const id = typeof node.id === "string" && node.id ? node.id : nanoid();
  const normalizedChildren = Array.isArray(node.children)
    ? node.children.map((child) => normalizeDescendant(child, "text"))
    : [];
  const children =
    normalizedChildren.length > 0 ? normalizedChildren : [emptyText()];
  const tableChildren =
    type === TABLE_TYPE
      ? normalizeTableChildren(node.children)
      : type === TABLE_ROW_TYPE
        ? normalizeTableRowChildren(node.children)
        : isTableCellType(type)
          ? normalizeTableCellChildren(node.children)
          : undefined;

  return {
    ...node,
    id,
    type,
    children: tableChildren
      ? tableChildren
      : type === COLUMN_GROUP_TYPE
        ? normalizeColumnGroupChildren(children)
        : children,
  } as TElement;
}

function normalizeDescendant(
  node: unknown,
  fallback: "element" | "text",
): Descendant {
  if (!isRecord(node)) {
    return fallback === "element" ? emptyParagraph() : emptyText();
  }

  if ("text" in node) {
    return normalizeTextNode(node);
  }

  return normalizeElementNode(node);
}

export function normalizePresentationValue(value: unknown): Value {
  if (!Array.isArray(value) || value.length === 0) {
    return [emptyParagraph()] as Value;
  }

  return value.map((node) => normalizeDescendant(node, "element")) as Value;
}

function normalizePresentationSlide(slide: unknown): PlateSlide {
  if (!isRecord(slide)) {
    return {
      id: nanoid(),
      content: [emptyParagraph()],
      alignment: "center",
    } as PlateSlide;
  }

  const id = typeof slide.id === "string" && slide.id ? slide.id : nanoid();

  return {
    ...slide,
    id,
    content: normalizePresentationValue(slide.content) as PlateSlide["content"],
  } as PlateSlide;
}

/**
 * @param previousSlides When provided, a slide whose normalized form is
 * deep-equal to its previous version (matched by id) keeps the PREVIOUS
 * object reference instead of the freshly built one. Without this, every
 * call replaced every slide's identity even when only one slide actually
 * changed -- e.g. `setSlides` is used for undo/redo, and a single-slide
 * undo would otherwise give all N slides a new `content` reference at
 * once, forcing every mounted Plate/Slate editor to resync (a real DOM
 * rebuild) in the same frame regardless of whether its own slide changed.
 * That caused visible freezing and, when the user's cursor/native browser
 * selection pointed into one of the untouched editors while its DOM got
 * rebuilt out from under it, an unrecoverable "Cannot resolve a Slate
 * point from DOM point" crash.
 */
export function normalizePresentationSlides(
  slides: unknown,
  previousSlides: PlateSlide[] = [],
): PlateSlide[] {
  if (!Array.isArray(slides)) {
    return [];
  }

  const previousById = new Map(
    previousSlides.map((slide) => [slide.id, slide]),
  );

  return slides.map((slide) => {
    const normalized = normalizePresentationSlide(slide);
    const previous = previousById.get(normalized.id);

    if (previous && JSON.stringify(previous) === JSON.stringify(normalized)) {
      return previous;
    }

    return normalized;
  });
}
