import { search_tool } from "@/ai/tools/search";
import {
  getLatestUserMessage,
  getMessageText,
} from "@/lib/ai/uiMessageParts";
import {
  assertModelIsConfigured,
  ensureModelIsReady,
  modelPicker,
} from "@/lib/modelPicker";
import { createLogger } from "@/lib/observability/logger";
import { logger } from "@/lib/observability/server/logger";
import { auth } from "@/server/auth";
import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import {
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { createAgent } from "langchain";
import { NextResponse } from "next/server";

// Vercel Hobby caps serverless functions at 60s. Deck generation on a free
// (rate-limited) provider can run long, so claim the full budget.
export const maxDuration = 60;

interface OutlineRequest {
  messages?: UIMessage[];
}

interface OutlineMessageMetadata {
  numberOfCards?: number;
  language?: string;
  modelId?: string;
  modelProvider?: "openai" | "ollama" | "lmstudio";
  apiKey?: string;
  baseUrl?: string;
  webSearch?: boolean;
  autoTheme?: boolean;
  textContent?: "minimal" | "concise" | "detailed" | "extensive";
  tone?: string;
  audience?: string;
  scenario?: string;
  presentationId?: string;
}

const outlineSystemPrompt = `You are an expert presentation outline generator. Your task is to create a comprehensive and engaging presentation outline based on the user's topic.

Current Date: {currentDate}

## Presentation Customization:
- Text Content Level: {textContent}
- Tone: {tone}
- Target Audience: {audience}
- Scenario: {scenario}

## Your Process:
1. Analyze the topic
2. {researchStep}
3. Generate the outline

## Web Search Guidelines:
{webSearchGuidelines}

## Outline Requirements:
- First generate an appropriate title for the presentation
- Generate exactly {numberOfCards} main topics
- Each topic should be a clear, engaging heading
- Include 2-3 bullet points per topic
- Use {language} language
- Adapt content depth based on the text content level
- Tailor language for the requested tone, audience, and scenario
- ALWAYS use bullet points formatted as "- point text"
- Do not use bold, italic, or underline

## Output Format:
Start with the title in XML tags, then generate markdown with each topic as a heading followed by bullet points.

Example:
<TITLE>Your Generated Presentation Title Here</TITLE>

# First Main Topic
- Key point
- Another point

# Second Main Topic
- Key point
- Another point

{themeInstructions}

Remember: {finalInstruction}`;

const autoThemeInstructions = `## Custom Theme Output:
After the full outline is complete, you MUST emit one final THEME XML block. The THEME block must come after all outline sections, never before them.

The THEME block is mandatory for this request. Create a custom visual direction that fits the user's topic, audience, tone, scenario, and any named brand or organization.

Example theme block:
<THEME>
  <name>Short theme name</name>
  <description>Short visual direction</description>
  <mode>light</mode>
  <primary>#2563EB</primary>
  <accent>#F97316</accent>
  <background>#F8FAFC</background>
  <text>#1F2937</text>
  <heading>#111827</heading>
  <smartLayout>#2563EB</smartLayout>
  <cardBackground>#FFFFFF</cardBackground>
  <headingFont>Inter</headingFont>
  <bodyFont>Inter</bodyFont>
</THEME>

Theme requirements:
- Prefer known brand colors when the prompt clearly names a brand and the palette is already known to you.
- If the brand palette is not known with confidence, create a topic-appropriate palette instead of inventing brand colors.
- Generate colors that match the topic, audience, tone, and scenario.
- Use only valid 6-digit hex colors.
- Ensure text and heading colors have strong contrast against background and cardBackground.
- Color field meanings:
  - primary is the main brand/action color used for emphasis and prominent accents.
  - smartLayout is the fill color for SVG-based visual structures such as pyramids, pie charts, staircase blocks, cycles, timelines, and diagrams. It usually belongs near primary or a deliberate variant of it, not a disconnected neutral color.
  - cardBackground is the readable surface behind text in cards and containers. Do not use cardBackground as a substitute for smartLayout.
- Include headingFont and bodyFont when you include a THEME block. Use real, well-known font family names that fit the brand and requirement. Do not invent font names. Good choices include Inter, Manrope, Poppins, IBM Plex Sans, Space Grotesk, Sora, Playfair Display, Merriweather, Lato, Open Sans, Work Sans, DM Sans, and Source Sans Pro.
- Do not include prose before or after the THEME block.`;

function buildOutlineSystemPrompt({
  actualLanguage,
  numberOfCards,
  currentDate,
  textContent,
  tone,
  audience,
  scenario,
  webSearch,
  autoTheme,
}: {
  actualLanguage: string;
  numberOfCards: number;
  currentDate: string;
  textContent: NonNullable<OutlineMessageMetadata["textContent"]>;
  tone: string;
  audience: string;
  scenario: string;
  webSearch: boolean;
  autoTheme: boolean;
}) {
  return outlineSystemPrompt
    .replace("{currentDate}", currentDate)
    .replace("{numberOfCards}", numberOfCards.toString())
    .replace("{language}", actualLanguage)
    .replaceAll("{textContent}", textContent)
    .replaceAll("{tone}", tone)
    .replaceAll("{audience}", audience)
    .replaceAll("{scenario}", scenario)
    .replace(
      "{researchStep}",
      webSearch
        ? "Research first using web search before writing the outline"
        : "Use existing knowledge only and skip tool usage",
    )
    .replace(
      "{webSearchGuidelines}",
      webSearch
        ? [
            "- Use web search for current facts, recent developments, and useful statistics",
            "- Limit yourself to a few focused searches",
            "- Only search when it materially improves the outline",
          ].join("\n")
        : "- Web search is disabled for this request.",
    )
    .replace("{themeInstructions}", autoTheme ? autoThemeInstructions : "")
    .replace(
      "{finalInstruction}",
      webSearch
        ? "Perform at least one web search before generating the outline."
        : "Generate the outline directly without web search.",
    );
}

export async function POST(req: Request) {
  const actionName = "presentation.outline.post";
  const requestId = crypto.randomUUID();
  const routeLogger = createLogger("api:presentation-outline");
  const span = logger.startSpan(`allweone.api.${actionName}`, {
    attributes: {
      "allweone.scope": "api",
      "allweone.action.type": "api_route",
      "allweone.action.name": actionName,
      "http.method": "POST",
      "http.route": "/api/presentation/outline",
      "allweone.request.id": requestId,
    },
  });

  try {
    routeLogger.info("Outline request received", { requestId });
    const session = await auth();
    if (!session) {
      routeLogger.warn("Outline request rejected: unauthorized", { requestId });
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const request = (await req.json()) as OutlineRequest;
    const { messages = [] } = request;
    const latestUserMessage = getLatestUserMessage(messages);
    const prompt = latestUserMessage ? getMessageText(latestUserMessage).trim() : "";
    const metadata =
      (latestUserMessage?.metadata as OutlineMessageMetadata | undefined) ?? {};
    const numberOfCards = metadata.numberOfCards ?? 0;
    const language = metadata.language ?? "";
    const modelProvider = metadata.modelProvider ?? "openai";
    const modelId = metadata.modelId;
    const modelOptions = { apiKey: metadata.apiKey, baseUrl: metadata.baseUrl };
    const webSearch = Boolean(metadata.webSearch);
    const autoTheme = metadata.autoTheme ?? false;

    span.annotate({
      "allweone.presentation.cards.count": numberOfCards,
      "allweone.presentation.prompt.length": prompt.length,
      "allweone.presentation.language": language,
      "allweone.presentation.web_search": webSearch,
      "allweone.presentation.auto_theme": autoTheme,
    });
    routeLogger.info("Validated outline request payload", {
      requestId,
      numberOfCards,
      promptLength: prompt.length,
      language,
      modelProvider,
      modelId: modelId || "gpt-4o-mini",
      webSearch,
    });

    if (!prompt || !numberOfCards || !language || messages.length === 0) {
      routeLogger.warn("Outline request rejected: missing required fields", {
        requestId,
        hasPrompt: Boolean(prompt),
        numberOfCards,
        language,
        messageCount: messages.length,
      });
      span.event("allweone.api.request_rejected", {
        "allweone.validation.error": "missing_required_fields",
      });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const languageMap: Record<string, string> = {
      "en-US": "English (US)",
      pt: "Portuguese",
      es: "Spanish",
      fr: "French",
      de: "German",
      it: "Italian",
      ja: "Japanese",
      ko: "Korean",
      zh: "Chinese",
      ru: "Russian",
      hi: "Hindi",
      ar: "Arabic",
    };

    const actualLanguage = languageMap[language] ?? language;
    const currentDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    try {
      assertModelIsConfigured(modelProvider, modelId, modelOptions);
    } catch (error) {
      routeLogger.error("Outline request rejected: invalid model configuration", error, {
        requestId,
        modelProvider,
        modelId: modelId || "gpt-4o-mini",
      });
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
    try {
      await ensureModelIsReady(modelProvider, modelId);
    } catch (error) {
      routeLogger.error(
        "Outline request rejected: selected model could not be prepared",
        error,
        {
          requestId,
          modelProvider,
          modelId: modelId || "gpt-4o-mini",
        },
      );
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to prepare selected model",
        },
        { status: 503 },
      );
    }

    const agent = createAgent({
      model: modelPicker(modelProvider, modelId, modelOptions),
      tools: webSearch ? [search_tool] : [],
      systemPrompt:
        buildOutlineSystemPrompt({
          actualLanguage,
          numberOfCards,
          currentDate,
          textContent: metadata.textContent ?? "concise",
          tone: metadata.tone ?? "auto",
          audience: metadata.audience ?? "auto",
          scenario: metadata.scenario ?? "auto",
          webSearch,
          autoTheme,
        }),
    });

    routeLogger.info("Presentation outline generation started", {
      requestId,
      modelProvider,
      modelId: modelId || "gpt-4o-mini",
      numberOfCards,
      webSearch,
    });
    const stream = await agent.stream(
      {
        messages: await toBaseMessages(messages),
      },
      {
        streamMode: ["values", "messages"],
      },
    );

    routeLogger.info("Presentation outline stream created", {
      requestId,
      modelProvider,
      modelId: modelId || "gpt-4o-mini",
    });
    span.event("allweone.api.response_stream_created");
    return createUIMessageStreamResponse({
      stream: toUIMessageStream(stream),
    });
  } catch (error) {
    routeLogger.error("Presentation outline generation failed", error, {
      requestId,
    });
    span.error(error);
    return NextResponse.json(
      { error: "Failed to generate outline" },
      { status: 500 },
    );
  } finally {
    span.end();
  }
}
