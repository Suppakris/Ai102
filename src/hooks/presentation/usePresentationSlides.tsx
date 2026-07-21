"use client";

import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";

import { type PlateSlide } from "@/components/notebook/presentation/utils/parser";
import { usePresentationState } from "@/states/presentation-state";

interface SlideWithId extends PlateSlide {
  id: string;
}

export function usePresentationSlides() {
  // Subscribe to slide IDs only for rendering - prevents re-render when
  // content changes. useShallow does the array comparison the old comment
  // here claimed but didn't actually wire up: without it, `.map(...)`
  // returns a brand-new array on every store update (Object.is fails even
  // when every id is identical), so this hook -- and SlidesContainer, its
  // DndContext, and every SlideItem's key-based reconciliation -- was
  // re-rendering on every keystroke in any slide's editor, not just when
  // slides were actually added/removed/reordered.
  const slideIds = usePresentationState(
    useShallow((s) => s.slides.map((slide) => slide.id)),
  );
  const setSlides = usePresentationState((s) => s.setSlides);
  const setCurrentSlideId = usePresentationState((s) => s.setCurrentSlideId);
  const isPresenting = usePresentationState((s) => s.isPresenting);
  const setIsReorderingSlides = usePresentationState(
    (s) => s.setIsReorderingSlides,
  );

  // Configure DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // slideIds is already stable (useShallow above) whenever ids don't
  // change, so it doubles as the DnD `items` list directly.
  const items = slideIds;

  // Handle drag end - reads slides fresh from the store instead of
  // subscribing to the full array reactively, so a content edit anywhere
  // in the deck doesn't re-render this hook (and everything that calls
  // it) on every keystroke just to keep a value only this callback needs.
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (isPresenting) return; // Prevent drag when presenting

      const { active, over } = event;

      if (over && active.id !== over.id) {
        const slides = usePresentationState.getState()
          .slides as SlideWithId[];
        const oldIndex = slides.findIndex((item) => item.id === active.id);
        const newIndex = slides.findIndex((item) => item.id === over.id);
        const newArray = arrayMove(slides, oldIndex, newIndex);
        setSlides([...newArray]);
        // Update current slide to the dragged slide's ID (not new position index)
        setCurrentSlideId(active.id as string);
      }
      // Clear reordering flag at end
      setIsReorderingSlides(false);
    },
    [isPresenting, setSlides, setCurrentSlideId, setIsReorderingSlides],
  );

  // Expose a start handler to set reordering flag (to be wired in DndContext)
  const handleDragStart = useCallback(() => {
    if (isPresenting) return;
    setIsReorderingSlides(true);
  }, [isPresenting, setIsReorderingSlides]);

  // Scroll to a slide by index
  const scrollToSlide = useCallback((id: string) => {
    // Target the slide wrapper instead of slide container
    const slideElement = document.querySelector(`.slide-wrapper-${id}`);

    if (slideElement) {
      // Find the scrollable container
      const scrollContainer = document.querySelector(".presentation-slides");

      if (scrollContainer) {
        // Calculate the scroll position
        scrollContainer.scrollTo({
          top: (slideElement as HTMLElement).offsetTop - 30, // Add a small offset for better visibility
          behavior: "smooth",
        });
      }
    }
  }, []);

  return {
    items,
    slideIds,
    sensors,
    isPresenting,
    handleDragStart,
    handleDragEnd,
    scrollToSlide,
  };
}
