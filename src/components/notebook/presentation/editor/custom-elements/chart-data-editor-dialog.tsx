"use client";

import { FileSpreadsheet, X } from "lucide-react";
import { useEffect, useRef, useState, type SyntheticEvent } from "react";

import {
  PRESENTATION_PORTAL_CONTENT_CLASS,
  PRESENTATION_PORTAL_OVERLAY_CLASS,
} from "@/components/presentation/overlay-layers";
import { Button } from "@/components/ui/button";
import {
  Credenza,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import {
  ChartDataEditor,
  type ChartDataMode,
  type ChartDataType,
  type SeriesChartType,
} from "./chart-data-editor";
import { importChartDataFromFile } from "./chart-data-editor/import-data";
import { ChartRenderer } from "./charts/ChartRenderer";

// Credenza portals its DOM to document.body, but React's synthetic events
// still bubble through the React tree, which nests this dialog under the
// Plate editor when opened from a chart's floating toolbar. Without this,
// clicks never focus the grid's inputs (swallowed as selection/pointer
// events by the editor) and keystrokes get swallowed the same way even if
// focus does land. Same fix as InfographicDataEditorDialog.
const stopEditorEventPropagation = (event: SyntheticEvent) => {
  event.stopPropagation();
};

interface ChartDataEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ChartDataType;
  onDataChange: (data: ChartDataType) => void;
  chartType: ChartDataMode;
  title?: string;
  isComposedChart?: boolean;
  seriesChartTypes?: Record<string, SeriesChartType>;
  onSeriesChartTypesChange?: (types: Record<string, SeriesChartType>) => void;
  previewChartType?: string;
  chartOptions?: Record<string, unknown>;
}

export function ChartDataEditorDialog({
  open,
  onOpenChange,
  data,
  onDataChange,
  chartType,
  title = "Edit Chart Data",
  isComposedChart = false,
  seriesChartTypes: initialSeriesChartTypes,
  onSeriesChartTypesChange,
  previewChartType,
  chartOptions,
}: ChartDataEditorDialogProps) {
  const [localData, setLocalData] = useState<ChartDataType>(data);
  const [localSeriesChartTypes, setLocalSeriesChartTypes] = useState<
    Record<string, SeriesChartType>
  >(initialSeriesChartTypes ?? {});
  const [importVersion, setImportVersion] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);

  // Sync with external data only on the closed -> open transition. Re-running
  // this on every `data` reference change (which happens periodically from
  // background re-renders while the dialog stays open) was wiping out
  // in-progress edits and remounting the grid mid-keystroke.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setLocalData(data);
      setLocalSeriesChartTypes(initialSeriesChartTypes ?? {});
      setImportError(null);
      setImportVersion((version) => version + 1);
    }
    wasOpenRef.current = open;
  }, [open, data, initialSeriesChartTypes]);

  const handleSave = () => {
    onDataChange(localData);
    if (isComposedChart && onSeriesChartTypesChange) {
      onSeriesChartTypesChange(localSeriesChartTypes);
    }
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalData(data);
    setLocalSeriesChartTypes(initialSeriesChartTypes ?? {});
    onOpenChange(false);
  };

  const handleDataChange = (newData: ChartDataType) => {
    setLocalData(newData);
  };

  const handleSeriesChartTypesChange = (
    types: Record<string, SeriesChartType>,
  ) => {
    setLocalSeriesChartTypes(types);
  };

  const handleImportFile = async (file: File) => {
    try {
      const importedData = await importChartDataFromFile(file, chartType);
      setLocalData(importedData);
      setImportVersion((version) => version + 1);
      setImportError(null);
    } catch (error) {
      try {
        setImportError(
          error instanceof Error
            ? error.message
            : "Unable to import this file.",
        );
      } catch (reactDoctorCatchError) {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        throw reactDoctorCatchError;
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const previewType = previewChartType ?? "";
  const previewOptions = {
    ...(chartOptions ?? {}),
    seriesChartTypes: localSeriesChartTypes,
    previewMode: true,
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent
        overlayClassName={PRESENTATION_PORTAL_OVERLAY_CLASS}
        shouldHaveClose={false}
        onPointerDown={stopEditorEventPropagation}
        onMouseDown={stopEditorEventPropagation}
        onClick={stopEditorEventPropagation}
        onKeyDown={stopEditorEventPropagation}
        className={`${PRESENTATION_PORTAL_CONTENT_CLASS} ignore-click-outside/toolbar pointer-events-auto flex h-[92dvh] max-h-[92dvh] w-screen max-w-none flex-col overflow-hidden rounded-t-xl p-0 sm:rounded-xl md:h-[calc(100dvh-3rem)] md:max-h-[calc(100dvh-3rem)] md:rounded-xl`}
      >
        <CredenzaHeader className="shrink-0 border-b px-4 py-3 sm:px-5 sm:py-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <CredenzaTitle>{title}</CredenzaTitle>
              <CredenzaDescription className="line-clamp-2">
                Edit the data and preview the chart before saving.
              </CredenzaDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <input
                aria-label="chart data editor dialog control"
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImportFile(file);
                }}
              />
              <Button
                variant="outline"
                className="hidden gap-2 sm:inline-flex"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="size-4" />
                Import CSV/XLSX
              </Button>
              <Button
                variant="outline"
                className="size-9 p-0 sm:hidden"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Import CSV or Excel data"
              >
                <FileSpreadsheet className="size-4" />
              </Button>
              <Button
                variant="ghost"
                className="size-9 p-0"
                onClick={handleCancel}
                aria-label="Close chart data editor"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </CredenzaHeader>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(220px,34dvh)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(320px,0.9fr)_minmax(460px,1.1fr)] lg:grid-rows-none">
          <section className="min-h-0 border-b bg-muted/20 p-3 sm:p-4 lg:border-r lg:border-b-0 lg:p-5">
            <div className="h-full min-h-0 overflow-hidden rounded-lg border bg-background p-2 sm:p-3">
              {previewType ? (
                <ChartRenderer
                  chartType={previewType}
                  chartData={localData}
                  chartOptions={previewOptions}
                  className="h-full min-h-0 border-0 shadow-none"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Chart preview unavailable.
                </div>
              )}
            </div>
          </section>

          <section className="min-h-0 overflow-auto p-3 sm:p-4 lg:p-5">
            {importError && (
              <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {importError}
              </div>
            )}
            <ChartDataEditor
              key={`${chartType}-${importVersion}`}
              data={localData}
              chartType={chartType}
              onDataChange={handleDataChange}
              isComposedChart={isComposedChart}
              seriesChartTypes={localSeriesChartTypes}
              onSeriesChartTypesChange={handleSeriesChartTypesChange}
            />
          </section>
        </div>

        <CredenzaFooter className="shrink-0 border-t px-4 py-3 sm:px-5 sm:py-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}

// Re-export types for backward compatibility
export type {
  ChartDataMode,
  ChartDataType,
  SeriesChartType,
} from "./chart-data-editor";
