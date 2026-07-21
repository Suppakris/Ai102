"use client";

import { Loader2, Play, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useDebouncedSave } from "@/hooks/presentation/useDebouncedSave";
import { cn } from "@/lib/utils";
import { usePresentationState } from "@/states/presentation-state";

export function PresentButton() {
  const [isPreparingPresentMode, setIsPreparingPresentMode] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const { saveImmediately } = useDebouncedSave();
  const isPresenting = usePresentationState((s) => s.isPresenting);
  const setIsPresenting = usePresentationState((s) => s.setIsPresenting);
  const setIsPresentingLoading = usePresentationState(
    (s) => s.setIsPresentingLoading,
  );
  const resetPresentingScaleLocks = usePresentationState(
    (s) => s.resetPresentingScaleLocks,
  );
  const setShouldStartPresentationGeneration = usePresentationState(
    (s) => s.setShouldStartPresentationGeneration,
  );
  const isGeneratingPresentation = usePresentationState(
    (s) => s.isGeneratingPresentation,
  );
  const isGeneratingOutline = usePresentationState(
    (s) => s.isGeneratingOutline,
  );

  useEffect(() => {
    if (isPresenting) {
      setIsPreparingPresentMode(false);
      setIsExiting(false);
    } else {
      setIsExiting(false);
    }
  }, [isPresenting]);

  // Check if generation is in progress
  const isGenerating = isGeneratingPresentation || isGeneratingOutline;
  const isLoading = isPreparingPresentMode || isExiting;
  const isDisabled = isGenerating || isLoading;

  return (
    <Button
      type="button"
      size="sm"
      className={cn(
        "notranslate h-10 w-10 shrink-0 rounded-lg px-0 sm:h-9 sm:w-auto sm:gap-1.5 sm:rounded-md sm:px-3",
        isPresenting
          ? "bg-red-600 text-white hover:bg-red-700"
          : "bg-purple-600 text-white hover:bg-purple-700",
        isDisabled && "cursor-not-allowed opacity-70",
      )}
      translate="no"
      onClick={async () => {
        if (isDisabled) return;

        if (isPresenting) {
          setIsExiting(true);
          await new Promise((resolve) => setTimeout(resolve, 50));
          setIsPresenting(false);
          setIsPresentingLoading(false);
          resetPresentingScaleLocks();
          // Defense-in-depth: a stray shouldStartPresentationGeneration
          // trigger left set from before entering present mode would wipe
          // and regenerate the deck as soon as it's next observed.
          setShouldStartPresentationGeneration(false);
          setIsExiting(false);
          return;
        }

        setIsPreparingPresentMode(true);
        try {
          await saveImmediately({ includeMetadata: true });
          resetPresentingScaleLocks();
          setIsPresentingLoading(true);
          setIsPresenting(true);
        } catch (caughtError) {
          setIsPreparingPresentMode(false);
          throw caughtError;
        }
        setIsPreparingPresentMode(false);
      }}
      disabled={isDisabled}
    >
      <span className="sr-only" translate="no">
        {isPresenting ? "Exit" : "Present"}
      </span>
      {isLoading ? (
        <>
          <Loader2
            className="h-5 w-5 animate-spin sm:mr-1 sm:h-4 sm:w-4"
            aria-hidden="true"
          />
          <span className="hidden sm:inline" translate="no">
            {isPresenting ? "Exiting" : "Presenting"}
          </span>
        </>
      ) : isPresenting ? (
        <>
          <X className="h-5 w-5 sm:mr-1 sm:h-4 sm:w-4" aria-hidden="true" />
          <span className="hidden sm:inline" translate="no">
            Exit
          </span>
        </>
      ) : (
        <>
          <Play className="h-5 w-5 sm:mr-1 sm:h-4 sm:w-4" aria-hidden="true" />
          <span className="hidden sm:inline" translate="no">
            Present
          </span>
        </>
      )}
    </Button>
  );
}
