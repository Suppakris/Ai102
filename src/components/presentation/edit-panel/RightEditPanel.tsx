"use client";

import {
  Blocks,
  CaseSensitive,
  ChartPie,
  Link as LinkIcon,
} from "lucide-react";

import { HelpMenu } from "@/components/sidebar/help-menu";
import { Button } from "@/components/ui/button";
import { usePresentationState } from "@/states/presentation-state";
import { ZoomControl } from "../controls/ZoomControl";

const RIGHT_PANEL_BUTTON_CLASSNAME =
  "size-12 text-foreground hover:bg-accent hover:text-accent-foreground";

export function RightEditPanel() {
  const setActiveRightPanel = usePresentationState(
    (s) => s.setActiveRightPanel,
  );

  return (
    <div className="fixed right-3 bottom-4 z-30 flex justify-end lg:sticky lg:top-0 lg:right-auto lg:bottom-auto lg:z-10 lg:h-[calc(100dvh-4rem)] lg:flex-col lg:justify-between lg:px-3 lg:pr-6">
      <div className="flex flex-col items-end gap-3 lg:hidden">
        <HelpMenu hideKeyboardShortcutsOnMobile />
      </div>

      <div className="sheet-container relative hidden w-full max-w-max items-center justify-center gap-1 rounded-2xl border border-border/70 bg-background/95 px-2 py-2 shadow-lg backdrop-blur lg:flex lg:flex-1 lg:items-center lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none">
        <div className="flex items-center gap-1 rounded-2xl border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur-md lg:absolute lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:flex-col lg:gap-3">
          <Button
            size="icon"
            variant="ghost"
            className={RIGHT_PANEL_BUTTON_CLASSNAME}
            onClick={() => setActiveRightPanel("basicBlocks")}
          >
            <CaseSensitive className="size-5" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className={RIGHT_PANEL_BUTTON_CLASSNAME}
            onClick={() => setActiveRightPanel("elements")}
          >
            <Blocks className="size-5" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className={RIGHT_PANEL_BUTTON_CLASSNAME}
            onClick={() => setActiveRightPanel("charts")}
          >
            <ChartPie className="size-5" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className={RIGHT_PANEL_BUTTON_CLASSNAME}
            onClick={() => setActiveRightPanel("embed")}
          >
            <LinkIcon className="size-5" />
          </Button>
        </div>
        <div className="ml-1 flex items-center gap-1 rounded-2xl border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur-md lg:absolute lg:bottom-4 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:flex-col">
          <ZoomControl />
          <HelpMenu hideKeyboardShortcutsOnMobile />
        </div>
      </div>
    </div>
  );
}
