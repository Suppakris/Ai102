"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  HelpCircle,
  Loader2,
  Wand2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  parseSlideXml,
  type PlateSlide,
} from "@/components/notebook/presentation/utils/parser";
import { serializeSlideToXml } from "@/components/notebook/presentation/utils/slide-serializer";
import { useDebouncedSave } from "@/hooks/presentation/useDebouncedSave";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { usePresentationState } from "@/states/presentation-state";

type ClaimStatus = "SUPPORTED" | "UNSUPPORTED" | "INSUFFICIENT_CONTEXT";

interface ReviewResult {
  claim_audit: Array<{
    slide_number: number;
    claim: string;
    status: ClaimStatus;
  }>;
  score: { clarity: number; design: number; content_accuracy: number };
  feedback: string;
  clarifying_questions: string[];
  needs_revision: boolean;
  /**
   * True when the shared Ollama server was unreachable and the route fell
   * back to the free OpenRouter tier for this review. That model's scoring
   * is less repeatable than Ollama's, worth flagging in the UI.
   */
  usedFallbackProvider?: boolean;
  /** Present only on revise:true responses (reviewAndRevise contract). */
  revision?: {
    applied: boolean;
    revised_slides?: Array<{ slide_number: number; content: string }>;
    revision_summary?: string;
    initial_review?: Omit<ReviewResult, "revision">;
  };
}

function averageScore(result: Pick<ReviewResult, "score">): number {
  return (
    (result.score.clarity +
      result.score.design +
      result.score.content_accuracy) /
    3
  );
}

const CLAIM_STATUS_STYLE: Record<
  ClaimStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  SUPPORTED: {
    label: "Supported",
    className: "text-emerald-600 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  UNSUPPORTED: {
    label: "Unsupported",
    className: "text-red-600 dark:text-red-400",
    Icon: XCircle,
  },
  INSUFFICIENT_CONTEXT: {
    label: "Unverifiable",
    className: "text-amber-600 dark:text-amber-400",
    Icon: AlertTriangle,
  },
};

/**
 * The reviewer fact-checks claims against source_context; the presentation's
 * own prompt and outline are the closest thing to source material we have.
 */
function buildSourceContext(
  presentationInput: string,
  outline: string[],
): string | undefined {
  const parts: string[] = [];
  if (presentationInput.trim()) {
    parts.push(`Presentation topic / original request:\n${presentationInput.trim()}`);
  }
  if (outline.length > 0) {
    parts.push(
      `Planned outline:\n${outline.map((item, i) => `${i + 1}. ${item}`).join("\n")}`,
    );
  }
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

function progressMessage(elapsedSeconds: number, slideCount: number): string {
  if (elapsedSeconds < 6) {
    return `Sending your ${slideCount} slide${slideCount === 1 ? "" : "s"} to the auditor…`;
  }
  if (elapsedSeconds < 20) {
    return "The auditor is reading your deck and checking its claims…";
  }
  if (elapsedSeconds < 45) {
    return "Still working — larger decks and busy servers take a bit longer…";
  }
  return "Hang tight — the AI server is under load. This can take a minute or two.";
}

/** Auto-fix is up to three sequential AI calls, so its stages run longer. */
function fixProgressMessage(elapsedSeconds: number): string {
  if (elapsedSeconds < 20) {
    return "Re-checking your deck to pin down what needs fixing…";
  }
  if (elapsedSeconds < 60) {
    return "Rewriting the flagged slides from the reviewer's feedback…";
  }
  return "Re-reviewing the revised deck — almost done…";
}

function ScoreTile({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 7
      ? "text-emerald-600 dark:text-emerald-400"
      : value >= 4
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";
  return (
    <div className="flex flex-1 flex-col items-center rounded-xl border border-border p-3">
      <span className={`text-2xl font-semibold ${tone}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function ReviewButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [slideCount, setSlideCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fixNotice, setFixNotice] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<PlateSlide[] | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const { toast } = useToast();
  const { saveImmediately } = useDebouncedSave();

  const isBusy = isReviewing || isFixing;

  useEffect(() => {
    if (!isBusy) return;
    setElapsedSeconds(0);
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isBusy]);

  /** Shared POST for review and auto-fix; throws Errors with user-facing messages. */
  const requestReview = async (revise: boolean): Promise<ReviewResult> => {
    const { slides, currentPresentationId, outline, presentationInput } =
      usePresentationState.getState();

    setSlideCount(slides.length);
    const response = await fetch("/api/presentation/review-deck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: currentPresentationId,
        slides: slides.map((slide, index) => ({
          slide_number: index + 1,
          content: serializeSlideToXml(slide),
        })),
        source_context: buildSourceContext(presentationInput, outline),
        ...(revise ? { revise: true } : {}),
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (response.status === 401) {
        throw new Error(
          "Your session has expired. Refresh the page and sign in again.",
        );
      }
      if (response.status === 429) {
        throw new Error(
          "You've run a lot of reviews recently — wait a few minutes and try again.",
        );
      }
      if (response.status === 503) {
        throw new Error(
          body?.error ??
            "The AI review server is offline right now. Try again in a few minutes.",
        );
      }
      throw new Error(
        body?.error ?? `Something went wrong (error ${response.status}). Try again.`,
      );
    }

    return (await response.json()) as ReviewResult;
  };

  const friendlyError = (error: unknown): string =>
    // fetch rejects with a TypeError when the request never reached the server
    error instanceof TypeError
      ? "Couldn't reach the server. Check your internet connection and try again."
      : error instanceof Error
        ? error.message
        : "There was an error reviewing your presentation.";

  const hasDeck = (): boolean => {
    const { slides, currentPresentationId } = usePresentationState.getState();
    if (!currentPresentationId || slides.length === 0) {
      toast({
        title: "Nothing to review",
        description: "Generate or add slides first.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleReview = async () => {
    if (!hasDeck()) return;

    setIsReviewing(true);
    setResult(null);
    setErrorMessage(null);
    setFixNotice(null);
    try {
      setResult(await requestReview(false));
    } catch (error) {
      setErrorMessage(friendlyError(error));
    } finally {
      setIsReviewing(false);
    }
  };

  /**
   * Converts the reviser's XML back into editor slides and swaps them in.
   * All-or-nothing: if any slide fails to parse, the deck is left untouched.
   * Position-matched originals keep their id/rootImage/aspect ratio (same
   * approach as the chat agent's regenerateSlide).
   */
  const applyRevisedSlides = (
    revised: Array<{ slide_number: number; content: string }>,
  ): boolean => {
    const { slides, setSlides } = usePresentationState.getState();

    const parsed: PlateSlide[] = [];
    for (const slide of revised) {
      try {
        const sections = parseSlideXml(slide.content);
        if (!sections?.[0]) return false;
        parsed.push(sections[0]);
      } catch {
        return false;
      }
    }
    if (parsed.length === 0) return false;

    const reference = slides[0];
    const merged = parsed.map((slide, index) => {
      const original = slides[index];
      return {
        ...slide,
        ...(original
          ? { id: original.id, rootImage: original.rootImage }
          : {}),
        aspectRatio: (original ?? reference)?.aspectRatio ?? slide.aspectRatio,
        formatCategory:
          (original ?? reference)?.formatCategory ?? slide.formatCategory,
      };
    });

    setUndoSnapshot(slides);
    setSlides(merged as PlateSlide[]);
    void saveImmediately();
    return true;
  };

  const handleAutoFix = async () => {
    if (!hasDeck()) return;

    setIsFixing(true);
    setErrorMessage(null);
    setFixNotice(null);
    try {
      const data = await requestReview(true);
      const revision = data.revision;

      if (revision?.applied && revision.revised_slides?.length) {
        if (!applyRevisedSlides(revision.revised_slides)) {
          // Keep the previous review on screen: `data` describes a rewrite
          // that was never applied to the deck.
          setErrorMessage(
            "The AI rewrote the deck, but the result couldn't be converted back into slides — your deck was left untouched. Try again.",
          );
          return;
        }
        const before = revision.initial_review
          ? averageScore(revision.initial_review).toFixed(1)
          : null;
        const after = averageScore(data).toFixed(1);
        setFixNotice(
          `${revision.revision_summary ?? "The deck was rewritten from the reviewer's feedback."}${
            before ? ` Score: ${before} → ${after}.` : ""
          }`,
        );
      } else {
        setFixNotice(
          "On a second look, the deck passed review — nothing needed changing.",
        );
      }
      setResult(data);
    } catch (error) {
      setErrorMessage(friendlyError(error));
    } finally {
      setIsFixing(false);
    }
  };

  const handleUndo = () => {
    if (!undoSnapshot) return;
    usePresentationState.getState().setSlides(undoSnapshot);
    void saveImmediately();
    setUndoSnapshot(null);
    setFixNotice(null);
    // The last review describes the now-reverted deck, so clear it too.
    setResult(null);
    toast({
      title: "Deck restored",
      description: "Your slides are back to how they were before Auto-fix.",
    });
  };

  const average = result
    ? (result.score.clarity +
        result.score.design +
        result.score.content_accuracy) /
      3
    : null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setResult(null);
          setErrorMessage(null);
          setFixNotice(null);
          // App-level undo (Ctrl+Z) still works after this — setSlides
          // records every change in presentation history.
          setUndoSnapshot(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative size-9 px-0 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
        >
          <span className="sr-only">Review presentation</span>
          <ClipboardCheck className="size-4 sm:mr-1" />
          <span className="hidden sm:inline">Review</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI Deck Review</DialogTitle>
          <DialogDescription>
            An AI auditor scores your deck for clarity, structure, and content
            accuracy, and flags claims it cannot verify.
          </DialogDescription>
        </DialogHeader>

        {result && !isBusy ? (
          <ScrollArea className="max-h-[55vh] pr-3">
            <div className="space-y-4">
              {fixNotice && (
                <div className="space-y-2 rounded-lg border border-emerald-600/40 bg-emerald-500/5 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Wand2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{fixNotice}</span>
                  </div>
                  {undoSnapshot && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUndo}
                    >
                      Undo — restore my original slides
                    </Button>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Overall: {average?.toFixed(1)} / 10
                </span>
                {result.needs_revision ? (
                  <Badge variant="destructive">Needs revision</Badge>
                ) : (
                  <Badge>Looks good</Badge>
                )}
              </div>

              {result.usedFallbackProvider && (
                <p className="text-xs text-muted-foreground">
                  The usual reviewer was offline, so this review ran on a
                  backup model. Scores can vary a bit more between runs than
                  usual — you can try Review again in a few minutes once the
                  main reviewer is back.
                </p>
              )}

              <div className="flex gap-2">
                <ScoreTile label="Clarity" value={result.score.clarity} />
                <ScoreTile label="Design" value={result.score.design} />
                <ScoreTile
                  label="Accuracy"
                  value={result.score.content_accuracy}
                />
              </div>

              <p className="text-sm leading-relaxed">
                {result.feedback.trim() ||
                  "The reviewer returned scores without written feedback — try Review again for a written assessment."}
              </p>

              {result.clarifying_questions.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">
                    The reviewer needs more information:
                  </span>
                  {result.clarifying_questions.map((question) => (
                    <div
                      key={question}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <HelpCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{question}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.claim_audit.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Claim audit</span>
                  {result.claim_audit.map((claim) => {
                    const style = CLAIM_STATUS_STYLE[claim.status];
                    return (
                      <div
                        key={`${claim.slide_number}-${claim.claim}`}
                        className="flex items-start gap-2 text-sm"
                      >
                        <style.Icon
                          className={`mt-0.5 size-4 shrink-0 ${style.className}`}
                        />
                        <span className="min-w-0">
                          <span className="text-muted-foreground">
                            {`Slide ${claim.slide_number}: `}
                          </span>
                          {claim.claim}
                          <span className={`ml-1 text-xs ${style.className}`}>
                            {`(${style.label})`}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        ) : isBusy ? (
          <div className="flex items-start gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
            <span>
              {isFixing
                ? fixProgressMessage(elapsedSeconds)
                : progressMessage(elapsedSeconds, slideCount)}
              {elapsedSeconds >= 6 && ` (${elapsedSeconds}s)`}
            </span>
          </div>
        ) : errorMessage ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>{errorMessage}</span>
          </div>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            Runs on the configured AI backend. Slide text is sent for review;
            nothing is changed without you.
          </p>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsOpen(false)}
            disabled={isBusy}
          >
            Close
          </Button>
          {result?.needs_revision && !isBusy && (
            <Button type="button" variant="outline" onClick={handleAutoFix}>
              <Wand2 className="mr-2 size-4" />
              Auto-fix deck
            </Button>
          )}
          <Button type="button" onClick={handleReview} disabled={isBusy}>
            {isReviewing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Reviewing…
              </>
            ) : isFixing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Fixing…
              </>
            ) : result ?? errorMessage ? (
              "Review again"
            ) : (
              "Review my deck"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
