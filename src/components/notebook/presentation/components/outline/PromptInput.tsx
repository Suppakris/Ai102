import { usePresentationState } from "@/states/presentation-state";
import { FileText, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

export function PromptInput() {
  const {
    presentationInput,
    setPresentationInput,
    sourceDocument,
    setSourceDocument,
    startOutlineGeneration,
    isGeneratingOutline,
  } = usePresentationState();

  const hasInput = Boolean(presentationInput.trim() || sourceDocument);

  const handleGenerateOutline = () => {
    if (!hasInput) {
      toast.error("Please enter a presentation topic or attach a PDF");
      return;
    }

    startOutlineGeneration();
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-3 shadow-xs sm:p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            Presentation prompt
          </h3>
          <p className="text-sm text-muted-foreground">
            Refine the topic or regenerate the outline after edits.
          </p>
        </div>
        <button
          className={`inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 px-3 transition-colors ${
            isGeneratingOutline
              ? "text-indigo-400"
              : "text-indigo-400 hover:bg-muted hover:text-indigo-500"
          }`}
          onClick={handleGenerateOutline}
          disabled={isGeneratingOutline || !hasInput}
          aria-label="Regenerate outline"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {sourceDocument ? (
        <div className="mb-3 flex min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
          <FileText className="size-4 shrink-0 text-primary" />
          <span className="truncate font-medium text-foreground">
            {sourceDocument.name}
          </span>
          <span className="shrink-0 text-muted-foreground">
            {sourceDocument.pageCount}{" "}
            {sourceDocument.pageCount === 1 ? "page" : "pages"}
            {sourceDocument.truncated ? ", truncated" : ""}
          </span>
          <button
            type="button"
            aria-label="Remove attached PDF"
            onClick={() => setSourceDocument(null)}
            disabled={isGeneratingOutline}
            className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <input
        type="text"
        value={presentationInput}
        onChange={(e) => setPresentationInput(e.target.value)}
        className="w-full rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-foreground outline-hidden transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-indigo-400 sm:text-base"
        placeholder={
          sourceDocument
            ? "Optional: add extra instructions for the attached PDF..."
            : "Enter your presentation topic..."
        }
        disabled={isGeneratingOutline}
      />
    </div>
  );
}
