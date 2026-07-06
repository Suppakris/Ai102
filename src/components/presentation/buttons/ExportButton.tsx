// components/export-ppt-button.tsx
"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { raiseError } from "@/lib/raise-error";
import { usePresentationState } from "@/states/presentation-state";
import { scanAllSlides } from "../export/domSlideScanner";
import { exportPresentationToPdf } from "../export/domToPdfConverter";
import { exportPresentationToPptx } from "../export/domToPptxConverter";

type ExportFormat = "pptx" | "pdf";

const EXPORT_SUCCESS_TOAST_DURATION_MS = 10000;
const FALLBACK_DOWNLOAD_LINK_TTL_MS = 60000;

function startDownload(blob: Blob, fileName: string) {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, FALLBACK_DOWNLOAD_LINK_TTL_MS);

  return downloadUrl;
}

export function ExportButton() {
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pptx");
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      setIsExporting(true);

      // Get all slide IDs
      const { slides, currentPresentationTitle } =
        usePresentationState.getState();
      const slideIds = slides.map((slide) => slide.id);

      if (slideIds.length === 0) {
        raiseError(new Error("No slides to export"));
      }

      const formatLabel = exportFormat === "pdf" ? "PDF" : "PowerPoint";

      // Show single toast with loader
      const { update, dismiss } = toast({
        title: "Exporting Presentation",
        description: (
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            <span>{"Scanning slides..."}</span>
          </div>
        ),
        duration: Infinity, // Keep open until we dismiss
      });

      const result =
        exportFormat === "pdf"
          ? await exportPresentationToPdf(
              slides,
              currentPresentationTitle ?? "presentation",
              (completedCount, total) => {
                update({
                  description: (
                    <div className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      <span>{`Rendering slide ${completedCount}/${total}...`}</span>
                    </div>
                  ),
                });
              },
            )
          : await (async () => {
              // Scan all slides in the DOM (now parallel)
              const scanResults = await scanAllSlides(slides);

              if (scanResults.length === 0) {
                raiseError(
                  new Error(
                    "Failed to scan slides. Please ensure all slides are visible on the page.",
                  ),
                );
              }

              update({
                description: (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    <span>{"Generating PowerPoint..."}</span>
                  </div>
                ),
              });

              return exportPresentationToPptx(
                scanResults,
                slides,
                currentPresentationTitle ?? "presentation",
              );
            })();

      const downloadUrl = startDownload(result.blob, result.fileName);

      dismiss();

      toast({
        title: "Export Complete",
        description: (
          <p>
            {`${formatLabel} download has started. If it did not start,`}{" "}
            <a
              className="font-medium text-foreground underline underline-offset-4"
              download={result.fileName}
              href={downloadUrl}
            >
              {"click here"}
            </a>
            .
          </p>
        ),
        duration: EXPORT_SUCCESS_TOAST_DURATION_MS,
      });

      setIsExportDialogOpen(false);
    } catch (error) {
      toast({
        title: "Export Failed",
        description:
          error instanceof Error
            ? error.message
            : "There was an error exporting your presentation.",
        variant: "destructive",
      });
      console.error("Export error:", error);
      setIsExporting(false);
    }
    setIsExporting(false);
  };

  return (
    <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative size-9 px-0 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
        >
          <span className="sr-only">
            Export presentation
          </span>
          <Download className="size-4 sm:mr-1" />
          <span className="hidden sm:inline">
            Export
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Export Presentation
          </DialogTitle>
          <DialogDescription>
            Choose a format to export your presentation.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label className="mb-2 block">
            Export Format
          </Label>
          <RadioGroup
            value={exportFormat}
            onValueChange={(value) => setExportFormat(value as ExportFormat)}
            className="grid gap-4"
          >
            <Label
              htmlFor="pptx"
              className={`flex cursor-pointer items-start space-x-4 rounded-xl border p-4 transition-all hover:bg-accent hover:text-accent-foreground ${
                exportFormat === "pptx"
                  ? "border-primary bg-accent/50 ring ring-primary"
                  : "border-border"
              }`}
            >
              <RadioGroupItem value="pptx" id="pptx" className="mt-3" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Download className="size-5" />
                  </div>
                  <div>
                    <span className="block text-base font-semibold">
                      PowerPoint (.pptx)
                    </span>
                    <p className="text-sm leading-snug text-muted-foreground">
                      Standard PowerPoint file
                    </p>
                  </div>
                </div>
              </div>
            </Label>
            <Label
              htmlFor="pdf"
              className={`flex cursor-pointer items-start space-x-4 rounded-xl border p-4 transition-all hover:bg-accent hover:text-accent-foreground ${
                exportFormat === "pdf"
                  ? "border-primary bg-accent/50 ring ring-primary"
                  : "border-border"
              }`}
            >
              <RadioGroupItem value="pdf" id="pdf" className="mt-3" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Download className="size-5" />
                  </div>
                  <div>
                    <span className="block text-base font-semibold">
                      PDF (.pdf)
                    </span>
                    <p className="text-sm leading-snug text-muted-foreground">
                      One page per slide, image-based
                    </p>
                  </div>
                </div>
              </div>
            </Label>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsExportDialogOpen(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Exporting…
              </>
            ) : (
              `Export to ${exportFormat === "pdf" ? "PDF" : "PowerPoint"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
