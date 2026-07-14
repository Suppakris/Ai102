import { modelPicker } from "@/lib/model-picker";
import { createLogger } from "@/lib/observability/logger";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  buildImproverUserMessage,
  buildReviewerUserMessage,
  buildVerifierUserMessage,
  IMPROVER_SYSTEM_PROMPT,
  REVIEWER_SYSTEM_PROMPT,
  VERIFIER_SYSTEM_PROMPT,
} from "./prompts";

const pipelineLogger = createLogger("slide-verification");

export interface SlideIssue {
  criterion: string;
  detail: string;
  fix: string;
}

export interface VerifierVerdict {
  steps: string[];
  schemaScore: number;
  groundingScore: number;
  languageScore: number;
  layoutScore: number;
  score: number;
  issues: SlideIssue[];
  questions: string[];
}

export interface ReviewerReport {
  verdict: "approve" | "needs_work";
  agreesWithVerifier: boolean;
  missedIssues: string[];
  overturnedIssues: string[];
  recommendations: string[];
}

export interface VerificationAttempt {
  attempt: number;
  score: number;
  passed: boolean;
  issues: SlideIssue[];
  questions: string[];
}

export interface VerificationLoopResult {
  finalSlideXml: string;
  passed: boolean;
  threshold: number;
  attempts: VerificationAttempt[];
  verdict: VerifierVerdict;
  review: ReviewerReport;
}

export interface VerificationLoopInput {
  slideXml: string;
  /** Source material the slide's claims are checked against. */
  context: string;
  /** Display name, e.g. "Thai" — matches getLanguageDisplayName output. */
  language: string;
  threshold: number;
  maxAttempts: number;
  modelProviderOrModel: string;
  modelId?: string;
}

function messageContentToString(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
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

/**
 * Small local models wrap JSON in fences or prose despite instructions;
 * take the outermost {...} span rather than failing on decoration.
 */
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

function extractSlideXml(raw: string): string {
  const start = raw.indexOf("<SECTION");
  const end = raw.lastIndexOf("</SECTION>");
  if (start === -1 || end <= start) {
    throw new Error("Improver returned no <SECTION> element");
  }
  return raw.slice(start, end + "</SECTION>".length);
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}

function normalizeVerdict(raw: Partial<VerifierVerdict>): VerifierVerdict {
  return {
    steps: Array.isArray(raw.steps) ? raw.steps.map(String) : [],
    schemaScore: clampScore(raw.schemaScore),
    groundingScore: clampScore(raw.groundingScore),
    languageScore: clampScore(raw.languageScore),
    layoutScore: clampScore(raw.layoutScore),
    score: clampScore(raw.score),
    issues: Array.isArray(raw.issues)
      ? raw.issues.map((issue) => ({
          criterion: String(issue?.criterion ?? "general"),
          detail: String(issue?.detail ?? ""),
          fix: String(issue?.fix ?? ""),
        }))
      : [],
    questions: Array.isArray(raw.questions) ? raw.questions.map(String) : [],
  };
}

function normalizeReview(raw: Partial<ReviewerReport>): ReviewerReport {
  return {
    verdict: raw.verdict === "approve" ? "approve" : "needs_work",
    agreesWithVerifier: Boolean(raw.agreesWithVerifier),
    missedIssues: Array.isArray(raw.missedIssues)
      ? raw.missedIssues.map(String)
      : [],
    overturnedIssues: Array.isArray(raw.overturnedIssues)
      ? raw.overturnedIssues.map(String)
      : [],
    recommendations: Array.isArray(raw.recommendations)
      ? raw.recommendations.map(String)
      : [],
  };
}

/**
 * Verify → (fail) → improve → re-verify, up to maxAttempts, then hand the
 * final slide to an independent reviewer agent for a second check.
 *
 * The loop is bounded and monotone in intent, not guaranteed in outcome: a
 * slide can come back from the improver worse than it went in, so `passed`
 * reflects the LAST verifier verdict, and the full attempt history is
 * returned for the caller to judge.
 */
export async function runVerificationLoop(
  input: VerificationLoopInput,
): Promise<VerificationLoopResult> {
  const model = modelPicker(input.modelProviderOrModel, input.modelId);
  const attempts: VerificationAttempt[] = [];

  let currentXml = input.slideXml;
  let verdict: VerifierVerdict | undefined;

  for (let attempt = 1; attempt <= input.maxAttempts; attempt++) {
    const verifierResponse = await model.invoke([
      new SystemMessage(VERIFIER_SYSTEM_PROMPT),
      new HumanMessage(
        buildVerifierUserMessage({
          slideXml: currentXml,
          context: input.context,
          language: input.language,
        }),
      ),
    ]);

    verdict = normalizeVerdict(
      extractJson<Partial<VerifierVerdict>>(
        messageContentToString(verifierResponse.content),
        "Verifier",
      ),
    );

    const passed = verdict.score >= input.threshold;
    attempts.push({
      attempt,
      score: verdict.score,
      passed,
      issues: verdict.issues,
      questions: verdict.questions,
    });
    pipelineLogger.info("Slide verification attempt scored", {
      attempt,
      score: verdict.score,
      threshold: input.threshold,
      passed,
      issueCount: verdict.issues.length,
      questionCount: verdict.questions.length,
    });

    if (passed || attempt === input.maxAttempts) {
      break;
    }

    const improverResponse = await model.invoke([
      new SystemMessage(IMPROVER_SYSTEM_PROMPT),
      new HumanMessage(
        buildImproverUserMessage({
          slideXml: currentXml,
          context: input.context,
          language: input.language,
          issues: verdict.issues,
          questions: verdict.questions,
        }),
      ),
    ]);
    currentXml = extractSlideXml(
      messageContentToString(improverResponse.content),
    );
    pipelineLogger.info("Slide regenerated from verification feedback", {
      attempt,
      slideXmlLength: currentXml.length,
    });
  }

  if (!verdict) {
    throw new Error("Verification loop produced no verdict");
  }

  const reviewerResponse = await model.invoke([
    new SystemMessage(REVIEWER_SYSTEM_PROMPT),
    new HumanMessage(
      buildReviewerUserMessage({
        slideXml: currentXml,
        context: input.context,
        language: input.language,
        verifierReportJson: JSON.stringify(verdict, null, 2),
      }),
    ),
  ]);
  const review = normalizeReview(
    extractJson<Partial<ReviewerReport>>(
      messageContentToString(reviewerResponse.content),
      "Reviewer",
    ),
  );

  return {
    finalSlideXml: currentXml,
    passed: verdict.score >= input.threshold,
    threshold: input.threshold,
    attempts,
    verdict,
    review,
  };
}
