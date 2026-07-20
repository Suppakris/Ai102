"use client";

import { DRAG_ITEM_BLOCK } from "@platejs/dnd";
import { GripVertical } from "lucide-react";
import { useMemo, useState } from "react";
import { useDrag } from "react-dnd";
import { toast } from "sonner";

import {
  createMediaEmbedNode,
  mediaEmbedItems,
  type MediaEmbedItem,
} from "@/components/plate/ui/media-embeds";
import { useDebouncedSave } from "@/hooks/presentation/useDebouncedSave";
import { cn } from "@/lib/utils";
import { usePresentationState } from "@/states/presentation-state";
import { PanelSearchFilter } from "./PanelSearchFilter";
import { matchesPanelSearch } from "./PanelSearchFilter";

function getMediaFilterValue(item: MediaEmbedItem): string {
  return item.embedType === "youtube" ? "video" : "web";
}

export function MediaEmbedPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredItems = useMemo(
    () =>
      mediaEmbedItems.filter((item) => {
        const category = getMediaFilterValue(item);

        return matchesPanelSearch(searchQuery, [
          item.label,
          item.description,
          item.embedType,
          category,
        ]);
      }),
    [searchQuery],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PanelSearchFilter
        onQueryChange={setSearchQuery}
        placeholder="Search embeds..."
        query={searchQuery}
      />
      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-4 scrollbar-thumb-primary scrollbar-track-transparent">
        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {filteredItems.map((item) => (
              <MediaEmbedCard key={item.key} item={item} />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No embeds match your search.
          </div>
        )}
      </div>
    </div>
  );
}

function MediaEmbedCard({ item }: { item: MediaEmbedItem }) {
  const currentSlideId = usePresentationState((s) => s.currentSlideId);
  const slides = usePresentationState((s) => s.slides);
  const setSlides = usePresentationState((s) => s.setSlides);
  const { saveImmediately } = useDebouncedSave();

  const [{ isDragging }, drag] = useDrag(() => ({
    type: DRAG_ITEM_BLOCK,
    item: {
      id: `external-media-${item.key}`,
      element: createMediaEmbedNode(item.embedType),
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }));

  const selectEmbedType = () => {
    const currentSlide = slides.find((s) => s.id === currentSlideId);

    if (currentSlide) {
      setSlides(
        slides.map((slide) =>
          slide.id === currentSlideId
            ? {
                ...slide,
                rootImage: {
                  ...(slide.rootImage ?? { query: "" }),
                  embedType: item.embedType,
                  url: "", // Clear URL so user can enter a new one
                  chartType: undefined, // Clear chart type since we're switching to embed
                  chartData: undefined,
                  chartOptions: undefined,
                },
              }
            : slide,
        ),
      );
      void saveImmediately();
      toast.success(`Changed to ${item.label} embed`);
    } else {
      toast.error("Please select a root image first");
    }
  };

  return (
    <div
      ref={(el) => {
        if (el) drag(el);
      }}
      onClick={selectEmbedType}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center justify-center space-y-3 rounded-xl border border-border/50 p-5 transition-all duration-300 hover:shadow-lg",
        "bg-card hover:bg-secondary/50",
        "hover:-translate-y-1 hover:scale-105 hover:border-border",
        isDragging && "scale-95 opacity-50",
      )}
    >
      <div className="absolute top-2 left-2">
        <GripVertical className="size-4 cursor-grab text-muted-foreground transition-colors group-hover:text-foreground active:cursor-grabbing" />
      </div>
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-lg text-3xl shadow transition-all duration-300 group-hover:scale-110",
          "bg-muted",
        )}
      >
        {item.icon}
      </div>
      <div className="text-center">
        <div className="text-sm font-bold text-foreground">{item.label}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {item.description}
        </div>
      </div>
    </div>
  );
}
