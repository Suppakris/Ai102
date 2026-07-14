import { modelPicker } from "@/lib/model-picker";
import { createLogger } from "@/lib/observability/logger";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const clarifyLogger = createLogger("clarify-agent");

/**
 * Pre-generation intake agent: before any deck is generated, it interviews
 * the user about their one-line topic ("I want a coffee slide") — style,
 * purpose, audience — then folds the answers into a refined prompt plus the
 * app's typed customization settings.
 *
 * Two phases, one model call each:
 *   no answers  → returns 2-4 questions with suggested options
 *   answers set → returns { refinedPrompt, settings }
 */

export interface ClarifyQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface ClarifyAnswer {
  question: string;
  answer: string;
}

/** Mirrors the unions in src/states/presentation-state.ts. */
export interface ClarifySettings {
  tone?: "auto" | "general" | "persuasive" | "inspiring" | "instructive" | "engaging";
  audience?: "auto" | "general" | "business" | "investor" | "teacher" | "student";
  scenario?:
    | "auto"
    | "general"
    | "analysis-report"
    | "teaching-training"
    | "promotional-materials"
    | "public-speeches";
  textContent?: "minimal" | "concise" | "detailed" | "extensive";
}

export type ClarifyResult =
  | { ready: false; questions: ClarifyQuestion[] }
  | { ready: true; refinedPrompt: string; settings: ClarifySettings };

const QUESTIONS_SYSTEM_PROMPT = `You are an expert presentation consultant. A user just gave you a short presentation topic. Before anything is generated, you interview them so the deck fits what they actually need.

Work step-by-step before writing your questions:
1. Read the topic. Note what it already specifies (subject, style, audience, purpose).
2. List what is still unknown that would change the deck: visual style, purpose/occasion, target audience, depth of content.
3. Write 2-4 short questions covering ONLY the unknowns — never ask about something the topic already answers.

Rules:
- Ask in the SAME LANGUAGE the user wrote their topic in.
- Each question gets 2-5 short suggested options (the user can also type their own answer).
- Questions must be concrete and easy to tap through, not open essays.

Respond with ONLY a JSON object — no prose, no markdown fences:

{
  "questions": [
    { "id": "style", "question": "...", "options": ["...", "..."] }
  ]
}`;

const REFINE_SYSTEM_PROMPT = `You are an expert presentation consultant. You previously asked a user clarifying questions about their presentation topic; they have now answered. Fold everything into one final brief.

Work step-by-step:
1. Combine the original topic with every answer into a single, specific presentation prompt (2-4 sentences). Keep it in the same language as the original topic. Do not invent details the user didn't give.
2. Map the answers onto the app's fixed settings. Use "auto" (or omit) when nothing maps cleanly:
   - tone: auto | general | persuasive | inspiring | instructive | engaging
   - audience: auto | general | business | investor | teacher | student
   - scenario: auto | general | analysis-report | teaching-training | promotional-materials | public-speeches
   - textContent: minimal | concise | detailed | extensive

Respond with ONLY a JSON object — no prose, no markdown fences:

{
  "refinedPrompt": "...",
  "settings": { "tone": "auto", "audience": "auto", "scenario": "auto", "textContent": "concise" }
}`;

function messageContentToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : typeof (part as { text?: unknown }).text === "string"
            ? (part as { text: string }).text
            : "",
      )
      .join("");
  }
  return String(content ?? "");
}

function extractJson<T>(raw: string, label: string): T {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error(`${label} returned no JSON object`);
  }
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch (error) {
    throw new Error(
      `${label} returned malformed JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const TONES = new Set(["auto", "general", "persuasive", "inspiring", "instructive", "engaging"]);
const AUDIENCES = new Set(["auto", "general", "business", "investor", "teacher", "student"]);
const SCENARIOS = new Set([
  "auto",
  "general",
  "analysis-report",
  "teaching-training",
  "promotional-materials",
  "public-speeches",
]);
const TEXT_CONTENTS = new Set(["minimal", "concise", "detailed", "extensive"]);

function normalizeSettings(raw: unknown): ClarifySettings {
  const candidate = (raw ?? {}) as Record<string, unknown>;
  const settings: ClarifySettings = {};
  if (typeof candidate.tone === "string" && TONES.has(candidate.tone)) {
    settings.tone = candidate.tone as ClarifySettings["tone"];
  }
  if (typeof candidate.audience === "string" && AUDIENCES.has(candidate.audience)) {
    settings.audience = candidate.audience as ClarifySettings["audience"];
  }
  if (typeof candidate.scenario === "string" && SCENARIOS.has(candidate.scenario)) {
    settings.scenario = candidate.scenario as ClarifySettings["scenario"];
  }
  if (
    typeof candidate.textContent === "string" &&
    TEXT_CONTENTS.has(candidate.textContent)
  ) {
    settings.textContent = candidate.textContent as ClarifySettings["textContent"];
  }
  return settings;
}

function buildTopicBlock(prompt: string, sourceDocumentName?: string): string {
  const attachment = sourceDocumentName
    ? `\n(The user also attached a source PDF: "${sourceDocumentName}")`
    : "";
  return `# USER'S TOPIC\n${prompt.trim() || "(no text — only the attached PDF)"}${attachment}`;
}

export async function runClarify({
  prompt,
  sourceDocumentName,
  answers,
  modelProviderOrModel,
  modelId,
}: {
  prompt: string;
  sourceDocumentName?: string;
  answers: ClarifyAnswer[];
  modelProviderOrModel: string;
  modelId?: string;
}): Promise<ClarifyResult> {
  const model = modelPicker(modelProviderOrModel, modelId);

  if (answers.length === 0) {
    const response = await model.invoke([
      new SystemMessage(QUESTIONS_SYSTEM_PROMPT),
      new HumanMessage(buildTopicBlock(prompt, sourceDocumentName)),
    ]);
    const parsed = extractJson<{ questions?: unknown }>(
      messageContentToString(response.content),
      "Clarify agent",
    );
    const questions: ClarifyQuestion[] = Array.isArray(parsed.questions)
      ? parsed.questions
          .map((q, index) => ({
            id: String((q as { id?: unknown })?.id ?? `q${index + 1}`),
            question: String((q as { question?: unknown })?.question ?? "").trim(),
            options: Array.isArray((q as { options?: unknown })?.options)
              ? ((q as { options: unknown[] }).options.map(String).filter(Boolean) as string[]).slice(0, 5)
              : [],
          }))
          .filter((q) => q.question.length > 0)
          .slice(0, 4)
      : [];

    if (questions.length === 0) {
      throw new Error("Clarify agent returned no usable questions");
    }
    clarifyLogger.info("Clarify questions generated", {
      questionCount: questions.length,
    });
    return { ready: false, questions };
  }

  const answersBlock = answers
    .map((a, i) => `${i + 1}. Q: ${a.question}\n   A: ${a.answer}`)
    .join("\n");
  const response = await model.invoke([
    new SystemMessage(REFINE_SYSTEM_PROMPT),
    new HumanMessage(
      `${buildTopicBlock(prompt, sourceDocumentName)}\n\n# USER'S ANSWERS\n${answersBlock}`,
    ),
  ]);
  const parsed = extractJson<{ refinedPrompt?: unknown; settings?: unknown }>(
    messageContentToString(response.content),
    "Clarify agent",
  );
  const refinedPrompt =
    typeof parsed.refinedPrompt === "string" && parsed.refinedPrompt.trim()
      ? parsed.refinedPrompt.trim()
      : // Fallback keeps the flow moving even if the model returned junk:
        // the raw answers appended to the topic still beat the bare topic.
        `${prompt.trim()}\n${answers.map((a) => `- ${a.question}: ${a.answer}`).join("\n")}`;

  const settings = normalizeSettings(parsed.settings);
  clarifyLogger.info("Clarify brief refined", {
    refinedPromptLength: refinedPrompt.length,
    settings,
  });
  return { ready: true, refinedPrompt, settings };
}
