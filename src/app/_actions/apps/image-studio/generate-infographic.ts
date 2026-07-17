"use server";

import { fal } from "@fal-ai/client";
import { UTFile } from "uploadthing/server";

import { utapi } from "@/app/api/uploadthing/lib";
import {
  DEFAULT_IMAGE_MODEL,
  getFalImageGenerationInput,
  type ImageModelList,
} from "@/constants/image-models";
import { env } from "@/env";
import { logger } from "@/lib/observability/server/logger";
import { auth } from "@/backend/auth";
import { db } from "@/backend/db";

fal.config({
  credentials: env.FAL_API_KEY,
});

type GenerateInfographicImageActionInput = {
  illustrationStyle?: string;
  layout?: string;
  model?: ImageModelList;
  prompt: string;
};

function buildInfographicPrompt({
  prompt,
  illustrationStyle,
  layout,
}: Required<
  Pick<
    GenerateInfographicImageActionInput,
    "illustrationStyle" | "layout" | "prompt"
  >
>) {
  return [
    "Create a polished, presentation-ready infographic image.",
    `Topic and source content: ${prompt}`,
    `Infographic layout: ${layout}.`,
    `Illustration style: ${illustrationStyle}.`,
    "Design requirements:",
    "- Build a clear visual hierarchy with one concise headline, short supporting labels, and meaningful grouped sections.",
    "- Use item labels of 20 characters or fewer and item descriptions of 60 characters or fewer.",
    "- For layout-based infographics such as timeline, process, comparison, hierarchy, cycle, roadmap, or matrix layouts, show only the strongest 4 to 5 visible items. Synthesize extra source details into those items instead of adding more sections.",
    "- Word clouds and chart-style visuals may include more items when useful.",
    "- Use accurate, readable text only; avoid misspellings, warped letters, fake words, and placeholder gibberish.",
    "- Convert the topic into a structured infographic with visual flow, icons, labels, connectors, and compact data callouts where useful.",
    "- Keep the composition uncluttered with generous spacing, strong alignment, and balanced margins for slide embedding.",
    "- Use a modern editorial presentation aesthetic with crisp vector-like shapes, high contrast, and clean typography.",
    "- Avoid photorealistic scenes unless the prompt explicitly requires them; prioritize diagrammatic explanation over decoration.",
    "- Do not include watermarks, UI chrome, browser frames, logos unless requested, QR codes, or stock-photo overlays.",
    "- The final output must be a single complete infographic image ready to place directly into a presentation.",
  ].join("\n");
}

export async function generateInfographicImageAction({
  illustrationStyle = "Bauhaus",
  layout = "Timeline",
  model = DEFAULT_IMAGE_MODEL,
  prompt,
}: GenerateInfographicImageActionInput) {
  const trimmedPrompt = prompt.trim();
  const actionName = "apps.image-studio.generateInfographicImageAction";
  const span = logger.startSpan(`notebook.server_action.${actionName}`, {
    attributes: {
      "allweone.scope": "notebook",
      "allweone.action.type": "server_action",
      "allweone.action.name": actionName,
      "allweone.server.image_generation.prompt.length": trimmedPrompt.length,
      "allweone.server.image_generation.requested_model": model,
    },
  });

  const session = await auth();

  if (!session?.user?.id) {
    span.annotate({
      "allweone.server.image_generation.authorized": false,
    });
    span.end();
    return {
      success: false,
      error: "You must be logged in to generate infographics",
    };
  }

  if (!trimmedPrompt) {
    span.end();
    return {
      success: false,
      error: "Prompt is required",
    };
  }

  const fullPrompt = buildInfographicPrompt({
    prompt: trimmedPrompt,
    illustrationStyle: illustrationStyle.trim() || "Bauhaus",
    layout: layout.trim() || "Timeline",
  });

  try {
    const actualModel = session.user.isAdmin ? model : DEFAULT_IMAGE_MODEL;

    span.annotate({
      "allweone.server.image_generation.authorized": true,
      "allweone.server.image_generation.admin": session.user.isAdmin,
      "allweone.server.image_generation.model": actualModel,
      "allweone.server.image_generation.user_id": session.user.id,
    });
    span.event("allweone.server.image_generation.started", {
      "allweone.server.image_generation.model": actualModel,
    });

    const result = await fal.subscribe(actualModel, {
      input: getFalImageGenerationInput({
        model: actualModel,
        prompt: fullPrompt,
        aspectRatio: "16:9",
      }),
    });

    const imageUrl = result.data?.images?.[0]?.url;

    if (!imageUrl) {
      throw new Error("Failed to generate infographic");
    }

    span.event("allweone.server.image_generation.image_ready", {
      "allweone.server.image_generation.source_url_available": true,
    });

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error("Failed to download generated infographic");
    }

    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();
    const filename = `infographic_${Date.now()}.png`;
    const utFile = new UTFile([new Uint8Array(imageBuffer)], filename);
    const uploadResult = await utapi.uploadFiles([utFile]);
    const permanentUrl = uploadResult[0]?.data?.ufsUrl;

    if (!permanentUrl) {
      throw new Error("Failed to upload generated infographic");
    }

    span.event("allweone.server.image_generation.upload_completed", {
      "allweone.server.image_generation.uploaded": true,
    });

    const generatedImage = await db.generatedImage.create({
      data: {
        url: permanentUrl,
        prompt: fullPrompt,
        userId: session.user.id,
      },
      select: {
        id: true,
        prompt: true,
        url: true,
      },
    });

    span.event("allweone.server.image_generation.completed", {
      "allweone.server.image_generation.generated_image.id": generatedImage.id,
    });

    return {
      success: true,
      image: generatedImage,
    };
  } catch (error) {
    span.error(error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate infographic",
    };
  } finally {
    span.end();
  }
}
