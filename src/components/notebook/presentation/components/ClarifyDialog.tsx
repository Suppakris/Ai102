"use client";

import {
  type ClarifyAnswer,
  type ClarifyQuestion,
} from "@/ai/agents/clarify/clarify";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface ClarifyDialogProps {
  open: boolean;
  questions: ClarifyQuestion[];
  isSubmitting: boolean;
  onSubmit: (answers: ClarifyAnswer[]) => void;
  /** Generate immediately with the original prompt, no interview. */
  onSkip: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ClarifyDialog({
  open,
  questions,
  isSubmitting,
  onSubmit,
  onSkip,
  onOpenChange,
}: ClarifyDialogProps) {
  // Per-question answer text; an option chip click fills it, typing overrides.
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setAnswers({});
  }, [open]);

  const answeredCount = questions.filter((q) =>
    answers[q.id]?.trim(),
  ).length;

  const handleSubmit = () => {
    const collected: ClarifyAnswer[] = questions
      .map((q) => ({ question: q.question, answer: answers[q.id]?.trim() ?? "" }))
      .filter((a) => a.answer);
    onSubmit(collected);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-indigo-400" />
            A few quick questions
          </DialogTitle>
          <DialogDescription>
            Answer what you can — it makes the deck fit what you actually
            need. Skip anything you don&apos;t care about.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {q.question}
              </p>
              {q.options.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((option) => {
                    const selected = answers[q.id] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: selected ? "" : option,
                          }))
                        }
                        className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                          selected
                            ? "border-indigo-400 bg-indigo-400/10 text-indigo-400"
                            : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <Input
                value={
                  q.options.includes(answers[q.id] ?? "")
                    ? ""
                    : (answers[q.id] ?? "")
                }
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                placeholder="Or type your own answer..."
                disabled={isSubmitting}
                className="h-9 text-sm"
              />
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={onSkip}
          >
            Skip &amp; generate
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || answeredCount === 0}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Refining...
              </>
            ) : (
              `Continue (${answeredCount}/${questions.length} answered)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
