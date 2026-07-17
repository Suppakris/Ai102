"use server";

import { auth } from "@/backend/auth";
import { runImageGeneration } from "@/backend/queue/image-generation";
import { checkRateLimit } from "@/backend/rate-limit";

// Nano Banana Pro model for presentation slide images
// const SLIDE_IMAGE_MODEL = "fal-ai/nano-banana-pro";
const DEFAULT_SLIDE_IMAGE_MODEL = "fal-ai/flux-2/flash";

export async function generateSlideImageAction(
  prompt: string,
  imageModel: string = DEFAULT_SLIDE_IMAGE_MODEL,
) {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      success: false,
      error: "You must be logged in to generate images",
    };
  }

  // Admin only feature
  if (!session.user.isAdmin) {
    return {
      success: false,
      error: "This feature is only available for admin users",
    };
  }

  try {
    const rateLimit = await checkRateLimit(`slide-image-generate:${session.user.id}`, {
      max: 60,
      windowSeconds: 300,
    });
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `Too many image generation requests. Try again in ${rateLimit.retryAfterSeconds}s.`,
      };
    }

    console.log(`Generating slide image with model: ${imageModel}`);

    const generatedImage = await runImageGeneration({
      provider: "fal",
      prompt,
      model: imageModel,
      userId: session.user.id,
    });

    console.log(`Uploaded slide image to: ${generatedImage.url}`);

    return {
      success: true,
      image: generatedImage,
    };
  } catch (error) {
    console.error("Error generating slide image:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate slide image",
    };
  }
}
