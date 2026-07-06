import { ChatPromptTemplate } from "@langchain/core/prompts";

import { type PresentationImageSearchResult } from "@/lib/presentation/image-search";
import { LAYOUT_REFERENCE } from "@/lib/presentation/layout-catalog";

export type PresentationGenerationPromptInput = {
  audience?: string;
  currentDate: string;
  imageSearchResults?: PresentationImageSearchResult[];
  imageSource?: "automatic" | "ai" | "stock" | "gif";
  language: string;
  outline: string[];
  outlineTemplateHints?: Record<number, string>;
  presentationTemplateContext?: string;
  prompt: string;
  scenario?: string;
  searchResults?: Array<{ query: string; results: unknown[] }>;
  selectedChunks?: Array<{
    chunkId: string;
    slideNumber?: number | null;
    content?: string;
  }>;
  selectedTemplateCount?: number;
  templateContext?: string;
  textContent?: "minimal" | "concise" | "detailed" | "extensive";
  title: string;
  tone: string;
};

type TemplateMode =
  | "none"
  | "presentation"
  | "assigned-full"
  | "assigned-partial"
  | "selected-full"
  | "selected-partial";

type TemplatePromptContext = {
  assignedSlideCount: number;
  mode: TemplateMode;
  selectedTemplateCount: number;
  totalSlides: number;
};

const COMPONENT_INSTRUCTIONS = `Component instructions:
- Match component geometry to SECTION layout: vertical root images need horizontal/wide components, and left/right root images need vertical or compact components.
- Do not pair CYCLE with layout="vertical".
- Use compact text in dense visual components. SNAKE, CIRCULAR-GRID, CONNECTED-CIRCLES, and SLOPE items need very short labels.
- SLOPE items must use <H4> only and must not include <P>.
- Use <TITLE> only for the first slide, a newly created title slide, or an introduction slide.
- Use <CONTRIBUTOR /> only as an empty standalone metadata block. Do not add attributes or body text to it.
- Treat <LABEL>, <QUOTE>, <CALLOUT>, and <CODE> as normal content blocks that can be used anywhere headings and paragraphs can be used, including inside COLUMNS.
- Use COLUMNS only for balanced lanes. Every column item must have parallel content, similar text length, and the same heading level; do not mix an H1-style item with H3/H4-style items in sibling columns.
- Keep columns visually balanced even when they include images, charts, infographics, or nested supported content.`;

export const SYSTEM_PROMPT_TEMPLATE = `
You are a presentation XML expert. Generate a complete presentation from the user's request, outline, and supporting context. Your output goes directly into a strict XML parser, so produce only valid presentation XML.

Your task is to create exactly {TOTAL_SLIDES} slides. Use the outline for coverage and sequence, then write stronger slide copy when the outline wording is too raw. Match the requested language, tone, audience, scenario, and text density.

Every slide must be distinct. Never repeat the same heading, bullet, or paragraph within one slide, and never generate two slides that say the same thing (e.g. two near-identical "Conclusion" slides). If two outline topics are this similar, write each one from a different angle instead of repeating content.

The human message below contains background info (title, user request, date, language, tone, etc.) so you know what to write about. That block describes the task; it is never the content of a slide. Do not create a slide that lists it, restates its field labels, or repeats the user's request verbatim — every slide must be original content about the topic itself.

# XML SYNTAX GUIDANCE

{XML_SYNTAX_GUIDANCE}

# RULES

{CONTEXT_RULES}

# FORMAT GUIDANCE

{FORMAT_GUIDANCE}

# VISUAL GUIDANCE

{VISUAL_GUIDANCE}

# Image query guidance:
{IMAGE_QUERY_STYLE}

# STYLE GUIDANCE

{STYLE_GUIDANCE}


# XML output contract:
{CRITICAL_RULES}

Generate the complete XML presentation now.`;

const USER_PROMPT_TEMPLATE = `{USER_CONTEXT}`;

export const presentationGenerationPromptTemplate =
  ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPT_TEMPLATE],
    ["human", USER_PROMPT_TEMPLATE],
  ]);

export type PresentationPromptMessages = {
  human: string;
  system: string;
};

export function buildPresentationPromptValues(
  input: PresentationGenerationPromptInput,
): Record<string, string | number> {
  const totalSlides = input.outline.length;
  const templatePromptContext = getTemplatePromptContext({
    outlineTemplateHints: input.outlineTemplateHints,
    presentationTemplateContext: input.presentationTemplateContext,
    selectedTemplateCount: input.selectedTemplateCount ?? 0,
    templateContext: input.templateContext,
    totalSlides,
  });
  const userContext = buildUserContext(input);

  return {
    CRITICAL_RULES: buildCriticalRules(templatePromptContext),
    CONTEXT_RULES: buildContextRules(input, templatePromptContext),
    FORMAT_GUIDANCE: buildFormatGuidance(templatePromptContext),
    IMAGE_QUERY_STYLE: getImageQueryStyle(
      input.imageSource,
      shouldUseImageLibrary(input),
    ),
    STYLE_GUIDANCE: buildStyleGuidance(input),
    TOTAL_SLIDES: totalSlides,
    USER_CONTEXT: userContext,
    VISUAL_GUIDANCE: buildVisualGuidance(templatePromptContext),
    XML_SYNTAX_GUIDANCE: buildXmlSyntaxGuidance(templatePromptContext),
  };
}

export async function buildPresentationPromptMessages(
  input: PresentationGenerationPromptInput,
): Promise<PresentationPromptMessages> {
  const promptValues = buildPresentationPromptValues(input);

  return {
    human: interpolatePromptTemplate(USER_PROMPT_TEMPLATE, promptValues),
    system: interpolatePromptTemplate(SYSTEM_PROMPT_TEMPLATE, promptValues),
  };
}

function interpolatePromptTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (renderedTemplate, [key, value]) =>
      renderedTemplate.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function hasItems(value: unknown[] | undefined): boolean {
  return Array.isArray(value) && value.length > 0;
}

function usesSearchableImageSource(imageSource?: string): boolean {
  return imageSource === "stock" || imageSource === "automatic" || !imageSource;
}

function shouldUseImageLibrary(
  input: PresentationGenerationPromptInput,
): boolean {
  return (
    usesSearchableImageSource(input.imageSource) &&
    hasItems(input.imageSearchResults)
  );
}

function isXmlSectionFormat(value: string): boolean {
  const normalizedValue = value.toLowerCase();

  return (
    normalizedValue.includes("<section") &&
    normalizedValue.includes("</section>")
  );
}

function getXmlSectionFormatHints(
  outlineTemplateHints?: Record<number, string>,
): Record<number, string> {
  if (!outlineTemplateHints) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(outlineTemplateHints).filter(
      (entry): entry is [string, string] => isXmlSectionFormat(entry[1]),
    ),
  );
}

function formatResearchContext(
  searchResults?: Array<{ query: string; results: unknown[] }>,
): string {
  if (!searchResults || searchResults.length === 0) {
    return "";
  }

  const searchData = searchResults
    .map((searchItem, index: number) => {
      const query = searchItem.query || `Search ${index + 1}`;
      const results = Array.isArray(searchItem.results)
        ? searchItem.results
        : [];

      if (results.length === 0) return "";

      const formattedResults = results
        .map((result: unknown) => {
          const resultObj = result as Record<string, unknown>;
          return `- ${resultObj.title || "No title"}\n  ${
            resultObj.content || "No content"
          }\n  ${resultObj.url || "No URL"}`;
        })
        .join("\n");

      return `**Query ${index + 1}:** ${query}\n${formattedResults}`;
    })
    .filter(Boolean)
    .join("\n\n");

  if (!searchData) {
    return "";
  }

  return `## Research Data\n\n\`\`\`md\n${searchData}\n\`\`\`\n`;
}

function formatImageLibrary(
  imageSearchResults?: PresentationImageSearchResult[],
): string {
  if (!imageSearchResults || imageSearchResults.length === 0) {
    return "";
  }

  const formattedSearches = imageSearchResults
    .map((searchItem, index) => {
      const results = Array.isArray(searchItem.results)
        ? searchItem.results
        : [];

      if (results.length === 0) {
        return "";
      }

      return [
        `Query ${index + 1}: ${searchItem.query}`,
        ...results.map((result, resultIndex) => {
          const sourceLabel =
            result.sourceTitle ?? result.sourceUrl ?? "Direct image result";

          return [
            `- Image ${resultIndex + 1}: ${result.description}`,
            `  URL: ${result.url}`,
            `  Source: ${sourceLabel}`,
          ].join("\n");
        }),
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  if (!formattedSearches) {
    return "";
  }

  return `## Preloaded Image Library\n\n\`\`\`md\n${formattedSearches}\n\`\`\`\n`;
}

function getImageQueryStyle(
  imageSource?: string,
  canUseImageLibrary = false,
): string {
  if (imageSource === "gif") {
    return `Image instruction:
- Use \`<IMG query="..." />\` with a short English keyword query to find an animated GIF from Giphy.
- Every \`<IMG query="...">\` value must be written in English for Giphy compatibility, even if the presentation language is not English.
- Keep all slide text/content in the requested presentation language; only the GIF query must stay in English.

Write only the searchable subject, reaction, action, or context:
- Use 1-5 words whenever possible.
- Prefer concrete motion/action terms: celebration, teamwork, launch, typing, applause, confused reaction.
- Do NOT write sentences, camera directions, lighting, art style, colors, or presentation intent.
- Do NOT include commas, quotes, or filler words.

\`\`\`xml
<IMG query="team celebration" />
<IMG query="product launch" />
<IMG query="data loading" />
<IMG query="applause reaction" />
\`\`\``;
  }

  if (usesSearchableImageSource(imageSource)) {
    const imageLibraryRule = canUseImageLibrary
      ? '- When the Preloaded Image Library contains a clearly relevant image, use `<IMG url="..." />` with its exact URL.'
      : "";

    return `Image instruction:
${imageLibraryRule ? `${imageLibraryRule}\n` : ""}- Use \`<IMG query="..." />\` with a short English keyword query to find a stock or web image.
- Every \`<IMG query="...">\` value must be written in English for image-provider compatibility, even if the presentation language is not English.
- Keep all slide text/content in the requested presentation language; only the image query must stay in English.

Write only the searchable subject and context:
- Use 2-5 words whenever possible.
- Prefer concrete nouns and noun phrases: people, place, object, industry, activity.
- Do NOT write sentences, camera directions, lighting, mood, art style, colors, typography, or presentation intent.
- Do NOT include commas, quotes, adjectives like "cinematic", or filler like "high contrast".
- If the slide needs a specific real-world thing, name that thing directly.

\`\`\`xml
<IMG query="smart city skyline" />
<IMG query="team collaboration" />
<IMG query="solar panels roof" />
<IMG query="hospital patient care" />
\`\`\``;
  }

  return `Image instruction:
- Use \`<IMG query="...">\` with a detailed descriptive prompt to generate an image.
- Keep slide text/content in the requested presentation language.
- Write image prompts in English unless the user explicitly requested another language for generated visuals.

Create prompts that:
- Describe the visual scene, composition, and mood
- Include style references (photorealistic, illustration, cinematic, etc.)
- Mention lighting, colors, and atmosphere
- Are relevant to the slide topic
- Do NOT include on-image text unless explicitly required by the slide content
- Do NOT use placeholders, brackets, or vague references
- Do NOT mention AI tools, models, or generation technology

\`\`\`xml
<IMG query="cinematic wide-angle view of a futuristic smart city powered by renewable energy, gleaming solar arrays and vertical gardens, morning haze, warm sunlight cutting through glass towers, clean aerial composition with leading lines, crisp details, high contrast, optimistic mood" />
<IMG query="photorealistic scene of a diverse product team collaborating in a modern glass office, warm ambient lighting, soft shadows, laptops and whiteboards with sketched diagrams, shallow depth of field, candid expressions, balanced composition, professional yet inviting atmosphere" />
\`\`\``;
}

function buildStyleGuidance(input: PresentationGenerationPromptInput): string {
  const textDensity = input.textContent ?? "concise";
  const textDensityGuidance = getTextDensityGuidance(textDensity);
  const styleRules = [
    `Match the requested tone: ${input.tone}.`,
    input.audience ? `Write for this audience: ${input.audience}.` : "",
    input.scenario ? `Fit this presentation scenario: ${input.scenario}.` : "",
    textDensityGuidance,
  ].filter((rule) => rule.length > 0);

  return `Style guidance:
${styleRules.map((rule) => `- ${rule}`).join("\n")}`;
}

function getTextDensityGuidance(
  textDensity: NonNullable<PresentationGenerationPromptInput["textContent"]>,
): string {
  switch (textDensity) {
    case "minimal":
      return "Text density is minimal: use short labels of 1-4 words, no full sentences.";
    case "detailed":
      return "Text density is detailed: write 2-3 full sentences per point (roughly 25-40 words), each adding one concrete supporting detail, example, or number. Do not compress a point down to a single short sentence.";
    case "extensive":
      return "Text density is extensive: write 3-5 full sentences per point (roughly 40-70 words), forming a short paragraph that adds context, implication, and supporting evidence. Never compress a point down to a single line or a short phrase.";
    case "concise":
      return "Text density is concise: use one direct sentence per point.";
  }
}

function buildContextRules(
  input: PresentationGenerationPromptInput,
  context: TemplatePromptContext,
): string {
  const rules = [
    buildTemplateRules(input, context),
    buildResearchRules(input),
    buildSelectedDocumentRules(input.selectedChunks),
  ].filter((section) => section.length > 0);

  return rules.length > 0 ? `${rules.join("\n\n")}\n` : "";
}

function getTemplatePromptContext({
  outlineTemplateHints,
  presentationTemplateContext,
  selectedTemplateCount,
  templateContext,
  totalSlides,
}: {
  outlineTemplateHints?: Record<number, string>;
  presentationTemplateContext?: string;
  selectedTemplateCount: number;
  templateContext?: string;
  totalSlides: number;
}): TemplatePromptContext {
  const assignedSlideCount = Object.keys(
    getXmlSectionFormatHints(outlineTemplateHints),
  ).length;
  const hasPerSlideAssignments = assignedSlideCount > 0;
  let mode: TemplateMode = "none";

  if (presentationTemplateContext) {
    mode = "presentation";
  } else if (hasPerSlideAssignments) {
    mode =
      assignedSlideCount >= totalSlides ? "assigned-full" : "assigned-partial";
  } else if (templateContext) {
    mode =
      selectedTemplateCount >= totalSlides
        ? "selected-full"
        : "selected-partial";
  }

  return {
    assignedSlideCount,
    mode,
    selectedTemplateCount,
    totalSlides,
  };
}

function buildTemplateRules(
  input: PresentationGenerationPromptInput,
  context: TemplatePromptContext,
): string {
  if (context.mode === "presentation" && input.presentationTemplateContext) {
    return `Use this XML structure for the presentation. Fill it with the user's content: headings, body text, list items, table cells, chart values, image queries or urls, icon keywords, and infographic prompt text. If the structure has a different slide count than ${context.totalSlides}, repeat or trim sections in order until the output has exactly ${context.totalSlides} slides.

\`\`\`xml
${input.presentationTemplateContext}
\`\`\``;
  }

  if (context.mode === "none") {
    return `Use the available formats below to generate the deck. Choose the format that best fits each slide's content, and vary formats across the deck so the presentation does not feel repetitive.

${LAYOUT_REFERENCE}

${COMPONENT_INSTRUCTIONS}`;
  }

  const selectedLayoutContext = input.templateContext
    ? `\n\n${input.templateContext}`
    : "";
  const hasSelectedLayoutContext = selectedLayoutContext.length > 0;
  const perSlideLayoutAssignments = buildPerSlideAssignmentsContext(
    getXmlSectionFormatHints(input.outlineTemplateHints),
  );
  const selectedLayoutRule =
    context.mode === "assigned-full"
      ? "Use the listed XML structures for their assigned slides exactly. Fill each structure with the slide content."
      : context.mode === "assigned-partial"
        ? hasSelectedLayoutContext
          ? "Use the listed XML structures for their assigned slides exactly. Fill each structure with the slide content. Use the selected XML layouts on the best matching unassigned slides, then build any other remaining slides from the available XML syntax below."
          : "Use the listed XML structures for their assigned slides exactly. Fill each structure with the slide content. Build the remaining slides from the available XML syntax below."
        : context.mode === "selected-full"
          ? "Use every selected XML layout exactly once across the deck. Assign each selected layout to the slide where it best fits the outline, unless the user has assigned a layout to a specific slide."
          : "Use every selected XML layout exactly once on the best matching slides. Build the remaining slides from the available XML syntax below.";
  const remainingSlideCount = Math.max(
    context.totalSlides -
      (context.mode === "assigned-full" || context.mode === "assigned-partial"
        ? context.assignedSlideCount
        : context.selectedTemplateCount),
    0,
  );
  const catalogRule =
    remainingSlideCount > 0 &&
    (context.mode === "assigned-partial" || context.mode === "selected-partial")
      ? `Available XML syntax for the ${remainingSlideCount} remaining slide(s):\n\n${LAYOUT_REFERENCE}\n\n${COMPONENT_INSTRUCTIONS}`
      : "";

  return [
    selectedLayoutRule,
    selectedLayoutContext.trim(),
    perSlideLayoutAssignments,
    catalogRule,
  ]
    .filter((section) => section.length > 0)
    .join("\n\n");
}

function buildXmlSyntaxGuidance(context: TemplatePromptContext): string {
  if (context.mode === "presentation") {
    return "Use the XML format provided below as the output format.";
  }

  if (context.mode === "assigned-full" || context.mode === "selected-full") {
    return "Use the XML formats provided below as the output formats.";
  }

  return 'Available XML syntax: wrap the deck in one <PRESENTATION> root. Put each slide in <SECTION layout="left|right|vertical">. Put one main component in each SECTION, except simple text slides and infographic-as-main slides may use only headings, paragraphs, title, label, quote, callout, code, or contributor blocks beside the infographic. Put a direct child root <IMG ... /> last when the slide needs a root image.';
}

function buildFormatGuidance(context: TemplatePromptContext): string {
  if (context.mode === "presentation") {
    return "";
  }

  if (context.mode === "assigned-full" || context.mode === "selected-full") {
    return "";
  }

  return `Use the available formats intentionally according to each slide's content and purpose:
- Pick list-style components for grouped points.
- Pick sequence components for processes or maturity paths.
- Pick comparison components for trade-offs or before/after states.
- Pick relationship components for connected concepts.
- Pick data components for evidence.
- Pick infographics for custom visual explanations that a standard component cannot express clearly.
- Use columns as a special mixed-content container when a slide needs balanced lanes, item images, charts, infographics, or nested supported content.

**Make sure there is high degree of visual and structural variety across the deck. Avoid using the same component more than once or twice in a row, to reduce visual monotony and maintain audience engagement.**
`;
}

function buildVisualGuidance(context: TemplatePromptContext): string {
  const fixedStructureGuidance =
    context.mode === "presentation" ||
    context.mode === "assigned-full" ||
    context.mode === "selected-full";

  if (fixedStructureGuidance) {
    return 'Fill visual fields in the provided XML structure. Icon attributes take one lowercase English keyword. Image queries follow the image instruction below. Chart data must be a markdown table inside <CHART>; the header row defines each field once. Infographic text is a complete visual brief with labels, entities, values, sequence, relationships, orientation, and takeaway. SECTION layout sets infographic orientation: layout="vertical" means horizontal/landscape; layout="left" or layout="right" means vertical/stacked. If an existing template uses layout="background", keep foreground copy compact and readable.';
  }

  return `Use images deliberately:
- Add a root image when it complements the component layout.
- Use item-level images inside COLUMNS when each lane needs a visual.
- Pair image placement and component geometry: vertical root images create a wide lower content area, so favor horizontal components; left/right root images create a narrower side content area, so favor vertical or compact components.
- Omit the root image when the component or infographic already carries the visual story.

Use icons only as search hints:
- When a supported item needs an icon, set icon to one lowercase English keyword such as security, analytics, team, growth, upload, idea, automation, calendar, money, network, settings, document, or message.
- For icon-list visuals, use <ICONS variant="icon"> with DIV icon attributes for symbolic lists, or <ICONS variant="image"> with DIV prompt attributes for generated item images. Use orientation="side" when the visual should sit beside the text and orientation="top" when it should sit above the text.

Use charts only for real numeric comparisons, trends, shares, distributions, or correlations:
- Use STATS for headline metrics.
- Use TABLE for exact row/column comparison.
- Use CHART for visual data.
- Put chart data directly inside <CHART> as a markdown table. The markdown header row defines field names once.
- For most charts: <CHART charttype="bar">
| label | value |
| --- | --- |
| Q1 | 24 |
| Q2 | 31 |
</CHART>.
- For multi-series charts, add more columns: label, revenue, profit.
- For scatter or bubble charts, use x, y, and optional z columns.
- For specialized charts, use renderer field names as table headers: range charts need category/low/high; waterfall needs category/amount; OHLC and candlestick need date/open/high/low/close; box plots need category/min/q1/median/q3/max; heatmaps need x/y/value; sankey/chord need from/to/size.

Use infographics when the slide asks for an infographic, diagram, process map, framework, hierarchy, lifecycle, matrix, relationship map, funnel, or cause-and-effect flow:
- Write the infographic prompt as a complete visual brief with exact labels, entities, values, sequence, relationships, orientation, and takeaway.
- Include the orientation based on SECTION layout: vertical or background means horizontal/landscape infographic; left or right means vertical/stacked infographic.
- Keep layout-based infographic prompts to the strongest 4 or 5 visible items unless it is a word cloud or chart-like visual.`;
}

function buildResearchRules(input: PresentationGenerationPromptInput): string {
  const canUseImageLibrary = shouldUseImageLibrary(input);

  if (!hasItems(input.searchResults) && !canUseImageLibrary) {
    return "";
  }

  if (hasItems(input.searchResults) && canUseImageLibrary) {
    return "Use provided research to enrich slide content with accurate facts, statistics, and context. Use the Preloaded Image Library only when a listed image clearly fits a slide topic.";
  }

  if (canUseImageLibrary) {
    return "Use the Preloaded Image Library only when a listed image clearly fits a slide topic.";
  }

  return "Use provided research to enrich slide content with accurate facts, statistics, and context.";
}

function buildSelectedDocumentRules(
  selectedChunks: PresentationGenerationPromptInput["selectedChunks"],
): string {
  if (!hasItems(selectedChunks)) {
    return "";
  }

  return "Incorporate selected document content into the presentation. If a chunk is assigned to a slide, include it on that slide. Convert markdown syntax into clean XML content instead of copying markdown markers into text nodes: write `<H2>Heading 2</H2>`, not `<H2>## Heading 2</H2>`.";
}

function buildUserContext(input: PresentationGenerationPromptInput): string {
  const sections = [
    formatRequestContext(input),
    formatOutlineContext(input.outline),
    formatResearchContext(input.searchResults),
    shouldUseImageLibrary(input)
      ? formatImageLibrary(input.imageSearchResults)
      : "",
    formatSelectedChunks(input.selectedChunks),
  ].filter((section) => section.length > 0);

  return sections.join("\n\n");
}

function formatRequestContext(
  input: PresentationGenerationPromptInput,
): string {
  const lines = [
    `Title: ${input.title}`,
    `User request: ${input.prompt || "No specific prompt provided"}`,
    `Date: ${input.currentDate}`,
    `Language: ${input.language}`,
    `Tone: ${input.tone}`,
    `Total slides: ${input.outline.length}`,
    `Text density: ${input.textContent || "concise"}`,
    ...(input.audience ? [`Target audience: ${input.audience}`] : []),
    ...(input.scenario ? [`Scenario: ${input.scenario}`] : []),
  ];

  return `# Presentation Context (background info for you only — never copy these lines, labels, or values into a slide; they are not slide content)
${lines.join("\n")}
# End of background info. Generate original slides about the topic above.`;
}

function formatOutlineContext(outline: string[]): string {
  return `## Outline

\`\`\`md
${formatOutlineForPrompt(outline)}
\`\`\``;
}

function buildPerSlideAssignmentsContext(
  outlineTemplateHints?: Record<number, string>,
): string {
  if (!outlineTemplateHints || Object.keys(outlineTemplateHints).length === 0) {
    return "";
  }

  const hints = Object.entries(outlineTemplateHints)
    .map(
      ([index, layoutDetail]) =>
        `Slide ${parseInt(index, 10) + 1}:\n${layoutDetail}`,
    )
    .join("\n\n");

  return `Use these XML formats for the listed slides:

${hints}
`;
}

function buildCriticalRules(context: TemplatePromptContext): string {
  const baseRules = `Presentation rules:
- Output exactly ${context.totalSlides} slides.
- Return one <PRESENTATION> root and valid XML only.
- Use supported tags and attributes only.
- Do not generate <BUTTON> elements.
- When you generate root level image, i.e <IMG /> elements, put it at last in each SECTION.
- Every SECTION must include at least one heading and body/list content before any root image. Never generate a SECTION that contains only a root <IMG /> with nothing else.
- Make sure you follow all the component level requirements and guidelines.
- Use the outline to cover the intended ideas, but shape the final slide copy like a strong presentation rather than copying the outline literally.`;

  if (context.mode === "none") {
    return `${baseRules}
- Include images where they strengthen the slide visually.`;
  }

  if (context.mode === "presentation") {
    return `Presentation rules:
- Return exactly ${context.totalSlides} slides inside one <PRESENTATION> root.
- Use valid XML.
- Do not generate <BUTTON> elements.
- Use the provided XML structure as the slide structure.`;
  }

  if (context.mode === "selected-full") {
    return `Presentation rules:
- Return exactly ${context.totalSlides} slides inside one <PRESENTATION> root.
- Use valid XML.
- Do not generate <BUTTON> elements.
- Use every selected XML layout exactly once.
- Preserve each selected layout's SECTION layout, main component tag, component attributes, item count, and nesting pattern.`;
  }

  if (context.mode === "selected-partial") {
    return `${baseRules}
- Use every selected XML layout exactly once, then use the available XML syntax for remaining slides.
- Preserve each selected layout's SECTION layout, main component tag, component attributes, item count, and nesting pattern.`;
  }

  const assignmentCoverage =
    context.assignedSlideCount < context.totalSlides
      ? "For slides without a provided XML format, choose from the available XML syntax."
      : "Every slide has a provided XML format.";

  if (context.mode === "assigned-full") {
    return `Presentation rules:
- Return exactly ${context.totalSlides} slides inside one <PRESENTATION> root.
- Use valid XML.
- Do not generate <BUTTON> elements.
- Use the exact provided XML layout for each listed slide.
- Preserve each assigned layout's SECTION layout, main component tag, component attributes, item count, and nesting pattern.`;
  }

  return `${baseRules}
- Use the exact provided XML format for each listed slide.
- Preserve each assigned layout's SECTION layout, main component tag, component attributes, item count, and nesting pattern.
- ${assignmentCoverage}`;
}

function formatSelectedChunks(
  selectedChunks?: Array<{
    chunkId: string;
    slideNumber?: number | null;
    content?: string;
  }>,
): string {
  if (!selectedChunks || selectedChunks.length === 0) {
    return "";
  }

  const generalChunks = selectedChunks.filter((c) => !c.slideNumber);
  const assignedChunks = selectedChunks.filter((c) => c.slideNumber);

  let output = `## Selected Document Content\n\n`;

  if (generalChunks.length > 0) {
    output += `### GENERAL CONTENT (Incorporate where relevant)
${generalChunks
  .map((c, i) => {
    const isImage = c.content?.trim().match(/^!\[.*\]\(.*\)$/);

    if (isImage) {
      const urlMatch = c.content?.match(/\((.*?)\)/);
      const url = urlMatch ? urlMatch[1] : "";
      return `Chunk ${i + 1} (Image URL): ${url}`;
    }

    return `Chunk ${i + 1}: ${c.content}`;
  })
  .join("\n\n")}

`;
  }

  if (assignedChunks.length > 0) {
    output += `### Slide-Specific Content

${assignedChunks
  .map((c) => {
    const isImage = c.content?.trim().match(/^!\[.*\]\(.*\)$/);

    if (isImage) {
      const urlMatch = c.content?.match(/\((.*?)\)/);
      const url = urlMatch ? urlMatch[1] : "";
      return `- Slide ${c.slideNumber} image URL: ${url}`;
    }

    return `- Slide ${c.slideNumber}: ${c.content}`;
  })
  .join("\n")}
`;
  }

  return output + "---\n";
}

function formatOutlineForPrompt(outline: string[]): string {
  return outline
    .map((item, index) => `Slide ${index + 1}:\n${item.trim()}`)
    .join("\n\n---\n\n");
}
