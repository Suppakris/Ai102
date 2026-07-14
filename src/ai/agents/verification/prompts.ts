import { LAYOUT_REFERENCE } from "@/lib/presentation/layout-catalog";

/**
 * Prompts for the two-agent slide audit system
 * (see ai-slide-auditor-implementation-plan.md, sections 1.2-1.5).
 *
 * Agent 1 (auditor) lists every claim on the slide, marks each
 * SUPPORTED / UNSUPPORTED / INSUFFICIENT_CONTEXT against the provided
 * outline + source context, and only then scores 0-100 on the plan's
 * weighted rubric. Claims it cannot verify become questions — never
 * guesses. Agent 2 (reviewer) independently double-checks the auditor's
 * report and recommends whether the score should stand.
 */

export const VERIFIER_SYSTEM_PROMPT = `You are an expert in slide verification. You audit presentation slides written in a strict custom XML schema against the outline and source context they were generated from. Your job is to catch content the model invented — content not present in the outline or context.

Work step-by-step. Do NOT rush to a verdict. Follow this exact process and record each step:

1. CLAIMS — List every factual claim, statistic, or named entity on the slide.
2. CLAIM STATUS — Mark each claim SUPPORTED, UNSUPPORTED, or INSUFFICIENT_CONTEXT against the outline and source context. Do not guess: if you cannot verify a claim from what you were given, it is INSUFFICIENT_CONTEXT, not SUPPORTED. For each INSUFFICIENT_CONTEXT claim, add a clarifying question to "questions".
3. SCHEMA CHECK — Validate the XML against the schema reference below: exactly one <SECTION>, only listed tags, required attributes present.
4. LANGUAGE CHECK — All slide copy must be in the required language. Image queries (IMG query="...") must be in English regardless of the slide language.
5. SCORE — Only after steps 1-4, assign the weighted scores.

Scoring rubric (integers, total 0-100):
- contentAccuracy (0-40): factual grounding per step 2. Any UNSUPPORTED claim caps this at 15; INSUFFICIENT_CONTEXT claims cap it at 25. Schema violations that break the parser also belong here (cap 10).
- outlineAlignment (0-30): does the slide cover its outline item — topic, intended points, nothing off-topic.
- clarityStructure (0-20): heading hierarchy, item counts within limits, readable density, correct language per step 4.
- designConsistency (0-10): layout fitness — orientation rules, image placement, component choice.
- score: the sum of the four (0-100).

# XML SCHEMA REFERENCE

${LAYOUT_REFERENCE}

# OUTPUT FORMAT

Respond with ONLY a JSON object — no prose, no markdown fences:

{
  "steps": ["short note per process step"],
  "claims": [
    { "claim": "", "status": "SUPPORTED|UNSUPPORTED|INSUFFICIENT_CONTEXT", "note": "" }
  ],
  "contentAccuracy": 0,
  "outlineAlignment": 0,
  "clarityStructure": 0,
  "designConsistency": 0,
  "score": 0,
  "issues": [
    { "criterion": "accuracy|alignment|clarity|design|schema|language", "detail": "what is wrong", "fix": "concrete revision instruction" }
  ],
  "questions": ["clarifying question for each INSUFFICIENT_CONTEXT claim"]
}

"issues" must contain one entry per problem found, each with an actionable "fix" — these are the revision notes the improver applies. Leave arrays empty when there is nothing to report.`;

export function buildVerifierUserMessage({
  slideXml,
  outline,
  context,
  language,
}: {
  slideXml: string;
  outline: string;
  context: string;
  language: string;
}): string {
  return `# OUTLINE (what this slide is supposed to cover)
${outline.trim() || "(no outline item was provided)"}

# SOURCE CONTEXT
${context.trim() || "(no source context was provided — treat all factual claims as INSUFFICIENT_CONTEXT and ask questions instead of guessing)"}

# REQUIRED LANGUAGE
${language}

# SLIDE XML TO AUDIT
${slideXml}`;
}

export const IMPROVER_SYSTEM_PROMPT = `You are an expert presentation designer. You repair a single presentation slide written in a strict custom XML schema, applying an audit report's revision notes exactly.

Rules:
- Apply every fix from the audit report.
- Keep everything the report did not flag: same topic, same language, same overall structure where valid.
- Ground all content ONLY in the provided outline and source context. If the report marked a claim UNSUPPORTED or INSUFFICIENT_CONTEXT, replace it with content the context supports, or remove it — never substitute a new unsupported claim.
- Output exactly ONE <SECTION> element and only tags from the schema reference.
- Image queries (IMG query="...") must be in English; all other copy stays in the required language.

# XML SCHEMA REFERENCE

${LAYOUT_REFERENCE}

# OUTPUT FORMAT

Return ONLY the corrected slide XML. No explanation, no markdown fences.`;

export function buildImproverUserMessage({
  slideXml,
  outline,
  context,
  language,
  issues,
  questions,
}: {
  slideXml: string;
  outline: string;
  context: string;
  language: string;
  issues: Array<{ criterion: string; detail: string; fix: string }>;
  questions: string[];
}): string {
  const issueLines =
    issues.length > 0
      ? issues
          .map((issue, i) => `${i + 1}. [${issue.criterion}] ${issue.detail} — FIX: ${issue.fix}`)
          .join("\n")
      : "(no itemized issues — improve overall quality per the rubric)";

  const questionLines =
    questions.length > 0
      ? `\n# UNVERIFIABLE CLAIMS (remove or replace with grounded content)\n${questions.map((q) => `- ${q}`).join("\n")}`
      : "";

  return `# OUTLINE (what this slide is supposed to cover)
${outline.trim() || "(no outline item was provided)"}

# SOURCE CONTEXT
${context.trim() || "(no source context — keep only content that needs no external facts)"}

# REQUIRED LANGUAGE
${language}

# AUDIT REPORT — REVISION NOTES TO APPLY
${issueLines}${questionLines}

# CURRENT SLIDE XML
${slideXml}`;
}

export const REVIEWER_SYSTEM_PROMPT = `You are a senior fact-checking reviewer performing an independent second check. Another agent has already audited and scored a slide; your job is to double-check that audit. Be skeptical by default — flag anything uncertain rather than assume it is fine. You do not rewrite the slide, and you do NOT re-score from scratch.

Work step-by-step:
1. Spot any claim the auditor marked SUPPORTED that is not actually backed by the outline/source context.
2. Spot any claim on the slide the auditor missed entirely.
3. Check the non-claim findings too: schema, language, layout.
4. Recommend whether the auditor's score should stand, increase, or decrease, and by how much.
5. Write recommendations: the highest-impact concrete improvements, whether or not the slide already passes.

Respond with ONLY a JSON object — no prose, no markdown fences:

{
  "agreement": "confirm" | "revise_up" | "revise_down",
  "adjustedScore": 0,
  "notes": ["what you found in steps 1-3, one entry per finding"],
  "recommendations": ["concrete, prioritized improvement"]
}

"adjustedScore" is the 0-100 score you believe is fair — equal to the auditor's score when agreement is "confirm".`;

export function buildReviewerUserMessage({
  slideXml,
  outline,
  context,
  language,
  verifierReportJson,
}: {
  slideXml: string;
  outline: string;
  context: string;
  language: string;
  verifierReportJson: string;
}): string {
  return `# OUTLINE (what this slide is supposed to cover)
${outline.trim() || "(no outline item was provided)"}

# SOURCE CONTEXT
${context.trim() || "(no source context was provided)"}

# REQUIRED LANGUAGE
${language}

# SLIDE XML
${slideXml}

# AUDIT REPORT TO DOUBLE-CHECK
${verifierReportJson}`;
}
