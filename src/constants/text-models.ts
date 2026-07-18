export type ModelProvider = "ollama" | "openrouter";

export type OpenRouterModelId =
  | "meta-llama/llama-3.3-70b-instruct"
  | "openai/gpt-4o-mini"
  | "deepseek/deepseek-chat"
  | "google/gemini-2.5-flash"
  | "anthropic/claude-haiku-4.5"
  | "openai/gpt-5";

export type TextModelOption = {
  value: OpenRouterModelId;
  label: string;
};

// Free, no API key required (local Ollama server). OpenRouter models below
// need OPENROUTER_API_KEY and cost money per token — optional paid upgrade.
export const DEFAULT_OPENROUTER_MODEL: OpenRouterModelId = "openai/gpt-4o-mini";

// Cheapest to most expensive, spanning a few different providers.
export const OPENROUTER_TEXT_MODELS: TextModelOption[] = [
  { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o mini" },
  { value: "deepseek/deepseek-chat", label: "DeepSeek V3" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { value: "openai/gpt-5", label: "GPT-5" },
];
