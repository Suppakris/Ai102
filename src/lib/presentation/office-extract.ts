import {
  truncateToTokenBudget,
  type PresentationSourceDocument,
} from "@/lib/presentation/source-document";

// Client-side only, same policy as pdf-extract: documents are parsed in the
// browser and never uploaded, so there is no upload service and no
// serverless body-size limit to worry about.

/** Word (.docx) via mammoth — raw text is all the outline prompt needs. */
export async function extractDocxSource(
  file: File,
): Promise<PresentationSourceDocument> {
  const mammoth = await import("mammoth");
  const data = await file.arrayBuffer();
  // mammoth's browser build reads { arrayBuffer }; its node build (used by
  // the offline test harness) reads { buffer }.
  const { value } = await mammoth.extractRawText(
    typeof window === "undefined"
      ? { buffer: Buffer.from(data) }
      : { arrayBuffer: data },
  );

  const bounded = truncateToTokenBudget(value.trim());
  return {
    name: file.name,
    text: bounded.text,
    pageCount: 1,
    truncated: bounded.truncated,
  };
}

/**
 * Excel (.xlsx/.xls) and CSV via SheetJS. Each sheet is rendered as CSV under
 * a "Sheet: <name>" heading so the model can tell tables apart.
 */
export async function extractSpreadsheetSource(
  file: File,
): Promise<PresentationSourceDocument> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });

  const sections: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet).trim();
    if (csv) {
      sections.push(
        workbook.SheetNames.length > 1 ? `Sheet: ${sheetName}\n${csv}` : csv,
      );
    }
  }

  const bounded = truncateToTokenBudget(sections.join("\n\n").trim());
  return {
    name: file.name,
    text: bounded.text,
    pageCount: workbook.SheetNames.length,
    truncated: bounded.truncated,
  };
}

/** Plain text formats (.txt, .md) — no parser needed. */
export async function extractPlainTextSource(
  file: File,
): Promise<PresentationSourceDocument> {
  const bounded = truncateToTokenBudget((await file.text()).trim());
  return {
    name: file.name,
    text: bounded.text,
    pageCount: 1,
    truncated: bounded.truncated,
  };
}
