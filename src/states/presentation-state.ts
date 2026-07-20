import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { type Image as GeneratedImage } from "@/app/_actions/apps/image-studio/fetch";
import { type PaletteDropTarget } from "@/components/notebook/presentation/editor/utils/paletteDrop";
import {
  normalizePresentationSlides,
  normalizePresentationValue,
} from "@/components/notebook/presentation/utils/normalizePresentationSlate";
import { type PlateSlide } from "@/components/notebook/presentation/utils/parser";
import { type ImageModelList } from "@/constants/image-models";
import { type ModelProvider } from "@/constants/text-models";
import { type NotebookAgentToolCall } from "@/lib/notebook/agent-activity";
import {
  type NotebookAttachment,
  type NotebookSelectedChunk,
} from "@/lib/notebook/attachments";
import {
  DEFAULT_PRESENTATION_GENERATION_ASPECT_RATIO,
  type PresentationGenerationAspectRatio,
} from "@/lib/presentation/aspect-ratio";
import {
  getPresentationImageGenerationKey,
  getRootImageGenerationTarget,
  resolvePresentationImageGenerationSource,
  type PresentationImageGenerationJob,
  type PresentationImageGenerationSource,
  type PresentationImageGenerationTarget,
} from "@/lib/presentation/image-generation";
import { type PresentationImageSearchResult } from "@/lib/presentation/image-search";
import { type PresentationSourceDocument } from "@/lib/presentation/source-document";
import { isBuiltInPresentationTheme } from "@/lib/presentation/theme-resolution";
import { type ThemeProperties, type Themes } from "@/lib/presentation/themes";
import { usePresentationHistoryState } from "./presentation-history-state";

export const MIN_PRESENTATION_ZOOM_LEVEL = 0.5;
export const MAX_PRESENTATION_ZOOM_LEVEL = 1.8;

const clampPresentationZoomLevel = (level: number): number =>
  Math.min(
    MAX_PRESENTATION_ZOOM_LEVEL,
    Math.max(MIN_PRESENTATION_ZOOM_LEVEL, level),
  );

function normalizeSlideUpdates(
  updates: Partial<PlateSlide>,
): Partial<PlateSlide> {
  if (!("content" in updates)) {
    return updates;
  }

  return {
    ...updates,
    content: normalizePresentationValue(
      updates.content,
    ) as PlateSlide["content"],
  };
}

export type HistoryType = "history";

export type ImageEditorMode =
  | "generate"
  | "your-images"
  | "generated-images"
  | "embed"
  | "search"
  | "gif"
  | "chart";

export type PresentationStockImageProvider = "unsplash" | "pixabay" | "google";

export type RightPanelType =
  | "basicBlocks"
  | "elements"
  | "charts"
  | "embed"
  | "background"
  | "theme"
  | "agent"
  | "globalSettings"
  | "imageEditor"
  | "chartEditor"
  | "infographicEditor"
  | "infographicGenerationEditor"
  | "presentationImageEditor"
  | "layoutEditor"
  | "iconPicker"
  | null;

export type LayoutEditorElementSnapshot = Record<string, unknown> & {
  children?: unknown[];
  id?: string;
  type?: string;
};

export type LayoutEditorApplyLayout = (
  type: string,
  additionalData?: Record<string, unknown>,
) => LayoutEditorElementSnapshot | null | void;

export type Chunk = NotebookSelectedChunk;

type PendingPresentationCreateRequest = {
  attachments?: NotebookAttachment[];
  language: string;
  modelId: string;
  modelProvider: ModelProvider;
  numSlides: number;
  generationAspectRatio?: PresentationGenerationAspectRatio;
  outputFormat?: "flow" | "html";
  prompt: string;
  webSearchEnabled: boolean;
  autoThemeEnabled?: boolean;
};

interface PresentationState {
  currentPresentationId: string | null;
  currentPresentationTitle: string | null;
  currentPresentationUpdatedAt: string | null;
  currentPresentationOwnerId: string | null;
  outputFormat: "flow" | "html";
  contentVersion: number;
  isGridView: boolean;
  isSheetOpen: boolean;
  numSlides: number;

  theme: Themes | string;
  customThemeData: ThemeProperties | null;
  themeDataByTheme: Record<string, ThemeProperties | null | undefined>;
  generatedThemeData: ThemeProperties | null;
  language: string;
  modelProvider: ModelProvider;
  modelId: string;
  pageStyle: string;
  presentationInput: string;
  sourceDocument: PresentationSourceDocument | null;
  imageModel: ImageModelList;
  imageSource: "automatic" | "ai" | "stock" | "gif";
  stockImageProvider: PresentationStockImageProvider;
  presentationStyle: string;
  generationAspectRatio: PresentationGenerationAspectRatio;
  // New customization options
  textContent: "minimal" | "concise" | "detailed" | "extensive";
  tone:
    | "auto"
    | "general"
    | "persuasive"
    | "inspiring"
    | "instructive"
    | "engaging";
  audience:
    | "auto"
    | "general"
    | "business"
    | "investor"
    | "teacher"
    | "student";
  scenario:
    | "auto"
    | "general"
    | "analysis-report"
    | "teaching-training"
    | "promotional-materials"
    | "public-speeches";
  savingStatus: "idle" | "saving" | "saved";
  isPresenting: boolean;
  isPresentingLoading: boolean;
  presentingScaleLocks: Record<string, boolean>;
  currentSlideId: string | null;
  isThemeCreatorOpen: boolean;

  pageBackground: Record<string, unknown>;
  setPageBackground: (pageBackground: Record<string, unknown>) => void;
  // Generation states
  shouldStartOutlineGeneration: boolean;
  shouldStartPresentationGeneration: boolean;
  shouldStartImageSlideGeneration: boolean;
  isGeneratingOutline: boolean;
  isGeneratingPresentation: boolean;
  activeGenerationPresentationId: string | null;
  completedGenerationPresentationId: string | null;
  pendingCreateRequest: PendingPresentationCreateRequest | null;
  outline: string[];
  searchResults: Array<{ query: string; results: unknown[] }>; // Store search results for context
  imageSearchResults: PresentationImageSearchResult[];
  outlineToolCalls: NotebookAgentToolCall[];
  webSearchEnabled: boolean; // Toggle for web search in outline generation
  autoThemeEnabled: boolean; // Toggle for generated custom themes in outline generation
  slides: PlateSlide[]; // This now holds the new object structure

  // Presentation image generation tracking. Root image jobs use the slide id as
  // their key for backward compatibility; nested image jobs use slideId:elementId.
  // Each job also stores the owning presentation id so late async image results
  // cannot be applied to a different deck that reuses the same generated slide id.
  rootImageGeneration: Record<string, PresentationImageGenerationJob>;

  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (update: boolean) => void;
  isRightPanelCollapsed: boolean;
  setIsRightPanelCollapsed: (update: boolean) => void;
  setSlides: (
    slides: PlateSlide[] | ((slides: PlateSlide[]) => PlateSlide[]),
    type?: HistoryType,
  ) => void;
  updateSlide: (
    slideId: string,
    updates: Partial<PlateSlide>,
    type?: HistoryType,
  ) => void;
  startPresentationImageGeneration: (
    target: PresentationImageGenerationTarget,
    query: string,
    options?: {
      imageModel?: ImageModelList;
      presentationId?: string;
      source?: PresentationImageGenerationSource;
      stockImageProvider?: PresentationStockImageProvider;
    },
  ) => void;
  completePresentationImageGeneration: (key: string, url: string) => void;
  failPresentationImageGeneration: (key: string, error: string) => void;
  clearPresentationImageGeneration: (
    targetOrKey: PresentationImageGenerationTarget | string,
  ) => void;
  startRootImageGeneration: (
    slideId: string,
    query: string,
    options?:
      | ImageModelList
      | {
          imageModel?: ImageModelList;
          source?: PresentationImageGenerationSource;
          stockImageProvider?: PresentationStockImageProvider;
        },
  ) => void;
  completeRootImageGeneration: (slideId: string, url: string) => void;
  failRootImageGeneration: (slideId: string, error: string) => void;
  clearRootImageGeneration: (slideId: string) => void;
  setCurrentPresentation: (id: string | null, title: string | null) => void;
  setCurrentPresentationOwnerId: (ownerId: string | null) => void;
  setCurrentPresentationUpdatedAt: (updatedAt: Date | string | null) => void;
  setOutputFormat: (outputFormat: "flow" | "html") => void;
  setContentVersion: (version: number) => void;
  setIsGridView: (isGrid: boolean) => void;
  setIsSheetOpen: (isOpen: boolean) => void;
  setNumSlides: (num: number) => void;
  setTheme: (
    theme: Themes | string,
    customData?: ThemeProperties | null,
    type?: HistoryType,
  ) => void;
  setThemeDataByTheme: (
    themeDataByTheme: Record<string, ThemeProperties | null | undefined>,
  ) => void;
  setGeneratedThemeData: (data: ThemeProperties | null) => void;
  shouldShowExitHeader: boolean;
  setShouldShowExitHeader: (udpdate: boolean) => void;
  thumbnailUrl?: string;
  setThumbnailUrl: (url: string | undefined) => void;
  setLanguage: (lang: string) => void;
  setModelProvider: (provider: ModelProvider) => void;
  setModelId: (id: string) => void;
  setPageStyle: (style: string) => void;
  setPresentationInput: (input: string) => void;
  setSourceDocument: (document: PresentationSourceDocument | null) => void;
  setOutline: (topics: string[]) => void;
  setSearchResults: (
    results: Array<{ query: string; results: unknown[] }>,
  ) => void;
  setImageSearchResults: (results: PresentationImageSearchResult[]) => void;
  setOutlineToolCalls: (toolCalls: NotebookAgentToolCall[]) => void;
  setWebSearchEnabled: (enabled: boolean) => void;
  setAutoThemeEnabled: (enabled: boolean) => void;
  setImageModel: (model: ImageModelList) => void;
  setImageSource: (source: "automatic" | "ai" | "stock" | "gif") => void;
  setStockImageProvider: (provider: PresentationStockImageProvider) => void;
  setPresentationStyle: (style: string) => void;
  setGenerationAspectRatio: (
    generationAspectRatio: PresentationGenerationAspectRatio,
  ) => void;
  setTextContent: (
    content: "minimal" | "concise" | "detailed" | "extensive",
  ) => void;
  setTone: (
    tone:
      | "auto"
      | "general"
      | "persuasive"
      | "inspiring"
      | "instructive"
      | "engaging",
  ) => void;
  setAudience: (
    audience:
      | "auto"
      | "general"
      | "business"
      | "investor"
      | "teacher"
      | "student",
  ) => void;
  setScenario: (
    scenario:
      | "auto"
      | "general"
      | "analysis-report"
      | "teaching-training"
      | "promotional-materials"
      | "public-speeches",
  ) => void;
  setSavingStatus: (status: "idle" | "saving" | "saved") => void;
  setIsPresenting: (isPresenting: boolean) => void;
  setIsPresentingLoading: (isLoading: boolean) => void;
  setPresentingScaleLock: (slideId: string, locked: boolean) => void;
  resetPresentingScaleLocks: () => void;
  setCurrentSlideId: (id: string | null) => void;
  nextSlide: () => void;
  previousSlide: () => void;

  setIsThemeCreatorOpen: (update: boolean) => void;
  // Typography overrides
  fontSize: "S" | "M" | "L"; // S=12px, M=16px, L=18px
  setFontSize: (size: "S" | "M" | "L") => void;
  fontFamily: { body: string; heading: string };
  setFontFamily: (fonts: { body?: string; heading?: string }) => void;
  // Generation actions
  setShouldStartOutlineGeneration: (shouldStart: boolean) => void;
  setShouldStartPresentationGeneration: (shouldStart: boolean) => void;
  setShouldStartImageSlideGeneration: (shouldStart: boolean) => void;
  setIsGeneratingOutline: (isGenerating: boolean) => void;
  setIsGeneratingPresentation: (isGenerating: boolean) => void;
  completePresentationGeneration: () => void;
  dismissCompletedGeneration: (presentationId: string) => void;
  setPendingCreateRequest: (
    request: PendingPresentationCreateRequest | null,
  ) => void;
  consumePendingCreateRequest: () => PendingPresentationCreateRequest | null;
  startOutlineGeneration: () => void;
  startPresentationGeneration: () => void;
  startImageSlideGeneration: () => void;
  resetGeneration: () => void;
  resetForNewGeneration: () => void;
  resetPresentationState: () => void;

  // Selection state
  isSelecting: boolean;
  selectedPresentations: string[];
  toggleSelecting: () => void;
  selectAllPresentations: (ids: string[]) => void;
  deselectAllPresentations: () => void;
  togglePresentationSelection: (id: string) => void;

  // Unified right panel state (replaces isAgentOpen, isGlobalSettingsOpen)
  activeRightPanel: RightPanelType;
  setActiveRightPanel: (panel: RightPanelType) => void;
  iconPickerCurrentIcon: string;
  iconPickerSelectIcon: ((iconName: string) => void) | null;
  iconPickerRemoveIcon: (() => void) | null;
  openIconPicker: (
    currentIcon: string,
    onSelect: (iconName: string) => void,
    onRemove?: () => void,
  ) => void;
  closeIconPicker: () => void;
  layoutEditorElementId: string | null;
  layoutEditorEditorId: string | null;
  layoutEditorElement: LayoutEditorElementSnapshot | null;
  layoutEditorApplyLayout: LayoutEditorApplyLayout | null;
  paletteDropTarget: PaletteDropTarget | null;
  setPaletteDropTarget: (target: PaletteDropTarget | null) => void;
  openLayoutEditor: (
    editorId: string | null,
    elementId: string | null,
    element: LayoutEditorElementSnapshot | null,
    applyLayout?: LayoutEditorApplyLayout,
  ) => void;

  // Pending agent message (for slide-specific editing from Magic Menu)
  pendingAgentMessage: {
    message: string;
    slideContext: string; // Serialized XML of the slide
  } | null;
  setPendingAgentMessage: (
    pending: { message: string; slideContext: string } | null,
  ) => void;

  // Image editor state for root image editing
  imageEditorInitialMode: ImageEditorMode | null;
  openImageEditor: (mode?: ImageEditorMode) => void;
  closeImageEditor: () => void;

  // Chart editor state for inline chart element editing
  chartEditorData: {
    chartType: string;
    chartData: unknown;
    chartOptions: Record<string, unknown>;
  } | null;
  openChartEditor: (
    chartData?: {
      chartType: string;
      chartData: unknown;
      chartOptions: Record<string, unknown>;
    },
    updateElementFn?: (props: Record<string, unknown>) => void,
  ) => void;
  closeChartEditor: () => void;

  // Infographic editor state for inline infographic element editing
  openInfographicEditor: (
    updateElementFn?: (props: Record<string, unknown>) => void,
  ) => void;
  closeInfographicEditor: () => void;
  openInfographicGenerationEditor: (
    updateElementFn?: (props: Record<string, unknown>) => void,
  ) => void;
  closeInfographicGenerationEditor: () => void;

  // Presentation image editor state (for inline TImageElement editing)
  presentationImageEditorInitialMode: ImageEditorMode | null;
  presentationImageEditorElement: Record<string, unknown> | null;
  presentationImageEditorFrame: {
    height: number;
    width: number;
  } | null;
  // Bound function to update the element from the panel
  boundUpdateElement: ((props: Record<string, unknown>) => void) | null;
  openPresentationImageEditor: (
    mode?: ImageEditorMode,
    updateElementFn?: (props: Record<string, unknown>) => void,
    element?: Record<string, unknown>,
    frame?: { height: number; width: number },
  ) => void;
  closePresentationImageEditor: () => void;

  // Reordering state
  isReorderingSlides: boolean;
  setIsReorderingSlides: (isReordering: boolean) => void;

  // Attached files (uploaded to /api/files/upload) for outline with docs
  attachedFiles: NotebookAttachment[];
  setAttachedFiles: (files: NotebookAttachment[]) => void;
  isUploadingAttachment: boolean;
  setIsUploadingAttachment: (uploading: boolean) => void;

  // Generated image cache by prompt
  generatedImageCache: Record<string, GeneratedImage[]>;
  setGeneratedImageCache: (prompt: string, images: GeneratedImage[]) => void;

  // Image search state
  imageSearchState: {
    mode: PresentationStockImageProvider;
    unsplashQuery: string;
    pixabayQuery: string;
    googleQuery: string;
  };
  setImageSearchState: (
    state: Partial<{
      mode: PresentationStockImageProvider;
      unsplashQuery: string;
      pixabayQuery: string;
      googleQuery: string;
    }>,
  ) => void;

  // Slide template selection for outline
  selectedSlideTemplates: string[]; // Array of template IDs from TEMPLATE_DEFINITIONS
  setSelectedSlideTemplates: (templates: string[]) => void;
  outlineItemIds: string[]; // Ordered outline item IDs used for per-slide layout mapping
  setOutlineItemIds: (ids: string[]) => void;
  outlineTemplateOverrides: Record<string, string | null>; // Map of outline ID -> template ID | null (null = auto)
  setOutlineTemplateOverride: (
    outlineId: string,
    templateId: string | null,
  ) => void;
  clearOutlineTemplateOverrides: () => void;

  // DB template selection for generation
  selectedDbTemplate: {
    id: string;
    title: string;
    slides: PlateSlide[];
  } | null;
  setSelectedDbTemplate: (
    template: { id: string; title: string; slides: PlateSlide[] } | null,
  ) => void;

  // Manual extraction state for presentation generation
  isManualExtractionEnabled: boolean;
  setIsManualExtractionEnabled: (enabled: boolean) => void;
  selectedChunks: Chunk[];
  setSelectedChunks: (chunks: Chunk[]) => void;
  addSelectedChunk: (chunk: Chunk) => void;
  removeSelectedChunk: (chunkId: string, ragId: string) => void;
  updateChunkSlideAssignment: (
    chunkId: string,
    ragId: string,
    slideNumber: number | null,
  ) => void;
  clearSelectedChunks: () => void;
  // Multi-file extraction support
  extractorRagIds: string[];
  addExtractorRagId: (id: string) => void;
  removeExtractorRagId: (id: string) => void;
  clearExtractorRagIds: () => void;
  setExtractorRagIds: (ids: string[]) => void;
  currentExtractorRagId: string | null;
  setCurrentExtractorRagId: (id: string | null) => void;

  // Zoom state for slide scaling in edit mode
  zoomLevel: number; // Zoom multiplier (1 = 100%, 1.4 = 140%, etc.)
  setZoomLevel: (level: number) => void;
  isReadOnly: boolean;
  setIsReadOnly: (isReadOnly: boolean) => void;
}

// Helper to handle history snapshots with circular dependency workaround
const pushHistorySnapshot = (
  type: HistoryType | undefined,
  slideId: string | undefined,
  changeType: "slide" | "theme" | "full" = "full",
) => {
  if (type === "history") return;

  // Dynamic import to avoid circular dependency

  const { history, pushSnapshot } = usePresentationHistoryState.getState();
  // Only push if history is initialized
  if (history.present !== null) {
    pushSnapshot(slideId, changeType);
  }
};

export const usePresentationState = create<PresentationState>()(
  persist(
    (set, get) => ({
      currentPresentationId: null,
      currentPresentationTitle: null,
      currentPresentationUpdatedAt: null,
      currentPresentationOwnerId: null,
      outputFormat: "flow",
      contentVersion: 0,
      isGridView: true,
      isSheetOpen: false,
      shouldShowExitHeader: false,
      setShouldShowExitHeader: (update) =>
        set({ shouldShowExitHeader: update }),
      thumbnailUrl: undefined,
      setThumbnailUrl: (url) => set({ thumbnailUrl: url }),
      numSlides: 5,
      language: "en-US",
      modelProvider: "ollama",
      modelId: "llama3.2:3b",
      pageStyle: "default",
      presentationInput: "",
      sourceDocument: null,
      outline: [],
      searchResults: [],
      imageSearchResults: [],
      outlineToolCalls: [],
      webSearchEnabled: true,
      autoThemeEnabled: true,
      theme: "mystique",
      customThemeData: null,
      themeDataByTheme: {},
      generatedThemeData: null,
      imageModel: "fal-ai/flux-2/flash",
      imageSource: "automatic",
      stockImageProvider: "unsplash",
      presentationStyle: "professional",
      generationAspectRatio: DEFAULT_PRESENTATION_GENERATION_ASPECT_RATIO,
      textContent: "concise",
      tone: "auto",
      audience: "auto",
      scenario: "auto",
      slides: [], // Now holds the new slide object structure
      rootImageGeneration: {},
      savingStatus: "idle",
      isPresenting: false,
      isPresentingLoading: false,
      presentingScaleLocks: {},
      currentSlideId: null,
      isThemeCreatorOpen: false,
      pageBackground: {},
      // Typography defaults
      fontSize: "M",
      setFontSize: (size) => set({ fontSize: size }),
      fontFamily: { body: "", heading: "" },
      setFontFamily: (fonts) =>
        set((state) => ({
          fontFamily: {
            body: fonts.body ?? state.fontFamily.body,
            heading: fonts.heading ?? state.fontFamily.heading,
          },
        })),
      isReorderingSlides: false,
      setIsReorderingSlides: (isReordering) =>
        set({ isReorderingSlides: isReordering }),

      // Attached files state
      attachedFiles: [],
      setAttachedFiles: (files) => set({ attachedFiles: files }),
      isUploadingAttachment: false,
      setIsUploadingAttachment: (uploading) =>
        set({ isUploadingAttachment: uploading }),

      // Generated image cache
      generatedImageCache: {},
      setGeneratedImageCache: (prompt, images) =>
        set((state) => ({
          generatedImageCache: {
            ...state.generatedImageCache,
            [prompt]: images,
          },
        })),

      // Image search state
      imageSearchState: {
        mode: "unsplash",
        unsplashQuery: "",
        pixabayQuery: "",
        googleQuery: "",
      },
      setImageSearchState: (newState) =>
        set((state) => ({
          imageSearchState: { ...state.imageSearchState, ...newState },
        })),

      // Slide template selection for outline
      selectedSlideTemplates: [],
      setSelectedSlideTemplates: (templates) =>
        set({ selectedSlideTemplates: templates }),
      outlineItemIds: [],
      setOutlineItemIds: (ids) => set({ outlineItemIds: ids }),
      outlineTemplateOverrides: {},
      setOutlineTemplateOverride: (outlineId, templateId) =>
        set((state) => {
          if (templateId === null) {
            const outlineTemplateOverrides = {
              ...state.outlineTemplateOverrides,
            };
            delete outlineTemplateOverrides[outlineId];

            return { outlineTemplateOverrides };
          }

          return {
            outlineTemplateOverrides: {
              ...state.outlineTemplateOverrides,
              [outlineId]: templateId,
            },
          };
        }),
      clearOutlineTemplateOverrides: () =>
        set({ outlineTemplateOverrides: {} }),

      // DB template selection for generation
      selectedDbTemplate: null,
      setSelectedDbTemplate: (template) =>
        set({ selectedDbTemplate: template }),

      // Manual extraction state
      isManualExtractionEnabled: false,
      setIsManualExtractionEnabled: (enabled) =>
        set({ isManualExtractionEnabled: enabled }),
      selectedChunks: [],
      setSelectedChunks: (selectedChunks) => set({ selectedChunks }),
      addSelectedChunk: (chunk) =>
        set((state) => ({
          selectedChunks: state.selectedChunks.some(
            (c) => c.chunkId === chunk.chunkId && c.ragId === chunk.ragId,
          )
            ? state.selectedChunks
            : [...state.selectedChunks, chunk],
        })),
      removeSelectedChunk: (chunkId, ragId) =>
        set((state) => ({
          selectedChunks: state.selectedChunks.filter(
            (c) => !(c.chunkId === chunkId && c.ragId === ragId),
          ),
        })),
      updateChunkSlideAssignment: (chunkId, ragId, slideNumber) =>
        set((state) => ({
          selectedChunks: state.selectedChunks.map((c) =>
            c.chunkId === chunkId && c.ragId === ragId
              ? { ...c, slideNumber }
              : c,
          ),
        })),
      clearSelectedChunks: () => set({ selectedChunks: [] }),
      // Multi-file extraction support
      extractorRagIds: [],
      addExtractorRagId: (id) =>
        set((state) => ({
          extractorRagIds: state.extractorRagIds.includes(id)
            ? state.extractorRagIds
            : [...state.extractorRagIds, id],
          // Auto-set current if first file
          currentExtractorRagId: state.currentExtractorRagId ?? id,
        })),
      removeExtractorRagId: (id) =>
        set((state) => {
          const newIds = state.extractorRagIds.filter((rid) => rid !== id);
          return {
            extractorRagIds: newIds,
            // Reset current if removed
            currentExtractorRagId:
              state.currentExtractorRagId === id
                ? (newIds[0] ?? null)
                : state.currentExtractorRagId,
            // Also remove chunks from this file
            selectedChunks: state.selectedChunks.filter((c) => c.ragId !== id),
          };
        }),
      clearExtractorRagIds: () =>
        set({ extractorRagIds: [], currentExtractorRagId: null }),
      setExtractorRagIds: (ids) => set({ extractorRagIds: ids }),
      currentExtractorRagId: null,
      setCurrentExtractorRagId: (id) => set({ currentExtractorRagId: id }),

      // Zoom state for slide scaling in edit mode
      zoomLevel: 1, // Default to 100% and clamp down on smaller layouts
      setZoomLevel: (level) =>
        set({ zoomLevel: clampPresentationZoomLevel(level) }),
      isReadOnly: false,
      setIsReadOnly: (isReadOnly) => set({ isReadOnly }),

      // Sidebar states
      isSidebarCollapsed: false,
      setIsSidebarCollapsed: (update) => set({ isSidebarCollapsed: update }),
      isRightPanelCollapsed: false,
      setIsRightPanelCollapsed: (update) =>
        set({ isRightPanelCollapsed: update }),

      // Generation states
      shouldStartOutlineGeneration: false,
      shouldStartPresentationGeneration: false,
      shouldStartImageSlideGeneration: false,
      isGeneratingOutline: false,
      isGeneratingPresentation: false,
      activeGenerationPresentationId: null,
      completedGenerationPresentationId: null,
      pendingCreateRequest: null,

      setSlides: (slides, type) => {
        set((state) => ({
          slides: normalizePresentationSlides(
            typeof slides === "function" ? slides(state.slides) : slides,
          ),
        }));

        pushHistorySnapshot(type, undefined, "full");
      },
      updateSlide: (slideId, updates, type) => {
        const normalizedUpdates = normalizeSlideUpdates(updates);

        set((state) => ({
          slides: state.slides.map((slide) =>
            slide.id === slideId ? { ...slide, ...normalizedUpdates } : slide,
          ),
        }));

        pushHistorySnapshot(type, slideId, "slide");
      },
      setPageBackground: (pageBackground) => set({ pageBackground }),

      // Unified right panel state
      activeRightPanel: null,
      setActiveRightPanel: (panel) =>
        set((state) =>
          state.activeRightPanel === panel ? state : { activeRightPanel: panel },
        ),
      iconPickerCurrentIcon: "",
      iconPickerSelectIcon: null,
      iconPickerRemoveIcon: null,
      openIconPicker: (currentIcon, onSelect, onRemove) =>
        set({
          activeRightPanel: "iconPicker",
          iconPickerCurrentIcon: currentIcon,
          iconPickerSelectIcon: onSelect,
          iconPickerRemoveIcon: onRemove ?? null,
        }),
      closeIconPicker: () =>
        set((state) => ({
          activeRightPanel:
            state.activeRightPanel === "iconPicker"
              ? null
              : state.activeRightPanel,
          iconPickerCurrentIcon: "",
          iconPickerSelectIcon: null,
          iconPickerRemoveIcon: null,
        })),
      layoutEditorElementId: null,
      layoutEditorEditorId: null,
      layoutEditorElement: null,
      layoutEditorApplyLayout: null,
      paletteDropTarget: null,
      setPaletteDropTarget: (target) => set({ paletteDropTarget: target }),
      openLayoutEditor: (editorId, elementId, element, applyLayout) =>
        set({
          activeRightPanel: "layoutEditor",
          layoutEditorElementId: elementId,
          layoutEditorEditorId: editorId,
          layoutEditorElement: element,
          layoutEditorApplyLayout: applyLayout ?? null,
        }),

      // Pending agent message
      pendingAgentMessage: null,
      setPendingAgentMessage: (pending) =>
        set({ pendingAgentMessage: pending }),

      // Image editor state
      imageEditorInitialMode: null,
      openImageEditor: (mode = "generate") =>
        set({
          imageEditorInitialMode: mode,
          activeRightPanel: "imageEditor",
        }),
      closeImageEditor: () =>
        set((state) => ({
          imageEditorInitialMode: null,
          activeRightPanel:
            state.activeRightPanel === "imageEditor"
              ? null
              : state.activeRightPanel,
        })),

      // Chart editor state
      chartEditorData: null,
      openChartEditor: (chartData, updateElementFn) =>
        set({
          activeRightPanel: "chartEditor",
          chartEditorData: chartData ?? null,
          boundUpdateElement: updateElementFn ?? null,
        }),
      closeChartEditor: () =>
        set((state) => ({
          activeRightPanel:
            state.activeRightPanel === "chartEditor"
              ? null
              : state.activeRightPanel,
          chartEditorData: null,
          boundUpdateElement:
            state.activeRightPanel === "chartEditor"
              ? null
              : state.boundUpdateElement,
        })),

      // Infographic editor state
      openInfographicEditor: (updateElementFn) =>
        set({
          activeRightPanel: "infographicEditor",
          boundUpdateElement: updateElementFn ?? null,
        }),
      closeInfographicEditor: () =>
        set((state) => ({
          activeRightPanel:
            state.activeRightPanel === "infographicEditor"
              ? null
              : state.activeRightPanel,
          boundUpdateElement:
            state.activeRightPanel === "infographicEditor"
              ? null
              : state.boundUpdateElement,
        })),
      openInfographicGenerationEditor: (updateElementFn) =>
        set({
          activeRightPanel: "infographicGenerationEditor",
          boundUpdateElement: updateElementFn ?? null,
        }),
      closeInfographicGenerationEditor: () =>
        set((state) => ({
          activeRightPanel:
            state.activeRightPanel === "infographicGenerationEditor"
              ? null
              : state.activeRightPanel,
          boundUpdateElement:
            state.activeRightPanel === "infographicGenerationEditor"
              ? null
              : state.boundUpdateElement,
        })),

      // Presentation image editor state (for inline TImageElement editing)
      presentationImageElementId: null,
      presentationImageEditorInitialMode: null,
      presentationImageEditorElement: null,
      presentationImageEditorFrame: null,
      boundUpdateElement: null,
      openPresentationImageEditor: (
        mode = "generate",
        updateElementFn,
        element,
        frame,
      ) =>
        set({
          presentationImageEditorInitialMode: mode,
          presentationImageEditorElement: element ?? null,
          presentationImageEditorFrame: frame ?? null,
          activeRightPanel: "presentationImageEditor",
          boundUpdateElement: updateElementFn ?? null,
        }),
      closePresentationImageEditor: () =>
        set((state) => ({
          presentationImageEditorInitialMode: null,
          presentationImageEditorElement: null,
          presentationImageEditorFrame: null,
          boundUpdateElement: null,
          activeRightPanel:
            state.activeRightPanel === "presentationImageEditor"
              ? null
              : state.activeRightPanel,
        })),

      startPresentationImageGeneration: (target, query, options) =>
        set((state) => {
          const key = getPresentationImageGenerationKey(target);
          const existingGeneration = state.rootImageGeneration[key];
          const presentationId =
            options?.presentationId ??
            state.activeGenerationPresentationId ??
            state.currentPresentationId;

          if (
            existingGeneration &&
            existingGeneration.presentationId === presentationId &&
            existingGeneration.query.trim() === query.trim() &&
            (existingGeneration.status === "queued" ||
              existingGeneration.status === "generating")
          ) {
            return state;
          }

          return {
            rootImageGeneration: {
              ...state.rootImageGeneration,
              [key]: {
                query,
                ...(presentationId ? { presentationId } : {}),
                source:
                  options?.source ??
                  resolvePresentationImageGenerationSource({
                    globalImageSource: state.imageSource,
                    imageSource:
                      target.kind === "root"
                        ? state.slides.find(
                            (slide) => slide.id === target.slideId,
                          )?.rootImage?.imageSource
                        : undefined,
                    isImageSlide: state.slides.find(
                      (slide) => slide.id === target.slideId,
                    )?.isImageSlide,
                  }),
                status: "queued",
                target,
                ...(options?.imageModel
                  ? { imageModel: options.imageModel }
                  : {}),
                ...(options?.stockImageProvider
                  ? { stockImageProvider: options.stockImageProvider }
                  : {}),
              },
            },
          };
        }),
      completePresentationImageGeneration: (key, url) =>
        set((state) => {
          const presentationId =
            state.activeGenerationPresentationId ?? state.currentPresentationId;

          return {
            rootImageGeneration: {
              ...state.rootImageGeneration,
              [key]: {
                ...(state.rootImageGeneration[key] ?? {
                  query: "",
                  ...(presentationId ? { presentationId } : {}),
                  source: "ai" as const,
                  status: "success" as const,
                  target: getRootImageGenerationTarget(key),
                }),
                status: "success",
                url,
              },
            },
          };
        }),
      failPresentationImageGeneration: (key, error) =>
        set((state) => {
          const presentationId =
            state.activeGenerationPresentationId ?? state.currentPresentationId;

          return {
            rootImageGeneration: {
              ...state.rootImageGeneration,
              [key]: {
                ...(state.rootImageGeneration[key] ?? {
                  query: "",
                  ...(presentationId ? { presentationId } : {}),
                  source: "ai" as const,
                  status: "error" as const,
                  target: getRootImageGenerationTarget(key),
                }),
                status: "error",
                error,
              },
            },
          };
        }),
      clearPresentationImageGeneration: (targetOrKey) =>
        set((state) => {
          const key =
            typeof targetOrKey === "string"
              ? targetOrKey
              : getPresentationImageGenerationKey(targetOrKey);
          const { [key]: _removed, ...rest } = state.rootImageGeneration;
          return { rootImageGeneration: rest } as Partial<PresentationState>;
        }),
      startRootImageGeneration: (slideId, query, options) => {
        const normalizedOptions =
          typeof options === "string" ? { imageModel: options } : options;

        get().startPresentationImageGeneration(
          getRootImageGenerationTarget(slideId),
          query,
          normalizedOptions,
        );
      },
      completeRootImageGeneration: (slideId, url) =>
        get().completePresentationImageGeneration(slideId, url),
      failRootImageGeneration: (slideId, error) =>
        get().failPresentationImageGeneration(slideId, error),
      clearRootImageGeneration: (slideId) =>
        get().clearPresentationImageGeneration(slideId),
      setCurrentPresentation: (id, title) =>
        set((state) =>
          state.currentPresentationId === id &&
          state.currentPresentationTitle === title
            ? state
            : {
                currentPresentationId: id,
                currentPresentationOwnerId:
                  state.currentPresentationId === id
                    ? state.currentPresentationOwnerId
                    : null,
                currentPresentationTitle: title,
              },
        ),
      setCurrentPresentationOwnerId: (ownerId) =>
        set((state) =>
          state.currentPresentationOwnerId === ownerId
            ? state
            : { currentPresentationOwnerId: ownerId },
        ),
      setCurrentPresentationUpdatedAt: (updatedAt) => {
        const currentPresentationUpdatedAt =
          updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt;

        set((state) =>
          state.currentPresentationUpdatedAt === currentPresentationUpdatedAt
            ? state
            : { currentPresentationUpdatedAt },
        );
      },
      setOutputFormat: (outputFormat) =>
        set((state) =>
          state.outputFormat === outputFormat ? state : { outputFormat },
        ),
      setContentVersion: (contentVersion) => set({ contentVersion }),
      setIsGridView: (isGrid) => set({ isGridView: isGrid }),
      setIsSheetOpen: (isOpen) => set({ isSheetOpen: isOpen }),
      setNumSlides: (num) => set({ numSlides: num }),
      setLanguage: (lang) => set({ language: lang }),
      setModelProvider: (provider) => set({ modelProvider: provider }),
      setModelId: (id) => set({ modelId: id }),
      setTheme: (theme, customData, type) => {
        set((state) => {
          let nextCustomThemeData: ThemeProperties | null;

          if (theme === "auto" && customData !== undefined) {
            // Auto theme with explicit data (e.g., customization save)
            nextCustomThemeData = customData;
          } else if (theme === "auto") {
            // Auto theme without explicit data: use generatedThemeData
            nextCustomThemeData = state.generatedThemeData;
          } else if (customData !== undefined) {
            // Explicit data passed (e.g., loading from DB or non-built-in theme)
            nextCustomThemeData = customData;
          } else if (isBuiltInPresentationTheme(theme)) {
            // Restore only the customization saved for this exact built-in theme.
            nextCustomThemeData = state.themeDataByTheme[theme] ?? null;
          } else {
            // Theme switch without explicit data: clear customization
            nextCustomThemeData = null;
          }

          return {
            theme,
            customThemeData: nextCustomThemeData,
          };
        });

        if (theme !== null) {
          pushHistorySnapshot(type, undefined, "theme");
        }
      },
      setThemeDataByTheme: (themeDataByTheme) => set({ themeDataByTheme }),
      setGeneratedThemeData: (data) => set({ generatedThemeData: data }),
      setPageStyle: (style) => set({ pageStyle: style }),
      setPresentationInput: (input) => set({ presentationInput: input }),
      setSourceDocument: (document) => set({ sourceDocument: document }),
      setOutline: (topics) => set({ outline: topics }),
      setSearchResults: (results) => set({ searchResults: results }),
      setImageSearchResults: (results) => set({ imageSearchResults: results }),
      setOutlineToolCalls: (outlineToolCalls) => set({ outlineToolCalls }),
      setWebSearchEnabled: (enabled) => set({ webSearchEnabled: enabled }),
      setAutoThemeEnabled: (enabled) => set({ autoThemeEnabled: enabled }),
      setImageModel: (model) => set({ imageModel: model }),
      setImageSource: (source) => set({ imageSource: source }),
      setStockImageProvider: (provider) =>
        set({ stockImageProvider: provider }),
      setPresentationStyle: (style) => set({ presentationStyle: style }),
      setGenerationAspectRatio: (generationAspectRatio) =>
        set({ generationAspectRatio }),
      setTextContent: (content) => set({ textContent: content }),
      setTone: (tone) => set({ tone }),
      setAudience: (audience) => set({ audience }),
      setScenario: (scenario) => set({ scenario }),
      setSavingStatus: (status) => set({ savingStatus: status }),
      setIsPresenting: (isPresenting) =>
        set(() => ({
          isPresenting,
          ...(isPresenting
            ? {}
            : { isPresentingLoading: false, presentingScaleLocks: {} }),
        })),
      setIsPresentingLoading: (isLoading) =>
        set({ isPresentingLoading: isLoading }),
      setPresentingScaleLock: (slideId, locked) =>
        set((state) => ({
          presentingScaleLocks: {
            ...state.presentingScaleLocks,
            [slideId]: locked,
          },
        })),
      resetPresentingScaleLocks: () => set({ presentingScaleLocks: {} }),
      setCurrentSlideId: (id) => set({ currentSlideId: id }),
      nextSlide: () => {
        set((state) => {
          const currentIndex = state.slides.findIndex(
            (s) => s.id === state.currentSlideId,
          );
          const newIndex = Math.min(
            (currentIndex === -1 ? 0 : currentIndex) + 1,
            state.slides.length - 1,
          );
          const newSlideId = state.slides[newIndex]?.id ?? null;
          return { currentSlideId: newSlideId };
        });
      },
      previousSlide: () =>
        set((state) => {
          const currentIndex = state.slides.findIndex(
            (s) => s.id === state.currentSlideId,
          );
          const newIndex = Math.max(
            (currentIndex === -1 ? 0 : currentIndex) - 1,
            0,
          );
          const newSlideId = state.slides[newIndex]?.id ?? null;
          return {
            currentSlideId: newSlideId,
          };
        }),

      // Generation actions
      setShouldStartOutlineGeneration: (shouldStart) =>
        set({ shouldStartOutlineGeneration: shouldStart }),
      setShouldStartPresentationGeneration: (shouldStart) =>
        set({ shouldStartPresentationGeneration: shouldStart }),
      setShouldStartImageSlideGeneration: (shouldStart) =>
        set({ shouldStartImageSlideGeneration: shouldStart }),
      setIsGeneratingOutline: (isGenerating) =>
        set({ isGeneratingOutline: isGenerating }),
      setIsGeneratingPresentation: (isGenerating) =>
        set({ isGeneratingPresentation: isGenerating }),
      completePresentationGeneration: () =>
        set((state) => ({
          isGeneratingPresentation: false,
          activeGenerationPresentationId: null,
          completedGenerationPresentationId:
            state.activeGenerationPresentationId ?? state.currentPresentationId,
        })),
      dismissCompletedGeneration: (presentationId) =>
        set((state) =>
          state.completedGenerationPresentationId === presentationId
            ? { completedGenerationPresentationId: null }
            : {},
        ),
      setPendingCreateRequest: (pendingCreateRequest) =>
        set({ pendingCreateRequest }),
      consumePendingCreateRequest: () => {
        const pendingCreateRequest = get().pendingCreateRequest;
        if (!pendingCreateRequest) {
          return null;
        }

        set({ pendingCreateRequest: null });
        return pendingCreateRequest;
      },
      startOutlineGeneration: () =>
        set({
          shouldStartOutlineGeneration: true,
          isGeneratingOutline: true,
          shouldStartPresentationGeneration: false,
          isGeneratingPresentation: false,
          activeGenerationPresentationId: null,
          completedGenerationPresentationId: null,
          isPresenting: false,
          isPresentingLoading: false,
          presentingScaleLocks: {},
          outline: [],
          searchResults: [],
          imageSearchResults: [],
          outlineToolCalls: [],
          outlineItemIds: [],
          outlineTemplateOverrides: {},
          slides: [],
          rootImageGeneration: {},
        }),
      startPresentationGeneration: () =>
        set((state) =>
          state.outline.some((item) => item.trim().length > 0)
            ? {
                shouldStartPresentationGeneration: true,
                isGeneratingPresentation: true,
                activeGenerationPresentationId: state.currentPresentationId,
                completedGenerationPresentationId: null,
                isPresenting: false,
                isPresentingLoading: false,
                presentingScaleLocks: {},
                slides: [],
                rootImageGeneration: {},
              }
            : {
                shouldStartPresentationGeneration: false,
                isGeneratingPresentation: false,
                activeGenerationPresentationId: null,
                isPresenting: false,
                isPresentingLoading: false,
                presentingScaleLocks: {},
              },
        ),
      startImageSlideGeneration: () =>
        set((state) =>
          state.outline.some((item) => item.trim().length > 0)
            ? {
                shouldStartImageSlideGeneration: true,
                isGeneratingPresentation: true,
                activeGenerationPresentationId: state.currentPresentationId,
                completedGenerationPresentationId: null,
                isPresenting: false,
                isPresentingLoading: false,
                presentingScaleLocks: {},
                slides: [],
                rootImageGeneration: {},
              }
            : {
                shouldStartImageSlideGeneration: false,
                isGeneratingPresentation: false,
                activeGenerationPresentationId: null,
                isPresenting: false,
                isPresentingLoading: false,
                presentingScaleLocks: {},
              },
        ),
      resetGeneration: () =>
        set({
          shouldStartOutlineGeneration: false,
          shouldStartPresentationGeneration: false,
          shouldStartImageSlideGeneration: false,
          isGeneratingOutline: false,
          isGeneratingPresentation: false,
          activeGenerationPresentationId: null,
          completedGenerationPresentationId: null,
          searchResults: [],
          imageSearchResults: [],
          outlineToolCalls: [],
        }),

      // Reset everything except ID and current input when starting new outline generation
      resetForNewGeneration: () =>
        set(() => ({
          thumbnailUrl: undefined,
          outline: [],
          searchResults: [],
          imageSearchResults: [],
          outlineToolCalls: [],
          slides: [],
          rootImageGeneration: {},
          pageBackground: {},
          selectedSlideTemplates: [],
          outlineItemIds: [],
          outlineTemplateOverrides: {},
        })),

      // Comprehensive reset when navigating back to the presentation dashboard.
      resetPresentationState: () =>
        set(() => ({
          // Clear presentation-specific state
          currentPresentationId: null,
          currentPresentationTitle: null,
          currentPresentationUpdatedAt: null,
          currentPresentationOwnerId: null,
          contentVersion: 0,
          presentationInput: "",
          sourceDocument: null,
          outline: [],
          slides: [],
          searchResults: [],
          imageSearchResults: [],
          outlineToolCalls: [],
          rootImageGeneration: {},
          attachedFiles: [],
          pageBackground: {},
          customThemeData: null,
          generatedThemeData: null,
          themeDataByTheme: {},
          thumbnailUrl: undefined,
          generationAspectRatio: DEFAULT_PRESENTATION_GENERATION_ASPECT_RATIO,
          isManualExtractionEnabled: false,
          selectedChunks: [],
          extractorRagIds: [],
          currentExtractorRagId: null,

          // Reset generation flags
          shouldStartOutlineGeneration: false,
          shouldStartPresentationGeneration: false,
          isGeneratingOutline: false,
          isGeneratingPresentation: false,
          activeGenerationPresentationId: null,
          completedGenerationPresentationId: null,
          pendingCreateRequest: null,
          outputFormat: "flow",

          // Reset UI state
          activeRightPanel: null,
          iconPickerCurrentIcon: "",
          iconPickerSelectIcon: null,
          iconPickerRemoveIcon: null,
          layoutEditorElementId: null,
          layoutEditorEditorId: null,
          layoutEditorElement: null,
          layoutEditorApplyLayout: null,
          paletteDropTarget: null,
          pendingAgentMessage: null,
          imageEditorInitialMode: null,
          presentationImageElementId: null,
          presentationImageEditorInitialMode: null,
          boundUpdateElement: null,
          isSidebarCollapsed: false,
          isRightPanelCollapsed: false,
          currentSlideId: null,
          savingStatus: "idle",
          isPresenting: false,
          isPresentingLoading: false,
          presentingScaleLocks: {},
          generatedImageCache: {},
          selectedSlideTemplates: [],
          outlineItemIds: [],
          outlineTemplateOverrides: {},
          isReadOnly: false,
        })),

      setIsThemeCreatorOpen: (update) => set({ isThemeCreatorOpen: update }),
      // Selection state
      isSelecting: false,
      selectedPresentations: [],
      toggleSelecting: () =>
        set((state) => ({
          isSelecting: !state.isSelecting,
          selectedPresentations: [],
        })),
      selectAllPresentations: (ids) => set({ selectedPresentations: ids }),
      deselectAllPresentations: () => set({ selectedPresentations: [] }),
      togglePresentationSelection: (id) =>
        set((state) => ({
          selectedPresentations: state.selectedPresentations.includes(id)
            ? state.selectedPresentations.filter((p) => p !== id)
            : [...state.selectedPresentations, id],
        })),
    }),
    {
      name: "presentation-state",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // v0 clients persisted removed cloud providers (openai/lmstudio);
      // coerce them to the Ollama default so the UI and requests agree.
      migrate: (persistedState) => {
        const state = persistedState as Record<string, unknown>;
        if (state.modelProvider !== "ollama") {
          state.modelProvider = "ollama";
          state.modelId = "llama3.2:3b";
        }
        return state;
      },
      partialize: (state) => ({
        attachedFiles: state.attachedFiles,
        audience: state.audience,
        activeGenerationPresentationId: state.activeGenerationPresentationId,
        autoThemeEnabled: state.autoThemeEnabled,
        currentExtractorRagId: state.currentExtractorRagId,
        currentPresentationId: state.currentPresentationId,
        currentPresentationOwnerId: state.currentPresentationOwnerId,
        currentPresentationTitle: state.currentPresentationTitle,
        currentPresentationUpdatedAt: state.currentPresentationUpdatedAt,
        customThemeData: state.customThemeData,
        themeDataByTheme: state.themeDataByTheme,
        generatedThemeData: state.generatedThemeData,
        extractorRagIds: state.extractorRagIds,
        imageSearchResults: state.imageSearchResults,
        imageSource: state.imageSource,
        language: state.language,
        modelId: state.modelId,
        modelProvider: state.modelProvider,
        numSlides: state.numSlides,
        outline: state.outline,
        outlineItemIds: state.outlineItemIds,
        outlineTemplateOverrides: state.outlineTemplateOverrides,
        outlineToolCalls: state.outlineToolCalls,
        outputFormat: state.outputFormat,
        pageBackground: state.pageBackground,
        pageStyle: state.pageStyle,
        pendingCreateRequest: state.pendingCreateRequest,
        presentationInput: state.presentationInput,
        presentationStyle: state.presentationStyle,
        sourceDocument: state.sourceDocument,
        scenario: state.scenario,
        searchResults: state.searchResults,
        selectedChunks: state.selectedChunks,
        selectedSlideTemplates: state.selectedSlideTemplates,
        shouldStartImageSlideGeneration: state.shouldStartImageSlideGeneration,
        shouldStartOutlineGeneration: state.shouldStartOutlineGeneration,
        shouldStartPresentationGeneration:
          state.shouldStartPresentationGeneration,
        stockImageProvider: state.stockImageProvider,
        textContent: state.textContent,
        theme: state.theme,
        tone: state.tone,
        webSearchEnabled: state.webSearchEnabled,
      }),
    },
  ),
);
