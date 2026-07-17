"use server";

import { utapi } from "@/app/api/uploadthing/core";
import {
  DEFAULT_IMAGE_MODEL,
  getFalImageGenerationInput,
  type ImageAspectRatio,
  type ImageModelList,
} from "@/constants/image-models";
import { env } from "@/env";
import { requireOptionalIntegration } from "@/lib/env/optional-integrations";
import { auth } from "@/backend/auth";
import { db } from "@/backend/db";
import { fal } from "@fal-ai/client";
import { UTFile } from "uploadthing/server";

async function persistGeneratedImage(
  imageUrl: string,
  prompt: string,
  userId: string,
  filePrefix: string,
) {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("Failed to download generated image");
  }

  const imageBlob = await imageResponse.blob();
  const imageBuffer = await imageBlob.arrayBuffer();
  const filename = `${filePrefix}_${Date.now()}.png`;
  const utFile = new UTFile([new Uint8Array(imageBuffer)], filename);
  const uploadResult = await utapi.uploadFiles([utFile]);

  if (!uploadResult[0]?.data?.ufsUrl) {
    throw new Error("Failed to upload generated image");
  }

  return db.generatedImage.create({
    data: {
      url: uploadResult[0].data.ufsUrl,
      prompt,
      userId,
    },
  });
}

async function generateFalImage(
  prompt: string,
  model: ImageModelList,
  userId: string,
  aspectRatio: ImageAspectRatio,
) {
  const falConfig = requireOptionalIntegration({
    integration: "FAL",
    envVar: "FAL_API_KEY",
    value: env.FAL_API_KEY,
    feature: "AI image generation",
  });

  if (!falConfig.ok) {
    return {
      success: false,
      error: falConfig.error,
    };
  }

  fal.config({
    credentials: falConfig.value,
  });

  const result = await fal.subscribe(model, {
    input: getFalImageGenerationInput({ model, prompt, aspectRatio }),
  });

  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error("Failed to generate image");
  }

  const image = await persistGeneratedImage(imageUrl, prompt, userId, "image");

  return {
    success: true,
    image,
  };
}

export async function generateImageAction(
  prompt: string,
  model: ImageModelList = DEFAULT_IMAGE_MODEL,
  aspectRatio: ImageAspectRatio = "16:9",
) {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      success: false,
      error: "You must be logged in to generate images",
    };
  }

  try {
    const actualModel = session.user.isAdmin ? model : DEFAULT_IMAGE_MODEL;
    return await generateFalImage(
      prompt,
      actualModel,
      session.user.id,
      aspectRatio,
    );
  } catch (error) {
    console.error("Error generating image:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate image",
    };
  }
}
