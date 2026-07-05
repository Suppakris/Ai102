"use client";

import { createLogger } from "@/lib/observability/logger";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import {
  getSelectedModel,
  setSelectedModel,
  useLocalModels,
} from "@/hooks/presentation/useLocalModels";
import { usePresentationState } from "@/states/presentation-state";
import { Cpu, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

const modelPickerLogger = createLogger("client:model-picker");

export function ModelPicker({
  shouldShowLabel = true,
}: {
  shouldShowLabel?: boolean;
}) {
  const { setModelProvider, modelId, setModelId } = usePresentationState();

  const { data: modelsData, isLoading, isInitialLoad } = useLocalModels();
  const hasRestoredFromStorage = useRef(false);

  useEffect(() => {
    if (!hasRestoredFromStorage.current) {
      const savedModel = getSelectedModel();
      if (savedModel?.modelProvider === "ollama" && savedModel.modelId) {
        modelPickerLogger.info("Restoring previously selected model", {
          modelProvider: "ollama",
          modelId: savedModel.modelId,
        });
        setModelProvider("ollama");
        setModelId(savedModel.modelId);
      }
      hasRestoredFromStorage.current = true;
    }
  }, [setModelId, setModelProvider]);

  const localModels = modelsData?.localModels ?? [];

  const currentValue = modelId ? `ollama-${modelId}` : "";
  const currentModel = localModels.find((model) => model.id === currentValue);
  const currentLabel = currentModel?.name ?? modelId ?? "Select model";

  const handleModelChange = (value: string) => {
    if (!value.startsWith("ollama-")) {
      return;
    }

    const model = value.replace("ollama-", "");
    modelPickerLogger.info("Selected Ollama model", {
      modelProvider: "ollama",
      modelId: model,
    });
    setModelProvider("ollama");
    setModelId(model);
    setSelectedModel("ollama", model);
  };

  return (
    <div className="min-w-0">
      {shouldShowLabel && (
        <label className="block text-xs font-medium text-muted-foreground">
          Text model
        </label>
      )}
      <Select value={currentValue} onValueChange={handleModelChange}>
        <SelectTrigger className="h-8 w-auto max-w-full gap-2 overflow-hidden rounded-full border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent sm:h-9 sm:px-3.5 sm:text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <Cpu className="h-4 w-4 flex-shrink-0" />
            <span className="truncate text-sm">{currentLabel}</span>
          </div>
        </SelectTrigger>
        <SelectContent className="w-80 max-w-[calc(100vw-1rem)]">
          {isLoading && !isInitialLoad && (
            <SelectGroup>
              <SelectLabel>Loading Models</SelectLabel>
              <SelectItem value="loading" disabled className="overflow-hidden">
                <div className="flex min-w-0 max-w-full items-center gap-3">
                  <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <span className="truncate text-sm">
                      Refreshing models...
                    </span>
                    <span className="line-clamp-2 whitespace-normal break-words text-xs leading-snug text-muted-foreground">
                      Checking for new models
                    </span>
                  </div>
                </div>
              </SelectItem>
            </SelectGroup>
          )}

          {localModels.length > 0 ? (
            <SelectGroup>
              <SelectLabel>Ollama Models</SelectLabel>
              {localModels.map((model) => (
                <SelectItem
                  key={model.id}
                  value={model.id}
                  className="overflow-hidden"
                >
                  <div className="flex min-w-0 max-w-full items-center gap-3">
                    <Cpu className="h-4 w-4 flex-shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                      <span className="truncate text-sm">{model.name}</span>
                      <span className="line-clamp-2 whitespace-normal break-words text-xs leading-snug text-muted-foreground">
                        Ollama model
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ) : (
            <SelectGroup>
              <SelectLabel>Ollama</SelectLabel>
              <SelectItem
                value="ollama-setup"
                disabled
                className="overflow-hidden"
              >
                <div className="flex min-w-0 max-w-full items-center gap-3">
                  <Cpu className="h-4 w-4 flex-shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <span className="line-clamp-2 whitespace-normal break-words text-sm leading-snug">
                      No Ollama models found
                    </span>
                    <span className="line-clamp-2 whitespace-normal break-words text-xs leading-snug text-muted-foreground">
                      Make sure the Ollama server is running and has models
                      installed (`ollama pull ...`)
                    </span>
                  </div>
                </div>
              </SelectItem>
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
