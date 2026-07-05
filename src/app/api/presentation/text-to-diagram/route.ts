import { toUIMessageStream } from "@ai-sdk/langchain";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { consumeStream, createUIMessageStreamResponse } from "ai";
import { NextResponse } from "next/server";

import { templates } from "@/constants/antv-templates";
import { DEFAULT_OLLAMA_MODEL, modelPicker } from "@/lib/modelPicker";
import { logger } from "@/lib/observability/server/logger";
import {
  buildInfographicLayoutInstruction,
  filterInfographicTemplatesForOrientation,
  getInfographicOrientationForSlideLayout,
  type InfographicOrientation,
  type InfographicSlideLayout,
} from "@/lib/presentation/infographic-layout";
import { auth } from "@/server/auth";

const INFOGRAPHIC_MODEL = DEFAULT_OLLAMA_MODEL;

type TextToDiagramRequest = {
  prompt: string;
  slideLayoutType?: InfographicSlideLayout;
  requestedOrientation?: InfographicOrientation;
  layoutInstruction?: string;
};

function isTextToDiagramRequest(value: unknown): value is TextToDiagramRequest {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<TextToDiagramRequest>;
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

// Organize templates by category for the prompt
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

  for (const t of templateList) {
    if (t.startsWith("chart-wordcloud")) categories.wordCloud!.push(t);
    else if (t.startsWith("compare-")) categories.compare!.push(t);
    else if (t.startsWith("hierarchy-")) categories.hierarchy!.push(t);
    else if (t.startsWith("list-")) categories.list!.push(t);
    else if (t.startsWith("quadrant-")) categories.quadrant!.push(t);
    else if (t.startsWith("relation-")) categories.relation!.push(t);
    else if (t.startsWith("sequence-")) categories.sequence!.push(t);
  }

  let result = "";
  for (const [category, items] of Object.entries(categories)) {
    if (items.length > 0) {
      const title =
        category === "wordCloud"
          ? "Word Cloud"
          : category.charAt(0).toUpperCase() + category.slice(1);
      result += `\n### ${title} Templates\n`;
      result += items.map((t) => `- ${t}`).join("\n");
      result += "\n";
    }
  }
  return result;
}

const SYSTEM_PROMPT = `You are an expert Information Designer and AntV Infographic Syntax Specialist. Your sole purpose is to translate natural language user requests into valid AntV Infographic DSL (Domain Specific Language) code.

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

**IMPORTANT**: The theme block MUST come immediately after the infographic line, BEFORE the data block. and make sure \`colorBg\` is always set to \`transparent\`.

## Template Library

Select the most appropriate template-id based on the data structure implied by the user's request.
{templateList}

Do not use chart-* templates except chart-wordcloud and chart-wordcloud-rotate. Standard charts are not part of the infographic conversion flow.

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
- If the source text contains more details than the chosen layout can fit, synthesize and merge related ideas into the strongest 5 or fewer items instead of listing everything.
- Avoid nested child nodes unless the selected template requires them; when nesting is required, keep the total visible content items at 5 or fewer.

## Relation Guidance

- For relation-* templates, model relationships explicitly.
- Prefer relations with arrows (A -> B) when the template supports it.
- If only items are allowed, express connections via concise item labels and descriptions.

## Relations (for relation-* templates)

For graph templates, use relations to describe connections:

YAML-style:
\`\`\`
relations
  - from Node A
    to Node B
\`\`\`

Mermaid-style:
\`\`\`
relations
  A -> B
  B -> C
  A <-> D
\`\`\`

## Content Mapping Rules

- Generate all text in the same language as the user's input
- Use the input text only as inspiration, not as direct copy
- Do NOT paste or quote the input text verbatim in labels or descriptions
- Avoid using more than 3 consecutive words from the source text
- Rephrase and synthesize: derive core ideas, then express them freshly and concisely
- Keep each item label at 20 characters or fewer
- Keep each item description at 60 characters or fewer
- Expand outward from the seed text: add helpful supporting nodes, contrasts, examples, or implications
- Favor clear, high-level abstractions over literal sentences from the source
- Identify a strong title and brief description that reframe the topic
- Break down content into logical items that radiate in multiple directions (not a single linear restatement)
- Choose the template that best matches the inferred structure (sequence, hierarchy, relation, etc.)

## Example

User Input: "Create a 3-step process: Research, Design, Build"

Your Output:
infographic sequence-steps-simple
theme light
  colorBg transparent
data
  title Development Process
  desc A streamlined approach to building products
  items
    - label Research
      desc Understand user needs and market
      icon mdi/magnify
    - label Design
      desc Create wireframes and prototypes
      icon mdi/palette
    - label Build
      desc Develop and test the solution
      icon mdi/hammer-wrench

The following user message will be a selected excerpt from a presentation or document. Your task is to analyze that content and convert it into a clear, visually appealing diagram using the AntV Infographic syntax. Choose the most appropriate template that best represents the structure and meaning of the content.`;

const USER_PROMPT = `{prompt}

Convert the above content into an AntV infographic diagram.`;

export async function POST(req: Request) {
  let endSpanOnReturn = true;
  const actionName = "presentation.text_to_diagram.post";
  const span = logger.startSpan(`allweone.api.${actionName}`, {
    attributes: {
      "allweone.scope": "api",
      "allweone.action.type": "api_route",
      "allweone.action.name": actionName,
      "http.method": "POST",
      "http.route": "/api/presentation/text-to-diagram",
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

    const body: unknown = await req.json();

    if (!isTextToDiagramRequest(body) || body.prompt.trim().length === 0) {
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "missing_prompt",
      });
      return NextResponse.json(
        { error: "No text provided for diagram generation" },
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
    const diagramChain = RunnableSequence.from([
      ChatPromptTemplate.fromMessages([
        ["system", SYSTEM_PROMPT],
        ["user", USER_PROMPT],
      ]),
      modelPicker(INFOGRAPHIC_MODEL),
    ]);

    const stream = await diagramChain.stream({
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
