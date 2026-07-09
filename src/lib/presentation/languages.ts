export const LANGUAGE_OPTIONS = [
  { label: "English (US)", shortLabel: "English", value: "en-US" },
  { label: "Thai", shortLabel: "Thai", value: "th" },
  { label: "Portuguese", shortLabel: "Portuguese", value: "pt" },
  { label: "Spanish", shortLabel: "Spanish", value: "es" },
  { label: "French", shortLabel: "French", value: "fr" },
  { label: "German", shortLabel: "German", value: "de" },
  { label: "Italian", shortLabel: "Italian", value: "it" },
  { label: "Japanese", shortLabel: "Japanese", value: "ja" },
  { label: "Korean", shortLabel: "Korean", value: "ko" },
  { label: "Chinese", shortLabel: "Chinese", value: "zh" },
  { label: "Russian", shortLabel: "Russian", value: "ru" },
  { label: "Hindi", shortLabel: "Hindi", value: "hi" },
  { label: "Arabic", shortLabel: "Arabic", value: "ar" },
] as const;

export type PresentationLanguageCode =
  (typeof LANGUAGE_OPTIONS)[number]["value"];

// Prompts must receive a human-readable language name; small models follow
// "Use Thai language" far more reliably than a bare BCP-47 code like "th".
export function getLanguageDisplayName(code: string): string {
  return (
    LANGUAGE_OPTIONS.find((option) => option.value === code)?.label ?? code
  );
}

export function getLanguageShortLabel(code: string): string {
  return (
    LANGUAGE_OPTIONS.find((option) => option.value === code)?.shortLabel ??
    code
  );
}
