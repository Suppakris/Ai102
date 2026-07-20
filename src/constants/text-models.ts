export type ModelProvider = "ollama" | "openrouter";

export type OpenRouterModelId =
  // Free tier ($0 per token, rate limited) — verified against OpenRouter's
  // live /api/v1/models catalog on 2026-07-20.
  | "google/gemma-4-31b-it:free"
  | "google/gemma-4-26b-a4b-it:free"
  | "openai/gpt-oss-20b:free"
  | "nvidia/nemotron-3-super-120b-a12b:free"
  // Paid — only usable when whoever owns OPENROUTER_API_KEY funds it.
  | "meta-llama/llama-3.3-70b-instruct"
  | "openai/gpt-4o-mini"
  | "deepseek/deepseek-chat"
  | "google/gemini-2.5-flash"
  | "anthropic/claude-haiku-4.5"
  | "openai/gpt-5";

export type TextModelOption = {
  value: OpenRouterModelId;
  label: string;
  /** $0 per token on OpenRouter's free tier. Rate limited, not unlimited. */
  free?: boolean;
};

// An OPENROUTER_API_KEY is still required for every model below, but the
// `free: true` ones cost nothing to run — so the default is a free one. A
// deployment with no budget can enable OpenRouter without incurring charges.
export const DEFAULT_OPENROUTER_MODEL: OpenRouterModelId =
  "google/gemma-4-31b-it:free";

// Free models first (largest context first), then paid cheapest to priciest.
export const OPENROUTER_TEXT_MODELS: TextModelOption[] = [
  {
    value: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "Nemotron 3 Super 120B (Free)",
    free: true,
  },
  { value: "google/gemma-4-31b-it:free", label: "Gemma 4 31B (Free)", free: true },
  {
    value: "google/gemma-4-26b-a4b-it:free",
    label: "Gemma 4 26B (Free)",
    free: true,
  },
  { value: "openai/gpt-oss-20b:free", label: "GPT-OSS 20B (Free)", free: true },
  { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o mini" },
  { value: "deepseek/deepseek-chat", label: "DeepSeek V3" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { value: "openai/gpt-5", label: "GPT-5" },
];

export const FREE_OPENROUTER_TEXT_MODELS = OPENROUTER_TEXT_MODELS.filter(
  (model) => model.free,
);
