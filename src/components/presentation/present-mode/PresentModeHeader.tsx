"use client";

import { Loader2 } from "lucide-react";
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

  return createPortal(
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
              onClick={async () => {
                setIsExiting(true);
                await new Promise((resolve) => setTimeout(resolve, 50));

                usePresentationState.getState().setIsPresenting(false);
                usePresentationState.getState().setIsPresentingLoading(false);
                usePresentationState.getState().resetPresentingScaleLocks();

                if (document.fullscreenElement) {
                  await document.exitFullscreen().catch(() => undefined);
                }

                const orientationController = getScreenOrientationController();
                if (typeof orientationController?.unlock === "function") {
                  orientationController.unlock();
                }
              }}
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
    </div>,
    document.body,
  );
}
