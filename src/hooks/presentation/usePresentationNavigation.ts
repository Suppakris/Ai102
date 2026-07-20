import { useEffect } from "react";

import { usePresentationState } from "@/states/presentation-state";

const WHEEL_NAVIGATION_THRESHOLD = 42;
const WHEEL_NAVIGATION_COOLDOWN_MS = 420;
const PIXELS_PER_LINE = 16;
const SCROLL_EDGE_TOLERANCE_PX = 2;

function getWheelDeltaInPixels(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * PIXELS_PER_LINE;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * window.innerHeight;
  }

  return event.deltaY;
}

function isElementVerticallyScrollable(element: HTMLElement): boolean {
  const styles = window.getComputedStyle(element);
  const canOverflow =
    styles.overflowY === "auto" ||
    styles.overflowY === "scroll" ||
    styles.overflowY === "overlay";

  return (
    canOverflow &&
    element.scrollHeight - element.clientHeight > SCROLL_EDGE_TOLERANCE_PX
  );
}

function findScrollableAncestor(
  target: EventTarget | null,
  rootElement: HTMLElement,
): HTMLElement | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  let element: HTMLElement | null = target;
  while (element && rootElement.contains(element)) {
    if (isElementVerticallyScrollable(element)) {
      return element;
    }

    if (element === rootElement) {
      break;
    }

    element = element.parentElement;
  }

  return null;
}

function getCurrentSlideScrollableElement(
  target: EventTarget | null,
): HTMLElement | null {
  const { currentSlideId } = usePresentationState.getState();
  if (!currentSlideId) {
    return null;
  }

  const currentSlideContainer = document.querySelector<HTMLElement>(
    `.slide-container-${CSS.escape(currentSlideId)}`,
  );

  if (!currentSlideContainer) {
    return null;
  }

  const scrollableAncestor = findScrollableAncestor(
    target,
    currentSlideContainer,
  );
  if (scrollableAncestor) {
    return scrollableAncestor;
  }

  if (isElementVerticallyScrollable(currentSlideContainer)) {
    return currentSlideContainer;
  }

  const scrollableDescendants =
    currentSlideContainer.querySelectorAll<HTMLElement>("*");
  for (const element of scrollableDescendants) {
    if (isElementVerticallyScrollable(element)) {
      return element;
    }
  }

  return null;
}

function canScrollInDirection(element: HTMLElement, deltaY: number): boolean {
  if (deltaY > 0) {
    return (
      element.scrollTop + element.clientHeight <
      element.scrollHeight - SCROLL_EDGE_TOLERANCE_PX
    );
  }

  if (deltaY < 0) {
    return element.scrollTop > SCROLL_EDGE_TOLERANCE_PX;
  }

  return false;
}

function shouldLetSlideScroll(
  target: EventTarget | null,
  deltaY: number,
): boolean {
  const scrollableElement = getCurrentSlideScrollableElement(target);

  return scrollableElement
    ? canScrollInDirection(scrollableElement, deltaY)
    : false;
}

export function usePresentationNavigation() {
  const isPresenting = usePresentationState((s) => s.isPresenting);
  const nextSlide = usePresentationState((s) => s.nextSlide);
  const previousSlide = usePresentationState((s) => s.previousSlide);
  const setShouldShowExitHeader = usePresentationState(
    (s) => s.setShouldShowExitHeader,
  );

  // Handle keyboard navigation in presentation mode
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isPresenting) return;

      const keyScrollDirection =
        event.key === "ArrowDown" ||
        event.key === "PageDown" ||
        ((event.key === " " || event.key === "Space") && !event.shiftKey)
          ? 1
          : event.key === "ArrowUp" ||
              event.key === "PageUp" ||
              ((event.key === " " || event.key === "Space") && event.shiftKey)
            ? -1
            : 0;

      if (
        keyScrollDirection !== 0 &&
        shouldLetSlideScroll(event.target, keyScrollDirection)
      ) {
        return;
      }

      if (
        event.key === "ArrowRight" ||
        event.key === "ArrowDown" ||
        event.key === "Space" ||
        event.key === " "
      ) {
        event.preventDefault();
        nextSlide();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        previousSlide();
      } else if (event.key === "Escape") {
        usePresentationState.getState().setIsPresenting(false);
        usePresentationState.getState().setIsPresentingLoading(false);
        usePresentationState.getState().resetPresentingScaleLocks();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, previousSlide, isPresenting]);

  // Handle wheel navigation in presentation mode
  useEffect(() => {
    let accumulatedDelta = 0;
    let lastNavigationTime = 0;

    const handleWheel = (event: WheelEvent) => {
      if (!isPresenting) return;

      const now = window.performance.now();
      if (now - lastNavigationTime < WHEEL_NAVIGATION_COOLDOWN_MS) {
        return;
      }

      const deltaY = getWheelDeltaInPixels(event);

      if (shouldLetSlideScroll(event.target, deltaY)) {
        accumulatedDelta = 0;
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      accumulatedDelta += deltaY;

      if (Math.abs(accumulatedDelta) < WHEEL_NAVIGATION_THRESHOLD) {
        return;
      }

      if (accumulatedDelta > 0) {
        nextSlide();
      } else {
        previousSlide();
      }

      accumulatedDelta = 0;
      lastNavigationTime = now;
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [isPresenting, nextSlide, previousSlide]);

  // Handle showing header on mouse move
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isPresenting) return; // Only show header when in presentation mode

      if (event.clientY < 100) {
        setShouldShowExitHeader(true);
      } else {
        setShouldShowExitHeader(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isPresenting, setShouldShowExitHeader]);
}
