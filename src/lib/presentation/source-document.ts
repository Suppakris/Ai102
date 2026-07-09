export const MAX_PDF_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export type PresentationSourceDocument = {
  name: string;
  text: string;
  pageCount: number;
  truncated: boolean;
};

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

  return [
    instruction,
    "",
    `--- SOURCE DOCUMENT: ${sourceDocument.name}${
      sourceDocument.truncated ? " (truncated)" : ""
    } ---`,
    sourceDocument.text,
    "--- END SOURCE DOCUMENT ---",
    "",
    "Base the presentation outline on the source document above.",
  ].join("\n");
}
