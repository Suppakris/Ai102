"use client";

import { KeyRound, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePresentationState } from "@/states/presentation-state";

// OpenAI-compatible free endpoints. Both mirror the OpenAI API, so pointing
// the client here + pasting a free key runs the whole generator at $0.
// Leave the fields blank to fall back to the server env key.
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

export function ApiKeySection() {
  const apiKey = usePresentationState((s) => s.apiKey);
  const baseUrl = usePresentationState((s) => s.baseUrl);
  const modelId = usePresentationState((s) => s.modelId);
  const setApiKey = usePresentationState((s) => s.setApiKey);
  const setBaseUrl = usePresentationState((s) => s.setBaseUrl);
  const setModelId = usePresentationState((s) => s.setModelId);

  const usingGroq = baseUrl.trim() === GROQ_BASE_URL;
  const usingOpenRouter = baseUrl.trim() === OPENROUTER_BASE_URL;

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <KeyRound className="size-4 text-muted-foreground" />
        AI Provider &amp; API Key
      </Label>

      <div className="flex gap-1.5">
        <Button
          type="button"
          variant={usingGroq ? "default" : "outline"}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => {
            setBaseUrl(GROQ_BASE_URL);
            if (!modelId || modelId.startsWith("gpt-")) {
              setModelId(GROQ_DEFAULT_MODEL);
            }
          }}
        >
          <Zap className="size-4" />
          {usingGroq ? "Using Groq (free)" : "Use Groq (free)"}
        </Button>

        <Button
          type="button"
          variant={usingOpenRouter ? "default" : "outline"}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => {
            setBaseUrl(OPENROUTER_BASE_URL);
            if (!modelId || modelId.startsWith("gpt-")) {
              setModelId(OPENROUTER_DEFAULT_MODEL);
            }
          }}
        >
          <Zap className="size-4" />
          {usingOpenRouter ? "Using OpenRouter (free)" : "Use OpenRouter (free)"}
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="api-key" className="text-xs text-muted-foreground">
          API key
        </Label>
        <Input
          id="api-key"
          type="password"
          autoComplete="off"
          placeholder="gsk_... (Groq), sk-or-... (OpenRouter), or sk-... (OpenAI)"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="base-url" className="text-xs text-muted-foreground">
          Base URL (OpenAI-compatible)
        </Label>
        <Input
          id="base-url"
          type="text"
          autoComplete="off"
          placeholder="Leave blank for OpenAI"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="model-id" className="text-xs text-muted-foreground">
          Model
        </Label>
        <Input
          id="model-id"
          type="text"
          autoComplete="off"
          placeholder="e.g. llama-3.3-70b-versatile"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Your key is stored only in this browser and sent directly with each
        generation request. Free keys: {" "}
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Groq
        </a>{" "}
        or {" "}
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          OpenRouter
        </a>
      </p>
    </div>
  );
}