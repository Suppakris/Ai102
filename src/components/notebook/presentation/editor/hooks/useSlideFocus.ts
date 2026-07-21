"use client";

import { type PlateEditor } from "platejs/react";
import { useEffect } from "react";

export function useSlideFocus(
  editor: PlateEditor,
  currentSlideId: string | null,
  slideId: string | undefined,
) {
  useEffect(() => {
    if (currentSlideId !== slideId) {
      return;
    }

    const timeoutId = setTimeout(() => {
      try {
        // Only force a default cursor position when this editor doesn't
        // already have one -- e.g. the slide became active via the
        // sidebar or a keyboard shortcut, not a direct click inside the
        // editor. A direct click already places the correct native
        // selection; overriding it here snapped the cursor to the end of
        // the slide on every click, which read as the editor "selecting
        // things on its own" / not letting go of a selection.
        if (!editor?.selection) {
          editor?.tf?.focus({ edge: "endEditor" });
        }
      } catch {}
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [currentSlideId, slideId, editor]);
}
