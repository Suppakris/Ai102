export const MAX_SOURCE_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export type SourceFileKind = "pdf" | "docx" | "spreadsheet" | "text";

/** Detects which extractor a file needs; null = unsupported. */
export function getSourceFileKind(file: File): SourceFileKind | null {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return "pdf";
  }
  if (/\.docx$/i.test(file.name)) {
    return "docx";
  }
  if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return "spreadsheet";
  }
  if (/\.(txt|md)$/i.test(file.name)) {
    return "text";
  }
  return null;
}

/** For the file-input accept attribute: everything getSourceFileKind allows. */
export const SOURCE_FILE_ACCEPT = [
  "application/pdf",
  ".pdf",
  ".docx",
  ".xlsx",
  ".xls",
  ".csv",
  ".txt",
  ".md",
].join(",");

export type PresentationSourceDocument = {
  name: string;
  text: string;
  pageCount: number;
  truncated: boolean;
};

// The system prompt + user prompt + source text + response must all fit in
// OLLAMA_NUM_CTX (8192 tokens by default). A character cap is not enough:
// Thai/CJK tokenize at roughly 2 tokens per character on llama-family
// models, so 8000 Thai characters alone blow past the whole window and
// Ollama silently truncates the prompt - including the outline formatting
// instructions - which yields an empty outline.
export const MAX_SOURCE_TOKEN_ESTIMATE = 4000;

// Rough upper-bound estimate: ASCII ≈ 1 token per 4 chars, everything else
// (Thai, CJK, emoji) ≈ 2 tokens per char.
export function estimateTokenCount(text: string): number {
  let asciiChars = 0;
  let otherChars = 0;
  for (const char of text) {
    if (char.charCodeAt(0) < 128) {
      asciiChars += 1;
    } else {
      otherChars += 1;
    }
  }
  return Math.ceil(asciiChars / 4) + otherChars * 2;
}

export function truncateToTokenBudget(
  text: string,
  budget: number = MAX_SOURCE_TOKEN_ESTIMATE,
): { text: string; truncated: boolean } {
  if (estimateTokenCount(text) <= budget) {
    return { text, truncated: false };
  }

  // Longest prefix that fits the budget, found by binary search.
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (estimateTokenCount(text.slice(0, mid)) <= budget) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return { text: text.slice(0, low).trim(), truncated: true };
}

export function buildOutlinePromptText(
  userInput: string,
  sourceDocument: PresentationSourceDocument | null,
): string {
  const prompt = userInput.trim();

  if (!sourceDocument) {
    return prompt;
  }

  const instruction =
    prompt || "Create a presentation based on the source document below.";

  // Re-trim at send time as well: documents persisted by older builds may
  // exceed the current token budget.
  const bounded = truncateToTokenBudget(sourceDocument.text);

  return [
    instruction,
    "",
    `--- SOURCE DOCUMENT: ${sourceDocument.name}${
      sourceDocument.truncated || bounded.truncated ? " (truncated)" : ""
    } ---`,
    bounded.text,
    "--- END SOURCE DOCUMENT ---",
    "",
    "Base the presentation outline on the source document above.",
  ].join("\n");
}
