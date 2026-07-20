"use server";

import { auth } from "@/backend/auth";
import { runImageGeneration } from "@/backend/queue/image-generation";
import { checkRateLimit } from "@/backend/rate-limit";

export type ImageModelList =
  | "black-forest-labs/FLUX1.1-pro"
  | "black-forest-labs/FLUX.1-schnell"
  | "black-forest-labs/FLUX.1-schnell-Free"
  | "black-forest-labs/FLUX.1-pro"
  | "black-forest-labs/FLUX.1-dev";

export async function generateImageAction(
  prompt: string,
  model: ImageModelList = "black-forest-labs/FLUX.1-schnell-Free",
) {
  // Get the current session
  const session = await auth();

  // Check if user is authenticated
  if (!session?.user?.id) {
    throw new Error("You must be logged in to generate images");
  }

  try {
    const rateLimit = await checkRateLimit(`image-generate:${session.user.id}`, {
      max: 20,
      windowSeconds: 300,
    });
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `Too many image generation requests. Try again in ${rateLimit.retryAfterSeconds}s.`,
      };
    }

    console.log(`Generating image with model: ${model}`);

    const generatedImage = await runImageGeneration({
      provider: "together",
      prompt,
      model,
      userId: session.user.id,
    });

    console.log(`Generated image URL: ${generatedImage.url}`);

    return {
      success: true,
      image: generatedImage,
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
