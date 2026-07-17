"use server";

import {
  DEFAULT_IMAGE_MODEL,
  type ImageAspectRatio,
  type ImageModelList,
} from "@/constants/image-models";
import { auth } from "@/backend/auth";
import { db } from "@/backend/db";
import { generateImageUrl } from "@/backend/queue/image-generation";

export async function generateImageAction(
  prompt: string,
  model: ImageModelList = DEFAULT_IMAGE_MODEL,
  // Aspect ratio only affects the paid FAL path today; Pollinations always
  // renders 16:9 (see generateWithPollinations in the queue module).
  _aspectRatio: ImageAspectRatio = "16:9",
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
    const url = await generateImageUrl(prompt, actualModel);
    const image = await db.generatedImage.create({
      data: { url, prompt, userId: session.user.id },
    });

    return {
      success: true,
      image,
    };
  } catch (error) {
    console.error("Error generating image:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate image",
    };
  }
}
