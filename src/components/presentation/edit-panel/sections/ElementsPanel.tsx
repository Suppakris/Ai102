"use client";

import { DRAG_ITEM_BLOCK } from "@platejs/dnd";
import {
  Brackets,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleUserRound,
  FileText,
  GripVertical,
  Info,
  List,
  ListChecks,
  ListOrdered,
  MousePointerClick,
  Sigma,
  TableOfContentsIcon,
  ToggleLeft,
  Type,
  type LucideIcon,
} from "lucide-react";
import { useEditorRef } from "platejs/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useDrag } from "react-dnd";

import { updateDroppedElementAfterDrop } from "@/components/notebook/presentation/editor/dnd/utils/updateSiblingsForcefully";
import {
  getElementId,
  getPaletteMutableSignature,
  replaceElementById,
  replaceFocusedEmptyParagraph,
  type PaletteDropTarget,
} from "@/components/notebook/presentation/editor/utils/paletteDrop";
import { type PlateSlide } from "@/components/notebook/presentation/utils/parser";
import { type MyEditor } from "@/components/plate/editor-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePresentationState } from "@/states/presentation-state";
import { ElementPreview } from "./ElementPreview";
import { visiblePaletteItems, type PaletteItem } from "./elements";
import { PanelSearchFilter } from "./PanelSearchFilter";
import { matchesPanelSearch } from "./PanelSearchFilter";

const KEYBOARD_APPLY_DELAY_MS = 250;
type PalettePanelSource = "basicBlocks" | "elements";
type PalettePanelAppearance = "basicBlocks" | "default";

const BASIC_BLOCK_ICON_MAP: Record<string, LucideIcon> = {
  "bulleted-list": List,
  "numbered-list": ListOrdered,
  "todo-list": ListChecks,
  "callout-note": FileText,
  "callout-info": Info,
  "callout-warning": CircleAlert,
  "callout-caution": CircleAlert,
  "callout-success": CircleCheck,
  "callout-question": CircleHelp,
  button: MousePointerClick,
  toggle: ToggleLeft,
  code: Brackets,
  math: Sigma,
  contributors: CircleUserRound,
  toc: TableOfContentsIcon,
};

function createPaletteNode(item: PaletteItem): PaletteItem["node"] {
  return structuredClone(item.node) as PaletteItem["node"];
}

function getElementFilterValue(item: PaletteItem): string {
  if (["quote-large", "quote-side-icon", "quote-side"].includes(item.key)) {
    return "text";
  }
  if (
    ["bullets", "timeline", "steps", "arrows", "arrow-vertical"].includes(
      item.key,
    )
  ) {
    return "process";
  }
  if (
    [
      "slope",
      "snake",
      "pyramid",
      "staircase",
      "cycle",
      "connected-circles",
      "circular-grid",
      "icon-list",
    ].includes(item.key)
  ) {
    return "diagrams";
  }
  if (["boxes", "compare", "before-after", "pros-cons"].includes(item.key)) {
    return "compare";
  }
  if (["columns"].includes(item.key)) {
    return "layout";
  }
  if (
    [
      "table-2x2",
      "table-3x3",
      "table-4x4",
      "stats-plain",
      "stats-circle",
      "stats-star",
      "stats-bar",
      "stats-dot-grid",
      "stats-dot-line",
    ].includes(item.key)
  ) {
    return "data";
  }
  if (["image", "media-embed", "infographic"].includes(item.key)) {
    return "media";
  }
  return "utility";
}

export function ElementsPanel({ isLoaded }: { isLoaded: boolean }) {
  return (
    <PaletteItemsPanel
      emptyMessage="No elements match your search."
      isLoaded={isLoaded}
      paletteItems={visiblePaletteItems}
      searchPlaceholder="Search elements..."
      source="elements"
      getFilterValue={getElementFilterValue}
    />
  );
}

export function PaletteItemsPanel({
  emptyMessage,
  getFilterValue,
  isLoaded,
  paletteItems,
  searchPlaceholder,
  source,
}: {
  emptyMessage: string;
  getFilterValue: (item: PaletteItem) => string;
  isLoaded: boolean;
  paletteItems: PaletteItem[];
  searchPlaceholder: string;
  source: PalettePanelSource;
}) {
  const appearance: PalettePanelAppearance =
    source === "basicBlocks" ? "basicBlocks" : "default";
  const paletteDropTarget = usePresentationState((s) => s.paletteDropTarget);
  const currentSlideId = usePresentationState((s) => s.currentSlideId);
  const setPaletteDropTarget = usePresentationState(
    (s) => s.setPaletteDropTarget,
  );
  const updateSlide = usePresentationState((s) => s.updateSlide);
  const editor = useEditorRef<MyEditor>(currentSlideId ?? undefined);

  const insertFocusedItem = useCallback(
    (item: PaletteItem) => {
      if (!currentSlideId) return;

      const node = createPaletteNode(item);
      const insertedElement = replaceFocusedEmptyParagraph(editor, node);
      const insertedElementId = getElementId(insertedElement ?? undefined);

      if (!insertedElementId) return;

      const insertedEntry = editor.api.node({ id: insertedElementId, at: [] });
      if (insertedEntry) {
        updateDroppedElementAfterDrop(editor, insertedEntry[1]);
      }

      updateSlide(currentSlideId, {
        content: editor.children as PlateSlide["content"],
      });

      const updatedEntry = editor.api.node({ id: insertedElementId, at: [] });
      const [updatedElement] = updatedEntry ?? [];

      setPaletteDropTarget({
        editorId: currentSlideId,
        elementId: insertedElementId,
        itemKey: item.key,
        source,
        mutableSignature: updatedElement
          ? getPaletteMutableSignature(updatedElement)
          : undefined,
      });
    },
    [currentSlideId, editor, setPaletteDropTarget, source, updateSlide],
  );

  if (!isLoaded) {
    return (
      <div
        draggable={false}
        className="animate-fade-in scrollbar-thin flex h-full flex-col gap-4 overflow-y-auto px-4 pb-5 scrollbar-thumb-primary scrollbar-track-transparent"
      >
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: paletteItems.length }).map((_, i) => (
            <div key={i} className="rounded-md border p-2">
              <div className="aspect-video w-full rounded-sm bg-muted/30">
                <Skeleton className="h-full w-full rounded-sm" />
              </div>
              <div className="mt-1.5 flex items-center gap-1 px-0.5">
                <div className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-muted" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (paletteDropTarget?.source === source) {
    return (
      <TrackedElementsPanel
        emptyMessage={emptyMessage}
        getFilterValue={getFilterValue}
        appearance={appearance}
        paletteDropTarget={paletteDropTarget}
        paletteItems={paletteItems}
        searchPlaceholder={searchPlaceholder}
        source={source}
      />
    );
  }

  return (
    <ElementsPanelContent
      emptyMessage={emptyMessage}
      getFilterValue={getFilterValue}
      appearance={appearance}
      paletteItems={paletteItems}
      insertFocusedItem={insertFocusedItem}
      searchPlaceholder={searchPlaceholder}
      source={source}
    />
  );
}

function TrackedElementsPanel({
  appearance,
  emptyMessage,
  getFilterValue,
  paletteDropTarget,
  paletteItems,
  searchPlaceholder,
  source,
}: {
  appearance: PalettePanelAppearance;
  emptyMessage: string;
  getFilterValue: (item: PaletteItem) => string;
  paletteDropTarget: PaletteDropTarget;
  paletteItems: PaletteItem[];
  searchPlaceholder: string;
  source: PalettePanelSource;
}) {
  const setPaletteDropTarget = usePresentationState(
    (s) => s.setPaletteDropTarget,
  );
  const updateSlide = usePresentationState((s) => s.updateSlide);
  const editor = useEditorRef<MyEditor>(paletteDropTarget.editorId);

  const replaceTrackedDrop = useCallback(
    (item: PaletteItem) => {
      const node = createPaletteNode(item);
      const replaced = replaceElementById(
        editor,
        paletteDropTarget.elementId,
        node,
        paletteDropTarget.mutableSignature,
      );

      if (!replaced) {
        setPaletteDropTarget(null);
        return;
      }

      updateSlide(paletteDropTarget.editorId, {
        content: editor.children as PlateSlide["content"],
      });
      const updatedEntry = editor.api.node({
        id: paletteDropTarget.elementId,
        at: [],
      });
      const [updatedElement] = updatedEntry ?? [];

      setPaletteDropTarget({
        ...paletteDropTarget,
        itemKey: item.key,
        mutableSignature: updatedElement
          ? getPaletteMutableSignature(updatedElement)
          : undefined,
      });
    },
    [editor, paletteDropTarget, setPaletteDropTarget, updateSlide],
  );

  const initialSelectedIndex = Math.max(
    paletteItems.findIndex((item) => item.key === paletteDropTarget.itemKey),
    0,
  );

  return (
    <ElementsPanelContent
      key={paletteDropTarget.elementId}
      emptyMessage={emptyMessage}
      getFilterValue={getFilterValue}
      appearance={appearance}
      paletteItems={paletteItems}
      initialSelectedIndex={initialSelectedIndex}
      replaceTrackedDrop={replaceTrackedDrop}
      searchPlaceholder={searchPlaceholder}
      source={source}
    />
  );
}

function ElementsPanelContent({
  appearance,
  emptyMessage,
  getFilterValue,
  paletteItems,
  initialSelectedIndex = 0,
  insertFocusedItem,
  replaceTrackedDrop,
  searchPlaceholder,
  source,
}: {
  appearance: PalettePanelAppearance;
  emptyMessage: string;
  getFilterValue: (item: PaletteItem) => string;
  paletteItems: PaletteItem[];
  initialSelectedIndex?: number;
  insertFocusedItem?: (item: PaletteItem) => void;
  replaceTrackedDrop?: (item: PaletteItem) => void;
  searchPlaceholder: string;
  source: PalettePanelSource;
}) {
  const isBasicBlocks = appearance === "basicBlocks";
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const [searchQuery, setSearchQuery] = useState("");
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const applyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filteredPaletteItems = useMemo(
    () =>
      paletteItems.filter((item) => {
        const category = getFilterValue(item);

        return matchesPanelSearch(searchQuery, [
          item.description,
          item.label,
          item.key,
          category,
        ]);
      }),
    [getFilterValue, paletteItems, searchQuery],
  );
  const groupedPaletteItems = useMemo(() => {
    const groups: Array<{ category: string | null; items: PaletteItem[] }> = [];

    for (const item of filteredPaletteItems) {
      const category = item.category ?? null;
      const previousGroup = groups.at(-1);

      if (previousGroup && previousGroup.category === category) {
        previousGroup.items.push(item);
        continue;
      }

      groups.push({ category, items: [item] });
    }

    return groups;
  }, [filteredPaletteItems]);

  const focusCard = useCallback((index: number) => {
    cardRefs.current[index]?.focus();
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      focusCard(initialSelectedIndex);
    });
  }, [focusCard, initialSelectedIndex]);

  useEffect(() => {
    setSelectedIndex((currentIndex) =>
      filteredPaletteItems.length === 0
        ? 0
        : Math.min(currentIndex, filteredPaletteItems.length - 1),
    );
  }, [filteredPaletteItems.length]);

  useEffect(
    () => () => {
      if (applyTimeoutRef.current) {
        clearTimeout(applyTimeoutRef.current);
      }
    },
    [],
  );

  const commitSelection = useCallback(
    (index: number) => {
      const item = filteredPaletteItems[index];

      if (!item) return;

      if (replaceTrackedDrop) {
        replaceTrackedDrop(item);
        return;
      }

      insertFocusedItem?.(item);
    },
    [filteredPaletteItems, insertFocusedItem, replaceTrackedDrop],
  );

  const selectItem = useCallback(
    (index: number) => {
      if (applyTimeoutRef.current) {
        clearTimeout(applyTimeoutRef.current);
        applyTimeoutRef.current = null;
      }

      setSelectedIndex(index);
      commitSelection(index);
    },
    [commitSelection],
  );

  const scheduleSelectionCommit = useCallback(
    (index: number) => {
      if (applyTimeoutRef.current) {
        clearTimeout(applyTimeoutRef.current);
      }

      applyTimeoutRef.current = setTimeout(() => {
        applyTimeoutRef.current = null;
        commitSelection(index);

        window.requestAnimationFrame(() => {
          focusCard(index);
        });
      }, KEYBOARD_APPLY_DELAY_MS);
    },
    [commitSelection, focusCard],
  );

  const moveSelection = useCallback(
    (nextIndex: number) => {
      const boundedIndex = Math.min(
        Math.max(nextIndex, 0),
        filteredPaletteItems.length - 1,
      );

      if (boundedIndex < 0) return;

      setSelectedIndex(boundedIndex);
      focusCard(boundedIndex);
      if (replaceTrackedDrop) {
        scheduleSelectionCommit(boundedIndex);
      }
    },
    [
      filteredPaletteItems.length,
      focusCard,
      replaceTrackedDrop,
      scheduleSelectionCommit,
    ],
  );

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, index: number) => {
      const columns = isBasicBlocks ? 3 : 2;

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          event.stopPropagation();
          moveSelection(index - 1);
          break;
        case "ArrowRight":
          event.preventDefault();
          event.stopPropagation();
          moveSelection(index + 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          event.stopPropagation();
          moveSelection(index - columns);
          break;
        case "ArrowDown":
          event.preventDefault();
          event.stopPropagation();
          moveSelection(index + columns);
          break;
        case "Home":
          event.preventDefault();
          event.stopPropagation();
          moveSelection(0);
          break;
        case "End":
          event.preventDefault();
          event.stopPropagation();
          moveSelection(filteredPaletteItems.length - 1);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          event.stopPropagation();
          selectItem(index);
          break;
      }
    },
    [filteredPaletteItems.length, isBasicBlocks, moveSelection, selectItem],
  );

  return (
    <div draggable={false} className="flex h-full flex-col overflow-hidden">
      <PanelSearchFilter
        onQueryChange={setSearchQuery}
        placeholder={searchPlaceholder}
        query={searchQuery}
      />
      <div
        className={cn(
          "scrollbar-thin flex-1 overflow-y-auto px-4 pb-5 scrollbar-thumb-primary scrollbar-track-transparent",
          isBasicBlocks &&
            "px-4 pb-8 scrollbar-thumb-primary scrollbar-track-transparent",
        )}
      >
        {filteredPaletteItems.length > 0 ? (
          <div
            className={cn("space-y-5 py-4", isBasicBlocks && "space-y-7 pt-5")}
          >
            {groupedPaletteItems.map((group) => {
              const firstIndex = filteredPaletteItems.findIndex(
                (item) => item.key === group.items[0]?.key,
              );

              return (
                <section key={group.category ?? "palette-items"}>
                  {group.category && (
                    <h3
                      className={cn(
                        "mb-2 text-sm font-semibold text-foreground",
                        isBasicBlocks &&
                          "mb-4 text-base leading-none font-semibold text-foreground",
                      )}
                    >
                      {group.category}
                    </h3>
                  )}
                  <div
                    className={cn(
                      "grid grid-cols-2 gap-3",
                      isBasicBlocks && "grid-cols-3 gap-x-3 gap-y-5",
                    )}
                  >
                    {group.items.map((item, groupIndex) => {
                      const index = firstIndex + groupIndex;

                      return (
                        <PaletteCard
                          key={item.key}
                          item={item}
                          refCallback={(node) => {
                            cardRefs.current[index] = node;
                          }}
                          isSelected={selectedIndex === index}
                          appearance={appearance}
                          source={source}
                          tabIndex={selectedIndex === index ? 0 : -1}
                          onClick={() => selectItem(index)}
                          onFocus={() => setSelectedIndex(index)}
                          onKeyDown={(event) => handleCardKeyDown(event, index)}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function PaletteCard({
  appearance,
  item,
  refCallback,
  isSelected,
  source,
  tabIndex,
  onClick,
  onFocus,
  onKeyDown,
}: {
  appearance: PalettePanelAppearance;
  item: PaletteItem;
  refCallback: (node: HTMLDivElement | null) => void;
  isSelected: boolean;
  source: PalettePanelSource;
  tabIndex: number;
  onClick: () => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: DRAG_ITEM_BLOCK,
      item: {
        id: `external-${item.key}`,
        element: createPaletteNode(item),
        itemKey: item.key,
        sourcePanel: source,
      },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [item, source],
  );

  const isBasicBlocks = appearance === "basicBlocks";

  return (
    <div
      ref={(el) => {
        refCallback(el);
        if (el) drag(el);
      }}
      aria-label={item.label}
      aria-pressed={isSelected}
      tabIndex={tabIndex}
      data-panel-arrow-target="true"
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={cn(
        "group cursor-grab rounded-md border p-2 transition hover:shadow focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:cursor-grabbing",
        isBasicBlocks &&
          "rounded-none border-0 p-0 text-center hover:shadow-none focus-visible:ring-primary",
        isSelected && !isBasicBlocks && "border-primary ring-1 ring-primary",
        isSelected && isBasicBlocks && "ring-0",
        isDragging && "opacity-50",
      )}
    >
      {isBasicBlocks ? (
        <BasicBlockPreviewIcon elementKey={item.key} />
      ) : (
        <ElementPreview elementKey={item.key} />
      )}
      <div
        className={cn(
          "mt-1.5 flex items-center gap-1 px-0.5",
          isBasicBlocks && "mt-3 block px-0",
        )}
      >
        {!isBasicBlocks && (
          <GripVertical className="size-3 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
        )}
        <div className="min-w-0">
          <span
            className={cn(
              "block truncate text-xs text-muted-foreground",
              isBasicBlocks &&
                "whitespace-normal text-base leading-tight font-semibold text-foreground",
            )}
          >
            {item.label}
          </span>
          {item.description && (
            <span
              className={cn(
                "block truncate text-[11px] text-muted-foreground/65",
                isBasicBlocks &&
                  "mt-0.5 whitespace-normal text-sm leading-tight font-normal text-muted-foreground",
              )}
            >
              {item.description}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BasicBlockPreviewIcon({ elementKey }: { elementKey: string }) {
  const Icon = BASIC_BLOCK_ICON_MAP[elementKey] ?? Type;
  const textIcon = {
    "heading-4": "H4",
  }[elementKey];

  return (
    <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-border bg-card transition-colors group-hover:border-primary/50">
      {textIcon ? (
        <span className="text-2xl leading-none font-semibold text-primary">
          {textIcon}
        </span>
      ) : (
        <Icon className="size-7 stroke-[2.25] text-primary" />
      )}
    </div>
  );
}
