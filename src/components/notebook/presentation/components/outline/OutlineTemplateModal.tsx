"use client";

import { Check, ChevronRight, LayoutGrid, Menu, X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Credenza,
  CredenzaContent,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMediaQuery } from "@/hooks/globals/useMediaQuery";
import { cn } from "@/lib/utils";
import { usePresentationState } from "@/states/presentation-state";
import {
  isTemplateSelected,
  removeTemplateSelection,
  TEMPLATE_CATEGORIES,
  TEMPLATE_DEFINITIONS,
  type TemplateDefinition,
} from "../../utils/templates";
import { persistOutlineLayoutSelection } from "./persistOutlineLayoutSelection";

interface SelectableTemplateCardProps {
  template: TemplateDefinition;
  isSelected: boolean;
  onToggle: () => void;
  atLimit?: boolean;
}

function SelectableTemplateCard({
  template,
  isSelected,
  onToggle,
  atLimit,
}: SelectableTemplateCardProps) {
  const dimmed = atLimit && !isSelected;

  return (
    <motion.button
      // Deliberately NOT a native `disabled` button even when at the
      // selection limit: onToggle still needs to fire so it can tell the
      // user why the click did nothing (see handleTemplateToggle) instead
      // of the click silently going nowhere, which read as the selection
      // "sometimes sticking, sometimes not" for no visible reason.
      onClick={onToggle}
      className={cn(
        "group relative flex flex-col gap-2 text-left",
        dimmed && "cursor-not-allowed opacity-50",
      )}
      whileHover={!dimmed ? { scale: 1.02 } : undefined}
      whileTap={!dimmed ? { scale: 0.98 } : undefined}
    >
      <div
        className={cn(
          "aspect-4/3 w-full overflow-hidden rounded-lg border bg-card shadow transition-all",
          isSelected
            ? "border-primary ring-2 ring-primary/20"
            : "border-border group-hover:border-primary/50 group-hover:shadow-md",
        )}
      >
        {template.preview}
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-xs font-medium",
            isSelected
              ? "text-foreground"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        >
          {template.name}
        </span>
      </div>
    </motion.button>
  );
}

interface OutlineTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "global" | "single";
  outlineId?: string; // Only for "single" mode
}

export function OutlineTemplateModal({
  isOpen,
  onClose,
  mode,
  outlineId,
}: OutlineTemplateModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  const {
    selectedSlideTemplates,
    setSelectedSlideTemplates,
    numSlides,
    outlineTemplateOverrides,
    setOutlineTemplateOverride,
  } = usePresentationState();

  const singleTemplateId =
    mode === "single" && outlineId ? outlineTemplateOverrides[outlineId] : null;

  useEffect(() => {
    if (isOpen) {
      setIsSidebarVisible(isDesktop);
    }
  }, [isDesktop, isOpen]);

  const effectiveSelection =
    mode === "global"
      ? selectedSlideTemplates
      : singleTemplateId
        ? [singleTemplateId]
        : [];

  const filteredTemplates = selectedCategory
    ? TEMPLATE_DEFINITIONS.filter((t) => t.categoryId === selectedCategory)
    : TEMPLATE_DEFINITIONS;

  const handleTemplateToggle = useCallback(
    (templateId: string) => {
      const template = TEMPLATE_DEFINITIONS.find(
        (item) => item.id === templateId,
      );

      if (!template) {
        return;
      }

      if (mode === "global") {
        const isSelected = isTemplateSelected(selectedSlideTemplates, template);
        if (isSelected) {
          setSelectedSlideTemplates(
            removeTemplateSelection(selectedSlideTemplates, template),
          );
        } else if (selectedSlideTemplates.length < numSlides) {
          setSelectedSlideTemplates([...selectedSlideTemplates, templateId]);
        } else {
          toast.info(
            `You've already selected a layout for all ${numSlides} slides. Remove one first, or use "Clear all" to start over.`,
          );
          return;
        }

        void persistOutlineLayoutSelection();
      } else {
        // Single mode - one explicit layout per outline item.
        const isSelected = singleTemplateId
          ? isTemplateSelected([singleTemplateId], template)
          : false;
        const nextTemplateId = isSelected ? null : templateId;

        if (outlineId) {
          setOutlineTemplateOverride(outlineId, nextTemplateId);
          void persistOutlineLayoutSelection();
        }
      }
    },
    [
      mode,
      selectedSlideTemplates,
      setSelectedSlideTemplates,
      numSlides,
      singleTemplateId,
      outlineId,
      setOutlineTemplateOverride,
    ],
  );

  const handleClearAll = () => {
    if (mode === "global") {
      setSelectedSlideTemplates([]);
    } else if (outlineId) {
      setOutlineTemplateOverride(outlineId, null);
    }

    void persistOutlineLayoutSelection();
  };

  const handleApply = () => {
    onClose();
  };

  const getTemplatesByCategory = (categoryId: string) =>
    TEMPLATE_DEFINITIONS.filter((t) => t.categoryId === categoryId);

  const selectionLimit = mode === "global" ? numSlides : 1;
  const isAtLimit =
    mode === "global" && effectiveSelection.length >= selectionLimit;

  const renderTemplateGrid = (templates: TemplateDefinition[]) => (
    <div className="grid grid-cols-2 gap-3 p-1 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
      {templates.map((template) => (
        <SelectableTemplateCard
          key={template.id}
          template={template}
          isSelected={isTemplateSelected(effectiveSelection, template)}
          onToggle={() => handleTemplateToggle(template.id)}
          atLimit={
            isAtLimit && !isTemplateSelected(effectiveSelection, template)
          }
        />
      ))}
    </div>
  );

  return (
    <Credenza
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <CredenzaContent
        shouldHaveClose={false}
        className="h-[92dvh] max-h-[92dvh] max-w-250 gap-0 overflow-hidden p-0 md:h-auto"
      >
        <CredenzaHeader className="border-b px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {isDesktop && (
                <Button
                  onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                  variant="ghost"
                  size="icon"
                  className="size-8"
                >
                  <Menu className="size-4" />
                </Button>
              )}
              <div className="min-w-0">
                <CredenzaTitle>
                  {mode === "global" ? "Select Layouts" : "Select Layout"}
                </CredenzaTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {effectiveSelection.length}/{selectionLimit} selected
                </p>
              </div>
            </div>
            {isDesktop && (
              <div className="flex items-center gap-2">
                {effectiveSelection.length > 0 && (
                  <Button
                    onClick={handleClearAll}
                    variant="outline"
                    size="sm"
                    className="h-8"
                  >
                    Clear All
                  </Button>
                )}
                <Button onClick={handleApply} size="sm" className="h-8">
                  {mode === "global" ? "Done" : "Apply"}
                </Button>
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="icon"
                  className="size-8"
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}
            {!isDesktop && (
              <Button
                onClick={onClose}
                variant="ghost"
                size="icon"
                className="size-8"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </CredenzaHeader>

        {isDesktop ? (
          <div className="flex h-[70vh]">
            {/* Sidebar */}
            {isSidebarVisible && (
              <div className="w-60 border-r bg-muted/30">
                <ScrollArea className="h-full space-y-2 p-3">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(null)}
                    className={cn(
                      "mb-1 flex w-full items-center gap-2 rounded-lg p-4 text-sm transition-colors",
                      selectedCategory === null
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                    )}
                  >
                    <LayoutGrid className="size-4" />
                    <span>All Templates</span>
                  </button>
                  {TEMPLATE_CATEGORIES.map((category) => (
                    <button
                      type="button"
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg p-4 text-sm transition-colors",
                        selectedCategory === category.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {category.icon}
                        <span>{category.name}</span>
                      </div>
                      <ChevronRight className="size-4" />
                    </button>
                  ))}
                </ScrollArea>
              </div>
            )}

            {/* Content */}
            <ScrollArea className="flex-1 overflow-x-visible p-5">
              {selectedCategory === null ? (
                <div className="space-y-8 px-1">
                  {TEMPLATE_CATEGORIES.map((category) => {
                    const categoryTemplates = getTemplatesByCategory(
                      category.id,
                    );
                    if (categoryTemplates.length === 0) return null;
                    return (
                      <section key={category.id}>
                        <div className="mb-3 flex items-center gap-2">
                          {category.icon}
                          <h3 className="text-sm font-medium">
                            {category.name}
                          </h3>
                        </div>
                        {renderTemplateGrid(categoryTemplates)}
                      </section>
                    );
                  })}
                </div>
              ) : (
                renderTemplateGrid(filteredTemplates)
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="overflow-x-auto border-b">
              <div className="flex w-max gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                    selectedCategory === null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <LayoutGrid className="size-4" />
                  <span>All Layouts</span>
                </button>
                {TEMPLATE_CATEGORIES.map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                      selectedCategory === category.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted",
                    )}
                  >
                    {category.icon}
                    <span>{category.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 px-4 py-4">
              {selectedCategory === null ? (
                <div className="space-y-6">
                  {TEMPLATE_CATEGORIES.map((category) => {
                    const categoryTemplates = getTemplatesByCategory(
                      category.id,
                    );
                    if (categoryTemplates.length === 0) return null;
                    return (
                      <section key={category.id}>
                        <div className="mb-3 flex items-center gap-2">
                          {category.icon}
                          <h3 className="text-sm font-medium">
                            {category.name}
                          </h3>
                        </div>
                        {renderTemplateGrid(categoryTemplates)}
                      </section>
                    );
                  })}
                </div>
              ) : (
                renderTemplateGrid(filteredTemplates)
              )}
            </ScrollArea>

            <div className="flex flex-col gap-2 border-t px-4 py-3">
              {effectiveSelection.length > 0 && (
                <Button onClick={handleClearAll} variant="outline">
                  Clear All
                </Button>
              )}
              <Button onClick={handleApply}>
                {mode === "global" ? "Done" : "Apply"}
              </Button>
            </div>
          </div>
        )}
      </CredenzaContent>
    </Credenza>
  );
}
