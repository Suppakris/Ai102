"use client";

import {
  Blocks,
  CaseSensitive,
  ChartPie,
  Edit3,
  ImageIcon,
  Link as LinkIcon,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { IconPickerPanel } from "@/components/ui/icon-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  usePresentationState,
  type RightPanelType,
} from "@/states/presentation-state";
import { PresentationAgentPanel } from "../agent/PresentationAgentPanel";
import { GlobalSettings } from "../controls/global-settings/GlobalSettings";
import { LayoutEditorPanel } from "../floating-toolbar/LayoutPreviewSheet";
import { FLOATING_TOOLBAR_IGNORE_CLASS } from "../floating-toolbar/toolbar-interaction";
import { BackgroundPanel } from "./sections/BackgroundPanel";
import { BasicBlocksPanel } from "./sections/BasicBlocksPanel";
import { ChartEditorPanel } from "./sections/ChartEditorPanel";
import { ChartPanel } from "./sections/ChartPanel";
import { ElementsPanel } from "./sections/ElementsPanel";
import { ImageEditorPanel } from "./sections/ImageEditorPanel";
import { InfographicGenerationPanel } from "./sections/InfographicGenerationPanel";
import { MediaEmbedPanel } from "./sections/MediaEmbedPanel";
import { PresentationImageEditorPanel } from "./sections/PresentationImageEditorPanel";
import { ThemePanel } from "./sections/ThemePanel";

const PANEL_ARROW_TARGET_SELECTOR = "[data-panel-arrow-target='true']";
const ARROW_NAVIGATION_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);
const RIGHT_PANEL_WIDTH = "26rem";
const RIGHT_PANEL_ANIMATION_DURATION_MS = 300;
const PANEL_CONTENT_LOAD_DELAY_MS = RIGHT_PANEL_ANIMATION_DURATION_MS + 50;
const IMMEDIATE_LOAD_PANELS: RightPanelType[] = ["basicBlocks", "elements"];

// Panel titles and icons for panels that need our generic header
const PANEL_INFO = {
  basicBlocks: {
    title: "Text",
    icon: <CaseSensitive className="size-4 text-primary" />,
  },
  elements: {
    title: "Add elements",
    icon: <Blocks className="size-4 text-primary" />,
  },
  charts: {
    title: "Add Charts",
    icon: <ChartPie className="size-4 text-primary" />,
  },
  embed: {
    title: "Media Embeds",
    icon: <LinkIcon className="size-4 text-primary" />,
  },
  background: {
    title: "Background",
    icon: <ImageIcon className="size-4 text-primary" />,
  },
  layoutEditor: {
    title: "Edit layout",
    icon: <Edit3 className="size-4 text-primary" />,
  },
  iconPicker: {
    title: "Choose icon",
    icon: <Sparkles className="size-4 text-primary" />,
  },
} as const;

// Panels that have their own complete structure (header, styling, etc.)
const SELF_CONTAINED_PANELS: RightPanelType[] = [
  "agent",
  "globalSettings",
  "theme",
  "imageEditor",
  "chartEditor",
  "infographicGenerationEditor",
  "presentationImageEditor",
];

function PanelHeader({
  panel,
  onClose,
}: {
  panel: RightPanelType;
  onClose: () => void;
}) {
  const info = PANEL_INFO[panel as keyof typeof PANEL_INFO];
  if (!info) return null;

  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex items-center gap-2">
        {info.icon}
        <h2 className="text-sm font-semibold tracking-wide">{info.title}</h2>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="size-8 rounded-full p-0 hover:bg-muted"
      >
        <X className="size-5" />
      </Button>
    </div>
  );
}

function PanelContent({
  isLoaded,
  panel,
}: {
  isLoaded: boolean;
  panel: RightPanelType;
}) {
  switch (panel) {
    case "basicBlocks":
      return <BasicBlocksPanel isLoaded={isLoaded} />;
    case "elements":
      return <ElementsPanel isLoaded />;
    case "charts":
      return <ChartPanel isLoaded />;
    case "embed":
      return <MediaEmbedPanel />;
    case "background":
      return (
        <ScrollArea className="max-h-full flex-1 p-4">
          <BackgroundPanel />
        </ScrollArea>
      );
    case "theme":
      return <ThemePanel />;
    case "agent":
      return <PresentationAgentPanel />;
    case "globalSettings":
      return <GlobalSettings />;
    case "imageEditor":
      return <ImageEditorPanel />;
    case "chartEditor":
      return <ChartEditorPanel />;
    case "infographicGenerationEditor":
      return <InfographicGenerationPanel />;
    case "presentationImageEditor":
      return <PresentationImageEditorPanel />;
    case "layoutEditor":
      return <LayoutEditorPanel isLoaded={isLoaded} />;
    case "iconPicker":
      return <IconPickerPanel />;
    default:
      return null;
  }
}

export function RightPanelRenderer() {
  const activeRightPanel = usePresentationState((s) => s.activeRightPanel);
  const setActiveRightPanel = usePresentationState(
    (s) => s.setActiveRightPanel,
  );
  const closeIconPicker = usePresentationState((s) => s.closeIconPicker);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [loadedPanel, setLoadedPanel] = useState<RightPanelType>(null);

  const handleClose = () => {
    if (activeRightPanel === "iconPicker") {
      closeIconPicker();
      return;
    }

    setActiveRightPanel(null);
  };

  const isSelfContained =
    activeRightPanel && SELF_CONTAINED_PANELS.includes(activeRightPanel);
  const shouldLoadImmediately =
    activeRightPanel && IMMEDIATE_LOAD_PANELS.includes(activeRightPanel);
  const isPanelLoaded =
    Boolean(shouldLoadImmediately) || loadedPanel === activeRightPanel;

  useEffect(() => {
    if (!activeRightPanel) {
      setLoadedPanel(null);
      return;
    }

    if (IMMEDIATE_LOAD_PANELS.includes(activeRightPanel)) {
      setLoadedPanel(activeRightPanel);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLoadedPanel(activeRightPanel);
    }, PANEL_CONTENT_LOAD_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeRightPanel]);

  const focusPanelArrowTarget = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return null;

    const activeTarget = panel.querySelector<HTMLElement>(
      `${PANEL_ARROW_TARGET_SELECTOR}[tabindex='0']`,
    );
    const fallbackTarget = panel.querySelector<HTMLElement>(
      PANEL_ARROW_TARGET_SELECTOR,
    );
    const target = activeTarget ?? fallbackTarget;

    target?.focus();
    return target;
  }, []);

  useEffect(() => {
    if (!activeRightPanel) return;

    const animationFrameId = window.requestAnimationFrame(() => {
      focusPanelArrowTarget();
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeRightPanel, focusPanelArrowTarget]);

  useEffect(() => {
    if (!activeRightPanel) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!ARROW_NAVIGATION_KEYS.has(event.key)) return;

      const panel = panelRef.current;
      const targetNode = event.target;

      if (!panel || !(targetNode instanceof Node)) return;
      if (panel.contains(targetNode)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const panelTarget = focusPanelArrowTarget();
      if (!panelTarget) return;

      panelTarget.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: event.key,
          code: event.code,
          bubbles: true,
          cancelable: true,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
        }),
      );
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [activeRightPanel, focusPanelArrowTarget]);

  return (
    <AnimatePresence>
      {activeRightPanel && (
        <motion.div
          key="right-panel"
          initial={{ width: 0, opacity: 0.5 }}
          animate={{ width: RIGHT_PANEL_WIDTH, opacity: 1 }}
          exit={{ width: 0, opacity: 0.5 }}
          transition={{
            duration: RIGHT_PANEL_ANIMATION_DURATION_MS / 1000,
            ease: "easeInOut",
          }}
          className="h-full shrink-0 overflow-hidden"
        >
          <div
            ref={panelRef}
            className={`${FLOATING_TOOLBAR_IGNORE_CLASS} flex h-full w-104 shrink-0 flex-col border-l bg-background`}
          >
            {!isSelfContained && (
              <PanelHeader panel={activeRightPanel} onClose={handleClose} />
            )}
            <div className="flex-1 overflow-hidden">
              <PanelContent isLoaded={isPanelLoaded} panel={activeRightPanel} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
