"use client";

import { useParams } from "next/navigation";
import { PlateController } from "platejs/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type UIEvent,
} from "react";

import TouchAwareDndProvider from "@/components/globals/TouchAwareDndProvider";
import { ThemeBackground } from "@/components/notebook/presentation/components/theme/ThemeBackground";
import { usePresentationAutoScroll } from "@/hooks/presentation/usePresentationAutoScroll";
import { usePresentationData } from "@/hooks/presentation/usePresentationData";
import { usePresentationHistory } from "@/hooks/presentation/usePresentationHistory";
import { type ThemeProperties } from "@/lib/presentation/themes";
import { cn } from "@/lib/utils";
import {
  MAX_PRESENTATION_ZOOM_LEVEL,
  MIN_PRESENTATION_ZOOM_LEVEL,
  usePresentationState,
} from "@/states/presentation-state";
import { RightEditPanel } from "../edit-panel/RightEditPanel";
import { RightPanelRenderer } from "../edit-panel/RightPanelRenderer";
import { LoadingState } from "../shared/LoadingState";
import { PresentingLoadingOverlay } from "../shared/PresentingLoadingOverlay";
import { ThemeFontLoader } from "../shared/ThemeFontLoader";
import { SlideSidebar } from "../sidebar/SlideSidebar";
import { SlidesContainer } from "../slides/SlidesContainer";
import { PresentationCompletionFeedback } from "./PresentationCompletionFeedback";

export default function PresentationPage({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const params = useParams();
  const id = params.id as string;
  const isGeneratingPresentation = usePresentationState(
    (s) => s.isGeneratingPresentation,
  );
  const isPresenting = usePresentationState((s) => s.isPresenting);
  const isReadOnly = usePresentationState((s) => s.isReadOnly);
  const setIsReadOnly = usePresentationState((s) => s.setIsReadOnly);
  const isPresentingLoading = usePresentationState(
    (s) => s.isPresentingLoading,
  );
  // const activeRightPanel = usePresentationState((s) => s.activeRightPanel);
  // Load presentation data
  const { isLoading, currentThemeData } = usePresentationData(id, readOnly);
  const currentPresentationTitle = usePresentationState(
    (s) => s.currentPresentationTitle,
  );
  const completedGenerationPresentationId = usePresentationState(
    (s) => s.completedGenerationPresentationId,
  );
  const setZoomLevel = usePresentationState((s) => s.setZoomLevel);
  const dismissCompletedGeneration = usePresentationState(
    (s) => s.dismissCompletedGeneration,
  );

  // Auto scroll refs
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(
    null,
  );
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const handleViewportRef = useCallback((node: HTMLDivElement | null) => {
    setViewportElement(node);
  }, []);
  const handleScrollRef = useCallback((node: HTMLDivElement | null) => {
    setScrollElement(node);
  }, []);

  usePresentationAutoScroll({
    viewportElement,
    scrollElement,
  });

  useEffect(() => {
    if (!viewportElement || isPresenting) return;

    const PIXELS_PER_LINE = 16;
    const clampZoom = (value: number): number =>
      Math.min(
        MAX_PRESENTATION_ZOOM_LEVEL,
        Math.max(MIN_PRESENTATION_ZOOM_LEVEL, value),
      );

    const toPixelDelta = (event: WheelEvent): number => {
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        return event.deltaY * PIXELS_PER_LINE;
      }
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        return event.deltaY * window.innerHeight;
      }
      return event.deltaY;
    };

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (!(event.target instanceof HTMLElement)) return;
      if (!viewportElement.contains(event.target)) return;

      event.preventDefault();
      event.stopPropagation();

      const { zoomLevel } = usePresentationState.getState();
      const pixelDelta = toPixelDelta(event);
      const zoomFactor = Math.exp(-pixelDelta * 0.0015);
      const nextZoom = clampZoom(zoomLevel * zoomFactor);

      if (Math.abs(nextZoom - zoomLevel) < 0.0005) return;
      setZoomLevel(Number(nextZoom.toFixed(3)));
    };

    viewportElement.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      viewportElement.removeEventListener("wheel", handleWheel, true);
    };
  }, [isPresenting, setZoomLevel, viewportElement]);

  // Track presentation history
  usePresentationHistory();

  useEffect(() => {
    setIsReadOnly(readOnly);
    return () => {
      setIsReadOnly(false);
    };
  }, [readOnly, setIsReadOnly]);

  const effectiveReadOnly = readOnly || isReadOnly;
  const showCompletionFeedback = completedGenerationPresentationId === id;
  const shouldShowGenerationTail =
    isGeneratingPresentation || showCompletionFeedback;
  const editModeScrollTopRef = useRef(0);
  const previousIsPresentingRef = useRef(isPresenting);

  const handleViewportScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (isPresenting) return;
      editModeScrollTopRef.current = event.currentTarget.scrollTop;
    },
    [isPresenting],
  );

  useLayoutEffect(() => {
    if (!viewportElement) return;

    const wasPresenting = previousIsPresentingRef.current;
    previousIsPresentingRef.current = isPresenting;

    if (!wasPresenting && !isPresenting) {
      editModeScrollTopRef.current = viewportElement.scrollTop;
      return;
    }

    if (!wasPresenting || isPresenting) return;

    const restoreScrollTop = editModeScrollTopRef.current;
    const restoreScroll = () => {
      viewportElement.scrollTop = restoreScrollTop;
      viewportElement.scrollLeft = 0;
    };

    restoreScroll();
    const frameIds: number[] = [];
    frameIds.push(
      window.requestAnimationFrame(() => {
        restoreScroll();
        frameIds.push(window.requestAnimationFrame(restoreScroll));
      }),
    );

    return () => {
      for (const frameId of frameIds) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [isPresenting, viewportElement]);

  if (isLoading) {
    return <LoadingState />;
  }

  const themeData: ThemeProperties | undefined = currentThemeData ?? undefined;
  const showSlideSidebar = !isPresenting;
  const showEditPanels = !effectiveReadOnly && !isPresenting;

  return (
    <ThemeBackground className="flex h-full w-full">
      <TouchAwareDndProvider>
        <PlateController>
          {themeData && <ThemeFontLoader themeData={themeData} />}

          <div className="grid h-full w-full min-w-0 lg:grid-cols-[auto_minmax(0,1fr)]">
            <div className="relative z-10 hidden lg:flex">
              <SlideSidebar showSidebar={showSlideSidebar} />
            </div>
            <div
              ref={handleViewportRef}
              onScroll={handleViewportScroll}
              className={cn(
                "presentation-slides flex w-full min-w-0 overflow-x-hidden overflow-y-auto",
                isPresenting && "fixed inset-0 pb-0",
              )}
            >
              <div className="mx-auto flex min-w-0 flex-1 flex-col space-y-8 px-3 pt-8 sm:px-0 sm:pt-16 lg:max-w-[95%] xl:max-w-[90%]">
                <div className="space-y-8">
                  <SlidesContainer
                    isGeneratingPresentation={isGeneratingPresentation}
                    isReadOnly={effectiveReadOnly}
                  />
                </div>
                {shouldShowGenerationTail ? (
                  <div className="w-full shrink-0">
                    {showCompletionFeedback ? (
                      <div className="min-h-[32vh] sm:min-h-[36vh]">
                        <PresentationCompletionFeedback
                          presentationId={id}
                          presentationTitle={currentPresentationTitle}
                          onHide={() => dismissCompletedGeneration(id)}
                        />
                      </div>
                    ) : (
                      <div
                        aria-hidden="true"
                        className="h-[32vh] min-h-32 w-full sm:h-[36vh]"
                      />
                    )}
                  </div>
                ) : null}
                <div ref={handleScrollRef} />
              </div>

              {/* RightEditPanel shows buttons, hidden when any panel is open */}
              {showEditPanels && <RightEditPanel />}
            </div>
          </div>

          {/* Unified Right Panel Renderer with animations */}
          {showEditPanels && <RightPanelRenderer />}
        </PlateController>
      </TouchAwareDndProvider>

      {isPresentingLoading && <PresentingLoadingOverlay />}
    </ThemeBackground>
  );
}
