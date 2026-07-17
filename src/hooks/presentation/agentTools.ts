import { type PresentationTool } from "@/backend/agent/tools/presentation/tools";
import {
  parseSlideXml,
  type PlateSlide,
} from "@/components/notebook/presentation/utils/parser";
import { usePresentationState } from "@/states/presentation-state";

interface ToolArgs {
  action: PresentationTool;
  scope?: "all";
  slideIds?: string[];
  [key: string]: unknown;
}

async function executeSearchTool(args: Record<string, unknown>) {
  const query = typeof args.query === "string" ? args.query.trim() : "";

  if (!query) {
    return "Missing search query";
  }

  const response = await fetch("/api/agent/presentation/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error("Search tool request failed");
  }

  const data = (await response.json()) as {
    result?: string;
  };

  return data.result ?? "Search completed";
}

function editSlideProperties(
  slidesToUpdate: string[],
  rest: Record<string, unknown>,
) {
  const { slides, setSlides } = usePresentationState.getState();
  const { bgColor, alignment, layoutType, width } = rest as {
    bgColor?: string;
    alignment?: "start" | "center" | "end" | "reset";
    layoutType?: "left" | "right" | "vertical" | "background" | "reset";
    width?: "S" | "M" | "L" | "reset";
  };

  if (!bgColor && !alignment && !layoutType && !width) {
    return "No properties provided";
  }
  const updatedSlides = slides.map((slide) => {
    if (slidesToUpdate.includes(slide.id)) {
      return {
        ...slide,
        ...(bgColor
          ? { bgColor: bgColor === "reset" ? undefined : bgColor }
          : {}),
        ...(alignment
          ? { alignment: alignment === "reset" ? undefined : alignment }
          : {}),
        ...(layoutType
          ? { layoutType: layoutType === "reset" ? "left" : layoutType }
          : {}),
        ...(width ? { width: width === "reset" ? "M" : width } : {}),
      };
    }
    return slide;
  });
  setSlides(updatedSlides);
  return `Updated ${Object.keys(rest).join(", ")} successfully to ${Object.values(rest).join(", ")}`;
}

function replaceImage(slidesToUpdate: string[], rest: Record<string, unknown>) {
  const { slides, setSlides } = usePresentationState.getState();
  const { imageUrl, imagePrompt } = rest;

  if (
    !imageUrl &&
    !imagePrompt &&
    typeof imageUrl !== "string" &&
    typeof imagePrompt !== "string"
  ) {
    return "No image URL or image prompt provided";
  }

  if (imageUrl) {
    const updatedSlides = slides.map((slide) => {
      if (slidesToUpdate.includes(slide.id)) {
        return {
          ...slide,
          rootImage: {
            ...slide.rootImage,
            url: imageUrl as string,
            embedType: undefined, // Clear embed type when replacing image
          },
        };
      }
      return slide;
    });
    setSlides(updatedSlides as PlateSlide[]);
    return "Image url replaced successfully";
  } else if (imagePrompt) {
    const updatedSlides = slides.map((slide) => {
      if (slidesToUpdate.includes(slide.id)) {
        const { startRootImageGeneration } = usePresentationState.getState();
        startRootImageGeneration(slide.id as string, imagePrompt as string);
        return {
          ...slide,
          rootImage: {
            ...slide.rootImage,
            query: imagePrompt as string,
            embedType: undefined, // Clear embed type when generating image
          },
        };
      }
      return slide;
    });
    setSlides(updatedSlides as PlateSlide[]);
    return "Image successfully generated from the given prompt";
  }

  return "No image url or image prompt provided";
}

function changeTheme(rest: Record<string, unknown>) {
  const { setTheme } = usePresentationState.getState();
  const { theme } = rest;
  if (!theme && typeof theme !== "string") {
    return "No theme provided";
  }
  setTheme(theme as string);
  return "Theme changed successfully";
}

export function regenerateSlide(rest: Record<string, unknown>) {
  const { slides, setSlides } = usePresentationState.getState();
  const { slides: slidesString, slideIds } = rest as {
    slides: string[];
    slideIds: string[];
  };

  if (!slidesString) {
    return "No slides provided";
  }

  const updatedSlides = slides.map((slide) => {
    if (slideIds.includes(slide.id)) {
      const slideString = slidesString[slideIds.indexOf(slide.id)] as string;
      const parsedSlide = parseSlideXml(slideString as string);
      return {
        ...parsedSlide[0],
        id: slide.id, // Preserve the original slide ID
        rootImage: slide.rootImage,
        // parseSlideXml parses a standalone <SECTION> fragment, which never
        // carries aspectRatio/formatCategory -- preserve the slide's own
        // existing values so a chat-regenerated slide doesn't silently
        // revert to the default aspect ratio while the rest of the deck
        // keeps whatever ratio was actually chosen for it.
        aspectRatio: slide.aspectRatio,
        formatCategory: slide.formatCategory,
      };
    }

    return slide;
  });
  setSlides(updatedSlides as PlateSlide[]);
  return `Slides ${slideIds.join(", ")} regenerated successfully`;
}

export function createSlide(rest: Record<string, unknown>) {
  const { slides, setSlides } = usePresentationState.getState();
  const { slides: newSlidesXml, afterSlideId } = rest as {
    slides?: string[];
    afterSlideId?: string;
  };

  if (!Array.isArray(newSlidesXml) || newSlidesXml.length === 0) {
    return "No slides provided";
  }

  const parsedNewSlides: PlateSlide[] = [];
  for (const xml of newSlidesXml) {
    try {
      const parsed = parseSlideXml(xml ?? "");
      if (parsed?.[0]) parsedNewSlides.push(parsed[0]);
    } catch (e) {
      console.error("Failed to parse new slide:", e);
    }
  }

  if (parsedNewSlides.length === 0) {
    return "No valid slides to insert";
  }

  // parseSlideXml parses standalone <SECTION> fragments, which never carry
  // aspectRatio/formatCategory -- match whichever ratio the rest of the deck
  // is already using (the slide these are inserted after, or the deck's
  // first slide) instead of silently falling back to the app default.
  const referenceSlide = afterSlideId
    ? (slides.find((s) => s.id === afterSlideId) ?? slides[0])
    : slides[0];
  const slidesWithAspectRatio = referenceSlide
    ? parsedNewSlides.map((slide) => ({
        ...slide,
        aspectRatio: referenceSlide.aspectRatio,
        formatCategory: referenceSlide.formatCategory,
      }))
    : parsedNewSlides;

  const updated = [...slides];
  if (afterSlideId) {
    const idx = updated.findIndex((s) => s.id === afterSlideId);
    if (idx >= 0) updated.splice(idx + 1, 0, ...slidesWithAspectRatio);
    else updated.push(...slidesWithAspectRatio);
  } else {
    updated.push(...slidesWithAspectRatio);
  }

  setSlides(updated);
  return `Added ${parsedNewSlides.length} slide${parsedNewSlides.length !== 1 ? "s" : ""}`;
}

export function deleteSlide(rest: Record<string, unknown>) {
  const { slides, setSlides } = usePresentationState.getState();
  const { slideIds } = rest as { slideIds?: string[] };

  if (!Array.isArray(slideIds) || slideIds.length === 0) {
    return "No slide ids provided";
  }

  const toDelete = new Set(slideIds);
  const updated = slides.filter((s) => !toDelete.has(s.id));
  setSlides(updated);
  return `Deleted ${slideIds.length} slide${slideIds.length !== 1 ? "s" : ""}`;
}

export function getSlidesToUpdate(scope?: "all", slideIds?: string[]) {
  const { slides } = usePresentationState.getState();
  return scope === "all" || (!scope && (!slideIds || slideIds?.length === 0))
    ? slides.map((slide) => slide.id)
    : slideIds;
}
/**
 * Execute a tool action on the presentation
 */
export function executeToolAction(args: ToolArgs) {
  const { action, slideIds, scope, ...rest } = args;

  const slidesToUpdate = getSlidesToUpdate(scope, slideIds);

  if (!slidesToUpdate) {
    return "No slides to update";
  }

  switch (action) {
    case "edit_slide_properties":
      return editSlideProperties(slidesToUpdate, rest);
    case "replace_image":
      return replaceImage(slidesToUpdate, rest);
    case "change_theme":
      return changeTheme(args);
    case "regenerate_slide":
      return regenerateSlide(args);
    case "create_slide":
      return createSlide(args);
    case "delete_slide":
      return deleteSlide(args);
    default:
      console.warn(`Unknown tool action: ${action}`);
      return "Unknown tool action";
  }
}

export async function executeToolCall({
  name,
  args,
}: {
  name: string;
  args: unknown;
}): Promise<string> {
  try {
    const parsedArgs = typeof args === "string" ? JSON.parse(args) : args;

    if (name === "webSearch") {
      return executeSearchTool((parsedArgs as Record<string, unknown>) ?? {});
    }

    if (name === "respond_to_user") {
      return typeof (parsedArgs as { message?: unknown })?.message === "string"
        ? ((parsedArgs as { message: string }).message ?? "").trim()
        : "";
    }

    const result = executeToolAction({
      action: name,
      ...parsedArgs,
    } as ToolArgs);
    return result;
  } catch (error) {
    console.error("Failed to handle tool call:", name, args, error);
    return "Unable to perform the task: " + name;
  }
}
