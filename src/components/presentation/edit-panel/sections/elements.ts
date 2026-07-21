"use client";

import { ColumnItemPlugin, ColumnPlugin } from "@platejs/layout/react";
import { KEYS, type TElement, type TText } from "platejs";

import {
  ANTV_INFOGRAPHIC,
  ARROW_LIST,
  ARROW_LIST_ITEM,
  BAR_CHART_ELEMENT,
  BEFORE_AFTER_GROUP,
  BEFORE_AFTER_SIDE,
  BOX_GROUP,
  BOX_ITEM,
  BULLET_GROUP,
  BULLET_ITEM,
  BUTTON_ELEMENT,
  CIRCULAR_GRID_GROUP,
  CIRCULAR_GRID_ITEM,
  COMPARE_GROUP,
  COMPARE_SIDE,
  CONNECTED_CIRCLES_GROUP,
  CONNECTED_CIRCLES_ITEM,
  CONS_ITEM,
  CONTRIBUTOR_ELEMENT,
  CYCLE_GROUP,
  CYCLE_ITEM,
  ICON_LIST,
  ICON_LIST_ITEM,
  LABEL_ELEMENT,
  LINE_CHART_ELEMENT,
  PIE_CHART_ELEMENT,
  PRESENTATION_TITLE_ELEMENT,
  PROS_CONS_GROUP,
  PROS_ITEM,
  PYRAMID_GROUP,
  PYRAMID_ITEM,
  QUOTE_ELEMENT,
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
  TIMELINE_GROUP,
  TIMELINE_ITEM,
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
