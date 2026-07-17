import { createUIMessageStreamResponse } from "ai";
import {
  assertModelIsConfigured,
  DEFAULT_OLLAMA_MODEL,
  modelPicker,
} from "@/lib/modelPicker";
import { createLogger } from "@/lib/observability/logger";
import { toUIMessageStream } from "@ai-sdk/langchain";
import { auth } from "@/backend/auth";
import { checkRateLimit, rateLimitResponse } from "@/backend/rate-limit";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { NextResponse } from "next/server";
import { LAYOUT_REFERENCE } from "@/lib/presentation/layout-catalog";
import { getLanguageDisplayName } from "@/lib/presentation/languages";

interface GenerateSlideRequest {
  prompt: string;
  currentSlide?: string; // Serialized XML of current slide (optional context)
  theme?: string;
  language?: string;
  slideType?: "standard" | "image";
  imageStyle?: "3D" | "Sketch" | "Flat";
  textDensity?: "Minimal" | "Balanced" | "Detailed";
}

const singleSlideTemplate = `You are an expert presentation designer. Create an engaging presentation in XML format.
Your output is consumed directly by a slide rendering engine that parses a custom XML schema -- it is NOT rendered as HTML or displayed as raw text. Every tag name, attribute, and structural rule described below is part of a strict schema.

Your task: Create a SINGLE engaging slide in XML format based on the user's request.

---

# TASK CONTEXT

## User Request
{PROMPT}

## Current Slide Context (if provided)
{CURRENT_SLIDE}

## Language
{LANGUAGE}

---

# XML OUTPUT SCHEMA

Return ONLY the XML for a single slide. No explanation, no wrapper tags. 

\`\`\`xml
<SECTION layout="left|right|vertical|background">
  <!-- Choose ONE layout component -->
  <!-- Optional: include an IMG tag with query after the content if relevant. Use layout="background" as a normal full-slide image layout when the image leaves enough contrast for readable foreground content. -->
</SECTION>
\`\`\`

---

${LAYOUT_REFERENCE}

---

# IMAGE HANDLING

Include an image query in most slides:
\`\`\`xml

<IMG query="abstract background, minimalist design" />
\`\`\`

If you include an \`<IMG query="...">\` tag, the query text MUST always be in English for stock or web image-provider compatibility, even if {LANGUAGE} is not English. Keep all other slide copy in {LANGUAGE}; only the image search query should be in English.
For standard slides, generate the slide content before the root image: put headings/body/layout components first and place any direct child root \`<IMG ... />\` as the final child of \`<SECTION>\`.

---

# INFOGRAPHIC BLOCKS

Use an infographic block when the slide needs a custom visual explanation: process map, hierarchy, lifecycle, relationship diagram, matrix, framework, or cause-and-effect flow.

<SECTION layout="vertical">
  <H2>Operating Model</H2>
  <INFOGRAPHIC>Operating model with five connected parts: Inputs = customer data and market signals; Workflows = intake, prioritization, delivery; Governance = decision rights and risk checks; Metrics = cycle time, quality, adoption; Outcomes = faster launches and higher retention.</INFOGRAPHIC>
</SECTION>

Place the \`<INFOGRAPHIC>\` element as slide content inside \`<SECTION>\`. Its text must be fully self-contained: include the exact labels, entities, values, steps, sequence, relationships, and takeaway the infographic should show.
For item-level content inside the infographic prompt, use labels of 20 characters or fewer and descriptions of 60 characters or fewer.
For layout-based infographic prompts such as pyramids, quadrants, lists, hierarchies, sequences, matrices, and relationship diagrams, include only the strongest 4 to 5 visible items. Synthesize extra detail into those items. Word clouds and chart-style visuals may include more items when useful.
When an \`<INFOGRAPHIC>\` is the main/root slide component, do not generate any other layout component on that slide. Only simple \`<H1>\`, \`<H2>\`, \`<H3>\`, or \`<P>\` text may accompany it.
The infographic prompt must state the required visual orientation: \`layout="vertical"\` or \`layout="background"\` requires a horizontal/landscape infographic because the content area is wide; \`layout="left"\` or \`layout="right"\` requires a vertical/stacked infographic because the content area is a narrow side column.

**CRITICAL INFOGRAPHIC RULE**: If the user's request explicitly mentions an "infographic", "diagram", "process map", or similar visual component, you MUST include an \`<INFOGRAPHIC>...</INFOGRAPHIC>\` element.

---

# HARD CONSTRAINTS

These rules are non-negotiable. Violating any **MUST** rule will break the parser.

### MUST (parsing will break)
1. Generate exactly ONE \`<SECTION>\` with ONE main layout component.
2. Use ONLY layout tags from the AVAILABLE LAYOUTS section -- unlisted tags cause parsing errors.
3. Do NOT use CYCLE with a vertical root image layout. Give CYCLE enough horizontal room or omit the root image.

### SHOULD (quality)
4. Use supported attributes instead of plain defaults when they improve the slide: alignment, bulletType, orientation, sidedness, svgType, boxType, statstype, numbered, showLine, and isFunnel.
5. Match nested layout orientation to the root image layout: vertical/background root image pairs with horizontal timelines; left/right root image pairs with vertical timelines.
6. Do not force all visuals into the root image. Add nested \`<IMG query="..." />\` inside layout items when item-level imagery improves comprehension.
7. For direct child root images, place \`<IMG ... />\` after the slide's content/layout component so the content is produced before the root image.
8. Use an \`<INFOGRAPHIC>\` element when it communicates the idea better than another list, chart, or image.
9. If the root slide component is \`<INFOGRAPHIC>\`, do not add COLUMNS, BULLETS, ICONS, CYCLE, ARROWS, TIMELINE, PYRAMID, BOXES, STEPS, COMPARE, TABLE, CHART, or any other layout component to the same slide.

Now generate a single slide based on the user's request.
`;

const singleImageSlideTemplate = `# ROLE

You are a visual presentation-to-XML compiler. Your output is consumed directly by a slide rendering engine -- it is NOT rendered as HTML. You produce a single full-bleed image slide where ALL text is rendered inside the generated image itself (no separate text overlays).

---

# TASK CONTEXT

## User Request
{PROMPT}

## Current Slide Context (if provided)
{CURRENT_SLIDE}

## Language
{LANGUAGE}

---

# XML OUTPUT SCHEMA

Return ONLY the XML for a single image slide. No explanation, no wrapper tags.

\`\`\`xml
<SECTION isImageSlide="true">
  <IMG query="..." />
</SECTION>
\`\`\`

Requirements:
- The SECTION MUST have \`isImageSlide="true"\`
- Output ONLY an \`<IMG query="...">\` tag inside the SECTION -- no H1/H2/H3/P or other elements
- The IMG query must be 60-120 words, highly descriptive, and include the exact on-image text in quotes

---

# IMAGE GENERATION GUIDELINES

## Visual Style
- **Style**: {IMAGE_STYLE}
- {IMAGE_STYLE_GUIDANCE}

## Text Density
- **Density**: {TEXT_DENSITY}
- {TEXT_DENSITY_GUIDANCE}

## Prompt Construction

Create a detailed, artistic prompt that:
- Describes the visual scene, composition, mood, color palette, and lighting
- Includes typography guidance (font style, size, placement, contrast)
- Expands the prompt into the final copy for the slide (titles, subtitles, bullets, labels)
- Does NOT use placeholders, brackets, or vague references

---

# HARD CONSTRAINTS

1. Generate exactly ONE \`<SECTION isImageSlide="true">\` containing exactly ONE \`<IMG query="...">\`
2. Do NOT include any other tags -- no H1, H2, H3, P, COLUMNS, or any layout component
3. The IMG query MUST be 60-120 words
4. The IMG query MUST include the exact on-image text in quotes

Now generate the single image slide.
`;

const model = modelPicker(DEFAULT_OLLAMA_MODEL);

function getImageStyleGuidance(style?: string): string {
  switch (style) {
    case "3D":
      return "Use a cinematic 3D render with depth, realistic shadows, and depth of field.";
    case "Sketch":
      return "Use hand-drawn sketch textures, ink lines, and paper grain.";
    case "Flat":
      return "Use flat design with minimal shading and strong color blocks.";
    default:
      return "Use a cinematic 3D render with depth, realistic shadows, and depth of field.";
  }
}

function getTextDensityGuidance(density?: string): string {
  switch (density) {
    case "Minimal":
      return "Text should be minimal: a short title and one short supporting line.";
    case "Detailed":
      return "Text should be detailed: title, subtitle, and 4-6 concise bullet lines or labels.";
    default:
      return "Text should be balanced: title, subtitle, and 2-3 concise supporting lines.";
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const routeLogger = createLogger("api:presentation-generate-slide");

  try {
    routeLogger.info("Single slide generation request received", { requestId });
    const session = await auth();
    if (!session) {
      routeLogger.warn("Single slide generation request rejected: unauthorized", {
        requestId,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(
      `presentation-generate-slide:${session.user.id}`,
      { max: 40, windowSeconds: 300 },
    );
    if (!rateLimit.allowed) {
      routeLogger.warn("Single slide generation request rejected: rate limited", {
        requestId,
      });
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const {
      prompt,
      currentSlide,
      language,
      slideType,
      imageStyle,
      textDensity,
    } = (await req.json()) as GenerateSlideRequest;

    if (!prompt) {
      routeLogger.warn("Single slide generation request rejected: missing prompt", {
        requestId,
      });
      return NextResponse.json(
        { error: "Missing required prompt field" },
        { status: 400 },
      );
    }
    routeLogger.info("Validated single slide generation request", {
      requestId,
      slideType: slideType || "standard",
      language: language || "en-US",
      imageStyle: imageStyle || "3D",
      textDensity: textDensity || "Balanced",
      promptLength: prompt.length,
      modelProvider: "ollama",
      modelId: DEFAULT_OLLAMA_MODEL,
    });
    try {
      assertModelIsConfigured(DEFAULT_OLLAMA_MODEL);
    } catch (error) {
      routeLogger.error(
        "Single slide generation request rejected: invalid model configuration",
        error,
        {
          requestId,
          modelProvider: "ollama",
          modelId: DEFAULT_OLLAMA_MODEL,
        },
      );
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid model configuration",
        },
        { status: 400 },
      );
    }

    const isImageSlide = slideType === "image";
    const promptTemplate = PromptTemplate.fromTemplate(
      isImageSlide ? singleImageSlideTemplate : singleSlideTemplate,
    );
    const chain = RunnableSequence.from([promptTemplate, model]);

    const input = isImageSlide
      ? {
          PROMPT: prompt,
          CURRENT_SLIDE: currentSlide || "No current slide context provided.",
          LANGUAGE: getLanguageDisplayName(language || "en-US"),
          IMAGE_STYLE: imageStyle || "3D",
          IMAGE_STYLE_GUIDANCE: getImageStyleGuidance(imageStyle),
          TEXT_DENSITY: textDensity || "Balanced",
          TEXT_DENSITY_GUIDANCE: getTextDensityGuidance(textDensity),
        }
      : {
          PROMPT: prompt,
          CURRENT_SLIDE: currentSlide || "No current slide context provided.",
          LANGUAGE: getLanguageDisplayName(language || "en-US"),
        };
    routeLogger.info("Single slide generation started", {
      requestId,
      slideType: isImageSlide ? "image" : "standard",
    });
    // @ts-expect-error types are incorrectly inferred
    const stream = await chain.stream(input);

    routeLogger.info("Single slide generation stream created", {
      requestId,
      slideType: isImageSlide ? "image" : "standard",
    });
    return createUIMessageStreamResponse({
      stream: toUIMessageStream(stream),
    });
  } catch (error) {
    routeLogger.error("Single slide generation failed", error, { requestId });
    return NextResponse.json(
      { error: "Failed to generate slide" },
      { status: 500 },
    );
  }
}
