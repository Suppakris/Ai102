"use client";

import { useOllamaStatus } from "@/hooks/presentation/useOllamaStatus";
import { cn } from "@/lib/utils";

function formatCheckedAt(checkedAt: string | null): string {
  if (!checkedAt) return "";
  return new Date(checkedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OllamaStatusBadge() {
  const { online, checkedAt, isChecking, refetch } = useOllamaStatus();

  const label =
    online === null
      ? "Checking Ollama..."
      : online
        ? "Ollama is awake"
        : "Ollama is unreachable";

  const title =
    online === null
      ? "Checking whether the Ollama backend is reachable..."
      : online
        ? `Ollama backend responded at ${formatCheckedAt(checkedAt)}`
        : `Ollama backend did not respond (last checked ${formatCheckedAt(checkedAt)}). If it's hosted on someone else's PC, make sure that machine and Ollama are running.`;

  return (
    <button
      type="button"
      onClick={() => refetch()}
      title={title}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
    >
      <span
        className={cn(
          "size-2 rounded-full",
          online === null
            ? "animate-pulse bg-muted-foreground"
            : online
              ? "bg-green-500"
              : "bg-red-500",
          isChecking && online !== null && "animate-pulse",
        )}
      />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
