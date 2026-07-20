import { KEYS, nanoid, NodeApi, type TElement } from "platejs";
import { type PlateEditor } from "platejs/react";

export type PaletteDropSource = "basicBlocks" | "charts" | "elements";

export type PaletteDropTarget = {
  editorId: string;
  elementId: string;
  itemKey?: string;
  source: PaletteDropSource;
  targetKind?: "element" | "rootImage";
  mutableSignature?: string;
};

export const PALETTE_DROP_MUTABLE_KEY = "paletteDropMutable";
const EMPTY_PLACEHOLDER_BLOCK_TYPES = new Set([
  KEYS.p,
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

type PaletteDragItem = {
  element?: unknown;
  itemKey?: unknown;
  sourcePanel?: PaletteDropSource;
};

function isElementNode(node: unknown): node is TElement {
  return (
    typeof node === "object" &&
    node !== null &&
    "type" in node &&
    "children" in node
  );
}

function cloneTextLikeNode(node: unknown): unknown {
  if (typeof node !== "object" || node === null) {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((child) =>
      isElementNode(child)
        ? cloneElementWithFreshIds(child)
        : cloneTextLikeNode(child),
    );
  }

  return { ...(node as Record<string, unknown>) };
}

function cloneElementWithFreshIds(
  element: TElement,
  preservedRootId?: string,
): TElement {
  const elementRecord = element as TElement & Record<string, unknown>;
  const children = Array.isArray(elementRecord.children)
    ? elementRecord.children.map((child) =>
        isElementNode(child)
          ? cloneElementWithFreshIds(child)
          : cloneTextLikeNode(child),
      )
    : [];

  return {
    ...elementRecord,
    id: preservedRootId ?? nanoid(),
    [PALETTE_DROP_MUTABLE_KEY]: true,
    children,
  } as TElement;
}

export function isPaletteDropMutable(target: unknown): boolean {
  return (
    typeof target === "object" &&
    target !== null &&
    (target as Record<string, unknown>)[PALETTE_DROP_MUTABLE_KEY] === true
  );
}

function normalizeForPaletteSignature(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForPaletteSignature);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const valueRecord = value as Record<string, unknown>;
  const normalizedEntries = Object.keys(valueRecord)
    .filter(
      (key) =>
        key !== "id" &&
        key !== "lastUpdate" &&
        key !== PALETTE_DROP_MUTABLE_KEY,
    )
    .sort()
    .map((key) => [key, normalizeForPaletteSignature(valueRecord[key])]);

  return Object.fromEntries(normalizedEntries);
}

export function getPaletteMutableSignature(value: unknown): string {
  return JSON.stringify(normalizeForPaletteSignature(value));
}

export function clonePaletteDropElements(element: unknown): TElement[] {
  if (Array.isArray(element)) {
    return element
      .filter(isElementNode)
      .map((node) => cloneElementWithFreshIds(node));
  }

  return isElementNode(element) ? [cloneElementWithFreshIds(element)] : [];
}

export function getPaletteDragSource(
  dragItem: unknown,
): PaletteDropSource | null {
  const sourcePanel = (dragItem as PaletteDragItem | undefined)?.sourcePanel;

  return sourcePanel === "basicBlocks" ||
    sourcePanel === "elements" ||
    sourcePanel === "charts"
    ? sourcePanel
    : null;
}

export function getPaletteDragItemKey(dragItem: unknown): string | undefined {
  const itemKey = (dragItem as PaletteDragItem | undefined)?.itemKey;

  return typeof itemKey === "string" ? itemKey : undefined;
}

export function getElementId(element: TElement | undefined): string | null {
  const id = (element as { id?: unknown } | undefined)?.id;

  return typeof id === "string" ? id : null;
}

function isEmptyPlaceholderBlock(node: unknown): node is TElement {
  return (
    isElementNode(node) &&
    EMPTY_PLACEHOLDER_BLOCK_TYPES.has(node.type) &&
    NodeApi.string(node).trim().length === 0
  );
}

function getEmptyPlaceholderFallback(
  editor: PlateEditor,
): [TElement, number[]] | null {
  if (!editor.api.isEmpty()) return null;

  const firstBlock = editor.children[0];

  return isEmptyPlaceholderBlock(firstBlock) ? [firstBlock, [0]] : null;
}

export function replaceElementById(
  editor: PlateEditor,
  elementId: string,
  nextElement: TElement,
  expectedMutableSignature?: string,
): boolean {
  const entry = editor.api.node({ id: elementId, at: [] });

  if (!entry) return false;

  const [currentElement, path] = entry;

  if (!isPaletteDropMutable(currentElement)) return false;
  if (
    expectedMutableSignature &&
    getPaletteMutableSignature(currentElement) !== expectedMutableSignature
  ) {
    return false;
  }

  const replacement = cloneElementWithFreshIds(nextElement, elementId);

  editor.tf.withoutNormalizing(() => {
    editor.tf.removeNodes({ at: path });
    editor.tf.insertNodes(replacement, { at: path });
  });

  return true;
}

export function replaceFocusedEmptyParagraph(
  editor: PlateEditor,
  nextElement: TElement,
): TElement | null {
  const focus = editor.selection?.focus;
  const blockEntry = focus ? editor.api.block({ at: focus }) : null;
  const targetEntry =
    blockEntry && isEmptyPlaceholderBlock(blockEntry[0])
      ? blockEntry
      : getEmptyPlaceholderFallback(editor);

  if (!targetEntry) return null;

  const [, blockPath] = targetEntry;

  const replacement = cloneElementWithFreshIds(nextElement);

  editor.tf.withoutNormalizing(() => {
    editor.tf.removeNodes({ at: blockPath });
    editor.tf.insertNodes(replacement, { at: blockPath });
  });

  return replacement;
}
