import {
  ArrowRight,
  BarChart3,
  CreditCard,
  Flower,
  GitCompare,
  Grid3x3,
  Hash,
  ImageIcon,
  List,
  ListOrdered,
  Quote,
  Shapes,
  Square,
  Triangle,
} from "lucide-react";
import { nanoid } from "nanoid";

import {
  ARROW_LIST,
  ARROW_LIST_ITEM,
  BAR_CHART_ELEMENT,
  BEFORE_AFTER_GROUP,
  BEFORE_AFTER_SIDE,
  BOX_GROUP,
  BOX_ITEM,
  BULLET_GROUP,
  BULLET_ITEM,
  CIRCULAR_GRID_GROUP,
  CIRCULAR_GRID_ITEM,
  COLUMN_GROUP,
  COLUMN_ITEM,
  COMPARE_GROUP,
  COMPARE_SIDE,
  CONNECTED_CIRCLES_GROUP,
  CONNECTED_CIRCLES_ITEM,
  CONS_ITEM,
  CYCLE_GROUP,
  CYCLE_ITEM,
  getDefaultChartDataForType,
  ICON_LIST,
  ICON_LIST_ITEM,
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
} from "../editor/lib";
import { type PlateSlide } from "./parser";
import * as Previews from "./template-previews";

export interface TemplateCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
}

export interface TemplateDefinition {
  id: string;
  legacyIds?: string[];
  name: string;
  categoryId: string;
  preview: React.ReactNode;
  template: Omit<PlateSlide, "id">;
}

export function getTemplateSelectionIds(
  template: TemplateDefinition,
): string[] {
  return [template.id, ...(template.legacyIds ?? [])];
}

export function isTemplateSelected(
  selectedTemplateIds: readonly string[],
  template: TemplateDefinition,
): boolean {
  const templateIds = new Set(getTemplateSelectionIds(template));

  return selectedTemplateIds.some((templateId) => templateIds.has(templateId));
}

export function removeTemplateSelection(
  selectedTemplateIds: readonly string[],
  template: TemplateDefinition,
): string[] {
  const templateIds = new Set(getTemplateSelectionIds(template));

  return selectedTemplateIds.filter(
    (templateId) => !templateIds.has(templateId),
  );
}

const createBaseContent = (
  title: string = "Main message",
  desc: string = "One concise supporting sentence that explains the point.",
) => [
  { type: "h2", id: nanoid(), children: [{ text: title }] },
  {
    type: "p",
    id: nanoid(),
    children: [{ text: desc }],
  },
];

const createTitleDescriptionContent = (
  title: string = "Title",
  desc: string = "A short supporting description that explains the main point.",
) => [
  {
    type: PRESENTATION_TITLE_ELEMENT,
    id: nanoid(),
    variant: "title",
    children: [{ text: title }],
  },
  {
    type: "p",
    id: nanoid(),
    children: [{ text: desc }],
  },
];

const createTextImageColumnContent = ({
  imageFirst,
}: {
  imageFirst: boolean;
}) => {
  const textColumn = {
    type: COLUMN_ITEM,
    id: nanoid(),
    children: createTitleDescriptionContent(
      "Title",
      "Description text goes here.",
    ),
  };
  const imageColumn = {
    type: COLUMN_ITEM,
    id: nanoid(),
    children: [
      {
        type: "img",
        query: "relevant topic visual",
        id: nanoid(),
        children: [{ text: "" }],
      },
    ],
  };

  return [
    {
      type: COLUMN_GROUP,
      id: nanoid(),
      layout: [1, 1],
      children: imageFirst
        ? [imageColumn, textColumn]
        : [textColumn, imageColumn],
    },
  ];
};

const createListContent = ({
  type = "basic",
  items = 4,
}: {
  type?: "basic" | "numbered" | "arrow";
  items?: number;
}) => [
  { type: "h2", id: nanoid(), children: [{ text: "List Title" }] },
  {
    type: BULLET_GROUP,
    id: nanoid(),
    bulletType: type, // Default to basic
    children: Array.from({ length: items }).map((_, index) => ({
      type: BULLET_ITEM,
      id: nanoid(),
      children: createDiagramTextChildren(
        `Point ${index + 1}`,
        "Short evidence or implication.",
      ),
    })),
  },
];

const createBoxContent = (
  variant:
    | "solid"
    | "outline"
    | "icon"
    | "sideline"
    | "side-label"
    | "top-label"
    | "top-circle"
    | "joined"
    | "joined-icon"
    | "leaf"
    | "labeled"
    | "alternating",
  items: number = 4,
) => [
  { type: "h2", id: nanoid(), children: [{ text: "Box Layout" }] },
  {
    type: BOX_GROUP,
    id: nanoid(),
    boxType: variant,
    columnSize: "md",
    children: Array.from({ length: items }).map((_, index) => ({
      type: BOX_ITEM,
      id: nanoid(),
      icon: variant.includes("icon") ? "idea" : undefined,
      children: createDiagramTextChildren(
        `Card ${index + 1}`,
        "Compact supporting detail.",
      ),
    })),
  },
];
const createChartContent = (type: string, title: string, variant?: string) => {
  return [
    { type: "h2", id: nanoid(), children: [{ text: title }] },
    {
      type,
      id: nanoid(),
      data: getDefaultChartDataForType(type),
      variant,
      children: [{ text: "" }], // Void element
    },
  ];
};

const createCycleContent = (items: number = 4) => [
  { type: "h2", id: nanoid(), children: [{ text: "Cycle Process" }] },
  {
    type: CYCLE_GROUP,
    id: nanoid(),
    children: Array.from({ length: items }).map(() => ({
      type: CYCLE_ITEM,
      id: nanoid(),
      children: [{ text: "Step" }],
    })),
  },
];

const createDiagramTextChildren = (title: string, desc: string) => [
  { type: "h3", id: nanoid(), children: [{ text: title }] },
  { type: "p", id: nanoid(), children: [{ text: desc }] },
];

const createSlopeContent = () => [
  { type: "h2", id: nanoid(), children: [{ text: "Growth Path" }] },
  {
    type: SLOPE_GROUP,
    id: nanoid(),
    children: ["Ideate", "Prototype", "Validate", "Scale"].map((title) => ({
      type: SLOPE_ITEM,
      id: nanoid(),
      icon: "idea",
      children: [{ type: "h4", id: nanoid(), children: [{ text: title }] }],
    })),
  },
];

const createConnectedCirclesContent = () => [
  { type: "h2", id: nanoid(), children: [{ text: "Connected Priorities" }] },
  {
    type: CONNECTED_CIRCLES_GROUP,
    id: nanoid(),
    children: (
      [
        ["Plan", "Define goals and align stakeholders."],
        ["Build", "Develop features while iterating."],
        ["Validate", "Test assumptions and refine direction."],
        ["Scale", "Expand reach while preserving quality."],
      ] satisfies ReadonlyArray<readonly [string, string]>
    ).map(([title, desc]) => ({
      type: CONNECTED_CIRCLES_ITEM,
      id: nanoid(),
      children: createDiagramTextChildren(title, desc),
    })),
  },
];

const createCircularGridContent = () => [
  { type: "h2", id: nanoid(), children: [{ text: "Smart Diagram" }] },
  {
    type: CIRCULAR_GRID_GROUP,
    id: nanoid(),
    centerText: "Smart Diagram",
    children: (
      [
        ["Objective", "Define the main goal."],
        ["Signals", "Capture the inputs that matter."],
        ["Actions", "Translate insights into work."],
        ["Metrics", "Track the change over time."],
        ["Risks", "Surface assumptions early."],
        ["Learning", "Feed results into the next cycle."],
      ] satisfies ReadonlyArray<readonly [string, string]>
    ).map(([title, desc]) => ({
      type: CIRCULAR_GRID_ITEM,
      id: nanoid(),
      children: createDiagramTextChildren(title, desc),
    })),
  },
];

const createSnakeContent = () => [
  { type: "h2", id: nanoid(), children: [{ text: "Delivery Flow" }] },
  {
    type: SNAKE_GROUP,
    id: nanoid(),
    children: (
      [
        ["Assess", "Evaluate needs and current state."],
        ["Plan", "Define strategy and roadmap."],
        ["Build", "Develop solutions and integrations."],
        ["Validate", "Test, iterate, and refine."],
        ["Scale", "Deploy broadly and optimize."],
      ] satisfies ReadonlyArray<readonly [string, string]>
    ).map(([title, desc]) => ({
      type: SNAKE_ITEM,
      id: nanoid(),
      children: createDiagramTextChildren(title, desc),
    })),
  },
];

const createStaircaseContent = (items: number = 4) => [
  { type: "h2", id: nanoid(), children: [{ text: "Staircase" }] },
  {
    type: STAIRCASE_GROUP,
    id: nanoid(),
    variant: "inside",
    children: Array.from({ length: items }).map((_, index) => ({
      type: STAIR_ITEM,
      id: nanoid(),
      children: createDiagramTextChildren(
        `Level ${index + 1}`,
        "Progress marker.",
      ),
    })),
  },
];

const createPyramidContent = (variant: "pyramid" | "funnel") => [
  {
    type: "h2",
    id: nanoid(),
    children: [{ text: variant === "pyramid" ? "Pyramid" : "Funnel" }],
  },
  {
    type: PYRAMID_GROUP,
    id: nanoid(),
    isFunnel: variant === "funnel",
    variant: "inside",
    children: Array.from({ length: 4 }).map((_, index) => ({
      type: PYRAMID_ITEM,
      id: nanoid(),
      children: createDiagramTextChildren(
        variant === "pyramid" ? `Layer ${index + 1}` : `Stage ${index + 1}`,
        "Short label.",
      ),
    })),
  },
];

const createTimelineContent = (
  variant: "timeline" | "arrow" | "pill" | "parallelogram" | "arrow-vertical",
  items: number = 4,
) => {
  let groupType = TIMELINE_GROUP;
  let itemType = TIMELINE_ITEM;
  let extraProps = {};

  if (variant === "arrow") {
    groupType = ARROW_LIST;
    itemType = ARROW_LIST_ITEM;
    extraProps = { svgType: "arrow" };
  } else if (variant === "pill") {
    groupType = ARROW_LIST;
    itemType = ARROW_LIST_ITEM;
    extraProps = { svgType: "pill" };
  } else if (variant === "parallelogram") {
    groupType = ARROW_LIST;
    itemType = ARROW_LIST_ITEM;
    extraProps = { svgType: "parallelogram" };
  } else if (variant === "arrow-vertical") {
    groupType = SEQUENCE_ARROW_GROUP;
    itemType = SEQUENCE_ARROW_ITEM;
  }

  return [
    { type: "h2", id: nanoid(), children: [{ text: "Timeline / Sequence" }] },
    {
      type: groupType,
      id: nanoid(),
      ...extraProps,
      orientation: variant === "arrow-vertical" ? "vertical" : "horizontal",
      numbered: true,
      showLine: true,
      children: Array.from({ length: items }).map((_, index) => ({
        type: itemType,
        id: nanoid(),
        children: createDiagramTextChildren(
          `Step ${index + 1}`,
          "Outcome of this stage.",
        ),
      })),
    },
  ];
};

const createStatsContent = (
  variant:
    | "plain"
    | "circle"
    | "star"
    | "bar"
    | "dot-grid"
    | "dot-line"
    | "circle-bold",
  items: number = 3,
) => [
  { type: "h2", id: nanoid(), children: [{ text: "Statistics" }] },
  {
    type: STATS_GROUP,
    id: nanoid(),
    statsType: variant,
    columnSize: "md",
    children: Array.from({ length: items }).map((_, index) => ({
      type: STATS_ITEM,
      id: nanoid(),
      stat: `${72 + index * 8}%`,
      children: [
        {
          type: "p",
          id: nanoid(),
          children: [{ text: `Metric ${index + 1}` }],
        },
      ],
    })),
  },
];

const createColumnContent = (
  cols: number = 2,
  options: { includeImages?: boolean } = {},
) => [
  { type: "h2", id: nanoid(), children: [{ text: "Columns Layout" }] },
  {
    type: COLUMN_GROUP,
    id: nanoid(),
    columnSize: "md",
    layout: Array(cols).fill(1),
    children: Array.from({ length: cols }).map((_, index) => ({
      type: COLUMN_ITEM,
      id: nanoid(),
      children: [
        ...(options.includeImages
          ? [
              {
                type: "img",
                query: `topic image ${index + 1}`,
                id: nanoid(),
                children: [{ text: "" }],
              },
            ]
          : []),
        {
          type: "h3",
          id: nanoid(),
          children: [{ text: `Column ${index + 1}` }],
        },
        {
          type: "p",
          id: nanoid(),
          children: [{ text: "Parallel supporting detail." }],
        },
      ],
    })),
  },
];

const createQuoteContent = (
  variant: "large" | "sidequote-icon" | "sidequote",
) => [
  {
    type: QUOTE_ELEMENT,
    id: nanoid(),
    variant,
    author: "Author Name",
    children: [
      {
        text: "This is an inspiring quote that captures the essence of your message.",
      },
    ],
  },
];

const createCompareContent = (variant: "compare" | "before-after") => {
  const groupType = variant === "compare" ? COMPARE_GROUP : BEFORE_AFTER_GROUP;
  const sideType = variant === "compare" ? COMPARE_SIDE : BEFORE_AFTER_SIDE;
  const labels =
    variant === "compare"
      ? (["Option A", "Option B"] as const)
      : (["Before", "After"] as const);

  return [
    { type: "h2", id: nanoid(), children: [{ text: "Comparison" }] },
    {
      type: groupType,
      id: nanoid(),
      children: labels.map((label) => ({
        type: sideType,
        id: nanoid(),
        children: [
          { type: "h3", id: nanoid(), children: [{ text: label }] },
          { type: "p", id: nanoid(), children: [{ text: "Key difference." }] },
          {
            type: "p",
            id: nanoid(),
            children: [{ text: "Important implication." }],
          },
        ],
      })),
    },
  ];
};

const createProsConsContent = () => [
  { type: "h2", id: nanoid(), children: [{ text: "Trade-offs" }] },
  {
    type: PROS_CONS_GROUP,
    id: nanoid(),
    children: [
      {
        type: PROS_ITEM,
        id: nanoid(),
        children: [
          { type: "h3", id: nanoid(), children: [{ text: "Pros" }] },
          {
            type: "p",
            id: nanoid(),
            indent: 1,
            listStyleType: "disc",
            children: [{ text: "Positive impact." }],
          },
          {
            type: "p",
            id: nanoid(),
            indent: 1,
            listStyleType: "disc",
            children: [{ text: "Why it helps." }],
          },
        ],
      },
      {
        type: CONS_ITEM,
        id: nanoid(),
        children: [
          { type: "h3", id: nanoid(), children: [{ text: "Cons" }] },
          {
            type: "p",
            id: nanoid(),
            indent: 1,
            listStyleType: "disc",
            children: [{ text: "Potential limitation." }],
          },
          {
            type: "p",
            id: nanoid(),
            indent: 1,
            listStyleType: "disc",
            children: [{ text: "What to watch." }],
          },
        ],
      },
    ],
  },
];

const createIconListContent = () => [
  { type: "h2", id: nanoid(), children: [{ text: "Key Signals" }] },
  {
    type: ICON_LIST,
    id: nanoid(),
    orientation: "side",
    variant: "icon",
    children: (
      [
        ["analytics", "Signal one", "What the signal tells us."],
        ["shield", "Signal two", "Why it matters."],
        ["growth", "Signal three", "Expected effect."],
      ] satisfies ReadonlyArray<readonly [string, string, string]>
    ).map(([icon, title, desc]) => ({
      type: ICON_LIST_ITEM,
      id: nanoid(),
      icon,
      children: createDiagramTextChildren(title, desc),
    })),
  },
];

const createStepsContent = () => [
  { type: "h2", id: nanoid(), children: [{ text: "Action Plan" }] },
  {
    type: STEPS_GROUP,
    id: nanoid(),
    variant: "arrow",
    columnSize: "md",
    children: ["Discover", "Build", "Launch"].map((title, index) => ({
      type: STEPS_ITEM,
      id: nanoid(),
      icon: ["search", "settings", "growth"][index],
      children: createDiagramTextChildren(title, "Short action detail."),
    })),
  },
];

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: "basic", name: "Basic", icon: <Grid3x3 className="size-4" /> },
  { id: "boxes", name: "Boxes", icon: <Square className="size-4" /> },
  { id: "bullets", name: "Bullets", icon: <List className="size-4" /> },
  {
    id: "card-layouts",
    name: "Card layouts",
    icon: <CreditCard className="size-4" />,
  },
  {
    id: "charts",
    name: "Charts & data",
    icon: <BarChart3 className="size-4" />,
  },
  {
    id: "comparison",
    name: "Comparison",
    icon: <GitCompare className="size-4" />,
  },
  { id: "circles", name: "Circles", icon: <Flower className="size-4" /> },
  { id: "icons", name: "Icons", icon: <Shapes className="size-4" /> },
  { id: "images", name: "Images", icon: <ImageIcon className="size-4" /> },
  { id: "numbers", name: "Numbers", icon: <Hash className="size-4" /> },
  { id: "pyramids", name: "Pyramids", icon: <Triangle className="size-4" /> },
  { id: "sequence", name: "Sequence", icon: <ArrowRight className="size-4" /> },
  { id: "steps", name: "Steps", icon: <ListOrdered className="size-4" /> },
  { id: "quotes", name: "Quotes", icon: <Quote className="size-4" /> },
];

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  // Basic
  {
    id: "text-and-heading",
    legacyIds: ["text-boxes"],
    name: "Text and Heading",
    categoryId: "basic",
    preview: <Previews.TextAndHeadingPreview />,
    template: {
      layoutType: "vertical",
      content: createTitleDescriptionContent(
        "Title",
        "A concise description introduces the slide and frames the main point.",
      ),
    },
  },
  {
    id: "text-and-image",
    name: "Text and image",
    categoryId: "basic",
    preview: <Previews.TextAndImagePreview />,
    template: {
      content: createTextImageColumnContent({ imageFirst: false }),
    },
  },
  {
    id: "image-and-text",
    name: "Image and text",
    categoryId: "basic",
    preview: <Previews.ImageAndTextPreview />,
    template: {
      content: createTextImageColumnContent({ imageFirst: true }),
    },
  },
  {
    id: "two-columns",
    name: "Two columns",
    categoryId: "comparison",
    preview: <Previews.TwoColumnsPreview />,
    template: {
      content: [
        {
          type: COLUMN_GROUP,
          id: nanoid(),
          layout: [1, 1],
          children: [
            {
              type: COLUMN_ITEM,
              id: nanoid(),
              children: [
                {
                  type: "h3",
                  id: nanoid(),
                  children: [{ text: "First Column" }],
                },
                {
                  type: "p",
                  id: nanoid(),
                  children: [{ text: "Description text goes here." }],
                },
              ],
            },
            {
              type: COLUMN_ITEM,
              id: nanoid(),
              children: [
                {
                  type: "h3",
                  id: nanoid(),
                  children: [{ text: "Second Column" }],
                },
                {
                  type: "p",
                  id: nanoid(),
                  children: [{ text: "Description text goes here." }],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "two-columns-with-heading",
    name: "Two columns with heading",
    categoryId: "comparison",
    preview: <Previews.TwoColumnsWithHeadingPreview />,
    template: {
      content: [
        {
          type: "h2",
          id: nanoid(),
          children: [{ text: "Two columns with heading" }],
        },
        {
          type: COLUMN_GROUP,
          id: nanoid(),
          layout: [1, 1],
          children: [
            {
              type: COLUMN_ITEM,
              id: nanoid(),
              children: [
                {
                  type: "h3",
                  id: nanoid(),
                  children: [{ text: "First Column" }],
                },
                {
                  type: "p",
                  id: nanoid(),
                  children: [{ text: "Description text goes here." }],
                },
              ],
            },
            {
              type: COLUMN_ITEM,
              id: nanoid(),
              children: [
                { type: "h3", id: nanoid(), children: [{ text: "Title" }] },
                {
                  type: "p",
                  id: nanoid(),
                  children: [{ text: "Description text goes here." }],
                },
              ],
            },
          ],
        },
      ],
    },
  },

  // Boxes
  {
    id: "solid-boxes",
    name: "Solid boxes",
    categoryId: "boxes",
    preview: <Previews.SolidBoxesPreview />,
    template: { content: createBoxContent("solid") },
  },
  {
    id: "outline-boxes",
    name: "Outline boxes",
    categoryId: "boxes",
    preview: <Previews.OutlineBoxesPreview />,
    template: { content: createBoxContent("outline") },
  },
  {
    id: "side-line-boxes",
    name: "Side line boxes",
    categoryId: "boxes",
    preview: <Previews.SideLineBoxesPreview />,
    template: { content: createBoxContent("sideline") },
  },
  {
    id: "side-line-text",
    name: "Side line text",
    categoryId: "boxes",
    preview: <Previews.SideLineTextPreview />,
    template: { content: createBoxContent("side-label", 3) },
  },
  {
    id: "top-line-text",
    name: "Top line text",
    categoryId: "boxes",
    preview: <Previews.TopLineTextPreview />,
    template: { content: createBoxContent("top-label", 3) },
  },
  {
    id: "top-circle-boxes",
    name: "Top circle boxes",
    categoryId: "boxes",
    preview: <Previews.TopCircleBoxesPreview />,
    template: { content: createBoxContent("top-circle", 3) },
  },
  {
    id: "joined-boxes",
    name: "Joined boxes",
    categoryId: "boxes",
    preview: <Previews.JoinedBoxesPreview />,
    template: { content: createBoxContent("joined") },
  },
  {
    id: "boxes-with-icons",
    name: "Joined boxes with icons",
    categoryId: "boxes",
    preview: <Previews.BoxesWithIconsPreview />,
    template: { content: createBoxContent("joined-icon", 3) },
  },
  {
    id: "leaf-boxes",
    name: "Leaf boxes",
    categoryId: "boxes",
    preview: <Previews.LeafBoxesPreview />,
    template: { content: createBoxContent("leaf") },
  },
  {
    id: "labeled-boxes",
    name: "Labeled boxes",
    categoryId: "boxes",
    preview: <Previews.LabeledBoxesPreview />,
    template: { content: createBoxContent("labeled", 3) },
  },
  {
    id: "alternating-boxes",
    name: "Alternating boxes",
    categoryId: "boxes",
    preview: <Previews.AlternatingBoxesPreview />,
    template: { content: createBoxContent("alternating", 3) },
  },

  // Bullets
  {
    id: "numbered-bullets",
    name: "Numbered bullets",
    categoryId: "bullets",
    preview: <Previews.LargeBulletsPreview />,
    template: { content: createListContent({ type: "numbered" }) },
  },
  {
    id: "small-bullets",
    name: "Small bullets",
    categoryId: "bullets",
    preview: <Previews.SmallBulletsPreview />,
    template: { content: createListContent({ type: "basic" }) },
  },
  {
    id: "arrow-bullets",
    name: "Arrow bullets",
    categoryId: "bullets",
    preview: <Previews.ArrowBulletsPreview />,
    template: { content: createListContent({ type: "arrow" }) },
  },

  // Card Layouts
  {
    id: "accent-left-layout",
    name: "Accent left",
    categoryId: "card-layouts",
    preview: <Previews.AccentLeftPreview />,
    template: {
      layoutType: "left",
      content: createBaseContent(),
      rootImage: {
        query: "relevant vertical accent visual",
        layoutType: "left",
      },
    },
  },
  {
    id: "accent-right-layout",
    name: "Accent right",
    categoryId: "card-layouts",
    preview: <Previews.AccentRightPreview />,
    template: {
      content: createBaseContent(),
      layoutType: "right",
      rootImage: {
        query: "relevant vertical accent visual",
        layoutType: "right",
      },
    },
  },
  {
    id: "accent-top-layout",
    name: "Accent top",
    categoryId: "card-layouts",
    preview: <Previews.AccentTopPreview />,
    template: {
      content: createBaseContent(),
      layoutType: "vertical",
      rootImage: {
        query: "relevant wide header visual",
        layoutType: "vertical",
      },
    },
  },
  {
    id: "accent-right-fit",
    name: "Accent right (fit)",
    categoryId: "card-layouts",
    preview: <Previews.AccentRightFitPreview />,
    template: {
      content: createBaseContent(),
      layoutType: "right",
      rootImage: {
        query: "relevant contained visual",
        layoutType: "right",
        cropSettings: {
          objectFit: "contain",
          objectPosition: {
            x: 50,
            y: 50,
          },
        },
      },
    },
  },
  {
    id: "accent-left-fit",
    name: "Accent left (fit)",
    categoryId: "card-layouts",
    preview: <Previews.AccentLeftFitPreview />,
    template: {
      content: createBaseContent(),
      layoutType: "left",
      rootImage: {
        query: "relevant contained visual",
        layoutType: "left",
        cropSettings: {
          objectFit: "contain",
          objectPosition: {
            x: 50,
            y: 50,
          },
        },
      },
    },
  },
  {
    id: "accent-background",
    name: "Accent background",
    categoryId: "card-layouts",
    preview: <Previews.AccentBackgroundPreview />,
    template: {
      content: createBaseContent(),
      layoutType: "background",
      rootImage: {
        query: "relevant full slide background",
        layoutType: "background",
      },
    },
  },

  {
    id: "bar-chart",
    name: "Bar chart",
    categoryId: "charts",
    preview: <Previews.BarChartPreview />,
    template: {
      content: createChartContent(BAR_CHART_ELEMENT, "Bar Chart", "horizontal"),
    },
  },
  {
    id: "line-chart",
    name: "Line chart",
    categoryId: "charts",
    preview: <Previews.LineChartPreview />,
    template: {
      content: createChartContent(LINE_CHART_ELEMENT, "Line Chart"),
    },
  },
  {
    id: "pie-chart",
    name: "Pie chart",
    categoryId: "charts",
    preview: <Previews.PieChartPreview />,
    template: { content: createChartContent(PIE_CHART_ELEMENT, "Pie Chart") },
  },
  {
    id: "comparison",
    name: "Comparison",
    categoryId: "comparison",
    preview: <Previews.TwoColumnsPreview />,
    template: { content: createCompareContent("compare") },
  },
  {
    id: "before-after",
    name: "Before and after",
    categoryId: "comparison",
    preview: <Previews.TwoColumnsWithHeadingPreview />,
    template: { content: createCompareContent("before-after") },
  },
  {
    id: "pros-cons",
    name: "Pros and cons",
    categoryId: "comparison",
    preview: <Previews.SideLineBoxesPreview />,
    template: { content: createProsConsContent() },
  },

  {
    id: "cycle",
    name: "Cycle",
    categoryId: "circles",
    preview: <Previews.CyclePreview />,
    template: { content: createCycleContent(4) },
  },
  {
    id: "connected-circles",
    name: "Connected circles",
    categoryId: "circles",
    preview: <Previews.ConnectedCirclesDiagramPreview />,
    template: { content: createConnectedCirclesContent() },
  },
  {
    id: "circular-grid",
    name: "Circular grid",
    categoryId: "circles",
    preview: <Previews.CircularGridDiagramPreview />,
    template: { content: createCircularGridContent() },
  },

  {
    id: "icon-list",
    name: "Icon list",
    categoryId: "icons",
    preview: <Previews.BoxesWithIconsPreview />,
    template: { content: createIconListContent() },
  },

  {
    id: "two-image-columns",
    name: "2 Image columns",
    categoryId: "images",
    preview: <Previews.TwoImageColumnsPreview />,
    template: { content: createColumnContent(2, { includeImages: true }) },
  },
  {
    id: "three-image-columns",
    name: "3 Image columns",
    categoryId: "images",
    preview: <Previews.ThreeImageColumnsCardPreview />,
    template: { content: createColumnContent(3, { includeImages: true }) },
  },
  {
    id: "four-image-columns",
    name: "4 image columns",
    categoryId: "images",
    preview: <Previews.FourImageColumnsPreview />,
    template: { content: createColumnContent(4, { includeImages: true }) },
  },
  {
    id: "images-with-text",
    name: "Images with text",
    categoryId: "images",
    preview: <Previews.ImagesWithTextPreview />,
    template: { content: createColumnContent(3, { includeImages: true }) },
  },
  {
    id: "image-gallery",
    name: "Image gallery",
    categoryId: "images",
    preview: <Previews.ImageGalleryPreview />,
    template: { content: createColumnContent(3, { includeImages: true }) },
  },
  {
    id: "team-photos",
    name: "Team photos",
    categoryId: "images",
    preview: <Previews.TeamPhotosPreview />,
    template: { content: createColumnContent(4, { includeImages: true }) },
  },

  {
    id: "stats",
    name: "Stats",
    categoryId: "numbers",
    preview: <Previews.StatsPreview />,
    template: { content: createStatsContent("plain") },
  },
  {
    id: "circle-stats",
    name: "Circle stats",
    categoryId: "numbers",
    preview: <Previews.CircleStatsPreview />,
    template: { content: createStatsContent("circle") },
  },
  {
    id: "bar-stats",
    name: "Bar stats",
    categoryId: "numbers",
    preview: <Previews.BarStatsPreview />,
    template: { content: createStatsContent("bar") },
  },
  {
    id: "star-rating",
    name: "Star rating",
    categoryId: "numbers",
    preview: <Previews.StarRatingPreview />,
    template: { content: createStatsContent("star") },
  },
  {
    id: "dot-grid-stats",
    name: "Dot grid stats",
    categoryId: "numbers",
    preview: <Previews.DotGridStatsPreview />,
    template: { content: createStatsContent("dot-grid") },
  },
  {
    id: "dot-line-stats",
    name: "Dot line stats",
    categoryId: "numbers",
    preview: <Previews.DotLineStatsPreview />,
    template: { content: createStatsContent("dot-line") },
  },
  {
    id: "circle-stats-bold",
    name: "Circle stats (bold)",
    categoryId: "numbers",
    preview: <Previews.CircleStatsMiddleBoldPreview />,
    template: { content: createStatsContent("circle-bold") },
  },

  // Pyramids

  {
    id: "pyramid",
    name: "Pyramid",
    categoryId: "pyramids",
    preview: <Previews.PyramidPreview />,
    template: { content: createPyramidContent("pyramid") },
  },
  {
    id: "vertical-funnel",
    name: "Vertical funnel",
    categoryId: "pyramids",
    preview: <Previews.VerticalFunnelPreview />,
    template: { content: createPyramidContent("funnel") },
  },

  // Sequence
  {
    id: "timeline-sequence",
    name: "Timeline",
    categoryId: "sequence",
    preview: <Previews.TimelineSequencePreview />,
    template: { content: createTimelineContent("timeline") },
  },
  {
    id: "minimal-timeline",
    name: "Minimal timeline",
    categoryId: "sequence",
    preview: <Previews.MinimalTimelinePreview />,
    template: { content: createTimelineContent("timeline") },
  },
  {
    id: "minimal-timeline-boxes",
    name: "Minimal timeline boxes",
    categoryId: "sequence",
    preview: <Previews.MinimalTimelineWithBoxesPreview />,
    template: { content: createTimelineContent("timeline") },
  },
  {
    id: "arrows-sequence",
    name: "Arrows",
    categoryId: "sequence",
    preview: <Previews.ArrowListPreview />,
    template: { content: createTimelineContent("arrow") },
  },
  {
    id: "pills-sequence",
    name: "Pills",
    categoryId: "sequence",
    preview: <Previews.PillsSequencePreview />,
    template: { content: createTimelineContent("pill") },
  },
  {
    id: "slanted-labels",
    name: "Slanted labels",
    categoryId: "sequence",
    preview: <Previews.SlantedLabelsPreview />,
    template: { content: createTimelineContent("parallelogram") },
  },
  {
    id: "snake-flow",
    name: "Snake flow",
    categoryId: "sequence",
    preview: <Previews.SnakeDiagramPreview />,
    template: { content: createSnakeContent() },
  },

  // Steps
  {
    id: "staircase",
    name: "Staircase",
    categoryId: "steps",
    preview: <Previews.StaircasePreview />,
    template: { content: createStaircaseContent() },
  },
  {
    id: "steps",
    name: "Steps",
    categoryId: "steps",
    preview: <Previews.LargeBulletsPreview />,
    template: { content: createStepsContent() },
  },
  {
    id: "sequence-arrow",
    name: "Sequence Arrow",
    categoryId: "steps",
    preview: <Previews.SequenceArrowPreview />,
    template: { content: createTimelineContent("arrow-vertical") },
  },
  {
    id: "slope",
    name: "Slope",
    categoryId: "steps",
    preview: <Previews.SlopeDiagramPreview />,
    template: { content: createSlopeContent() },
  },

  // Quotes
  {
    id: "large-quote",
    name: "Large quote",
    categoryId: "quotes",
    preview: <Previews.LargeQuotePreview />,
    template: { content: createQuoteContent("large") },
  },
  {
    id: "side-quote-icon",
    name: "Side quote with icon",
    categoryId: "quotes",
    preview: <Previews.SideQuoteWithIconPreview />,
    template: { content: createQuoteContent("sidequote-icon") },
  },
  {
    id: "simple-side-quote",
    name: "Simple side quote",
    categoryId: "quotes",
    preview: <Previews.SimpleSideQuotePreview />,
    template: { content: createQuoteContent("sidequote") },
  },
];
