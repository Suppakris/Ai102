"use client";

import { Replace } from "lucide-react";
import { type TElement } from "platejs";
import { useEditorRef } from "platejs/react";
import * as React from "react";

import {
  ARROW_LIST,
  BEFORE_AFTER_GROUP,
  BLOCKS,
  BOX_GROUP,
  BULLET_GROUP,
  CIRCULAR_GRID_GROUP,
  COLUMN_GROUP,
  COMPARE_GROUP,
  CONNECTED_CIRCLES_GROUP,
  CYCLE_GROUP,
  getAvailableConversionOptions,
  handleLayoutChange,
  ICON_LIST,
  PARENT_CHILD_RELATIONSHIP,
  PROS_CONS_GROUP,
  PYRAMID_GROUP,
  QUOTE_ELEMENT,
  SEQUENCE_ARROW_GROUP,
  SLOPE_GROUP,
  SNAKE_GROUP,
  STAIRCASE_GROUP,
  STATS_GROUP,
  STEPS_GROUP,
  TIMELINE_GROUP,
} from "@/components/notebook/presentation/editor/lib";
import StaticPresentationEditor from "@/components/notebook/presentation/editor/presentation-editor-static";
import { type PlateSlide } from "@/components/notebook/presentation/utils/parser";
import { type MyEditor } from "@/components/plate/editor-kit";
import { ToolbarButton, ToolbarGroup } from "@/components/plate/ui/toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  calculateHeightFromRatio,
  getSlideBaseWidth,
} from "@/config/slideFormats";
import { cn } from "@/lib/utils";
import {
  usePresentationState,
  type LayoutEditorApplyLayout,
  type LayoutEditorElementSnapshot,
} from "@/states/presentation-state";
import { PanelSearchFilter } from "../edit-panel/sections/PanelSearchFilter";
import { matchesPanelSearch } from "../edit-panel/sections/PanelSearchFilter";

interface LayoutEditorButtonProps {
  editorId: string;
  elementId: string | undefined;
  element: Record<string, unknown> | undefined;
  onApplyLayout: LayoutEditorApplyLayout;
}

interface LayoutVariation {
  id: string;
  type: string;
  name: string;
  element: TElement;
  additionalData: Record<string, unknown>;
}

interface LayoutVariationSection {
  title: string;
  variations: LayoutVariation[];
}

interface PreviewDimensions {
  width: number;
  height: number;
}

const KEYBOARD_APPLY_DELAY_MS = 250;

export function LayoutEditorButton({
  editorId,
  elementId,
  element,
  onApplyLayout,
}: LayoutEditorButtonProps) {
  const openLayoutEditor = usePresentationState((s) => s.openLayoutEditor);
  const activeRightPanel = usePresentationState((s) => s.activeRightPanel);

  return (
    <ToolbarGroup>
      <ToolbarButton
        tooltip="Change layout"
        pressed={activeRightPanel === "layoutEditor"}
        onClick={() =>
          openLayoutEditor(
            editorId,
            elementId ?? null,
            (element as LayoutEditorElementSnapshot | undefined) ?? null,
            onApplyLayout,
          )
        }
      >
        <Replace className="size-4" />
        <span>Change</span>
      </ToolbarButton>
    </ToolbarGroup>
  );
}

function ScaledPreview({
  children,
  dimensions,
}: {
  children: React.ReactNode;
  dimensions: PreviewDimensions;
}) {
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const [frameWidth, setFrameWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    if (!frameRef.current) return;

    const updateFrameWidth = () => {
      if (!frameRef.current) return;
      setFrameWidth(frameRef.current.clientWidth);
    };

    const resizeObserver = new ResizeObserver(updateFrameWidth);
    resizeObserver.observe(frameRef.current);
    updateFrameWidth();

    return () => resizeObserver.disconnect();
  }, []);

  const scale = frameWidth > 0 ? frameWidth / dimensions.width : 0;

  return (
    <div
      ref={frameRef}
      className="w-full overflow-hidden rounded-sm bg-muted/30"
      style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function EditorWrapper({
  elementNode,
  previewSlide,
  dimensions,
}: {
  elementNode: TElement;
  previewSlide: PlateSlide;
  dimensions: PreviewDimensions;
}) {
  const [showEditor, setShowEditor] = React.useState(false);
  const previewId = React.useId();

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShowEditor(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!showEditor) {
    return (
      <Skeleton
        className="w-full"
        style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
      />
    );
  }

  return (
    <ScaledPreview dimensions={dimensions}>
      <StaticPresentationEditor
        initialContent={previewSlide}
        id={`layout-preview-${elementNode.type}-${previewId}`}
        className="h-full min-h-0! w-full"
      />
    </ScaledPreview>
  );
}

function ElementPreview({
  variation,
  isVisible,
  previewSlide,
  dimensions,
}: {
  variation: LayoutVariation;
  isVisible: boolean;
  previewSlide: PlateSlide;
  dimensions: PreviewDimensions;
}) {
  if (!isVisible) {
    return (
      <Skeleton
        className="w-full"
        style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
      />
    );
  }

  return (
    <EditorWrapper
      elementNode={variation.element}
      previewSlide={previewSlide}
      dimensions={dimensions}
    />
  );
}

function getPreviewDimensions(currentSlide: PlateSlide | undefined) {
  const formatCategory = currentSlide?.formatCategory ?? "presentation";
  const widthSize = currentSlide?.width ?? "M";
  const aspectRatio =
    currentSlide?.aspectRatio?.type === "fluid" || !currentSlide?.aspectRatio
      ? { type: "ratio", value: "16:9" }
      : currentSlide.aspectRatio;
  const width = getSlideBaseWidth(
    formatCategory,
    widthSize as "S" | "M" | "L",
    aspectRatio,
  );
  const height =
    calculateHeightFromRatio(width, aspectRatio).minHeightPx ??
    Math.round(width * (9 / 16));

  return { width, height };
}

function createPreviewSlide({
  currentSlide,
  element,
  fallbackAspectRatio,
  variationId,
}: {
  currentSlide: PlateSlide | undefined;
  element: TElement;
  fallbackAspectRatio: PlateSlide["aspectRatio"];
  variationId: string;
}): PlateSlide {
  return {
    id: `layout-preview-slide-${variationId}`,
    content: [element] as PlateSlide["content"],
    alignment: currentSlide?.alignment ?? "start",
    aspectRatio: fallbackAspectRatio,
    formatCategory: currentSlide?.formatCategory ?? "presentation",
    width: currentSlide?.width ?? "M",
  };
}

function getBlockName(elementType: string) {
  return (
    BLOCKS.find((block) => block.type === elementType)?.name || elementType
  );
}

function getVariationIdValue(value: unknown) {
  return String(value).replaceAll(" ", "-").toLowerCase();
}

function createVariation({
  elementType,
  blockName,
  previewElement,
  additionalData,
}: {
  elementType: string;
  blockName: string;
  previewElement: Record<string, unknown>;
  additionalData: Record<string, unknown>;
}): LayoutVariation {
  const dataKey =
    Object.entries(additionalData)
      .map(([key, value]) => `${key}-${getVariationIdValue(value)}`)
      .join("-") || "default";

  return {
    id: `${elementType}-${dataKey}`,
    type: elementType,
    name: blockName,
    element: {
      ...previewElement,
      ...additionalData,
    } as unknown as TElement,
    additionalData,
  };
}

// The layout panel used to fan every element's orientation/variant options
// out into a separate thumbnail card each (e.g. a Timeline offered 6+ cards
// for vertical/horizontal x single/double x numbered/lined combos). Users
// found the resulting wall of near-identical cards confusing, so each
// element/conversion candidate now shows exactly one basic card.
function createCapabilityPropertySets(
  _elementType: string,
  baseProperties: Record<string, unknown>,
) {
  return [baseProperties];
}

function createTimelinePreviewData(
  previewElement: Record<string, unknown>,
): LayoutVariation[] {
  const blockName = getBlockName(TIMELINE_GROUP);
  // Only the basic variant — see createCapabilityPropertySets for why the
  // rest of the format-variant combos were dropped.
  const timelineVariants: Record<string, unknown>[] = [
    {
      orientation: "vertical",
      sidedness: "single",
      numbered: true,
      showLine: true,
    },
  ];

  return timelineVariants.map((additionalData) =>
    createVariation({
      elementType: TIMELINE_GROUP,
      blockName,
      previewElement,
      additionalData,
    }),
  );
}

function generatePreviewData(
  elementType: string,
  currentElement: TElement,
  variant?: string,
  variantKey?: string,
): LayoutVariation[] {
  const blockName = getBlockName(elementType);

  const previewElement: Record<string, unknown> = {
    ...currentElement,
    type: elementType,
    children: currentElement.children.map((child, index) => {
      const childRelation =
        PARENT_CHILD_RELATIONSHIP[
          elementType as keyof typeof PARENT_CHILD_RELATIONSHIP
        ]?.child;
      const childType = Array.isArray(childRelation)
        ? childRelation[index % childRelation.length]
        : childRelation || child.type;

      return {
        ...child,
        type: childType,
      };
    }),
  };

  const baseProperties: Record<string, unknown> =
    variant && variantKey
      ? {
          [variantKey]:
            variantKey === "isFunnel" ? variant === "funnel" : variant,
        }
      : {};

  if (elementType === TIMELINE_GROUP) {
    return createTimelinePreviewData(previewElement);
  }

  return createCapabilityPropertySets(elementType, baseProperties).map(
    (additionalData) =>
      createVariation({
        elementType,
        blockName,
        previewElement,
        additionalData,
      }),
  );
}

function getVariationLabel(variation: LayoutVariation) {
  const variationElement = variation.element as Record<string, unknown>;
  const labelParts: string[] = [];

  const appendOrientationLabel = () => {
    if (variationElement.orientation === "horizontal") {
      labelParts.push("Horizontal");
    } else if (variationElement.orientation === "vertical") {
      labelParts.push("Vertical");
    }
  };

  const joinLabel = (baseLabel: string) =>
    labelParts.length > 0
      ? `${baseLabel} - ${labelParts.join(", ")}`
      : baseLabel;

  if (variation.type === BULLET_GROUP) {
    switch (variationElement.bulletType) {
      case "numbered":
        return joinLabel("Numbered list");
      case "basic":
        return joinLabel("Bullet list");
      case "arrow":
        return joinLabel("Arrow list");
      default:
        return joinLabel("List");
    }
  }

  if (variation.type === BOX_GROUP) {
    if (variationElement.boxType === "alternating") {
      appendOrientationLabel();
    }
    switch (variationElement.boxType) {
      case "solid":
        return joinLabel("Solid box");
      case "outline":
        return joinLabel("Outline box");
      case "icon":
        return joinLabel("Icon box");
      case "sideline":
        return joinLabel("Side line box");
      case "side-label":
        return joinLabel("Side line text");
      case "top-label":
        return joinLabel("Top line text");
      case "top-circle":
        return joinLabel("Top circle box");
      case "joined":
        return joinLabel("Joined box");
      case "joined-icon":
        return joinLabel("Joined box with icons");
      case "leaf":
        return joinLabel("Leaf box");
      case "labeled":
        return joinLabel("Labeled box");
      case "alternating":
        return joinLabel("Alternating box");
      default:
        return joinLabel("Box");
    }
  }
  if (variation.type === ARROW_LIST) {
    appendOrientationLabel();

    switch (variationElement.svgType) {
      case "arrow":
        return joinLabel("Arrow sequence");
      case "pill":
        return joinLabel("Pill sequence");
      case "parallelogram":
        return joinLabel("Parallelogram sequence");
      default:
        return joinLabel("Sequence");
    }
  }

  if (variation.type === TIMELINE_GROUP) {
    appendOrientationLabel();

    if (variationElement.sidedness === "single") {
      labelParts.push("Single");
    } else if (variationElement.sidedness === "double") {
      labelParts.push("Double");
    }

    if (variationElement.numbered === false) {
      labelParts.push("No numbers");
    }

    if (variationElement.showLine === false) {
      labelParts.push("No line");
    }

    return joinLabel("Timeline");
  }

  if (variation.type === SEQUENCE_ARROW_GROUP) {
    appendOrientationLabel();
    return joinLabel("Steps");
  }

  if (variation.type === PYRAMID_GROUP) {
    const baseName = variationElement.isFunnel ? "Funnel" : "Pyramid";
    return joinLabel(
      variationElement.variant === "inside" ? `Inside ${baseName}` : baseName,
    );
  }

  if (variation.type === STATS_GROUP) {
    switch (variationElement.statsType) {
      case "plain":
        return joinLabel("Plain stats");
      case "circle":
        return joinLabel("Circle stats");
      case "circle-bold":
        return joinLabel("Bold circle stats");
      case "star":
        return joinLabel("Star rating");
      case "bar":
        return joinLabel("Bar stats");
      case "dot-grid":
        return joinLabel("Dot grid stats");
      case "dot-line":
        return joinLabel("Dot line stats");
      default:
        return joinLabel("Stats");
    }
  }

  if (variation.type === QUOTE_ELEMENT) {
    switch (variationElement.variant) {
      case "large":
        return "Large quote";
      case "sidequote-icon":
        return "Side quote with icon";
      case "sidequote":
        return "Side quote";
      default:
        return "Quote";
    }
  }

  switch (variation.type) {
    case STEPS_GROUP:
      return joinLabel(
        variationElement.variant === "arrow"
          ? "Arrow Steps"
          : variationElement.variant === "box"
            ? "Box Steps"
            : "Steps",
      );
    case STAIRCASE_GROUP:
      return joinLabel(
        variationElement.variant === "inside"
          ? "Inside Staircase"
          : "Staircase",
      );
    case CYCLE_GROUP:
      return "Cycle";
    case ICON_LIST:
      return joinLabel("Icon list");
    case CONNECTED_CIRCLES_GROUP:
      return "Connected circles";
    case CIRCULAR_GRID_GROUP:
      return "Circular grid";
    case SLOPE_GROUP:
      return "Slope";
    case SNAKE_GROUP:
      return "Snake";
    case COLUMN_GROUP:
      return "Columns";
    case COMPARE_GROUP:
      return "Comparison";
    case BEFORE_AFTER_GROUP:
      return "Before and after";
    case PROS_CONS_GROUP:
      return "Pros and cons";
    default:
      return variation.name;
  }
}

function flattenSections(sections: LayoutVariationSection[]) {
  return sections.flatMap((section) => section.variations);
}

export function LayoutEditorPanel({ isLoaded }: { isLoaded?: boolean }) {
  const layoutEditorEditorId = usePresentationState(
    (s) => s.layoutEditorEditorId,
  );
  const editor = useEditorRef<MyEditor>(layoutEditorEditorId ?? undefined);
  const currentSlide = usePresentationState((s) =>
    s.slides.find((slide) => slide.id === s.currentSlideId),
  );
  const layoutEditorElement = usePresentationState(
    (s) => s.layoutEditorElement,
  );
  const layoutEditorElementId = usePresentationState(
    (s) => s.layoutEditorElementId,
  );
  const layoutEditorApplyLayout = usePresentationState(
    (s) => s.layoutEditorApplyLayout,
  );
  const setPaletteDropTarget = usePresentationState(
    (s) => s.setPaletteDropTarget,
  );
  const updateSlide = usePresentationState((s) => s.updateSlide);
  const [currentElement, setCurrentElement] =
    React.useState<LayoutEditorElementSnapshot | null>(layoutEditorElement);
  const [focusedVariationIndex, setFocusedVariationIndex] = React.useState(0);
  const [searchQuery, setSearchQuery] = React.useState("");
  const variationRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const applyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const previewDimensions = React.useMemo(
    () => getPreviewDimensions(currentSlide),
    [currentSlide],
  );

  React.useEffect(() => {
    setCurrentElement(layoutEditorElement);
  }, [layoutEditorElement]);

  const currentElementType =
    (currentElement?.type as string) ?? BLOCKS[0]?.type ?? "";
  const availableOptions = React.useMemo(
    () => getAvailableConversionOptions(currentElementType),
    [currentElementType],
  );

  const currentElementAsTElement: TElement = currentElement
    ? (currentElement as unknown as TElement)
    : ({
        type: currentElementType,
        children: [],
      } as TElement);

  const currentVariations = React.useMemo(
    () =>
      generatePreviewData(currentElementType, currentElementAsTElement).map(
        (variation) => ({
          ...variation,
          id: `current-${variation.id}`,
          name: `Current ${variation.name}`,
        }),
      ),
    [currentElementType, currentElementAsTElement],
  );

  const variationSections = React.useMemo<LayoutVariationSection[]>(() => {
    const sections: LayoutVariationSection[] = [
      {
        title: `Current: ${
          BLOCKS.find((block) => block.type === currentElementType)?.name ??
          currentElementType
        }`,
        variations: currentVariations,
      },
    ];

    Object.entries(availableOptions).forEach(([category, options]) => {
      const variations = options.flatMap((option) => {
        if (option.supportsOrientation) {
          return generatePreviewData(
            option.type,
            currentElementAsTElement,
            option.variant,
            option.variant ? option.key : "orientation",
          );
        }

        return generatePreviewData(
          option.type,
          currentElementAsTElement,
          option.variant,
          option.key,
        );
      });

      if (variations.length > 0) {
        sections.push({ title: category, variations });
      }
    });

    return sections;
  }, [
    availableOptions,
    currentElementAsTElement,
    currentElementType,
    currentVariations,
  ]);

  const filteredVariationSections = React.useMemo(
    () =>
      variationSections
        .map((section) => ({
          ...section,
          variations: section.variations.filter((variation) => {
            const label = getVariationLabel(variation);

            return matchesPanelSearch(searchQuery, [
              label,
              variation.name,
              variation.type,
              section.title,
            ]);
          }),
        }))
        .filter((section) => section.variations.length > 0),
    [searchQuery, variationSections],
  );
  const allVariations = React.useMemo(
    () => flattenSections(filteredVariationSections),
    [filteredVariationSections],
  );

  React.useEffect(() => {
    setFocusedVariationIndex(0);
  }, [currentElement?.id, searchQuery]);

  React.useEffect(() => {
    variationRefs.current = variationRefs.current.slice(
      0,
      allVariations.length,
    );
  }, [allVariations.length]);

  React.useEffect(() => {
    window.requestAnimationFrame(() => {
      variationRefs.current[0]?.focus();
    });
  }, [currentElement?.id]);

  React.useEffect(
    () => () => {
      if (applyTimeoutRef.current) {
        clearTimeout(applyTimeoutRef.current);
      }
    },
    [],
  );

  const applyVariation = React.useCallback(
    (variation: LayoutVariation) => {
      if (applyTimeoutRef.current) {
        clearTimeout(applyTimeoutRef.current);
        applyTimeoutRef.current = null;
      }

      const additionalData =
        Object.keys(variation.additionalData).length > 0
          ? variation.additionalData
          : undefined;

      setPaletteDropTarget(null);
      const appliedElement = layoutEditorApplyLayout
        ? layoutEditorApplyLayout(variation.type, additionalData)
        : handleLayoutChange(
            editor,
            variation.type,
            additionalData,
            layoutEditorElementId ?? undefined,
          );

      setCurrentElement(
        appliedElement
          ? (appliedElement as LayoutEditorElementSnapshot)
          : (variation.element as LayoutEditorElementSnapshot),
      );

      if (currentSlide?.id) {
        updateSlide(currentSlide.id, {
          content: editor.children as PlateSlide["content"],
        });
      }
    },
    [
      currentSlide?.id,
      editor,
      layoutEditorApplyLayout,
      layoutEditorElementId,
      setPaletteDropTarget,
      updateSlide,
    ],
  );

  const scheduleVariationApply = React.useCallback(
    (variation: LayoutVariation, index: number) => {
      if (applyTimeoutRef.current) {
        clearTimeout(applyTimeoutRef.current);
      }

      applyTimeoutRef.current = setTimeout(() => {
        applyTimeoutRef.current = null;
        applyVariation(variation);

        window.requestAnimationFrame(() => {
          variationRefs.current[index]?.focus();
        });
      }, KEYBOARD_APPLY_DELAY_MS);
    },
    [applyVariation],
  );

  const focusVariation = React.useCallback(
    (nextIndex: number, shouldApply = false) => {
      if (allVariations.length === 0) return;

      const boundedIndex =
        (nextIndex + allVariations.length) % allVariations.length;
      const variation = allVariations[boundedIndex];

      setFocusedVariationIndex(boundedIndex);

      if (shouldApply && variation) {
        scheduleVariationApply(variation, boundedIndex);
      }

      window.requestAnimationFrame(() => {
        variationRefs.current[boundedIndex]?.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
        variationRefs.current[boundedIndex]?.focus();
      });
    },
    [allVariations, scheduleVariationApply],
  );

  const handleCardKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          event.stopPropagation();
          focusVariation(index - 1, true);
          break;
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          event.stopPropagation();
          focusVariation(index + 1, true);
          break;
        case "Home":
          event.preventDefault();
          event.stopPropagation();
          focusVariation(0, true);
          break;
        case "End":
          event.preventDefault();
          event.stopPropagation();
          focusVariation(allVariations.length - 1, true);
          break;
        case "Enter": {
          event.preventDefault();
          event.stopPropagation();
          const variation = allVariations[index];
          if (!variation) return;
          applyVariation(variation);
          break;
        }
      }
    },
    [allVariations, applyVariation, focusVariation],
  );

  if (!isLoaded) {
    return (
      <div
        draggable={false}
        className="animate-fade-in scrollbar-thin flex h-full flex-col gap-5 overflow-y-auto px-4 pb-5 scrollbar-thumb-primary scrollbar-track-transparent"
      >
        <div>
          <h3 className="mb-3 animate-pulse text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Loading layouts...
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-md border p-2">
                <div
                  className="w-full overflow-hidden rounded-sm bg-muted/30"
                  style={{
                    aspectRatio: `${previewDimensions.width} / ${previewDimensions.height}`,
                  }}
                >
                  <Skeleton className="h-full w-full rounded-sm" />
                </div>
                <div className="mt-1.5 px-0.5">
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!currentElement || !layoutEditorEditorId) {
    return (
      <div className="px-4 py-5 text-sm text-muted-foreground">
        Select a layout block on the slide to edit its layout.
      </div>
    );
  }

  return (
    <div draggable={false} className="flex h-full flex-col overflow-hidden">
      <PanelSearchFilter
        onQueryChange={setSearchQuery}
        placeholder="Search layouts..."
        query={searchQuery}
      />
      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-5 scrollbar-thumb-primary scrollbar-track-transparent">
        {filteredVariationSections.length > 0 ? (
          <div className="flex flex-col gap-5 py-4">
            {filteredVariationSections.map((section) => (
              <div key={section.title}>
                <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {section.title}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {section.variations.map((variation) => {
                    const absoluteIndex = allVariations.findIndex(
                      (item) => item.id === variation.id,
                    );
                    const isFocused = absoluteIndex === focusedVariationIndex;
                    const label = getVariationLabel(variation);
                    const previewAspectRatio =
                      currentSlide?.aspectRatio?.type === "fluid" ||
                      !currentSlide?.aspectRatio
                        ? ({ type: "ratio", value: "16:9" } as const)
                        : currentSlide.aspectRatio;
                    const previewSlide = createPreviewSlide({
                      currentSlide,
                      element: variation.element,
                      fallbackAspectRatio: previewAspectRatio,
                      variationId: variation.id,
                    });

                    return (
                      <div
                        key={variation.id}
                        ref={(node) => {
                          if (absoluteIndex >= 0) {
                            variationRefs.current[absoluteIndex] = node;
                          }
                        }}
                        role="button"
                        aria-label={`Apply ${label}`}
                        aria-pressed={isFocused}
                        tabIndex={isFocused ? 0 : -1}
                        data-panel-arrow-target="true"
                        onClick={() => applyVariation(variation)}
                        onFocus={() => setFocusedVariationIndex(absoluteIndex)}
                        onKeyDown={(event) =>
                          handleCardKeyDown(event, absoluteIndex)
                        }
                        className={cn(
                          "group cursor-pointer rounded-md border p-2 transition hover:shadow focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                          isFocused && "border-primary ring-1 ring-primary",
                        )}
                      >
                        <ElementPreview
                          variation={variation}
                          isVisible
                          previewSlide={previewSlide}
                          dimensions={previewDimensions}
                        />
                        <div className="mt-1.5 px-0.5">
                          <div className="truncate text-sm font-medium text-foreground">
                            {label}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No layouts match your search.
          </div>
        )}
      </div>
    </div>
  );
}
