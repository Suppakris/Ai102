"use client";

import { BlockSelectionPlugin } from "@platejs/selection/react";
import { KEYS, NodeApi, PathApi, type TImageElement } from "platejs";
import { useEditorRef, usePluginOption } from "platejs/react";
import * as React from "react";

import {
  type ChartDataMode,
  type ChartDataType,
  type SeriesChartType,
} from "@/components/notebook/presentation/editor/custom-elements/chart-data-editor-dialog";
import {
  BOX_GROUP,
  COMPOSED_CHART_ELEMENT,
  getAlignmentOptions,
  getAvailableConversionOptions,
  getChartDataCategory,
  getColumnSizeOptions,
  getDirectLayoutToolbarTargetEntry,
  getElementDisplayName,
  getOrientationOptions,
  getSidednessOptions,
  getVariantOptions,
  ICON_LIST,
  isChartType,
  isLayoutChildType,
  TIMELINE_GROUP,
  handleLayoutChange as layoutChange,
  handleNodePropertyUpdate as nodePropertyUpdate,
  supportsAlignment,
  supportsColumnSize,
  supportsNumbered,
  supportsOrientation,
  supportsShowLine,
  supportsSidedness,
  supportsVariant,
} from "@/components/notebook/presentation/editor/lib";
import { PALETTE_DROP_MUTABLE_KEY } from "@/components/notebook/presentation/editor/utils/paletteDrop";
import { type MyEditor } from "@/components/plate/editor-kit";
import {
  CALLOUT_VARIANTS,
  getCalloutVariant,
} from "@/components/plate/ui/callout-variants";
import {
  usePresentationState,
  type ImageEditorMode,
} from "@/states/presentation-state";

export interface ToolbarContextValue {
  editor: MyEditor;
  element: Record<string, unknown> | undefined;
  elementId: string | undefined;
  elementType: string;

  // Current property values
  currentOrientation: string;
  currentSidedness: string;
  currentNumbered: boolean;
  currentShowLine: boolean;
  currentColor: string;
  currentBackgroundColor: string;
  currentTextColor: string;
  currentColumnSize: "sm" | "md" | "lg" | "xl";
  currentAlignment: "left" | "center" | "right";
  currentVariant: string;

  // Capability checks
  supportsOrientationControl: boolean;
  supportsSidednessControl: boolean;
  supportsNumberedControl: boolean;
  supportsShowLineControl: boolean;
  supportsColumnSizeControl: boolean;
  supportsAlignmentControl: boolean;
  supportsVariantControl: boolean;
  isCurrentElementChart: boolean;
  isComposedChart: boolean;
  isImageElement: boolean;
  isInfographicElement: boolean;
  isLayoutChildElement: boolean;
  isMediaEmbedElement: boolean;
  imageUrl: string | undefined;
  handleOpenImageEditor: (mode: ImageEditorMode) => void;

  // Chart-specific handler
  handleOpenChartEditor: () => void;

  // Available options
  orientationOptions: readonly string[];
  sidednessOptions: readonly string[];
  columnSizeOptions: readonly string[];
  alignmentOptions: readonly ("left" | "center" | "right")[];
  variantOptions: readonly string[];
  availableOptionsGrouped: ReturnType<typeof getAvailableConversionOptions>;
  selectedOption: string;

  // Chart-specific
  chartData: ChartDataType;
  chartDataType: ChartDataMode;
  seriesChartTypes: Record<string, SeriesChartType>;

  // Handlers
  handleNodePropertyUpdate: (
    property: string,
    value:
      | string
      | boolean
      | number
      | Record<string, unknown>
      | unknown[]
      | undefined,
  ) => void;
  handleLayoutChange: (
    type: string,
    additionalData?: Record<string, unknown>,
  ) => void;
  handleChartDataUpdate: (newData: ChartDataType) => void;
  handleSeriesChartTypesUpdate: (
    types: Record<string, SeriesChartType>,
  ) => void;
}

const ToolbarContext = React.createContext<ToolbarContextValue | null>(null);
const SMART_LAYOUT_COLOR_FALLBACK =
  "var(--presentation-smart-layout, var(--presentation-primary))";

function getStringColor(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function useToolbarContext() {
  const context = React.useContext(ToolbarContext);
  if (!context) {
    throw new Error("useToolbarContext must be used within a ToolbarProvider");
  }
  return context;
}

export function ToolbarProvider({ children }: { children: React.ReactNode }) {
  const editor = useEditorRef<MyEditor>();

  // Get current selection
  const selectionIds = usePluginOption(BlockSelectionPlugin, "selectedIds");
  const selectedElementId = React.useMemo(() => {
    const firstSelectedId = Array.from(selectionIds ?? [])[0];
    return typeof firstSelectedId === "string" ? firstSelectedId : undefined;
  }, [selectionIds]);
  const [committedElementId, setCommittedElementId] = React.useState<
    string | undefined
  >();

  React.useEffect(() => {
    if (selectedElementId) {
      setCommittedElementId(selectedElementId);
    }
  }, [selectedElementId]);

  const elementId = selectedElementId ?? committedElementId;
  const targetEntry = getDirectLayoutToolbarTargetEntry(editor, elementId);
  const [element, elementPath] = targetEntry ?? [];

  // Get current element type and available options
  const elementType = (element?.type as string) ?? "";
  const availableOptionsGrouped = React.useMemo(
    () => getAvailableConversionOptions(elementType),
    [elementType],
  );

  // Get display name for current element
  const selectedOption = React.useMemo(() => {
    return getElementDisplayName(
      elementType,
      element as Record<string, unknown> | undefined,
    );
  }, [elementType, element]);

  // Get current properties
  const currentOrientation =
    (element as { orientation?: string })?.orientation ??
    (elementType === ICON_LIST ? "side" : "vertical");
  const currentSidedness =
    (element as { sidedness?: string })?.sidedness ?? "single";
  const currentNumbered =
    (element as { numbered?: boolean })?.numbered ?? false;
  const currentShowLine = (element as { showLine?: boolean })?.showLine ?? true;
  const elementColors = element as
    | {
        backgroundColor?: string;
        color?: string;
        textColor?: string;
        variant?: unknown;
      }
    | undefined;
  const calloutVariant = getCalloutVariant(elementColors?.variant);
  const isLayoutChildElement = isLayoutChildType(elementType);
  const layoutParentElement =
    isLayoutChildElement && elementPath && elementPath.length > 0
      ? NodeApi.get(editor, PathApi.parent(elementPath))
      : undefined;
  const parentColor =
    typeof layoutParentElement === "object" && layoutParentElement !== null
      ? getStringColor((layoutParentElement as { color?: unknown }).color)
      : undefined;
  const currentBackgroundColor =
    elementColors?.backgroundColor ??
    (elementType === KEYS.callout
      ? CALLOUT_VARIANTS[calloutVariant].backgroundColor
      : "#ffffff");
  const currentColor =
    elementColors?.color ?? parentColor ?? SMART_LAYOUT_COLOR_FALLBACK;
  const currentTextColor =
    elementColors?.textColor ??
    elementColors?.color ??
    (elementType === KEYS.callout
      ? CALLOUT_VARIANTS[calloutVariant].textColor
      : "#ffffff");
  const currentColumnSize =
    (element as { columnSize?: "sm" | "md" | "lg" | "xl" })?.columnSize ?? "md";
  const currentAlignment =
    (element as { alignment?: "left" | "center" | "right" })?.alignment ??
    (element as { align?: "left" | "center" | "right" })?.align ??
    "left";
  // Check capabilities
  const supportsOrientationControl =
    supportsOrientation(elementType) &&
    (elementType !== BOX_GROUP ||
      (element as { boxType?: string })?.boxType === "alternating");
  const supportsSidednessControl = supportsSidedness(elementType);
  const supportsNumberedControl = supportsNumbered(elementType);
  const supportsShowLineControl = supportsShowLine(elementType);
  const supportsColumnSizeControl = supportsColumnSize(elementType);
  // Timeline alignment only affects layout in "single" sidedness — the
  // "double" (alternating) layout ignores it entirely, which made the
  // align buttons look broken (clicking them did nothing visible).
  const supportsAlignmentControl =
    supportsAlignment(elementType) &&
    !(elementType === TIMELINE_GROUP && currentSidedness === "double");
  const supportsVariantControl = supportsVariant(elementType);

  // Get available options
  const orientationOptions = getOrientationOptions(elementType);
  const sidednessOptions = getSidednessOptions(elementType);
  const columnSizeOptions = getColumnSizeOptions(elementType);
  const alignmentOptions = getAlignmentOptions(elementType);
  const variantOptions = getVariantOptions(elementType);
  const currentVariant =
    (element as { variant?: string })?.variant ??
    variantOptions[0] ??
    "default";

  // Chart data
  const isCurrentElementChart = isChartType(elementType);
  const chartData = (element as { data?: unknown })?.data as ChartDataType;
  const chartDataType: ChartDataMode =
    (getChartDataCategory(elementType) as ChartDataMode) ?? "multi-series";
  const isComposedChart = elementType === COMPOSED_CHART_ELEMENT;
  const seriesChartTypes =
    (element as { seriesChartTypes?: Record<string, SeriesChartType> })
      ?.seriesChartTypes ?? {};

  // Image-specific
  const isImageElement = elementType === "img";
  const isMediaEmbedElement = elementType === KEYS.mediaEmbed;
  // Infographic-specific
  const isInfographicElement = elementType === "antv-infographic";
  const imageUrl = (element as TImageElement | undefined)?.url;
  const openPresentationImageEditor = usePresentationState(
    (s) => s.openPresentationImageEditor,
  );
  const setPaletteDropTarget = usePresentationState(
    (s) => s.setPaletteDropTarget,
  );

  const handleOpenImageEditor = React.useCallback(
    (mode: ImageEditorMode) => {
      if (!element?.id) return;
      // Create a bound updateElement function that captures the current editor and element
      const boundUpdateElement = (updateProps: Record<string, unknown>) => {
        setPaletteDropTarget(null);
        editor.tf.setNodes(
          {
            ...(updateProps as Partial<TImageElement>),
            [PALETTE_DROP_MUTABLE_KEY]: false,
          },
          {
            at: [],
            match: (n) => n.id === element.id,
          },
        );
      };
      // Open the presentation image editor panel with the selected element snapshot.
      openPresentationImageEditor(
        mode,
        boundUpdateElement,
        element as Record<string, unknown>,
      );
    },
    [editor, element, openPresentationImageEditor, setPaletteDropTarget],
  );

  // Chart-specific handler
  const openChartEditor = usePresentationState((s) => s.openChartEditor);

  const handleOpenChartEditor = React.useCallback(() => {
    if (!element?.id) return;

    // Get chart data from element
    const chartElement = element as {
      type?: string;
      data?: unknown;
      variant?: string;
      orientation?: string;
      interpolation?: string;
      [key: string]: unknown;
    };

    // Extract chart options from element
    const {
      type,
      data,
      id: _id,
      children: _children,
      ...chartOptions
    } = chartElement;

    // Create a bound updateElement function that captures the current editor and element
    const boundUpdateElement = (updateProps: Record<string, unknown>) => {
      setPaletteDropTarget(null);
      editor.tf.setNodes(
        { ...updateProps, [PALETTE_DROP_MUTABLE_KEY]: false },
        {
          at: [],
          match: (n) => n.id === element.id,
        },
      );
    };

    // Open the chart editor panel with the element data and bound function
    openChartEditor(
      {
        chartType: (type as string) ?? "",
        chartData: data,
        chartOptions: chartOptions as Record<string, unknown>,
      },
      boundUpdateElement,
    );
  }, [editor, element, openChartEditor, setPaletteDropTarget]);

  // Handlers
  const handleNodePropertyUpdate = React.useCallback(
    (
      property: string,
      value:
        | string
        | boolean
        | number
        | Record<string, unknown>
        | unknown[]
        | undefined,
    ) => {
      const targetElementId =
        typeof element?.id === "string" ? element.id : elementId;

      setPaletteDropTarget(null);
      nodePropertyUpdate(editor, property, value, targetElementId);
    },
    [editor, element, elementId, setPaletteDropTarget],
  );

  const handleLayoutChange = React.useCallback(
    (type: string, additionalData?: Record<string, unknown>) => {
      const targetElementId =
        typeof element?.id === "string" ? element.id : elementId;

      setPaletteDropTarget(null);
      return layoutChange(editor, type, additionalData, targetElementId);
    },
    [editor, element, elementId, setPaletteDropTarget],
  );

  const handleChartDataUpdate = React.useCallback(
    (newData: ChartDataType) => {
      if (!element) return;
      setPaletteDropTarget(null);
      editor.tf.setNodes(
        { data: newData, [PALETTE_DROP_MUTABLE_KEY]: false },
        { at: editor.api.findPath(element) },
      );
    },
    [editor, element, setPaletteDropTarget],
  );

  const handleSeriesChartTypesUpdate = React.useCallback(
    (types: Record<string, SeriesChartType>) => {
      if (!element) return;
      setPaletteDropTarget(null);
      editor.tf.setNodes(
        { seriesChartTypes: types, [PALETTE_DROP_MUTABLE_KEY]: false },
        { at: editor.api.findPath(element) },
      );
    },
    [editor, element, setPaletteDropTarget],
  );

  const value: ToolbarContextValue = {
    editor,
    element: element as Record<string, unknown> | undefined,
    elementId,
    elementType,
    currentOrientation,
    currentSidedness,
    currentNumbered,
    currentShowLine,
    currentColor,
    currentBackgroundColor,
    currentTextColor,
    currentColumnSize,
    currentAlignment,
    currentVariant,
    supportsOrientationControl,
    supportsSidednessControl,
    supportsNumberedControl,
    supportsShowLineControl,
    supportsColumnSizeControl,
    supportsAlignmentControl,
    supportsVariantControl,
    isCurrentElementChart,
    isComposedChart,
    isImageElement,
    isInfographicElement,
    isLayoutChildElement,
    isMediaEmbedElement,
    imageUrl,
    handleOpenImageEditor,
    orientationOptions,
    sidednessOptions,
    columnSizeOptions,
    alignmentOptions,
    variantOptions,
    availableOptionsGrouped,
    selectedOption,
    chartData,
    chartDataType,
    seriesChartTypes,
    handleNodePropertyUpdate,
    handleLayoutChange,
    handleChartDataUpdate,
    handleSeriesChartTypesUpdate,
    handleOpenChartEditor,
  };

  return (
    <ToolbarContext.Provider value={value}>{children}</ToolbarContext.Provider>
  );
}
