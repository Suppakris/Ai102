import { cva } from "class-variance-authority";
import { PlateElement, type PlateElementProps } from "platejs/react";
import { type CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { type TTimelineGroupElement } from "../plugins/timeline-plugin";
import { getPresentationAccentColor } from "./color-utils";

export const containerVariants = cva("mb-4 flex", {
  variants: {
    orientation: {
      horizontal: "justify-around",
      vertical: "flex-col",
    },

    sidedness: {
      single: "",
      double: "",
    },
  },
  compoundVariants: [
    {
      orientation: "horizontal",
      sidedness: "double",
      class: "my-6 py-4",
    },
  ],
});

export const lineVariants = cva("absolute transform", {
  variants: {
    orientation: {
      horizontal: "h-0.5",
      vertical: "w-0.5",
    },

    sidedness: {
      single: "",
      double: "",
    },
    alignment: {
      left: "",
      center: "",
      right: "",
    },
  },
  compoundVariants: [
    {
      orientation: "horizontal",
      sidedness: "single",
      alignment: "center",
      class:
        "top-5 right-[var(--timeline-line-inset)] left-[var(--timeline-line-inset)]",
    },

    {
      orientation: "horizontal",
      sidedness: "single",
      class:
        "top-5 right-[var(--timeline-line-inset)] left-[var(--timeline-line-inset)]",
      alignment: "left",
    },

    {
      orientation: "horizontal",
      sidedness: "single",
      class:
        "top-auto right-[var(--timeline-line-inset)] bottom-5 left-[var(--timeline-line-inset)]",
      alignment: "right",
    },

    {
      orientation: "horizontal",
      sidedness: "double",
      class:
        "top-1/2 right-[var(--timeline-line-inset)] left-[var(--timeline-line-inset)] -translate-y-1/2",
    },
    {
      orientation: "vertical",
      sidedness: "single",
      class: "top-9 bottom-9 left-5",
      alignment: "center",
    },

    {
      orientation: "vertical",
      sidedness: "single",
      class: "top-9 bottom-9 left-5",
      alignment: "left",
    },

    {
      orientation: "vertical",
      sidedness: "single",
      class: "top-9 right-5 bottom-9 left-auto",
      alignment: "right",
    },

    {
      orientation: "vertical",
      sidedness: "double",
      class: "top-9 bottom-9 left-1/2 -translate-x-1/2",
    },
  ],
});

export default function Timeline({
  element,
  children,
  ...props
}: PlateElementProps<TTimelineGroupElement>) {
  const orientation = element.orientation ?? "vertical";
  const sidedness = element.sidedness ?? "single";
  const alignment = element.alignment ?? "left";
  const showLine = element.showLine ?? true;
  const itemCount = Math.max(element.children.length, 1);
  const timelineColor = getPresentationAccentColor(
    element,
    undefined,
    "var(--presentation-smart-layout, var(--presentation-primary))",
  );
  const lineStyle = {
    backgroundColor: timelineColor,
    "--timeline-line-inset": `calc(50% / ${itemCount})`,
  } satisfies CSSProperties & { "--timeline-line-inset": string };

  return (
    <div className="relative h-max">
      {showLine ? (
        <div
          data-shape="rect"
          data-shape-role="timeline-rail"
          data-fill-color={timelineColor}
          data-orientation={orientation}
          className={cn(lineVariants({ orientation, sidedness, alignment }))}
          style={lineStyle}
        />
      ) : null}

      <PlateElement
        element={element}
        {...props}
        className={cn(
          containerVariants({ orientation, sidedness }),
          sidedness === "single" && orientation === "horizontal" && "*:flex-1",
          orientation === "horizontal" && sidedness === "double" && "*:flex-1",
        )}
      >
        {children}
      </PlateElement>
    </div>
  );
}
