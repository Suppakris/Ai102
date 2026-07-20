"use client";

import { ColumnItemPlugin, ColumnPlugin } from "@platejs/layout/react";
import { KEYS, type TElement, type TText } from "platejs";

import {
  ANTV_INFOGRAPHIC,
  AREA_CHART_ELEMENT,
  ARROW_LIST,
  ARROW_LIST_ITEM,
  BAR_CHART_ELEMENT,
  BEFORE_AFTER_GROUP,
  BEFORE_AFTER_SIDE,
  BOX_GROUP,
  BOX_ITEM,
  BOX_PLOT_CHART_ELEMENT,
  BUBBLE_CHART_ELEMENT,
  BULLET_GROUP,
  BULLET_ITEM,
  BUTTON_ELEMENT,
  CANDLESTICK_CHART_ELEMENT,
  CIRCULAR_GRID_GROUP,
  CIRCULAR_GRID_ITEM,
  COMPARE_GROUP,
  COMPARE_SIDE,
  COMPOSED_CHART_ELEMENT,
  CONNECTED_CIRCLES_GROUP,
  CONNECTED_CIRCLES_ITEM,
  CONS_ITEM,
  CONTRIBUTOR_ELEMENT,
  CYCLE_GROUP,
  CYCLE_ITEM,
  DEFAULT_CHART_DATA,
  DONUT_CHART_ELEMENT,
  FUNNEL_CHART_ELEMENT,
  HEATMAP_CHART_ELEMENT,
  HISTOGRAM_CHART_ELEMENT,
  ICON_LIST,
  ICON_LIST_ITEM,
  LABEL_ELEMENT,
  LINE_CHART_ELEMENT,
  LINEAR_GAUGE_ELEMENT,
  PIE_CHART_ELEMENT,
  PRESENTATION_TITLE_ELEMENT,
  PROS_CONS_GROUP,
  PROS_ITEM,
  PYRAMID_CHART_ELEMENT,
  PYRAMID_GROUP,
  PYRAMID_ITEM,
  QUOTE_ELEMENT,
  RADAR_CHART_ELEMENT,
  RADIAL_BAR_CHART_ELEMENT,
  RADIAL_COLUMN_CHART_ELEMENT,
  RADIAL_GAUGE_ELEMENT,
  RANGE_AREA_CHART_ELEMENT,
  RANGE_BAR_CHART_ELEMENT,
  SANKEY_CHART_ELEMENT,
  SCATTER_CHART_ELEMENT,
  SEQUENCE_ARROW_GROUP,
  SEQUENCE_ARROW_ITEM,
  SLOPE_GROUP,
  SLOPE_ITEM,
  SNAKE_GROUP,
  SNAKE_ITEM,
  STAIR_ITEM,
  STAIRCASE_GROUP,
  STATS_GROUP,
  STATS_ITEM,
  STEPS_GROUP,
  STEPS_ITEM,
  SUNBURST_CHART_ELEMENT,
  TIMELINE_GROUP,
  TIMELINE_ITEM,
  TREEMAP_CHART_ELEMENT,
  WATERFALL_CHART_ELEMENT,
} from "@/components/notebook/presentation/editor/lib";
import { CALLOUT_VARIANTS } from "@/components/plate/ui/callout-variants";

export type PaletteItem = {
  category?: string;
  description?: string;
  key: string;
  label: string;
  node: TElement;
};

const text = (value: string): TText => ({ text: value }) as const;

const paragraph = (children: Array<TElement | TText> = [text("")]): TElement =>
  ({ type: KEYS.p, children }) as unknown as TElement;

const h3 = (content: string): TElement =>
  ({ type: "h3", children: [text(content)] }) as unknown as TElement;

const h4 = (content: string): TElement =>
  ({ type: "h4", children: [text(content)] }) as unknown as TElement;

const heading = (
  type: "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
  content: string,
): TElement => ({ type, children: [text(content)] }) as unknown as TElement;

const codeBlock = (code: string, language = "tsx"): TElement => {
  const lines = code
    .split("\n")
    .map((l) => ({ type: KEYS.codeLine, children: [text(l)] }));
  return {
    type: KEYS.codeBlock,
    lang: language,
    children: lines as unknown as TElement["children"],
  } as unknown as TElement;
};

const callout = (
  icon: string,
  bg: string,
  content: string,
  variant: string,
): TElement =>
  ({
    type: KEYS.callout,
    alignment: "left",
    icon,
    backgroundColor: bg,
    variant,
    children: [paragraph([text(content)])],
  }) as unknown as TElement;

const _table = (headers: string[], rows: string[][]): TElement =>
  ({
    type: KEYS.table,
    children: [
      {
        type: KEYS.tr,
        children: headers.map((h) => ({
          type: KEYS.td,
          header: true,
          children: [paragraph([text(h)])],
        })),
      },
      ...rows.map((r) => ({
        type: KEYS.tr,
        children: r.map((c) => ({
          type: KEYS.td,
          children: [paragraph([text(c)])],
        })),
      })),
    ],
  }) as unknown as TElement;

const blankTable = (rows: number, cols: number): TElement =>
  ({
    type: KEYS.table,
    children: Array.from({ length: rows }, () => ({
      type: KEYS.tr,
      children: Array.from({ length: cols }, () => ({
        type: KEYS.td,
        children: [paragraph()],
      })),
    })),
  }) as unknown as TElement;

const columns = (cols: Array<{ title: string; body: string[] }>): TElement =>
  ({
    type: ColumnPlugin.key,
    children: cols.map((c) => ({
      type: ColumnItemPlugin.key,
      width: "M",
      children: [h3(c.title), ...c.body.map((b) => paragraph([text(b)]))],
    })),
  }) as unknown as TElement;

const simple = {
  hr: (): TElement =>
    ({ type: KEYS.hr, children: [{ text: "" }] }) as unknown as TElement,
  toc: (): TElement =>
    ({ type: KEYS.toc, children: [{ text: "" }] }) as unknown as TElement,
  blockquote: (content: string): TElement =>
    ({
      type: KEYS.blockquote,
      children: [paragraph([text(content)])],
    }) as unknown as TElement,
};

const listBlock = (
  listStyleType: typeof KEYS.ul | typeof KEYS.ol | typeof KEYS.listTodo,
  content: string,
): TElement =>
  ({
    type: KEYS.p,
    indent: 1,
    listStyleType,
    children: [text(content)],
  }) as unknown as TElement;

// ============================================================================
// HELPER FUNCTIONS - List & Group Builders
// ============================================================================

const createList = (
  type: string,
  itemType: string,
  items: Array<{ heading?: string; content: string }>,
): TElement =>
  ({
    type,
    ...(type === BULLET_GROUP && { columnSize: "md" }), // Add default columnSize for bullet groups
    children: items.map((item) => ({
      type: itemType,
      children: item.heading
        ? [h4(item.heading), paragraph([text(item.content)])]
        : [paragraph([text(item.content)])],
    })),
  }) as unknown as TElement;

const createIconListItem = (iconName: string, content: string) => ({
  type: ICON_LIST_ITEM,
  icon: iconName,
  children: [paragraph([text(content)])],
});

const createBoxItem = (title: string, content: string) => ({
  type: BOX_ITEM,
  children: [h3(title), paragraph([text(content)])],
});

const createCompareSide = (
  title: string,
  items: string[],
  type: typeof COMPARE_SIDE | typeof BEFORE_AFTER_SIDE = COMPARE_SIDE,
) => ({
  type,
  children: [h3(title), ...items.map((item) => paragraph([text(item)]))],
});

const createDiagramItem = (type: string, title: string, content: string) => ({
  type,
  children: [h3(title), paragraph([text(content)])],
});

const createDiagramTitleItem = (type: string, title: string) => ({
  type,
  children: [h3(title)],
});

const createStatsItem = (stat: string, label: string) => ({
  type: STATS_ITEM,
  stat,
  children: [paragraph([text(label)])],
});

// ============================================================================
// CHART BUILDERS
// ============================================================================

// Helper to create a chart node with disableAnimation
const createChartNode = (
  type: string,
  data: unknown,
  options?: Record<string, unknown>,
): TElement =>
  ({
    type,
    data,
    disableAnimation: false,
    ...options,
    children: [{ text: "" }],
  }) as unknown as TElement;

export const chartItems: PaletteItem[] = [
  {
    key: "chart-pie",
    label: "Pie Chart",
    node: createChartNode(PIE_CHART_ELEMENT, [
      { label: "Enterprise", value: 42 },
      { label: "Small Business", value: 28 },
      { label: "Mid-Market", value: 18 },
      { label: "Consumer", value: 8 },
      { label: "Government", value: 4 },
    ]),
  },
  // Donut Chart - dedicated donut type
  {
    key: "chart-donut",
    label: "Donut Chart",
    node: createChartNode(DONUT_CHART_ELEMENT, [
      { label: "Completed", value: 65 },
      { label: "In Progress", value: 20 },
      { label: "Pending", value: 10 },
      { label: "Cancelled", value: 5 },
    ]),
  },
  // Bar Chart - with more data points
  {
    key: "chart-bar",
    label: "Bar Chart",
    node: createChartNode(BAR_CHART_ELEMENT, [
      { label: "Q1 2023", value: 320 },
      { label: "Q2 2023", value: 410 },
      { label: "Q3 2023", value: 570 },
      { label: "Q4 2023", value: 680 },
      { label: "Q1 2024", value: 720 },
      { label: "Q2 2024", value: 850 },
      { label: "Q3 2024", value: 920 },
      { label: "Q4 2024", value: 1050 },
    ]),
  },
  // Line Chart - with more data points
  {
    key: "chart-line",
    label: "Line Chart",
    node: createChartNode(LINE_CHART_ELEMENT, [
      { name: "Jan", value: 120 },
      { name: "Feb", value: 190 },
      { name: "Mar", value: 170 },
      { name: "Apr", value: 230 },
      { name: "May", value: 290 },
      { name: "Jun", value: 310 },
      { name: "Jul", value: 280 },
      { name: "Aug", value: 350 },
      { name: "Sep", value: 420 },
      { name: "Oct", value: 390 },
      { name: "Nov", value: 450 },
      { name: "Dec", value: 520 },
    ]),
  },
  // Area Chart - with gradient fill
  {
    key: "chart-area",
    label: "Area Chart",
    node: createChartNode(AREA_CHART_ELEMENT, [
      { name: "Week 1", value: 1200 },
      { name: "Week 2", value: 1900 },
      { name: "Week 3", value: 1700 },
      { name: "Week 4", value: 2300 },
      { name: "Week 5", value: 2900 },
      { name: "Week 6", value: 3100 },
      { name: "Week 7", value: 2800 },
      { name: "Week 8", value: 3500 },
    ]),
  },
  // Scatter Chart - with X/Y coordinates
  {
    key: "chart-scatter",
    label: "Scatter Chart",
    node: createChartNode(SCATTER_CHART_ELEMENT, [
      { x: 10, y: 30 },
      { x: 25, y: 45 },
      { x: 35, y: 20 },
      { x: 45, y: 55 },
      { x: 55, y: 40 },
      { x: 65, y: 70 },
      { x: 75, y: 50 },
      { x: 85, y: 85 },
      { x: 95, y: 60 },
      { x: 40, y: 35 },
      { x: 60, y: 48 },
      { x: 80, y: 72 },
    ]),
  },
  // Bubble Chart - 3D scatter with z-axis for size
  {
    key: "chart-bubble",
    label: "Bubble Chart",
    node: createChartNode(BUBBLE_CHART_ELEMENT, [
      { x: 10, y: 30, z: 200 },
      { x: 25, y: 45, z: 350 },
      { x: 35, y: 20, z: 150 },
      { x: 45, y: 55, z: 400 },
      { x: 55, y: 40, z: 280 },
      { x: 65, y: 70, z: 520 },
      { x: 75, y: 50, z: 180 },
      { x: 85, y: 85, z: 600 },
    ]),
  },
  // Radar Chart - skills/attributes comparison
  {
    key: "chart-radar",
    label: "Radar Chart",
    node: createChartNode(RADAR_CHART_ELEMENT, [
      { name: "Speed", value: 85 },
      { name: "Reliability", value: 90 },
      { name: "Usability", value: 78 },
      { name: "Performance", value: 92 },
      { name: "Security", value: 88 },
      { name: "Scalability", value: 75 },
    ]),
  },
  // Radial Bar Chart - progress indicators
  {
    key: "chart-radial-bar",
    label: "Radial Bar",
    node: createChartNode(RADIAL_BAR_CHART_ELEMENT, [
      { label: "Marketing", value: 85 },
      { label: "Sales", value: 72 },
      { label: "Engineering", value: 94 },
      { label: "Design", value: 68 },
      { label: "Support", value: 81 },
    ]),
  },
  // Radial Column - circular columns
  {
    key: "chart-radial-column",
    label: "Radial Column",
    node: createChartNode(RADIAL_COLUMN_CHART_ELEMENT, [
      { label: "Jan", value: 45 },
      { label: "Feb", value: 52 },
      { label: "Mar", value: 48 },
      { label: "Apr", value: 61 },
      { label: "May", value: 55 },
      { label: "Jun", value: 67 },
    ]),
  },
  // Composed Chart - multi-series with bar, line, area
  {
    key: "chart-composed",
    label: "Composed Chart",
    node: createChartNode(COMPOSED_CHART_ELEMENT, [
      { label: "Jan", revenue: 4500, expenses: 3200, profit: 1300 },
      { label: "Feb", revenue: 5200, expenses: 3400, profit: 1800 },
      { label: "Mar", revenue: 4800, expenses: 3100, profit: 1700 },
      { label: "Apr", revenue: 6100, expenses: 3800, profit: 2300 },
      { label: "May", revenue: 5900, expenses: 3500, profit: 2400 },
      { label: "Jun", revenue: 6800, expenses: 4000, profit: 2800 },
    ]),
  },
  // Treemap Chart - hierarchical data
  {
    key: "chart-treemap",
    label: "Treemap",
    node: createChartNode(TREEMAP_CHART_ELEMENT, [
      { label: "North America", value: 45000 },
      { label: "Europe", value: 32000 },
      { label: "Asia Pacific", value: 28000 },
      { label: "Latin America", value: 12000 },
      { label: "Middle East", value: 8000 },
      { label: "Africa", value: 5000 },
    ]),
  },
  // Histogram - frequency distribution
  {
    key: "chart-histogram",
    label: "Histogram",
    node: createChartNode(HISTOGRAM_CHART_ELEMENT, [
      { label: "15-25", value: 3 },
      { label: "25-35", value: 7 },
      { label: "35-45", value: 15 },
      { label: "45-55", value: 25 },
      { label: "55-65", value: 20 },
      { label: "65-75", value: 12 },
      { label: "75-85", value: 5 },
    ]),
  },
  // Heatmap - matrix data
  {
    key: "chart-heatmap",
    label: "Heatmap",
    node: createChartNode(HEATMAP_CHART_ELEMENT, [
      { x: "Mon", y: "Morning", value: 75 },
      { x: "Mon", y: "Afternoon", value: 85 },
      { x: "Mon", y: "Evening", value: 45 },
      { x: "Tue", y: "Morning", value: 65 },
      { x: "Tue", y: "Afternoon", value: 92 },
      { x: "Tue", y: "Evening", value: 55 },
      { x: "Wed", y: "Morning", value: 80 },
      { x: "Wed", y: "Afternoon", value: 78 },
      { x: "Wed", y: "Evening", value: 40 },
    ]),
  },
  // Range Bar - value ranges
  {
    key: "chart-range-bar",
    label: "Range Bar",
    node: createChartNode(RANGE_BAR_CHART_ELEMENT, [
      { category: "Project A", low: 10, high: 45 },
      { category: "Project B", low: 20, high: 65 },
      { category: "Project C", low: 15, high: 55 },
      { category: "Project D", low: 30, high: 80 },
      { category: "Project E", low: 5, high: 35 },
    ]),
  },
  // Range Area - area with ranges
  {
    key: "chart-range-area",
    label: "Range Area",
    node: createChartNode(RANGE_AREA_CHART_ELEMENT, [
      { date: "Jan", low: 20, high: 45 },
      { date: "Feb", low: 25, high: 52 },
      { date: "Mar", low: 22, high: 48 },
      { date: "Apr", low: 28, high: 58 },
      { date: "May", low: 32, high: 65 },
      { date: "Jun", low: 35, high: 70 },
    ]),
  },
  // Waterfall - cumulative effects
  {
    key: "chart-waterfall",
    label: "Waterfall",
    node: createChartNode(WATERFALL_CHART_ELEMENT, [
      { category: "Start", amount: 100 },
      { category: "Revenue", amount: 50 },
      { category: "Costs", amount: -30 },
      { category: "Marketing", amount: -15 },
      { category: "Tax", amount: -10 },
      { category: "Net", amount: 95 },
    ]),
  },
  // Box Plot - statistical distribution
  {
    key: "chart-box-plot",
    label: "Box Plot",
    node: createChartNode(BOX_PLOT_CHART_ELEMENT, [
      { category: "Q1", min: 10, q1: 25, median: 35, q3: 48, max: 65 },
      { category: "Q2", min: 15, q1: 30, median: 42, q3: 55, max: 72 },
      { category: "Q3", min: 12, q1: 28, median: 38, q3: 52, max: 68 },
      { category: "Q4", min: 18, q1: 35, median: 48, q3: 62, max: 78 },
    ]),
  },
  // Candlestick - financial OHLC
  {
    key: "chart-candlestick",
    label: "Candlestick",
    node: createChartNode(CANDLESTICK_CHART_ELEMENT, [
      { date: "Mon", open: 100, high: 115, low: 95, close: 110 },
      { date: "Tue", open: 110, high: 125, low: 105, close: 120 },
      { date: "Wed", open: 120, high: 130, low: 112, close: 115 },
      { date: "Thu", open: 115, high: 128, low: 108, close: 125 },
      { date: "Fri", open: 125, high: 140, low: 118, close: 135 },
    ]),
  },
  // Sunburst - hierarchical radial
  {
    key: "chart-sunburst",
    label: "Sunburst",
    node: createChartNode(SUNBURST_CHART_ELEMENT, DEFAULT_CHART_DATA.hierarchy),
  },
  // Sankey - flow visualization
  {
    key: "chart-sankey",
    label: "Sankey",
    node: createChartNode(SANKEY_CHART_ELEMENT, [
      { from: "Website", to: "Signup", size: 100 },
      { from: "Referral", to: "Signup", size: 40 },
      { from: "Signup", to: "Trial", size: 80 },
      { from: "Trial", to: "Paid", size: 50 },
      { from: "Trial", to: "Churn", size: 30 },
    ]),
  },
  // Funnel - pipeline visualization
  {
    key: "chart-funnel",
    label: "Funnel",
    node: createChartNode(FUNNEL_CHART_ELEMENT, [
      { label: "Visitors", value: 10000 },
      { label: "Prospects", value: 5000 },
      { label: "Leads", value: 2500 },
      { label: "Opportunities", value: 1000 },
      { label: "Customers", value: 500 },
    ]),
  },
  // Pyramid Chart - triangular visualization
  {
    key: "chart-pyramid",
    label: "Pyramid Chart",
    node: createChartNode(PYRAMID_CHART_ELEMENT, [
      { label: "Executive", value: 5 },
      { label: "Management", value: 20 },
      { label: "Specialists", value: 50 },
      { label: "Staff", value: 100 },
    ]),
  },
  // Radial Gauge - circular gauge
  {
    key: "chart-radial-gauge",
    label: "Radial Gauge",
    node: createChartNode(RADIAL_GAUGE_ELEMENT, 75),
  },
  // Linear Gauge - linear gauge
  {
    key: "chart-linear-gauge",
    label: "Linear Gauge",
    node: createChartNode(LINEAR_GAUGE_ELEMENT, 65),
  },
];

export const basicBlockItems: PaletteItem[] = [
  {
    category: "Text",
    key: "title",
    label: "Title",
    description: "! Title",
    node: {
      type: PRESENTATION_TITLE_ELEMENT,
      alignment: "left",
      variant: "title",
      children: [text("Title")],
    } as unknown as TElement,
  },
  {
    category: "Text",
    key: "heading-1",
    label: "Heading 1",
    description: "# Heading 1",
    node: heading("h1", "Heading 1"),
  },
  {
    category: "Text",
    key: "heading-2",
    label: "Heading 2",
    description: "## Heading 2",
    node: heading("h2", "Heading 2"),
  },
  {
    category: "Text",
    key: "heading-3",
    label: "Heading 3",
    description: "### Heading 3",
    node: heading("h3", "Heading 3"),
  },
  {
    category: "Text",
    key: "heading-4",
    label: "Heading 4",
    description: "#### Heading 4",
    node: heading("h4", "Heading 4"),
  },
  {
    category: "Text",
    key: "paragraph",
    label: "Text",
    description: "Paragraph",
    node: paragraph([text("Add a paragraph here.")]),
  },
  {
    category: "Text",
    key: "blockquote",
    label: "Blockquote",
    description: "> Quote",
    node: simple.blockquote("Add a quote here."),
  },
  {
    category: "Text",
    key: "label",
    label: "Label",
    description: "Label",
    node: {
      type: LABEL_ELEMENT,
      alignment: "left",
      children: [text("Label")],
    } as unknown as TElement,
  },
  {
    category: "Tables",
    key: "table-2x2",
    label: "2x2 table",
    description: "/table",
    node: blankTable(2, 2),
  },
  {
    category: "Tables",
    key: "table-3x3",
    label: "3x3 table",
    node: blankTable(3, 3),
  },
  {
    category: "Tables",
    key: "table-4x4",
    label: "4x4 table",
    node: blankTable(4, 4),
  },
  {
    category: "Lists",
    key: "bulleted-list",
    label: "Bulleted list",
    description: "- Item",
    node: listBlock(KEYS.ul, "Item"),
  },
  {
    category: "Lists",
    key: "numbered-list",
    label: "Numbered list",
    description: "1. Item",
    node: listBlock(KEYS.ol, "Item"),
  },
  {
    category: "Lists",
    key: "todo-list",
    label: "Todo list",
    description: "[] Item",
    node: listBlock(KEYS.listTodo, "Item"),
  },
  {
    category: "Callout boxes",
    key: "callout-note",
    label: "Note box",
    description: "/note",
    node: callout(
      "FiFileText",
      CALLOUT_VARIANTS.note.backgroundColor,
      "Add a note here.",
      "note",
    ),
  },
  {
    category: "Callout boxes",
    key: "callout-info",
    label: "Info box",
    description: "/info",
    node: callout(
      "FiInfo",
      CALLOUT_VARIANTS.info.backgroundColor,
      "Add useful information here.",
      "info",
    ),
  },
  {
    category: "Callout boxes",
    key: "callout-warning",
    label: "Warning box",
    description: "/warning",
    node: callout(
      "FiAlertTriangle",
      "#FFF7ED",
      "Add a warning here.",
      "warning",
    ),
  },
  {
    category: "Callout boxes",
    key: "callout-caution",
    label: "Caution box",
    description: "/caution",
    node: callout("FiXCircle", "#FEF2F2", "Add a caution here.", "caution"),
  },
  {
    category: "Callout boxes",
    key: "callout-success",
    label: "Success box",
    description: "/success",
    node: callout(
      "FiCheckCircle",
      "#F0FDF4",
      "Add a success note here.",
      "success",
    ),
  },
  {
    category: "Callout boxes",
    key: "callout-question",
    label: "Question box",
    description: "/question",
    node: callout(
      "FiHelpCircle",
      CALLOUT_VARIANTS.question.backgroundColor,
      "Add a question here.",
      "question",
    ),
  },
  {
    category: "Interactive",
    key: "button",
    label: "Button",
    node: {
      type: BUTTON_ELEMENT,
      alignment: "left",
      variant: "filled",
      size: "md",
      children: [paragraph([text("Get Started")])],
    } as unknown as TElement,
  },
  {
    category: "Interactive",
    key: "toggle",
    label: "Toggle",
    node: {
      type: KEYS.toggle,
      children: [text("Toggle content")],
    } as unknown as TElement,
  },
  {
    category: "Other",
    key: "code",
    label: "Code block",
    description: "```",
    node: codeBlock(`// Your code here\nconst hello = "world";`, "typescript"),
  },
  {
    category: "Other",
    key: "math",
    label: "Math block",
    node: {
      type: KEYS.equation,
      texExpression: "f(x)=x^2",
      children: [{ text: "" }],
    } as unknown as TElement,
  },
  {
    category: "Other",
    key: "contributors",
    label: "Contributors",
    node: {
      type: CONTRIBUTOR_ELEMENT,
      alignment: "left",
      children: [text("")],
    } as unknown as TElement,
  },
  {
    category: "Other",
    key: "toc",
    label: "Table of contents",
    node: simple.toc(),
  },
];

export const statsItems: PaletteItem[] = [
  {
    key: "stats-plain",
    label: "Stats",
    node: {
      type: STATS_GROUP,
      statsType: "plain",
      columnSize: "md",
      children: [
        createStatsItem("64", "Completion rate"),
        createStatsItem("28", "Active teams"),
        createStatsItem("91", "Satisfaction score"),
      ],
    } as unknown as TElement,
  },
  {
    key: "stats-circle",
    label: "Circle Stats",
    node: {
      type: STATS_GROUP,
      statsType: "circle",
      columnSize: "md",
      children: [
        createStatsItem("72", "Progress"),
        createStatsItem("48", "Adoption"),
        createStatsItem("88", "Quality"),
      ],
    } as unknown as TElement,
  },
  {
    key: "stats-star",
    label: "Star Rating",
    node: {
      type: STATS_GROUP,
      statsType: "star",
      columnSize: "md",
      children: [
        createStatsItem("4", "Customer rating"),
        createStatsItem("5", "Product fit"),
        createStatsItem("4", "Team confidence"),
      ],
    } as unknown as TElement,
  },
  {
    key: "stats-bar",
    label: "Bar Stats",
    node: {
      type: STATS_GROUP,
      statsType: "bar",
      columnSize: "md",
      children: [
        createStatsItem("74", "Pipeline"),
        createStatsItem("52", "Usage"),
        createStatsItem("89", "Retention"),
      ],
    } as unknown as TElement,
  },
  {
    key: "stats-dot-grid",
    label: "Dot Grid Stats",
    node: {
      type: STATS_GROUP,
      statsType: "dot-grid",
      columnSize: "md",
      children: [
        createStatsItem("68", "Coverage"),
        createStatsItem("41", "Reach"),
        createStatsItem("96", "Reliability"),
      ],
    } as unknown as TElement,
  },
  {
    key: "stats-dot-line",
    label: "Dot Line Stats",
    node: {
      type: STATS_GROUP,
      statsType: "dot-line",
      columnSize: "md",
      children: [
        createStatsItem("60", "Baseline"),
        createStatsItem("75", "Target"),
        createStatsItem("90", "Stretch"),
      ],
    } as unknown as TElement,
  },
];

export const quoteItems: PaletteItem[] = [
  {
    key: "quote-large",
    label: "Large Quote",
    node: {
      type: QUOTE_ELEMENT,
      variant: "large",
      author: "Author name",
      children: [text("Add a memorable quote or testimonial here.")],
    } as unknown as TElement,
  },
  {
    key: "quote-side-icon",
    label: "Quote with Icon",
    node: {
      type: QUOTE_ELEMENT,
      variant: "sidequote-icon",
      author: "Author name",
      children: [text("Add a short supporting quote here.")],
    } as unknown as TElement,
  },
  {
    key: "quote-side",
    label: "Side Quote",
    node: {
      type: QUOTE_ELEMENT,
      variant: "sidequote",
      author: "Author name",
      children: [text("Add a concise quote here.")],
    } as unknown as TElement,
  },
];

export const embedItems: PaletteItem[] = [
  {
    key: "media-embed",
    label: "Media Embed",
    node: {
      type: KEYS.mediaEmbed,
      provider: "youtube",
      url: "",
      alignment: "center",
      width: "100%",
      children: [{ text: "" }],
    } as unknown as TElement,
  },
  {
    key: "infographic",
    label: "AI Infographic",
    node: {
      type: ANTV_INFOGRAPHIC,
      syntax: "",
      isLoading: false,
      align: "center",
      children: [{ text: "" }],
    } as unknown as TElement,
  },
];

export const paletteItems: PaletteItem[] = [
  {
    key: "bullets",
    label: "Bullet Points",
    node: createList(BULLET_GROUP, BULLET_ITEM, [
      { heading: "Point one", content: "Add your first key point here." },
      { heading: "Point two", content: "Add your second key point here." },
      { heading: "Point three", content: "Add your third key point here." },
    ]),
  },

  {
    key: "timeline",
    label: "Timeline",
    node: createList(TIMELINE_GROUP, TIMELINE_ITEM, [
      { heading: "Step one", content: "Describe what happened at this stage." },
      { heading: "Step two", content: "Describe what happened at this stage." },
      {
        heading: "Step three",
        content: "Describe what happened at this stage.",
      },
    ]),
  },
  {
    key: "steps",
    label: "Steps",
    node: {
      type: STEPS_GROUP,
      variant: "arrow",
      columnSize: "md",
      children: [
        {
          type: STEPS_ITEM,
          children: [
            h4("Step one"),
            paragraph([text("Describe the first step here.")]),
          ],
        },
        {
          type: STEPS_ITEM,
          children: [
            h4("Step two"),
            paragraph([text("Describe the second step here.")]),
          ],
        },
        {
          type: STEPS_ITEM,
          children: [
            h4("Step three"),
            paragraph([text("Describe the third step here.")]),
          ],
        },
      ],
    } as unknown as TElement,
  },
  {
    key: "arrows",
    label: "Process (Arrows)",
    node: createList(ARROW_LIST, ARROW_LIST_ITEM, [
      { heading: "Step one", content: "Describe this step." },
      { heading: "Step two", content: "Describe this step." },
      { heading: "Step three", content: "Describe this step." },
    ]),
  },
  {
    key: "arrow-vertical",
    label: "Vertical Steps",
    node: createList(SEQUENCE_ARROW_GROUP, SEQUENCE_ARROW_ITEM, [
      { heading: "Step one", content: "Describe this step." },
      { heading: "Step two", content: "Describe this step." },
      { heading: "Step three", content: "Describe this step." },
    ]),
  },
  {
    key: "slope",
    label: "Slope",
    node: {
      type: SLOPE_GROUP,
      children: [
        {
          ...createDiagramTitleItem(SLOPE_ITEM, "Ideate"),
          icon: "FaLightbulb",
        },
        {
          ...createDiagramTitleItem(SLOPE_ITEM, "Prototype"),
          icon: "FaFlask",
        },
        {
          ...createDiagramTitleItem(SLOPE_ITEM, "Validate"),
          icon: "FaCheck",
        },
        {
          ...createDiagramTitleItem(SLOPE_ITEM, "Scale"),
          icon: "FaChartLine",
        },
      ],
    } as unknown as TElement,
  },
  {
    key: "snake",
    label: "Snake Flow",
    node: {
      type: SNAKE_GROUP,
      children: [
        createDiagramItem(SNAKE_ITEM, "Assess", "Evaluate the current state."),
        createDiagramItem(SNAKE_ITEM, "Plan", "Define the roadmap."),
        createDiagramItem(SNAKE_ITEM, "Build", "Develop the solution."),
        createDiagramItem(SNAKE_ITEM, "Validate", "Test and refine."),
        createDiagramItem(SNAKE_ITEM, "Scale", "Deploy and optimize."),
      ],
    } as unknown as TElement,
  },

  // HIERARCHIES
  {
    key: "pyramid",
    label: "Pyramid",
    node: createList(PYRAMID_GROUP, PYRAMID_ITEM, [
      { content: "Top level." },
      { content: "Middle level." },
      { content: "Base level." },
    ]),
  },
  {
    key: "staircase",
    label: "Staircase",
    node: createList(STAIRCASE_GROUP, STAIR_ITEM, [
      { content: "Level one." },
      { content: "Level two." },
      { content: "Level three." },
    ]),
  },
  {
    key: "cycle",
    label: "Cycle",
    node: createList(CYCLE_GROUP, CYCLE_ITEM, [
      { heading: "Discover", content: "Identify the opportunity." },
      { heading: "Plan", content: "Define the next move." },
      { heading: "Build", content: "Create the first version." },
      { heading: "Improve", content: "Refine from feedback." },
    ]),
  },
  {
    key: "connected-circles",
    label: "Connected Circles",
    node: {
      type: CONNECTED_CIRCLES_GROUP,
      children: [
        createDiagramItem(
          CONNECTED_CIRCLES_ITEM,
          "Shared Moments",
          "Center the message on emotional occasions.",
        ),
        createDiagramItem(
          CONNECTED_CIRCLES_ITEM,
          "Consistent Voice",
          "Keep the message stable and recognizable.",
        ),
        createDiagramItem(
          CONNECTED_CIRCLES_ITEM,
          "Emotion First",
          "Connect the brand to feelings.",
        ),
        createDiagramItem(
          CONNECTED_CIRCLES_ITEM,
          "Long Memory",
          "Make the brand easy to recognize later.",
        ),
      ],
    } as unknown as TElement,
  },
  {
    key: "circular-grid",
    label: "Circular Grid",
    node: {
      type: CIRCULAR_GRID_GROUP,
      centerText: "Smart Diagram",
      children: [
        createDiagramItem(CIRCULAR_GRID_ITEM, "Objective", "Define the goal."),
        createDiagramItem(CIRCULAR_GRID_ITEM, "Signals", "Capture inputs."),
        createDiagramItem(CIRCULAR_GRID_ITEM, "Actions", "Move into work."),
        createDiagramItem(CIRCULAR_GRID_ITEM, "Metrics", "Track progress."),
        createDiagramItem(CIRCULAR_GRID_ITEM, "Risks", "Surface assumptions."),
        createDiagramItem(CIRCULAR_GRID_ITEM, "Learning", "Feed results back."),
      ],
    } as unknown as TElement,
  },
  // COMPARISON & EVALUATION
  {
    key: "boxes",
    label: "Feature Boxes",
    node: {
      type: BOX_GROUP,
      children: [
        createBoxItem("Feature one", "Describe this feature."),
        createBoxItem("Feature two", "Describe this feature."),
        createBoxItem("Feature three", "Describe this feature."),
      ],
    } as unknown as TElement,
  },
  {
    key: "compare",
    label: "Comparison",
    node: {
      type: COMPARE_GROUP,
      children: [
        createCompareSide("Option A", [
          "Point one",
          "Point two",
          "Point three",
        ]),
        createCompareSide("Option B", [
          "Point one",
          "Point two",
          "Point three",
        ]),
      ],
    } as unknown as TElement,
  },
  {
    key: "before-after",
    label: "Before / After",
    node: {
      type: BEFORE_AFTER_GROUP,
      children: [
        createCompareSide(
          "Before",
          ["Point one", "Point two", "Point three"],
          BEFORE_AFTER_SIDE,
        ),
        createCompareSide(
          "After",
          ["Point one", "Point two", "Point three"],
          BEFORE_AFTER_SIDE,
        ),
      ],
    } as unknown as TElement,
  },
  {
    key: "pros-cons",
    label: "Pros & Cons",
    node: {
      type: PROS_CONS_GROUP,
      children: [
        {
          type: PROS_ITEM,
          children: [paragraph([text("Strength or advantage.")])],
        },
        {
          type: PROS_ITEM,
          children: [paragraph([text("Strength or advantage.")])],
        },
        {
          type: CONS_ITEM,
          children: [paragraph([text("Weakness or limitation.")])],
        },
        {
          type: CONS_ITEM,
          children: [paragraph([text("Weakness or limitation.")])],
        },
      ],
    } as unknown as TElement,
  },

  // ICONS
  {
    key: "icon-list",
    label: "Icon List",
    node: {
      type: ICON_LIST,
      orientation: "side",
      variant: "icon",
      children: [
        createIconListItem("activity", "Describe this point."),
        createIconListItem("shield", "Describe this point."),
        createIconListItem("bolt", "Describe this point."),
      ],
    } as unknown as TElement,
  },

  // INTERACTIVE & MEDIA
  {
    key: "image",
    label: "Image",
    node: {
      type: "img",
      url: "",
      query: "",
      children: [],
    } as unknown as TElement,
  },
  {
    key: "columns",
    label: "Columns",
    node: columns([
      {
        title: "Column one",
        body: ["Add your content here.", "Add more points."],
      },
      {
        title: "Column two",
        body: ["Add your content here.", "Add more points."],
      },
      {
        title: "Column three",
        body: ["Add your content here.", "Add more points."],
      },
    ]),
  },

  ...statsItems,
  ...quoteItems,
  ...embedItems,
];

const HIDDEN_PALETTE_ITEM_KEYS = new Set<string>();

export const visiblePaletteItems = paletteItems.filter(
  (item) => !HIDDEN_PALETTE_ITEM_KEYS.has(item.key),
);
