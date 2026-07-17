import { tool } from "@langchain/core/tools";
import * as z from "zod";

import { LAYOUT_REFERENCE } from "@/lib/presentation/layout-catalog";
import { presentationAiThemePropertiesSchema } from "@/lib/presentation/theme-schema";
import { themes } from "@/lib/presentation/themes";
import { search_tool } from "../search";

const COMPONENT_INSTRUCTIONS = `Component instructions:
- Match component geometry to SECTION layout: vertical root images need horizontal/wide components, and left/right root images need vertical or compact components.
- Do not pair CYCLE with layout="vertical".
- Use compact text in dense visual components. SNAKE, CIRCULAR-GRID, CONNECTED-CIRCLES, and SLOPE items need very short labels.
- SLOPE items must use <H4> only and must not include <P>.
- Use <TITLE> only for the first slide, a newly created title slide, or an introduction slide.
- For most first/title slides, include <TITLE>, <CONTRIBUTOR />, and a supporting visual image. The contributor block self-populates with the creator name; omit it only when a stronger creative concept needs the space.
- Treat <LABEL>, <BLOCKQUOTE>, <QUOTE>, <CALLOUT>, and <CODE> as normal content blocks that can be used anywhere headings and paragraphs can be used, including inside COLUMNS. But don't overuse them.
- Use COLUMNS only for balanced lanes. Every column item must have parallel content, similar text length, and the same heading level; do not mix an H1-style item with H3/H4-style items in sibling columns.
- Keep columns visually balanced even when they include images, charts, infographics, or nested supported content.`;

// Schema for scope specification
const ScopeSchema = z
  .enum(["all"])
  .optional()
  .describe(
    "Scope of the action: 'all' for all slides. Defaults to 'all' if not specified. This property and slideIds property are mutually exclusive. If you provide both, the slideIds property will be ignored.",
  );

const slideIdsSchema = z
  .array(z.string())
  .optional()
  .describe(
    "Specific slide ids to apply the action to. If provided, overrides scope. This property and scope property are mutually exclusive. If you provide both, this property will be ignored. So be very careful.",
  );

const builtInThemeSchema = z.enum(
  Object.keys(themes) as [keyof typeof themes, ...(keyof typeof themes)[]],
);

const edit_slide_properties = tool(
  async (props) => {
    const { slideIds: _slideIds, scope: _scope, ...rest } = props;
    return `Updated ${Object.keys(rest).join(", ")} successfully to ${Object.values(rest).join(", ")}`;
  },
  {
    name: "edit_slide_properties",
    description: "You can use this tool to edit the properties of a slide",
    schema: z.object({
      scope: ScopeSchema,
      slideIds: slideIdsSchema,
      bgColor: z
        .string()
        .describe(
          "The background color of the slide, use 'reset' to reset the background color",
        )
        .optional(),
      alignment: z
        .enum(["start", "center", "end", "reset"])
        .describe("The content alignment of the slide")
        .optional(),
      layoutType: z
        .enum(["left", "right", "vertical", "background", "reset"])
        .describe(
          "Determines where the accent / root image appears in the slide, left means the image is on the left, right means the image is on the right, vertical means the image is on the top, background means the image is the background of the slide",
        )
        .optional(),
      width: z
        .enum(["S", "M", "L", "reset"])
        .describe("The width of the slide")
        .optional(),
    }),
  },
);

const replace_image = tool(
  async (props) => {
    const { slideIds: _slideIds, scope: _scope, ...rest } = props;
    if (rest.imageUrl) {
      return `Image url replaced successfully`;
    } else if (rest.imagePrompt) {
      return `Image successfully generated from the given prompt`;
    }
    return `No image url or image prompt provided`;
  },
  {
    name: "replace_image",
    description:
      "You can use this tool to replace the root image of a slide. If the user also asked for slide text, layout, or content changes, call create_slide or regenerate_slide first, wait for that content tool to complete, and only then call replace_image.",
    schema: z.object({
      slideIds: slideIdsSchema,
      scope: ScopeSchema,
      imageUrl: z
        .string()
        .describe("The URL of the image to replace")
        .optional(),
      imagePrompt: z
        .string()
        .describe(
          "Image request for the replacement. Use a detailed descriptive prompt only when the selected image source is AI generation. For Unsplash, Pixabay, Google, web, or stock image search, use a short English keyword query with 2-5 concrete words, such as 'team collaboration' or 'solar panels roof'.",
        )
        .optional(),
      imageSource: z
        .enum(["ai", "stock", "gif"])
        .describe(
          "How the imagePrompt should be resolved. Use 'stock' for Unsplash/Pixabay/Google/web image search, 'gif' for animated GIFs, and 'ai' for detailed generated-image prompts.",
        )
        .optional(),
      stockImageProvider: z
        .enum(["unsplash", "pixabay", "google"])
        .describe("Preferred stock provider when imageSource is 'stock'.")
        .optional(),
    }),
  },
);

const change_theme = tool(
  async (props) => {
    const { theme } = props;
    return `Theme changed successfully to ${theme}`;
  },
  {
    name: "change_theme",
    description:
      "Apply an existing built-in presentation theme. Use create_custom_theme when the user asks for custom fonts, custom colors, brand styling, or a new theme.",
    schema: z.object({
      theme: builtInThemeSchema.describe("The built-in theme id to apply"),
    }),
  },
);

const create_custom_theme = tool(
  async (props) => {
    return `Custom theme "${props.themeData.name ?? "Custom theme"}" created and applied successfully`;
  },
  {
    name: "create_custom_theme",
    description:
      "Create and apply a custom presentation theme. Use this for custom visual identity, brand styling, font changes, palettes, or backgrounds. Only provide colors, fonts, and background values that are relevant to the request; omitted values are kept from the current theme.",
    schema: z.object({
      isPublic: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether the new custom theme should be public"),
      themeData: presentationAiThemePropertiesSchema.describe(
        "Partial custom theme data. Only include colors, fonts, and background values. Use real, well-known font family names that fit the brand and requirement. Do not invent font names. smartLayout is the fill color for SVG layout elements such as pyramids, pie charts, staircases, cycles, timelines, and diagrams; choose it as a close companion or deliberate variant of primary, not as the cardBackground. cardBackground is the readable text container surface. Do not include animation, transitions, shadows, border radius, or masks.",
      ),
    }),
  },
);

const update_custom_theme = tool(
  async (props) => {
    return `Custom theme "${props.themeData.name ?? "Custom theme"}" updated and applied successfully`;
  },
  {
    name: "update_custom_theme",
    description:
      "Update the currently selected custom presentation theme and apply it. If the current theme is built-in, the app will create a new custom theme from this data instead. Only provide colors, fonts, and background values that should change; omitted values are kept from the current theme.",
    schema: z.object({
      isPublic: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether the custom theme should be public"),
      themeData: presentationAiThemePropertiesSchema.describe(
        "Partial replacement theme data. Only include colors, fonts, and background values. Use real, well-known font family names that fit the brand and requirement. Do not invent font names. smartLayout is the fill color for SVG layout elements such as pyramids, pie charts, staircases, cycles, timelines, and diagrams; choose it as a close companion or deliberate variant of primary, not as the cardBackground. cardBackground is the readable text container surface. Do not include animation, transitions, shadows, border radius, or masks.",
      ),
    }),
  },
);

const REGENERATE_SLIDE_DESCRIPTION = `You are a presentation XML expert. Regenerate one or more existing slides from the user's request.

Your task is to return exactly two arrays: \`slideIds\` and \`slides\`, with the same length and same order so that \`slides[i]\` replaces \`slideIds[i]\`.

Use this tool for slide content, layout, text, chart, infographic, and structure changes. If the user also wants a new root image, regenerate the XML content here first; replace/generate the root image afterward with replace_image.

Return only valid XML strings in \`slides\`. Each item must be one <SECTION>...</SECTION> block, not a full <PRESENTATION>. Use only supported tags and attributes. Put headings, body, and layout content before any direct child root <IMG ... />. If a root image is included, it must be the final direct child of <SECTION>. Keep <IMG /> tags self-closing.

Preserve structure when the request is text-only. Keep the same SECTION layout, component type, item count when reasonable, root image placement, and existing image URLs unless the user asks to change them. When the user asks for a structural change, choose the component that fits the content shape: list for grouped points, sequence for process or progression, comparison for trade-offs or states, relationship for connected concepts, data for evidence, infographic for custom diagrams, and columns for balanced mixed-content lanes.

${LAYOUT_REFERENCE}

${COMPONENT_INSTRUCTIONS}

Use images deliberately. A direct child <IMG /> is the root slide image and must stay last. Use short English keyword queries for stock, web, Unsplash, Pixabay, Google, or GIF search. Use detailed visual prompts for AI image generation. Keep existing image urls exactly when the user did not request image regeneration.

Use icon attributes as search hints only. Each icon value must be exactly one broad lowercase English keyword with no spaces, punctuation, hyphens, underscores, or react-icons component names. Good examples: security, analytics, team, growth, upload, idea, automation, calendar, money, network, settings, document, message. Do not default to home unless the content is actually about home. For icon lists, use <ICONS variant="icon"> with DIV icon attributes, or <ICONS variant="image"> with DIV prompt attributes for generated item images. Use orientation="side" for visual beside text and orientation="top" for visual above text.

Do not choose background layouts or full-slide image backgrounds by default. Only use <SECTION layout="background"> when the user explicitly asks to make an image the slide background, or when preserving an existing/template structure that already uses it.

Use infographics when a process map, lifecycle, hierarchy, relationship diagram, matrix, framework, funnel, or cause-and-effect flow communicates better than a list, chart, or image. If the user explicitly asks for an infographic, diagram, process map, framework, or similar visual on a slide, include exactly one <INFOGRAPHIC> element on that slide. The infographic text must include only the information needed to generate the diagram: exact labels, entities, values, steps, sequence, relationships, the required visual orientation, and the takeaway. Do not include unrelated slide state. For <SECTION layout="vertical">, request a horizontal/landscape infographic because the infographic will sit in the wide content area. For <SECTION layout="left"> or <SECTION layout="right">, request a vertical/stacked infographic because it must fit beside the side root image. Limit layout-based infographic prompts to 5 or fewer visible items by merging lower-priority details. If INFOGRAPHIC is the main/root component, do not add another layout component; only simple headings or paragraphs may accompany it.

Mandatory rules:
- Include boolean-style attributes only when enabled; omit false attributes.
- Write compact real slide copy, not placeholders.
- Convert markdown into XML text content; do not include markdown markers inside headings or paragraphs.`;

const regenerate_slide = tool(
  async (props) => {
    const { slideIds: _slideIds } = props;
    return `Slides regenerated successfully`;
  },
  {
    name: "regenerate_slide",
    description: REGENERATE_SLIDE_DESCRIPTION,
    schema: z
      .object({
        slideIds: z
          .array(z.string())
          .min(1)
          .describe(
            "Array of slide ids to regenerate. Order must match the `slides` array.",
          ),
        slides: z
          .array(z.string())
          .min(1)
          .describe(
            "Array of XML <SECTION> strings. Each item is a single slide's content.",
          ),
      })
      .superRefine((data, ctx) => {
        if (data.slideIds.length !== data.slides.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "`slideIds` and `slides` must have the same length and matching order.",
            path: ["slides"],
          });
        }
      }),
  },
);

// Create new slides and insert them after a given slide id (if provided), else append
const create_slide = tool(
  async (props) => {
    const { afterSlideId: _afterSlideId, slides: _slides } = props as {
      afterSlideId?: string;
      slides: string[];
    };
    return `Slides created successfully`;
  },
  {
    name: "create_slide",
    description:
      "Create one or more slides. Return an array of XML <SECTION> strings and optionally the slide id to insert after. Generate headings/body/layout content first; when adding a direct child root <IMG ... />, place it as the final child of <SECTION> so the content appears before root image generation.",
    schema: z.object({
      slides: z
        .array(z.string())
        .min(1)
        .describe(
          'Array of XML <SECTION> strings. Each item is a single slide\'s content. Supported default layouts are left, right, and vertical. Use layout="background" only when the user explicitly asks for a full-slide image background or when preserving an existing/template structure that already uses it. For the root image only provide the query and not url. Include an <INFOGRAPHIC> XML element inside SECTION when a custom visual explanation improves clarity. The element text must include labels, values, entities, sequence, relationships, takeaway, and required orientation, without unrelated slide state. For layout="vertical", request a horizontal/landscape infographic for the wide content area. For layout="left" or layout="right", request a vertical/stacked infographic for the narrow side-by-side content area. If INFOGRAPHIC is the main slide component, only simple headings or paragraphs may accompany it; do not add another layout component. For layout-based infographic prompts, cap visible items at 5 or fewer by combining lower-priority details.',
        ),
      afterSlideId: z
        .string()
        .optional()
        .describe(
          "Insert new slides immediately after this slide id. If omitted or not found, append to the end.",
        ),
    }),
  },
);

// Delete slides by ids
const delete_slide = tool(
  async (props) => {
    const { slideIds: _slideIds } = props as { slideIds: string[] };
    return `Slides deleted successfully`;
  },
  {
    name: "delete_slide",
    description: "Delete one or more slides by id.",
    schema: z.object({
      slideIds: z
        .array(z.string())
        .min(1)
        .describe("Array of slide ids to delete."),
    }),
  },
);
// Export all tools as an array
export const presentationTools = [
  edit_slide_properties,
  replace_image,
  change_theme,
  create_custom_theme,
  update_custom_theme,
  regenerate_slide,
  create_slide,
  delete_slide,
  search_tool,
] as const;

export type PresentationTool =
  | "edit_slide_properties"
  | "replace_image"
  | "change_theme"
  | "create_custom_theme"
  | "update_custom_theme"
  | "regenerate_slide"
  | "create_slide"
  | "delete_slide"
  | "exa_search_results_json";
