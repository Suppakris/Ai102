"use client";

import { DRAG_ITEM_BLOCK, type ElementDragItemNode } from "@platejs/dnd";
import {
  Copy,
  Download,
  Edit,
  ExternalLink,
  FileText,
  Link2,
  Maximize2,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useDrop } from "react-dnd";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  usePresentationState,
  type ImageEditorMode,
} from "@/states/presentation-state";
import { type RootImage } from "../../../utils/parser";

interface ImageSlideProps {
  image: RootImage;
  slideId: string;
}

export default function ImageSlide({ image, slideId }: ImageSlideProps) {
  const slides = usePresentationState((s) => s.slides);
  const isPresenting = usePresentationState((s) => s.isPresenting);
  const setSlides = usePresentationState((s) => s.setSlides);
  const setCurrentSlide = usePresentationState((s) => s.setCurrentSlideId);
  const openImageEditor = usePresentationState((s) => s.openImageEditor);
  const stockImageProvider = usePresentationState((s) => s.stockImageProvider);
  const setImageSearchState = usePresentationState(
    (s) => s.setImageSearchState,
  );
  const rootImageGeneration = usePresentationState(
    (s) => s.rootImageGeneration,
  );

  const rawComputedGen = rootImageGeneration[slideId];
  const imageQuery = image.query.trim();
  const computedGen =
    rawComputedGen &&
    (!imageQuery || rawComputedGen.query.trim() === imageQuery)
      ? rawComputedGen
      : undefined;
  const computedImageUrl = computedGen?.url ?? image.url;
  const isGenerating =
    image.isQueryStreaming ||
    computedGen?.status === "queued" ||
    computedGen?.status === "generating";

  const handleAction = (action: string) => {
    switch (action) {
      case "copy":
        if (computedImageUrl) {
          fetch(computedImageUrl)
            .then((response) => response.blob())
            .then((blob) => {
              const item = new ClipboardItem({ [blob.type]: blob });
              navigator.clipboard.write([item]);
              toast("Image copied to clipboard");
            })
            .catch((err) => {
              console.error("Failed to copy image:", err);
              toast("Failed to copy image");
            });
        }
        break;
      case "copyAddress":
        if (computedImageUrl) {
          navigator.clipboard.writeText(computedImageUrl);
          toast("Image address copied to clipboard");
        }
        break;
      case "openNewTab":
        if (computedImageUrl) {
          window.open(computedImageUrl, "_blank");
        }
        break;
      case "download":
        if (computedImageUrl) {
          const link = document.createElement("a");
          link.href = computedImageUrl;
          link.download = "downloaded-image";
          link.click();
        }
        break;
      case "replace":
        setCurrentSlide(slideId);
        const mode: ImageEditorMode =
          image.imageSource === "search"
            ? "search"
            : image.imageSource === "gif"
              ? "gif"
              : "generate";
        if (mode === "search") {
          setImageSearchState({
            mode: image.stockImageProvider ?? stockImageProvider,
          });
        }
        openImageEditor(mode);
        break;
      case "fit":
        updateCropSettings({
          ...image.cropSettings,
          objectFit:
            image.cropSettings?.objectFit === "contain" ? "cover" : "contain",
          objectPosition: image.cropSettings?.objectPosition ?? {
            x: 50,
            y: 50,
          },
        });
        break;
      case "convertToSlide":
        // Convert this image slide back to a regular slide
        const updatedSlides = slides.map((slide) => {
          if (slide.id === slideId) {
            return {
              ...slide,
              isImageSlide: false,
              layoutType: "left" as const, // Set a default layout
              content:
                slide.content.length > 0
                  ? slide.content
                  : [{ type: "h1", children: [{ text: "" }] }],
            };
          }
          return slide;
        });
        setSlides(updatedSlides);
        toast("Converted to slide");
        break;
      case "removeSlide":
        // Remove this slide entirely
        const filteredSlides = slides.filter((slide) => slide.id !== slideId);
        setSlides(filteredSlides);
        toast("Slide removed");
        break;
      default:
        console.log(`Action: ${action}`);
    }
  };

  const updateCropSettings = (newCropSettings: typeof image.cropSettings) => {
    const updatedSlides = slides.map((slide) => {
      if (slide.id === slideId && slide.rootImage) {
        return {
          ...slide,
          rootImage: {
            ...slide.rootImage,
            cropSettings: newCropSettings,
          },
        };
      }
      return slide;
    });
    setSlides(updatedSlides);
  };

  // Drop zone for accepting draggable elements
  const [{ isOver, canDrop }, dropRef] = useDrop<
    ElementDragItemNode,
    void,
    { isOver: boolean; canDrop: boolean }
  >({
    accept: DRAG_ITEM_BLOCK,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
    drop: (dragItem) => {
      // Get the dropped element from dragItem
      const droppedElement = dragItem.element;
      if (!droppedElement) {
        toast.error("Could not get dropped element");
        return;
      }

      // Convert image slide to normal slide with image as background
      // and add the dropped element to the content
      const updatedSlides = slides.map((slide) => {
        if (slide.id === slideId) {
          // Create new content array with the dropped element
          const newContent = Array.isArray(droppedElement)
            ? [...droppedElement]
            : [droppedElement];

          return {
            ...slide,
            isImageSlide: false,
            layoutType: "background" as const,
            // Keep the rootImage so it becomes the background
            rootImage: slide.rootImage,
            // Add the dropped element to content
            content: newContent as typeof slide.content,
          };
        }
        return slide;
      });
      setSlides(updatedSlides);
      toast.success("Element added to slide");
    },
  });

  const isDropActive = isOver && canDrop;

  return (
    <div
      ref={dropRef as unknown as React.Ref<HTMLDivElement>}
      className={cn(
        "relative w-full",
        // Present mode already sizes/centers the slide to the viewport; a
        // fixed 16:9 box here fights that on any non-16:9 viewport, leaving
        // the image smaller than the screen and not vertically centered.
        isPresenting ? "h-full" : "aspect-video",
      )}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "flex size-full cursor-pointer items-center justify-center",
              "relative overflow-hidden",
            )}
            onDoubleClick={() => {
              setCurrentSlide(slideId);
              const mode: ImageEditorMode =
                image.imageSource === "search"
                  ? "search"
                  : image.imageSource === "gif"
                    ? "gif"
                    : "generate";
              if (mode === "search") {
                setImageSearchState({
                  mode: image.stockImageProvider ?? stockImageProvider,
                });
              }
              openImageEditor(mode);
            }}
          >
            {isGenerating ? (
              <div className="absolute inset-0 z-10 flex size-full flex-col items-center justify-center gap-3 bg-muted/30 p-4 text-center">
                <Spinner className="size-8" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Generating image
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This can take a moment.
                  </p>
                </div>
              </div>
            ) : computedImageUrl ? (
              <Image
                unoptimized
                width={400}
                height={300}
                src={computedImageUrl}
                alt={image.query}
                className="size-full"
                style={{
                  objectFit: image.cropSettings?.objectFit ?? "cover",
                  objectPosition: image.cropSettings?.objectPosition
                    ? `${image.cropSettings.objectPosition.x}% ${image.cropSettings.objectPosition.y}%`
                    : "center",
                }}
              />
            ) : (
              <div className="flex items-center justify-center text-muted-foreground">
                <span>
                  {computedGen?.status === "error"
                    ? "Image not found"
                    : "No image"}
                </span>
              </div>
            )}
            {/* Drop indicator overlay */}
            {isDropActive && (
              <div className="absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed border-primary bg-primary/20">
                <div className="rounded-md bg-background/90 px-4 py-2 shadow-lg">
                  <span className="text-sm font-medium text-primary">
                    Drop to add element
                  </span>
                </div>
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <ContextMenuItem onClick={() => handleAction("copy")}>
            <Copy className="mr-2 size-4" />
            Copy
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction("copyAddress")}>
            <Link2 className="mr-2 size-4" />
            Copy image address
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction("openNewTab")}>
            <ExternalLink className="mr-2 size-4" />
            Open image in new tab
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction("download")}>
            <Download className="mr-2 size-4" />
            Download image
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => handleAction("replace")}>
            <Edit className="mr-2 size-4" />
            Replace image…
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleAction("fit")}>
            <Maximize2 className="mr-2 size-4" />
            {image.cropSettings?.objectFit === "contain"
              ? "Cover Image"
              : "Fit Image"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => handleAction("convertToSlide")}>
            <FileText className="mr-2 size-4" />
            Convert to slide
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => handleAction("removeSlide")}
            className="text-red-500 focus:bg-red-50 focus:text-red-500"
          >
            <Trash2 className="mr-2 size-4" />
            Remove slide
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
