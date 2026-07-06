"use client";

import { generateImageAction } from "@/app/_actions/apps/image-studio/generate";
import { getImageFromPixabay } from "@/app/_actions/apps/image-studio/pixabay";
import { getImageFromUnsplash } from "@/app/_actions/apps/image-studio/unsplash";
import { updatePresentation } from "@/app/_actions/notebook/presentation/presentationActions";
import { generateSlideImageAction } from "@/app/_actions/presentation/generate-slide-image";
import {
  getMessageText,
  getToolInputArgs,
  getToolName,
  getToolOutput,
  getToolState,
  isToolPart,
} from "@/lib/ai/uiMessageParts";
import { collectNotebookAgentToolCalls } from "@/lib/notebook/agent-activity";
import { isWebSearchToolName } from "@/lib/ai/tool-names";
import { createLogger } from "@/lib/observability/logger";
import { useDebouncedSave } from "@/hooks/presentation/useDebouncedSave";
import { applyGenerationAspectRatioToSlides } from "@/lib/presentation/aspect-ratio";
import {
  chunkOutlineForGeneration,
  sliceTemplateHintsForBatch,
} from "@/lib/presentation/generation-batching";
import { sanitizeGeneratedSlides } from "@/lib/presentation/generation-sanitize";
import { buildPresentationCustomization } from "@/lib/presentation/customization";
import { extractGeneratedPresentationTheme } from "@/lib/presentation/generated-theme";
import {
  getPersistablePresentationTheme,
  PRESENTATION_AUTO_THEME_ID,
} from "@/lib/presentation/theme-resolution";
import { type ThemeProperties } from "@/lib/presentation/themes";
import { usePresentationState } from "@/states/presentation-state";
import { useChat, useCompletion } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { usePresentationTheme } from "@/components/presentation/providers/PresentationThemeProvider";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { type PlateSlide, SlideParser } from "../utils/parser";
import {
  serializeTemplateHintsForPrompt,
  serializeTemplatesForPrompt,
} from "../utils/template-serializer";

interface PresentationOutlineMessageMetadata {
  numberOfCards: number;
  language: string;
  modelId: string;
  modelProvider: "ollama";
  webSearch: boolean;
  autoTheme: boolean;
  presentationId: string | null;
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
}

const generationLogger = createLogger("client:presentation-generation");

function stripXmlCodeBlock(input: string): string {
  let result = input.trim();
  if (result.startsWith("```xml")) {
    result = result.slice(6).trimStart();
  }
  if (result.endsWith("```")) {
    result = result.slice(0, -3).trimEnd();
  }
  return result;
}

function hasGeneratedOutline(outline: string[]): boolean {
  return outline.some((item) => item.trim().length > 0);
}

// Small local models don't always follow the requested "# Topic" heading
// level exactly (e.g. they may use "##" for every topic, or drift levels
// partway through). Splitting on any 1-3 hash heading instead of exactly
// "# " avoids collapsing a whole outline into a single item when that
// happens, at the cost of also splitting on any true sub-headings a model
// might emit within one topic — an acceptable trade since a missed split
// (one giant item instead of many) is the worse failure mode here.
const OUTLINE_HEADING_PATTERN = /^#{1,3}[ \t]+/m;
const OUTLINE_HEADING_SPLIT_PATTERN = /^#{1,3}[ \t]+/gm;

function parseOutlineItems(content: string): string[] {
  if (!OUTLINE_HEADING_PATTERN.test(content)) {
    return [];
  }

  const sections = content
    .split(OUTLINE_HEADING_SPLIT_PATTERN)
    .map((section) => section.trim())
    .filter(Boolean);

  return sections.map((section) => `# ${section}`);
}

function usesStockSearchForPresentation(
  imageSource: "automatic" | "ai" | "stock" | "gif",
): boolean {
  return imageSource === "automatic" || imageSource === "stock";
}

export function PresentationGenerationManager() {
  const { resolvedTheme } = usePresentationTheme();
  const {
    numSlides,
    language,
    modelId,
    modelProvider,
    presentationInput,
    generationAspectRatio,
    shouldStartOutlineGeneration,
    shouldStartPresentationGeneration,
    shouldStartImageSlideGeneration,
    webSearchEnabled,
    autoThemeEnabled,
    setIsGeneratingOutline,
    setShouldStartOutlineGeneration,
    setShouldStartPresentationGeneration,
    setShouldStartImageSlideGeneration,
    resetGeneration,
    setOutline,
    setOutlineToolCalls,
    setSearchResults,
    setSlides,
    setIsGeneratingPresentation,
    setCurrentPresentation,
    currentPresentationId,
    imageModel,
    imageSource,
    rootImageGeneration,
    startRootImageGeneration,
    completeRootImageGeneration,
    failRootImageGeneration,
    isGeneratingPresentation,
    isGeneratingOutline,
    slides,
    textContent,
    tone,
    audience,
    scenario,
  } = usePresentationState();

  // Persist slide updates during generation using debounced saves to limit frequency
  const { save } = useDebouncedSave();

  // Create a ref for the streaming parser to persist between renders
  const streamingParserRef = useRef<SlideParser>(new SlideParser());
  // Add refs to track the animation frame IDs
  const slidesRafIdRef = useRef<number | null>(null);
  const outlineRafIdRef = useRef<number | null>(null);
  const outlineTransportRef = useRef<DefaultChatTransport<UIMessage> | null>(
    null,
  );
  const outlineBufferRef = useRef<string[] | null>(null);
  const searchResultsBufferRef = useRef<Array<{
    query: string;
    results: unknown[];
  }> | null>(null);
  // Track the last processed messages length to avoid unnecessary updates
  const lastProcessedMessagesLength = useRef<number>(0);
  // Track if title has already been extracted to avoid unnecessary processing
  const titleExtractedRef = useRef<boolean>(false);
  const latestGeneratedThemeDataRef = useRef<ThemeProperties | null>(null);
  // Slides finalized from previously completed generation batches (batched
  // generation resets the parser/completion per batch, so these must be
  // merged back in on every RAF tick instead of being overwritten).
  const completedDeckSlidesRef = useRef<PlateSlide[]>([]);
  // Set by the presentation-generation onError handler so the batch loop
  // stops requesting further batches after one fails.
  const batchGenerationErroredRef = useRef<boolean>(false);

  // Function to update slides using requestAnimationFrame
  const updateSlidesWithRAF = (): void => {
    const processedPresentationCompletion = stripXmlCodeBlock(
      presentationCompletion,
    );
    streamingParserRef.current.reset();
    streamingParserRef.current.parseChunk(processedPresentationCompletion);
    streamingParserRef.current.finalize();
    const allSlides = streamingParserRef.current.getAllSlides();
    // Merge any completed root image URLs from state into streamed slides
    const mergedSlides = allSlides.map((slide) => {
      const gen = rootImageGeneration[slide.id];
      if (gen?.status === "success" && slide.rootImage?.query) {
        return {
          ...slide,
          rootImage: {
            ...slide.rootImage,
            url: gen.url,
            imageSource: (imageSource === "stock" ? "search" : "generate") as
              | "search"
              | "generate",
          },
        };
      }
      return slide;
    });
    // For any slide that has a rootImage query but no url, ensure generation is tracked/started
    for (const slide of allSlides) {
      const slideId = slide.id;
      const rootImage = slide.rootImage;
      if (rootImage?.query && !rootImage.url) {
        const already = rootImageGeneration[slideId];
        if (!already || already.status === "error") {
          startRootImageGeneration(slideId, rootImage.query);
        }
      }
    }
    setSlides(
      applyGenerationAspectRatioToSlides(
        [...completedDeckSlidesRef.current, ...mergedSlides],
        generationAspectRatio,
      ),
    );
    // Debounced save during generation to avoid excessive writes
    save();
    slidesRafIdRef.current = null;
  };

  // Function to extract title from content
  const extractTitle = (
    content: string,
  ): { title: string | null; cleanContent: string } => {
    const titleMatch = content.match(/<TITLE>(.*?)<\/TITLE>/i);
    if (titleMatch?.[1]) {
      const title = titleMatch[1].trim();
      const cleanContent = content.replace(/<TITLE>.*?<\/TITLE>/i, "").trim();
      return { title, cleanContent };
    }
    return { title: null, cleanContent: content };
  };

  const processMessages = (messages: typeof outlineMessages): void => {
    if (messages.length <= 1) return;
    const searchResults: Array<{ query: string; results: unknown[] }> = [];
    let latestTitle: string | null = null;
    let latestOutlineItems: string[] = [];

    for (const message of messages) {
      for (const part of message.parts) {
        if (!isToolPart(part)) {
          continue;
        }

        const invocation = {
          toolName: getToolName(part),
          state: getToolState(part),
          args: getToolInputArgs(part),
          result: getToolOutput(part),
        };

        if (
          isWebSearchToolName(invocation.toolName) &&
          invocation.state === "result" &&
          invocation.result
        ) {
          const argsRecord =
            typeof invocation.args === "object" && invocation.args !== null
              ? (invocation.args as Record<string, unknown>)
              : {};
          const query =
            typeof argsRecord.query === "string"
              ? argsRecord.query
              : "Unknown query";

          let parsedResult: unknown;
          try {
            parsedResult =
              typeof invocation.result === "string"
                ? JSON.parse(invocation.result)
                : invocation.result;
          } catch {
            parsedResult = invocation.result;
          }

          searchResults.push({
            query,
            results:
              parsedResult &&
              typeof parsedResult === "object" &&
              "results" in parsedResult &&
              Array.isArray(parsedResult.results)
                ? parsedResult.results
                : [],
          });
        }
      }

      if (message.role !== "assistant") {
        continue;
      }

      const assistantText = getMessageText(message);
      if (!assistantText) {
        continue;
      }

      const { title, cleanContent } = extractTitle(assistantText);
      if (title) {
        latestTitle = title;
      }

      const generatedTheme = extractGeneratedPresentationTheme(cleanContent);
      const outlineItems = parseOutlineItems(generatedTheme.cleanContent);
      if (outlineItems.length > 0) {
        latestOutlineItems = outlineItems;
      }

      if (generatedTheme.themeData) {
        latestGeneratedThemeDataRef.current = generatedTheme.themeData;
      }
    }

    if (!titleExtractedRef.current && latestTitle) {
      setCurrentPresentation(currentPresentationId, latestTitle);
      titleExtractedRef.current = true;
    }

    if (searchResults.length > 0) {
      searchResultsBufferRef.current = searchResults;
    }

    if (latestOutlineItems.length > 0) {
      outlineBufferRef.current = latestOutlineItems;
    }

    if (latestGeneratedThemeDataRef.current) {
      const state = usePresentationState.getState();
      state.setGeneratedThemeData(latestGeneratedThemeDataRef.current);
      state.setTheme(PRESENTATION_AUTO_THEME_ID);
    }
  };

  // Function to update outline and search results using requestAnimationFrame
  const updateOutlineWithRAF = (): void => {
    // Batch all updates in a single RAF callback for better performance

    // Update search results if available
    if (searchResultsBufferRef.current !== null) {
      setSearchResults(searchResultsBufferRef.current);
      searchResultsBufferRef.current = null;
    }

    // Update outline if available
    if (outlineBufferRef.current !== null) {
      setOutline(outlineBufferRef.current);
      outlineBufferRef.current = null;
    }

    // Clear the current frame ID
    outlineRafIdRef.current = null;
  };

  // Outline generation with or without web search
  if (outlineTransportRef.current === null) {
    outlineTransportRef.current = new DefaultChatTransport({
      api: "/api/presentation/outline",
    });
  }

  const {
    messages: outlineMessages,
    sendMessage: appendOutlineMessage,
    setMessages: setOutlineMessages,
  } = useChat({
    transport: outlineTransportRef.current,

    onFinish: () => {
      const {
        currentPresentationId,
        outline,
        searchResults,
        currentPresentationTitle,
        imageSource,
      } = usePresentationState.getState();
      const state = usePresentationState.getState();
      const generatedThemeData = latestGeneratedThemeDataRef.current;

      setIsGeneratingOutline(false);
      setShouldStartOutlineGeneration(false);
      setShouldStartPresentationGeneration(false);

      if (!hasGeneratedOutline(outline)) {
        generationLogger.warn(
          "Presentation outline completed without any outline items",
          {
            presentationId: currentPresentationId,
            searchResultsCount: searchResults.length,
          },
        );
        toast.error(
          "Outline generation finished without producing an outline. Please try again.",
        );
        return;
      }

      generationLogger.info("Presentation outline completed", {
        presentationId: currentPresentationId,
        outlineItems: outline.length,
        searchResultsCount: searchResults.length,
        title: currentPresentationTitle,
        imageSource,
      });

      if (currentPresentationId) {
        const outlineToolCalls = collectNotebookAgentToolCalls(outlineMessages);
        setOutlineToolCalls(outlineToolCalls);

        void updatePresentation({
          id: currentPresentationId,
          outline,
          searchResults,
          toolCalls: outlineToolCalls,
          selectedChunks: state.selectedChunks.map(
            ({ chunkId, slideNumber, content, ragId }) => ({
              chunkId,
              slideNumber,
              content,
              ragId,
            }),
          ),
          prompt: presentationInput,
          title: currentPresentationTitle ?? "",
          imageSource,
          theme: getPersistablePresentationTheme({
            fallbackTheme: resolvedTheme === "dark" ? "ebony" : "mystique",
            theme: generatedThemeData ? PRESENTATION_AUTO_THEME_ID : state.theme,
          }),
          customization: buildPresentationCustomization({
            customThemeData: generatedThemeData ?? state.customThemeData,
            themeDataByTheme: state.themeDataByTheme,
            generatedThemeData: generatedThemeData ?? state.generatedThemeData,
            theme: generatedThemeData ? PRESENTATION_AUTO_THEME_ID : state.theme,
            pageStyle: state.pageStyle,
            presentationStyle: state.presentationStyle,
            generationAspectRatio: state.generationAspectRatio,
            textContent: state.textContent,
            tone: state.tone,
            audience: state.audience,
            scenario: state.scenario,
            pageBackground: state.pageBackground,
            selectedSlideTemplates: state.selectedSlideTemplates,
            outlineItemIds: state.outlineItemIds,
            outlineTemplateOverrides: state.outlineTemplateOverrides,
          }),
        });
      }

      // Cancel any pending outline animation frame
      if (outlineRafIdRef.current !== null) {
        cancelAnimationFrame(outlineRafIdRef.current);
        outlineRafIdRef.current = null;
      }
    },
    onError: (error) => {
      generationLogger.error("Presentation outline generation failed", error, {
        presentationId: usePresentationState.getState().currentPresentationId,
      });
      setIsGeneratingOutline(false);
      setShouldStartOutlineGeneration(false);
      setShouldStartPresentationGeneration(false);
      toast.error("Failed to generate outline: " + error.message);
      resetGeneration();
      setOutlineToolCalls([]);

      if (outlineRafIdRef.current !== null) {
        cancelAnimationFrame(outlineRafIdRef.current);
        outlineRafIdRef.current = null;
      }
    },
  });

  // Lightweight useEffect that only schedules RAF updates
  useEffect(() => {
    setOutlineToolCalls(collectNotebookAgentToolCalls(outlineMessages));

    if (outlineMessages.length > 1) {
      lastProcessedMessagesLength.current = outlineMessages.length;
      processMessages(outlineMessages);
      if (outlineRafIdRef.current === null) {
        outlineRafIdRef.current = requestAnimationFrame(updateOutlineWithRAF);
      }
    }
  }, [outlineMessages, webSearchEnabled, setOutlineToolCalls]);

  // Watch for outline generation start
  useEffect(() => {
    const startOutlineGeneration = async (): Promise<void> => {
      if (shouldStartOutlineGeneration) {
        try {
          titleExtractedRef.current = false;
          setOutlineMessages([]);
          outlineBufferRef.current = null;
          searchResultsBufferRef.current = null;
          latestGeneratedThemeDataRef.current = null;
          lastProcessedMessagesLength.current = 0;

          const { presentationInput } = usePresentationState.getState();
          if (outlineRafIdRef.current === null) {
            outlineRafIdRef.current =
              requestAnimationFrame(updateOutlineWithRAF);
          }

          generationLogger.info("Presentation outline generation started", {
            presentationId: currentPresentationId,
            modelProvider,
            modelId: modelId || "llama3.2:3b",
            numSlides,
            language,
            webSearchEnabled,
            textContent,
            tone,
            audience,
            scenario,
          });

          await appendOutlineMessage({
            role: "user",
            metadata: {
              numberOfCards: numSlides,
              language,
              modelId,
              modelProvider,
              webSearch: webSearchEnabled,
              autoTheme: autoThemeEnabled,
              presentationId: currentPresentationId,
              textContent,
              tone,
              audience,
              scenario,
            } satisfies PresentationOutlineMessageMetadata,
            parts: [{ type: "text", text: presentationInput }],
          });
        } catch (error) {
          generationLogger.error(
            "Failed to start presentation outline generation",
            error,
            {
              presentationId: currentPresentationId,
            },
          );
        }
      }
    };

    void startOutlineGeneration();
  }, [shouldStartOutlineGeneration]);

  // Persists the final theme/customization and clears generation flags.
  // Runs once, after every generation batch has completed successfully —
  // NOT per batch (batched generation calls generatePresentation multiple
  // times per deck; only the very last one means the deck is actually done).
  const finalizePresentationGeneration = () => {
    generationLogger.info("Presentation generation completed", {
      presentationId: currentPresentationId,
      generatedSlides: usePresentationState.getState().slides.length,
    });
    setIsGeneratingPresentation(false);
    setShouldStartPresentationGeneration(false);
    const state = usePresentationState.getState();
    if (currentPresentationId) {
      updatePresentation({
        id: currentPresentationId,
        theme: getPersistablePresentationTheme({
          fallbackTheme: resolvedTheme === "dark" ? "ebony" : "mystique",
          theme: state.theme,
        }),
        customization: buildPresentationCustomization({
          customThemeData: state.customThemeData,
          themeDataByTheme: state.themeDataByTheme,
          generatedThemeData: state.generatedThemeData,
          theme: state.theme,
          pageStyle: state.pageStyle,
          presentationStyle: state.presentationStyle,
          generationAspectRatio: state.generationAspectRatio,
          textContent: state.textContent,
          tone: state.tone,
          audience: state.audience,
          scenario: state.scenario,
          pageBackground: state.pageBackground,
          selectedSlideTemplates: state.selectedSlideTemplates,
          outlineItemIds: state.outlineItemIds,
          outlineTemplateOverrides: state.outlineTemplateOverrides,
        }),
      });
    }
  };

  const { completion: presentationCompletion, complete: generatePresentation } =
    useCompletion({
      api: "/api/presentation/generate",
      onFinish: (_prompt, _completion) => {
        generationLogger.info("Presentation generation batch completed", {
          presentationId: currentPresentationId,
          generatedSlides: usePresentationState.getState().slides.length,
        });
      },
      onError: (error) => {
        generationLogger.error("Presentation generation failed", error, {
          presentationId: usePresentationState.getState().currentPresentationId,
        });
        toast.error("Failed to generate presentation: " + error.message);
        batchGenerationErroredRef.current = true;
        resetGeneration();
        streamingParserRef.current.reset();

        // Cancel any pending animation frame
        if (slidesRafIdRef.current !== null) {
          cancelAnimationFrame(slidesRafIdRef.current);
          slidesRafIdRef.current = null;
        }
      },
    });

  // Image slides generation
  const { completion: imageSlidesCompletion, complete: generateImageSlides } =
    useCompletion({
      api: "/api/presentation/generate-image-slides",
      onFinish: (_prompt, _completion) => {
        generationLogger.info("Image slide generation completed", {
          presentationId: currentPresentationId,
          generatedSlides: usePresentationState.getState().slides.length,
        });
        setIsGeneratingPresentation(false);
        setShouldStartImageSlideGeneration(false);
        const state = usePresentationState.getState();
        if (currentPresentationId) {
          updatePresentation({
            id: currentPresentationId,
            theme: getPersistablePresentationTheme({
              fallbackTheme: resolvedTheme === "dark" ? "ebony" : "mystique",
              theme: state.theme,
            }),
            customization: buildPresentationCustomization({
              customThemeData: state.customThemeData,
              themeDataByTheme: state.themeDataByTheme,
              generatedThemeData: state.generatedThemeData,
              theme: state.theme,
              pageStyle: state.pageStyle,
              presentationStyle: state.presentationStyle,
              generationAspectRatio: state.generationAspectRatio,
              textContent: state.textContent,
              tone: state.tone,
              audience: state.audience,
              scenario: state.scenario,
              pageBackground: state.pageBackground,
              selectedSlideTemplates: state.selectedSlideTemplates,
              outlineItemIds: state.outlineItemIds,
              outlineTemplateOverrides: state.outlineTemplateOverrides,
            }),
          });
        }
      },
      onError: (error) => {
        generationLogger.error("Image slide generation failed", error, {
          presentationId: usePresentationState.getState().currentPresentationId,
        });
        toast.error("Failed to generate image slides: " + error.message);
        resetGeneration();
        streamingParserRef.current.reset();

        // Cancel any pending animation frame
        if (slidesRafIdRef.current !== null) {
          cancelAnimationFrame(slidesRafIdRef.current);
          slidesRafIdRef.current = null;
        }
      },
    });

  useEffect(() => {
    if (presentationCompletion) {
      try {
        // Only schedule a new frame if one isn't already pending
        if (slidesRafIdRef.current === null) {
          slidesRafIdRef.current = requestAnimationFrame(updateSlidesWithRAF);
        }
      } catch (error) {
        generationLogger.error("Failed to process presentation XML stream", error, {
          presentationId: usePresentationState.getState().currentPresentationId,
        });
        toast.error("Error processing presentation content");
      }
    }
  }, [presentationCompletion]);

  // Handle image slides completion streaming
  useEffect(() => {
    if (imageSlidesCompletion) {
      try {
        const processedCompletion = stripXmlCodeBlock(imageSlidesCompletion);
        streamingParserRef.current.reset();
        streamingParserRef.current.parseChunk(processedCompletion);
        streamingParserRef.current.finalize();
        const allSlides = streamingParserRef.current.getAllSlides();

        // Mark all slides as image slides and start image generation
        const imageSlidesData = allSlides.map((slide) => {
          const gen = rootImageGeneration[slide.id];
          if (gen?.status === "success" && slide.rootImage?.query) {
            return {
              ...slide,
              isImageSlide: true,
              rootImage: {
                ...slide.rootImage,
                url: gen.url,
                imageSource: "generate" as const,
              },
            };
          }
          return { ...slide, isImageSlide: true };
        });

        // Start image generation for slides that need it
        for (const slide of allSlides) {
          const slideId = slide.id;
          const rootImage = slide.rootImage;
          if (rootImage?.query && !rootImage.url) {
            const already = rootImageGeneration[slideId];
            if (!already || already.status === "error") {
              startRootImageGeneration(slideId, rootImage.query);
            }
          }
        }

        setSlides(
          applyGenerationAspectRatioToSlides(
            imageSlidesData,
            generationAspectRatio,
          ),
        );
        save();
      } catch (error) {
        generationLogger.error("Failed to process image slides XML stream", error, {
          presentationId: usePresentationState.getState().currentPresentationId,
        });
        toast.error("Error processing image slides content");
      }
    }
  }, [imageSlidesCompletion]);

  useEffect(() => {
    if (shouldStartPresentationGeneration) {
      const {
        outline,
        presentationInput,
        language,
        modelId,
        modelProvider,
        tone,
        currentPresentationTitle,
        searchResults: stateSearchResults,
        setThumbnailUrl,
        textContent,
        audience,
        scenario,
        imageSource,
        selectedSlideTemplates,
        outlineTemplateOverrides,
      } = usePresentationState.getState();

      if (!hasGeneratedOutline(outline)) {
        setShouldStartPresentationGeneration(false);
        setIsGeneratingPresentation(false);
        toast.error("Generate an outline before generating the presentation.");
        return;
      }

      // Serialize templates for AI if any are selected
      const templateContext =
        selectedSlideTemplates.length > 0
          ? serializeTemplatesForPrompt(selectedSlideTemplates)
          : undefined;
      const outlineTemplateHints =
        selectedSlideTemplates.length > 0 &&
        Object.keys(outlineTemplateOverrides).length > 0
          ? serializeTemplateHintsForPrompt(
              outlineTemplateOverrides,
              selectedSlideTemplates,
            )
          : undefined;

      const batches = chunkOutlineForGeneration(outline);
      completedDeckSlidesRef.current = [];
      batchGenerationErroredRef.current = false;
      // Explicitly clear any pre-existing slides instead of relying on the
      // first streamed batch to overwrite them: if batches resolve fast
      // enough that no live RAF preview tick fires before this run's first
      // setSlides call, a stale slide from before generation started could
      // otherwise remain visible/persisted underneath the new ones.
      setSlides([]);
      streamingParserRef.current.reset();
      setIsGeneratingPresentation(true);
      setThumbnailUrl(undefined);
      generationLogger.info("Presentation generation started", {
        presentationId: currentPresentationId,
        title: currentPresentationTitle ?? presentationInput ?? "",
        outlineItems: outline.length,
        batchCount: batches.length,
        modelProvider,
        modelId: modelId || "llama3.2:3b",
        imageSource,
        templateCount: selectedSlideTemplates.length,
      });

      void (async () => {
        for (const batch of batches) {
          if (batchGenerationErroredRef.current) {
            return;
          }

          streamingParserRef.current.reset();
          generationLogger.info("Presentation generation batch started", {
            presentationId: currentPresentationId,
            batchStartIndex: batch.startIndex,
            batchSlideCount: batch.outline.length,
          });

          const batchCompletion = await generatePresentation(
            presentationInput ?? "",
            {
              body: {
                title: currentPresentationTitle ?? presentationInput ?? "",
                prompt: presentationInput ?? "",
                outline: batch.outline,
                searchResults: stateSearchResults,
                language,
                tone: tone,
                modelId,
                modelProvider,
                textContent,
                audience,
                scenario,
                imageSource,
                templateContext,
                outlineTemplateHints: sliceTemplateHintsForBatch(
                  outlineTemplateHints,
                  batch.startIndex,
                  batch.outline.length,
                ),
                selectedTemplateCount: selectedSlideTemplates.length,
              },
            },
          );

          if (batchGenerationErroredRef.current || batchCompletion == null) {
            return;
          }

          // Parse this batch's final text directly instead of relying on
          // streamingParserRef's RAF-driven state, which may not have
          // caught up yet at the exact moment this promise resolves.
          const batchParser = new SlideParser();
          batchParser.parseChunk(stripXmlCodeBlock(batchCompletion));
          batchParser.finalize();
          completedDeckSlidesRef.current = [
            ...completedDeckSlidesRef.current,
            ...batchParser.getAllSlides(),
          ];
        }

        if (batchGenerationErroredRef.current) {
          return;
        }

        // Root image generation is async and can finish after a batch's
        // text is already captured into completedDeckSlidesRef. Overwriting
        // the whole deck with that ref verbatim would erase any image that
        // had already completed and been applied to live state in the
        // meantime -- merge those back in instead of discarding them.
        const liveSlides = usePresentationState.getState().slides;
        const finalSlides = completedDeckSlidesRef.current.map((slide) => {
          if (slide.rootImage?.url) {
            return slide;
          }
          const liveSlide = liveSlides.find((s) => s.id === slide.id);
          return liveSlide?.rootImage?.url
            ? { ...slide, rootImage: liveSlide.rootImage }
            : slide;
        });

        setSlides(
          applyGenerationAspectRatioToSlides(
            sanitizeGeneratedSlides(finalSlides),
            usePresentationState.getState().generationAspectRatio,
          ),
        );
        finalizePresentationGeneration();
      })();
    }
  }, [shouldStartPresentationGeneration]);

  // Watch for image slide generation start
  useEffect(() => {
    if (shouldStartImageSlideGeneration) {
      const {
        outline,
        presentationInput,
        language,
        modelId,
        modelProvider,
        currentPresentationTitle,
        setThumbnailUrl,
      } = usePresentationState.getState();

      if (!hasGeneratedOutline(outline)) {
        setShouldStartImageSlideGeneration(false);
        setIsGeneratingPresentation(false);
        toast.error("Generate an outline before generating image slides.");
        return;
      }

      // Reset the parser before starting a new generation
      streamingParserRef.current.reset();
      setIsGeneratingPresentation(true);
      setThumbnailUrl(undefined);
      generationLogger.info("Image slide generation started", {
        presentationId: currentPresentationId,
        title: currentPresentationTitle ?? presentationInput ?? "",
        outlineItems: outline.length,
        modelProvider,
        modelId: modelId || "llama3.2:3b",
      });

      void generateImageSlides(presentationInput ?? "", {
        body: {
          title: currentPresentationTitle ?? presentationInput ?? "",
          prompt: presentationInput ?? "",
          outline,
          language,
          modelId,
          modelProvider,
        },
      });
    }
  }, [shouldStartImageSlideGeneration]);

  // Listen for manual root image generation changes (when user manually triggers image generation)
  useEffect(() => {
    for (const [slideId, gen] of Object.entries(rootImageGeneration)) {
      if (gen.status === "queued") {
        // Next, set status to "pending"
        usePresentationState.getState().rootImageGeneration &&
          usePresentationState.setState((state) => ({
            rootImageGeneration: {
              ...state.rootImageGeneration,
              [slideId]: {
                ...gen,
                status: "generating",
              },
            },
          }));

        const slide = slides.find((s) => s.id === slideId);
        if (slide?.rootImage?.query) {
          const usesStockSearch =
            usesStockSearchForPresentation(imageSource) && !slide.isImageSlide;
          generationLogger.info("Root image generation started", {
            presentationId: currentPresentationId,
            slideId,
            isImageSlide: Boolean(slide.isImageSlide),
            imageSource,
            imageModel,
            query: slide.rootImage.query,
          });
          void (async () => {
            try {
              let result;

              if (usesStockSearch) {
                const { stockImageProvider } = usePresentationState.getState();
                if (
                  imageSource === "stock" &&
                  stockImageProvider === "pixabay"
                ) {
                  const pixabayResult = await getImageFromPixabay(
                    slide.rootImage!.query,
                    slide.rootImage!.layoutType,
                  );
                  if (pixabayResult.success && pixabayResult.imageUrl) {
                    result = {
                      success: true,
                      image: { url: pixabayResult.imageUrl },
                    };
                  }
                } else {
                  const unsplashResult = await getImageFromUnsplash(
                    slide.rootImage!.query,
                    slide.rootImage!.layoutType,
                  );
                  if (unsplashResult.success && unsplashResult.imageUrl) {
                    result = {
                      success: true,
                      image: { url: unsplashResult.imageUrl },
                    };
                  }
                }
              } else {
                if (slide?.isImageSlide) {
                  result = await generateSlideImageAction(
                    slide.rootImage!.query,
                    imageModel,
                  );
                } else {
                  result = await generateImageAction(
                    slide.rootImage!.query,
                    imageModel,
                  );
                }
              }

              if (result?.success && result.image?.url) {
                generationLogger.info("Root image generation completed", {
                  presentationId: currentPresentationId,
                  slideId,
                  imageUrl: result.image.url,
                  mode: usesStockSearch ? "stock-search" : "ai-generate",
                });
                completeRootImageGeneration(slideId, result.image.url);
                usePresentationState.getState().setSlides(
                  usePresentationState.getState().slides.map((s) =>
                    s.id === slideId
                      ? {
                          ...s,
                        rootImage: {
                          ...s.rootImage!,
                          url: result.image.url,
                          imageSource: usesStockSearch
                            ? "search"
                            : "generate",
                        },
                      }
                      : s,
                  ),
                );
                save();
              } else {
                generationLogger.error(
                  "Root image generation failed without an image URL",
                  undefined,
                  {
                    presentationId: currentPresentationId,
                    slideId,
                    mode: usesStockSearch ? "stock-search" : "ai-generate",
                    error: result?.error ?? "No image url returned",
                  },
                );
                failRootImageGeneration(
                  slideId,
                  result?.error ?? "No image url returned",
                );
              }
            } catch (err) {
              const message =
                err instanceof Error ? err.message : "Image generation failed";
              generationLogger.error("Root image generation threw an error", err, {
                presentationId: currentPresentationId,
                slideId,
                mode: usesStockSearch ? "stock-search" : "ai-generate",
              });
              failRootImageGeneration(slideId, message);
            }
          })();
        }
      }
    }
  }, [
    rootImageGeneration,
    isGeneratingPresentation,
    isGeneratingOutline,
    slides,
    imageSource,
    imageModel,
    completeRootImageGeneration,
    failRootImageGeneration,
    setSlides,
  ]);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (slidesRafIdRef.current !== null) {
        cancelAnimationFrame(slidesRafIdRef.current);
        slidesRafIdRef.current = null;
      }

      if (outlineRafIdRef.current !== null) {
        cancelAnimationFrame(outlineRafIdRef.current);
        outlineRafIdRef.current = null;
      }
    };
  }, []);

  return null;
}
