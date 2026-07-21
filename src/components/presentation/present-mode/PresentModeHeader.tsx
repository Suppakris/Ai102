"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { usePresentationState } from "@/states/presentation-state";

type ScreenOrientationController = ScreenOrientation & {
  unlock?: () => void;
};

function getScreenOrientationController(): ScreenOrientationController | null {
  if (typeof screen === "undefined" || !("orientation" in screen)) {
    return null;
  }

  return screen.orientation as ScreenOrientationController;
}

interface PresentModeHeaderProps {
  showHeader: boolean;
  presentationTitle: string | null;
}

export function PresentModeHeader({
  showHeader,
  presentationTitle,
}: PresentModeHeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const isPresenting = usePresentationState((s) => s.isPresenting);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isPresenting) {
      setIsExiting(false);
    }
  }, [isPresenting]);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  const exitPresentation = async () => {
    setIsExiting(true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    usePresentationState.getState().setIsPresenting(false);
    usePresentationState.getState().setIsPresentingLoading(false);
    usePresentationState.getState().resetPresentingScaleLocks();
    // Defense-in-depth: a stray shouldStartPresentationGeneration
    // trigger left set from before entering present mode would
    // wipe and regenerate the deck as soon as it's next observed.
    usePresentationState.getState().setShouldStartPresentationGeneration(false);

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }

    const orientationController = getScreenOrientationController();
    if (typeof orientationController?.unlock === "function") {
      orientationController.unlock();
    }
  };

  return createPortal(
    <>
      {/* Always-visible back button: the full header below only reveals on
          mouse-move-to-top, which is undiscoverable (and unusable on touch),
          so present mode otherwise has no persistent way back to editing. */}
      {isPresenting && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to editor"
          disabled={isExiting}
          onClick={exitPresentation}
          className="fixed top-4 left-4 z-2147483647 rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          {isExiting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowLeft className="size-4" />
          )}
        </Button>
      )}

      <div
        className={`fixed top-0 right-0 left-0 z-2147483647 transition-all duration-300 ${
          showHeader ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="border-b border-white/10 bg-black/80 backdrop-blur-xs">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-white">
                {presentationTitle}
              </div>
              <Button
                variant="ghost"
                className="text-white hover:bg-white/20"
                disabled={isExiting}
                onClick={exitPresentation}
              >
                {isExiting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Exiting…
                  </>
                ) : (
                  "Exit Presentation"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
