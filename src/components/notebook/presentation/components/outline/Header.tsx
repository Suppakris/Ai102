"use client";

import {
  Check,
  ChevronDown,
  Languages,
  Layers,
  Paperclip,
  RefreshCw,
  Search,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getNotebookAttachmentRagId } from "@/lib/notebook/attachments";
import {
  getPresentationGenerationAspectRatioLabel,
  PRESENTATION_GENERATION_ASPECT_RATIO_OPTIONS,
  type PresentationGenerationAspectRatio,
} from "@/lib/presentation/aspect-ratio";
import { LANGUAGE_OPTIONS } from "@/lib/presentation/languages";
import { cn } from "@/lib/utils";
import { usePresentationState } from "@/states/presentation-state";

interface HeaderProps {
  onRegenerate?: () => void;
  isGeneratingOutlineOverride?: boolean;
}

function getLanguageLabel(language: string): string {
  return (
    LANGUAGE_OPTIONS.find((option) => option.value === language)?.shortLabel ??
    language
  );
}

export function Header({
  onRegenerate,
  isGeneratingOutlineOverride,
}: HeaderProps) {
  const {
    presentationInput,
    setPresentationInput,
    numSlides,
    setNumSlides,
    language,
    setLanguage,
    webSearchEnabled,
    setWebSearchEnabled,
    generationAspectRatio,
    setGenerationAspectRatio,
    isGeneratingOutline: isGeneratingOutlineFromState,
    startOutlineGeneration,
    sourceDocument,
    attachedFiles,
    selectedChunks,
    extractorRagIds,
    setCurrentExtractorRagId,
  } = usePresentationState();
  const isGeneratingOutline =
    isGeneratingOutlineOverride ?? isGeneratingOutlineFromState;
  const [isExpanded, setIsExpanded] = useState(false);
  const prompt = presentationInput.trim();
  const formatBadgeLabel =
    getPresentationGenerationAspectRatioLabel(generationAspectRatio);
  const languageBadgeLabel = getLanguageLabel(language);
  const hasKnownLanguage = LANGUAGE_OPTIONS.some(
    (option) => option.value === language,
  );
  const languageSelectValue = language.trim()
    ? language
    : LANGUAGE_OPTIONS[0].value;

  function handleRegenerate() {
    if (!prompt && !sourceDocument) {
      toast.error("Please enter a presentation topic or attach a PDF");
      return;
    }

    if (onRegenerate) {
      onRegenerate();
      return;
    }

    startOutlineGeneration();
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border bg-muted/30 p-3 text-left transition-colors hover:bg-muted/40",
            isExpanded && "rounded-b-none",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                isExpanded && "rotate-180",
              )}
            />
            <span className="truncate text-sm font-medium">
              {prompt || sourceDocument?.name || "Untitled presentation"}
            </span>
          </div>

          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <Badge variant="secondary" className="font-normal">
              {numSlides} slides
            </Badge>
            <Badge variant="secondary" className="font-normal">
              {formatBadgeLabel}
            </Badge>
            <Badge variant="secondary" className="font-normal">
              {languageBadgeLabel}
            </Badge>
            <Badge variant="secondary" className="font-normal">
              {webSearchEnabled ? "Search on" : "Search off"}
            </Badge>
            {attachedFiles.length > 0 ? (
              <Badge variant="outline" className="font-normal text-primary">
                {attachedFiles.length}{" "}
                {attachedFiles.length === 1 ? "file" : "files"}
              </Badge>
            ) : null}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              handleRegenerate();
            }}
            disabled={isGeneratingOutline || !prompt}
            className="h-7 shrink-0 gap-1.5 rounded-full px-3 text-xs"
          >
            <RefreshCw
              className={cn(
                "size-3.5",
                isGeneratingOutline && "animate-spin",
              )}
            />
            <span className="hidden sm:inline">Regenerate</span>
          </Button>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="rounded-b-lg border border-t-0 bg-muted/30 p-4">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5 sm:hidden">
              <Badge variant="secondary" className="font-normal">
                {numSlides} slides
              </Badge>
              <Badge variant="secondary" className="font-normal">
                {formatBadgeLabel}
              </Badge>
              <Badge variant="secondary" className="font-normal">
                {languageBadgeLabel}
              </Badge>
              <Badge variant="secondary" className="font-normal">
                {webSearchEnabled ? "Search on" : "Search off"}
              </Badge>
              {attachedFiles.length > 0 ? (
                <Badge variant="outline" className="font-normal text-primary">
                  {attachedFiles.length}{" "}
                  {attachedFiles.length === 1 ? "file" : "files"}
                </Badge>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="outline-prompt"
                className="text-xs font-medium text-muted-foreground"
              >
                Prompt
              </label>
              <Textarea
                id="outline-prompt"
                value={presentationInput}
                onChange={(event) => setPresentationInput(event.target.value)}
                disabled={isGeneratingOutline}
                rows={3}
                placeholder="Describe the presentation you want to generate..."
                className="min-h-20 resize-none rounded-xl border-border/50 bg-background px-3.5 py-2.5 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="outline-slides"
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                >
                  <Layers className="size-3.5" />
                  Slides
                </label>
                <Select
                  value={String(numSlides)}
                  onValueChange={(value) => setNumSlides(Number(value))}
                >
                  <SelectTrigger
                    id="outline-slides"
                    className="h-9 rounded-lg bg-background"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map(
                      (slideCount) => (
                        <SelectItem
                          key={slideCount}
                          value={String(slideCount)}
                        >
                          {slideCount} {slideCount === 1 ? "slide" : "slides"}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="outline-aspect-ratio"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Aspect ratio
                </label>
                <Select
                  value={generationAspectRatio}
                  onValueChange={(value) =>
                    setGenerationAspectRatio(
                      value as PresentationGenerationAspectRatio,
                    )
                  }
                >
                  <SelectTrigger
                    id="outline-aspect-ratio"
                    className="h-9 rounded-lg bg-background"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESENTATION_GENERATION_ASPECT_RATIO_OPTIONS.map(
                      (option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="outline-language"
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                >
                  <Languages className="size-3.5" />
                  Language
                </label>
                <Select value={languageSelectValue} onValueChange={setLanguage}>
                  <SelectTrigger
                    id="outline-language"
                    className="h-9 rounded-lg bg-background"
                  >
                    <SelectValue>{languageBadgeLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {!hasKnownLanguage && language.trim() ? (
                      <SelectItem value={language}>{language}</SelectItem>
                    ) : null}
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="outline-web-search"
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                >
                  <Search className="size-3.5" />
                  Web search
                </label>
                <div className="flex h-9 items-center justify-between rounded-lg border bg-background px-3">
                  <span className="text-sm text-muted-foreground">
                    {webSearchEnabled ? "Enabled" : "Disabled"}
                  </span>
                  <Switch
                    id="outline-web-search"
                    checked={webSearchEnabled}
                    onCheckedChange={setWebSearchEnabled}
                  />
                </div>
              </div>
            </div>

            {attachedFiles.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Attached files
                  </span>
                  {selectedChunks.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {selectedChunks.length}{" "}
                      {selectedChunks.length === 1 ? "selection" : "selections"}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {attachedFiles.map((file, index) => {
                    const ragId = getNotebookAttachmentRagId({
                      attachment: file,
                      attachments: attachedFiles,
                      extractorRagIds,
                      index,
                    });
                    const processed = Boolean(ragId);
                    const count = selectedChunks.filter(
                      (chunk) => chunk.ragId === ragId,
                    ).length;

                    return (
                      <button
                        key={file.fileAssetId ?? file.url}
                        type="button"
                        onClick={() => {
                          if (!processed || !ragId) {
                            return;
                          }

                          setCurrentExtractorRagId(ragId);
                        }}
                        className={cn(
                          "flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                          processed
                            ? "cursor-pointer border-primary/30 bg-primary/5 hover:bg-primary/10"
                            : "border-border bg-muted/40",
                        )}
                        title={processed ? "File processed" : file.name}
                      >
                        {count > 0 ? (
                          <span className="flex items-center gap-0.5 text-primary">
                            <Check className="size-3" />
                            <span className="font-medium">{count}</span>
                          </span>
                        ) : null}
                        <Paperclip className="size-3 shrink-0" />
                        <span className="max-w-48 truncate">{file.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
