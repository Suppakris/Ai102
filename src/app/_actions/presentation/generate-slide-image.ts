"use server";

import { auth } from "@/backend/auth";
import { runImageGeneration } from "@/backend/queue/image-generation";
import { checkRateLimit } from "@/backend/rate-limit";

// Free by default: Pollinations.ai needs no API key. FAL is opt-in — pass an
// imageModel string containing "fal-ai/" and configure FAL_API_KEY to use it.
const DEFAULT_SLIDE_IMAGE_MODEL = "flux";

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

  // Non-admins are capped to the free default model rather than blocked
  // outright, matching the other image-generation actions.
  const actualModel = session.user.isAdmin ? imageModel : DEFAULT_SLIDE_IMAGE_MODEL;

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

    console.log(`Generating slide image with model: ${actualModel}`);

    const generatedImage = await runImageGeneration(
      actualModel.startsWith("fal-ai/")
        ? { provider: "fal", prompt, model: actualModel, userId: session.user.id }
        : { provider: "pollinations", prompt, model: actualModel, userId: session.user.id },
    );

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
