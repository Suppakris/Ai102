"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  HelpCircle,
  Loader2,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { serializeSlideToXml } from "@/components/notebook/presentation/utils/slide-serializer";
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
  const [result, setResult] = useState<ReviewResult | null>(null);
  const { toast } = useToast();

  const handleReview = async () => {
    const { slides, currentPresentationId } = usePresentationState.getState();

    if (!currentPresentationId || slides.length === 0) {
      toast({
        title: "Nothing to review",
        description: "Generate or add slides first.",
        variant: "destructive",
      });
      return;
    }

    setIsReviewing(true);
    setResult(null);
    try {
      const response = await fetch("/api/presentation/review-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: currentPresentationId,
          slides: slides.map((slide, index) => ({
            slide_number: index + 1,
            content: serializeSlideToXml(slide),
          })),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Review failed (${response.status})`);
      }

      setResult((await response.json()) as ReviewResult);
    } catch (error) {
      toast({
        title: "Review Failed",
        description:
          error instanceof Error
            ? error.message
            : "There was an error reviewing your presentation.",
        variant: "destructive",
      });
    } finally {
      setIsReviewing(false);
    }
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
        if (!open) setResult(null);
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

        {result ? (
          <ScrollArea className="max-h-[55vh] pr-3">
            <div className="space-y-4">
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
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            {isReviewing
              ? "The auditor is reading your slides — this usually takes a few seconds."
              : "Runs on the configured AI backend. Slide text is sent for review; nothing is changed without you."}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsOpen(false)}
            disabled={isReviewing}
          >
            Close
          </Button>
          <Button type="button" onClick={handleReview} disabled={isReviewing}>
            {isReviewing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Reviewing…
              </>
            ) : result ? (
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
