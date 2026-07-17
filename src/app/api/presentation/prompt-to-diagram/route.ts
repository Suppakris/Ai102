import "server-only";

import { toUIMessageStream } from "@ai-sdk/langchain";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { consumeStream, createUIMessageStreamResponse } from "ai";
import { NextResponse } from "next/server";

import { templates } from "@/constants/antv-templates";
import { DEFAULT_OLLAMA_MODEL, modelPicker } from "@/lib/modelPicker";
import { logger } from "@/lib/observability/server/logger";
import { checkRateLimit, rateLimitResponse } from "@/backend/rate-limit";
import {
  buildInfographicLayoutInstruction,
  filterInfographicTemplatesForOrientation,
  getInfographicOrientationForSlideLayout,
  type InfographicOrientation,
  type InfographicSlideLayout,
} from "@/lib/presentation/infographic-layout";
import { auth } from "@/backend/auth";

const INFOGRAPHIC_MODEL = DEFAULT_OLLAMA_MODEL;

type PromptToDiagramRequest = {
  prompt: string;
  slideLayoutType?: InfographicSlideLayout;
  requestedOrientation?: InfographicOrientation;
  layoutInstruction?: string;
};

function isPromptToDiagramRequest(
  value: unknown,
): value is PromptToDiagramRequest {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<PromptToDiagramRequest>;
  return (
    typeof candidate.prompt === "string" &&
    (candidate.slideLayoutType === undefined ||
      typeof candidate.slideLayoutType === "string") &&
    (candidate.requestedOrientation === undefined ||
      typeof candidate.requestedOrientation === "string") &&
    (candidate.layoutInstruction === undefined ||
      typeof candidate.layoutInstruction === "string")
  );
}

function organizeTemplates(templateList: string[]): string {
  const categories: Record<string, string[]> = {
    wordCloud: [],
    compare: [],
    hierarchy: [],
    list: [],
    quadrant: [],
    relation: [],
    sequence: [],
  };

  for (const templateName of templateList) {
    if (templateName.startsWith("chart-wordcloud")) {
      categories.wordCloud!.push(templateName);
    } else if (templateName.startsWith("compare-")) {
      categories.compare!.push(templateName);
    } else if (templateName.startsWith("hierarchy-")) {
      categories.hierarchy!.push(templateName);
    } else if (templateName.startsWith("list-")) {
      categories.list!.push(templateName);
    } else if (templateName.startsWith("quadrant-")) {
      categories.quadrant!.push(templateName);
    } else if (templateName.startsWith("relation-")) {
      categories.relation!.push(templateName);
    } else if (templateName.startsWith("sequence-")) {
      categories.sequence!.push(templateName);
    }
  }

  return Object.entries(categories)
    .filter(([, items]) => items.length > 0)
    .map(([category, items]) => {
      const title =
        category === "wordCloud"
          ? "Word Cloud"
          : `${category.charAt(0).toUpperCase()}${category.slice(1)}`;
      return `\n### ${title} Templates\n${items.map((item) => `- ${item}`).join("\n")}`;
    })
    .join("\n");
}

const SYSTEM_PROMPT = `You are an expert Information Designer and AntV Infographic Syntax Specialist. Your sole purpose is to transform a user prompt into valid AntV Infographic DSL code.

## Response Format

You must output ONLY the infographic syntax code. Do not provide conversational filler, explanations, or preambles. Do NOT wrap your output in a markdown code block.

## The AntV Infographic Syntax

The syntax is strict, case-sensitive, and indentation-based (2 spaces). It follows this structure:

\`\`\`
infographic <template-id>
theme 
  colorBg transparent
data
  title <Main Title>
  desc <Subtitle or Description>
  items
    - label <Item Title>
      desc <Item Description>
      value <Optional Numeric Value>
      icon <Icon ID>
\`\`\`

**IMPORTANT**: The theme block MUST come immediately after the infographic line, BEFORE the data block. Make sure \`colorBg\` is always set to \`transparent\`.

## Template Library

Select the most appropriate template-id based on the structure inferred from the prompt.
{templateList}

Do not use chart-* templates except chart-wordcloud and chart-wordcloud-rotate. Standard charts are not part of the infographic generation flow.

## Layout Fit Contract

{layoutInstruction}

- The selected template MUST match the required infographic orientation. Treat orientation as a hard requirement.
- Horizontal means landscape/wide: left-to-right flow, rows, grids, quadrants, or compact wide diagrams.
- Vertical means portrait/stacked: top-to-bottom flow, columns, vertical roadmaps, or compact stacked hierarchy.
- Do not choose a template just because it matches the topic; choose one that also fits the required orientation.
- Do not mention the slide layout, orientation rule, or fitting instructions in the generated infographic text.

## Icon Selection Rules

You must assign an icon to every item in the items list. Use one of these methods:

**Option A: Material Design Icons (Recommended)**
Use mdi/ prefix. Examples: mdi/rocket-launch, mdi/account-group, mdi/lightbulb, mdi/source-branch

**Option B: Font Awesome**
Use fa/ prefix. Examples: fa/check-circle, fa/users, fa/cog

**Option C: Semantic Search (Auto-Select)**
If unsure of the exact icon ID, use: ref:search:svg:<keyword>
Example: ref:search:svg:artificial intelligence

## Styling & Theme Options

Add a stylize property inside the theme block for special effects:

- **Hand-Drawn/Sketchy**: stylize rough (adds pencil sketch effect)
- **Gradient**: stylize linear-gradient or stylize radial-gradient
- **Pattern**: stylize pattern (fills with geometric textures)

## Syntax Rules

1. Entry starts with: infographic <template-name>
2. Key-value pairs use spaces for separation
3. Indentation uses 2 spaces
4. Object arrays use - on new lines (e.g., items)
5. Simple arrays stay inline (e.g., palette #ff5a5f #1fb6ff #13ce66)

## Data Field Mapping (choose ONE main field)

- compare-* => compares
- chart-wordcloud* => items
- hierarchy-* => root
- list-* => items
- quadrant-* => items
- relation-* => items
- sequence-* => items

## Binary / Hierarchy Constraints

- compare-binary-* and compare-hierarchy-left-right-* require exactly two root nodes; all compare items must live under those two roots.
- hierarchy-* uses a single root; do not repeat root.

## Item Count Limits

- Never generate more than 5 visible content items. This is a hard cap across top-level items, direct root children, comparison points, relation nodes, and word-cloud terms.
- For list-*, quadrant-*, sequence-*, relation-*, and comparable layout templates, use 3 to 5 top-level items.
- For hierarchy-* templates, use 3 to 5 direct child nodes under the single root unless the selected template strictly requires fewer.
- For compare-* templates, use exactly two sides and keep the combined comparison points to 4 or 5 visible points total.
- If the prompt contains more details than the chosen layout can fit, synthesize and merge related ideas into the strongest 5 or fewer items instead of listing everything.
- Avoid nested child nodes unless the selected template requires them; when nesting is required, keep the total visible content items at 5 or fewer.

## Relation Guidance

- For relation-* templates, model relationships explicitly.
- Prefer relations with arrows (A -> B) when the template supports it.
- If only items are allowed, express connections via concise item labels and descriptions.

## Prompt to Visual Mapping

- Generate all text in the same language as the user's prompt
- Use the prompt only as guidance; do not copy it verbatim in long phrases
- Avoid using more than 3 consecutive words from the user's prompt
- Rephrase and synthesize ideas into concise infographic-friendly content
- Keep each item label at 20 characters or fewer
- Keep each item description at 60 characters or fewer
- Infer and add supporting nodes where helpful
`;

const USER_PROMPT = `## User Prompt

{prompt}

Convert the prompt into one complete AntV infographic syntax output.`;

export async function POST(req: Request) {
  let endSpanOnReturn = true;
  const actionName = "presentation.prompt_to_diagram.post";
  const span = logger.startSpan(`allweone.api.${actionName}`, {
    attributes: {
      "allweone.scope": "api",
      "allweone.action.type": "api_route",
      "allweone.action.name": actionName,
      "http.method": "POST",
      "http.route": "/api/presentation/prompt-to-diagram",
    },
  });

  try {
    const session = await auth();
    if (!session) {
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(
      `presentation-prompt-to-diagram:${session.user.id}`,
      { max: 40, windowSeconds: 300 },
    );
    if (!rateLimit.allowed) {
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "rate_limited",
      });
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const body: unknown = await req.json();

    if (!isPromptToDiagramRequest(body) || body.prompt.trim().length === 0) {
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "missing_prompt",
      });
      return NextResponse.json(
        { error: "No prompt provided for diagram generation" },
        { status: 400 },
      );
    }

    const prompt = body.prompt;
    const requestedOrientation =
      body.requestedOrientation ??
      getInfographicOrientationForSlideLayout(body.slideLayoutType);
    const layoutInstruction =
      body.layoutInstruction ??
      buildInfographicLayoutInstruction(body.slideLayoutType);
    const templateList = organizeTemplates(
      filterInfographicTemplatesForOrientation(templates, requestedOrientation),
    );
    const promptToDiagramChain = RunnableSequence.from([
      ChatPromptTemplate.fromMessages([
        ["system", SYSTEM_PROMPT],
        ["user", USER_PROMPT],
      ]),
      modelPicker(INFOGRAPHIC_MODEL),
    ]);

    const stream = await promptToDiagramChain.stream({
      prompt,
      templateList,
      layoutInstruction,
    });
    span.event("allweone.api.response_stream_created");
    endSpanOnReturn = false;

    return createUIMessageStreamResponse({
      stream: toUIMessageStream(stream),
      consumeSseStream: ({ stream: sseStream }) => {
        void consumeStream({
          stream: sseStream,
          onError: (error) => {
            span.error(error);
          },
        }).finally(() => {
          span.end();
        });
      },
    });
  } catch (error) {
    span.error(error);
    return NextResponse.json(
      { error: "Failed to generate diagram" },
      { status: 500 },
    );
  } finally {
    if (endSpanOnReturn) {
      span.end();
    }
  }
}
