"use client";

import { KeyRound, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePresentationState } from "@/states/presentation-state";

// OpenAI-compatible free endpoint. Groq mirrors the OpenAI API, so pointing the
// client here + pasting a free Groq key (console.groq.com/keys) runs the whole
// generator at $0. Leave the fields blank to fall back to the server env key.
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

export function ApiKeySection() {
  const apiKey = usePresentationState((s) => s.apiKey);
  const baseUrl = usePresentationState((s) => s.baseUrl);
  const modelId = usePresentationState((s) => s.modelId);
  const setApiKey = usePresentationState((s) => s.setApiKey);
  const setBaseUrl = usePresentationState((s) => s.setBaseUrl);
  const setModelId = usePresentationState((s) => s.setModelId);

  const usingGroq = baseUrl.trim() === GROQ_BASE_URL;

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <KeyRound className="size-4 text-muted-foreground" />
        AI Provider &amp; API Key
      </Label>

      <Button
        type="button"
        variant={usingGroq ? "default" : "outline"}
        size="sm"
        className="w-full gap-1.5"
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

      <div className="space-y-1.5">
        <Label htmlFor="api-key" className="text-xs text-muted-foreground">
          API key
        </Label>
        <Input
          id="api-key"
          type="password"
          autoComplete="off"
          placeholder="gsk_... (Groq) or sk-... (OpenAI)"
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
        generation request. Free Groq keys:{" "}
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          console.groq.com/keys
        </a>
      </p>
    </div>
  );
}
