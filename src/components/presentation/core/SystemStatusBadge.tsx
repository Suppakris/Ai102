"use client";

import { RefreshCw } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSystemStatus } from "@/hooks/presentation/useSystemStatus";
import { cn } from "@/lib/utils";

function formatCheckedAt(checkedAt: string | null): string {
  if (!checkedAt) return "";
  return new Date(checkedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusDot({ online }: { online: boolean | null }) {
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        online === null
          ? "animate-pulse bg-muted-foreground"
          : online
            ? "bg-green-500"
            : "bg-red-500",
      )}
    />
  );
}

function StatusRow({
  label,
  online,
  detail,
}: {
  label: string;
  online: boolean | null;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {detail}
        <StatusDot online={online} />
      </span>
    </div>
  );
}

export function SystemStatusBadge() {
  const { ollama, database, integrations, checkedAt, isChecking, refetch } =
    useSystemStatus();

  const criticalOnline =
    ollama?.online === true && database?.online === true;
  const criticalKnown = ollama !== null && database !== null;

  const overallLabel = !criticalKnown
    ? "Checking status..."
    : criticalOnline
      ? "All systems awake"
      : "Backend issue detected";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={overallLabel}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
        >
          <StatusDot online={criticalKnown ? criticalOnline : null} />
          <span className="hidden sm:inline">{overallLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">System Status</span>
          <button
            type="button"
            onClick={() => refetch()}
            title="Recheck now"
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn("size-3.5", isChecking && "animate-spin")} />
          </button>
        </div>

        <div className="space-y-0.5 divide-y divide-border">
          <StatusRow
            label="Ollama"
            online={ollama?.online ?? null}
            detail={ollama && !ollama.online ? "unreachable" : undefined}
          />
          <StatusRow
            label="Database"
            online={database?.online ?? null}
            detail={database && !database.online ? "unreachable" : undefined}
          />
        </div>

        <div className="mt-3 mb-1 text-xs font-medium text-muted-foreground">
          Optional integrations (config only, not live-checked)
        </div>
        <div className="space-y-0.5 divide-y divide-border">
          <StatusRow
            label="FAL (AI images)"
            online={integrations?.falImages ?? null}
          />
          <StatusRow
            label="Together AI (AI images)"
            online={integrations?.togetherAiImages ?? null}
          />
          <StatusRow
            label="UploadThing (storage)"
            online={integrations?.uploadthing ?? null}
          />
          <StatusRow
            label="Tavily (web search)"
            online={integrations?.tavilySearch ?? null}
          />
          <StatusRow
            label="Unsplash (stock photos)"
            online={integrations?.unsplashImages ?? null}
          />
          <StatusRow
            label="Google image search"
            online={integrations?.googleImageSearch ?? null}
          />
        </div>

        {checkedAt && (
          <div className="mt-3 text-[11px] text-muted-foreground">
            Last checked {formatCheckedAt(checkedAt)}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
