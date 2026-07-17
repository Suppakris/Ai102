export type ImageModelList =
  | "pollinations/flux"
  | "pollinations/turbo"
  | "openai/gpt-image-2"
  | "fal-ai/nano-banana-2"
  | "fal-ai/nano-banana-pro"
  | "fal-ai/flux-2/turbo"
  | "fal-ai/flux-2/flash"
  | "fal-ai/flux-2-pro"
  | "fal-ai/flux-2"
  | "fal-ai/flux/dev";

// Free, no API key required (Pollinations.ai). FAL models below need
// FAL_API_KEY and cost money per image — kept as an admin-only opt-in.
export const DEFAULT_IMAGE_MODEL: ImageModelList = "pollinations/flux";

export type ImageModelOption = {
  value: ImageModelList;
  label: string;
  adminOnly?: boolean;
};

const IMAGE_MODELS: ImageModelOption[] = [
  {
    value: "pollinations/flux",
    label: "Flux (Free)",
  },
  {
    value: "pollinations/turbo",
    label: "Turbo (Free)",
  },
  {
    value: "fal-ai/flux-2/flash",
    label: "Flux 2 Flash (paid, needs FAL_API_KEY)",
    adminOnly: true,
  },
  {
    value: "fal-ai/flux-2/turbo",
    label: "Flux 2 Turbo",
    adminOnly: true,
  },
  {
    value: "fal-ai/flux/dev",
    label: "Flux Dev",
    adminOnly: true,
  },
  {
    value: "fal-ai/flux-2",
    label: "Flux 2",
    adminOnly: true,
  },
  {
    value: "fal-ai/flux-2-pro",
    label: "Flux 2 Pro",
    adminOnly: true,
  },
  {
    value: "fal-ai/nano-banana-pro",
    label: "Nano Banana Pro",
    adminOnly: true,
  },
  {
    value: "fal-ai/nano-banana-2",
    label: "Nano Banana 2",
    adminOnly: true,
  },
  {
    value: "openai/gpt-image-2",
    label: "GPT Image 2",
    adminOnly: true,
  },
];

export const getAvailableImageModels = (isAdmin: boolean): ImageModelOption[] =>
  IMAGE_MODELS.filter((model) => isAdmin || !model.adminOnly);

type GptImageSize = "1024x1024" | "1536x1024" | "1024x1536" | "auto";

type FluxDevImageSize =
  | "landscape_16_9"
  | "landscape_4_3"
  | "portrait_4_3"
  | "portrait_9_16"
  | "square";

export type FalImageGenerationInput =
  | {
      prompt: string;
      aspect_ratio: "16:9" | "1:1" | "4:3" | "3:4" | "9:16";
      num_images: 1;
      output_format?: "png";
    }
  | {
      prompt: string;
      image_size: FluxDevImageSize;
      num_images: 1;
    }
  | {
      prompt: string;
      image_size: GptImageSize;
      num_images: 1;
      output_format: "png";
    };

export type ImageAspectRatio = "16:9" | "1:1" | "4:3" | "3:4" | "9:16";

export function getFalImageGenerationInput({
  model,
  prompt,
  aspectRatio,
}: {
  model: ImageModelList;
  prompt: string;
  aspectRatio: ImageAspectRatio;
}): FalImageGenerationInput {
  if (model.includes("flux")) {
    return {
      prompt,
      image_size: getFluxDevImageSize(aspectRatio),
      num_images: 1,
    };
  }

  if (model === "openai/gpt-image-2") {
    return {
      prompt,
      image_size: getGptImageSize(aspectRatio),
      num_images: 1,
      output_format: "png",
    };
  }

  return {
    prompt,
    aspect_ratio: aspectRatio,
    num_images: 1,
    output_format: "png",
  };
}

function getFluxDevImageSize(aspectRatio: ImageAspectRatio): FluxDevImageSize {
  if (aspectRatio === "1:1") return "square";
  if (aspectRatio === "9:16") return "portrait_9_16";
  if (aspectRatio === "3:4") return "portrait_4_3";
  if (aspectRatio === "4:3") return "landscape_4_3";
  return "landscape_16_9";
}

function getGptImageSize(aspectRatio: ImageAspectRatio): GptImageSize {
  if (aspectRatio === "1:1") return "1024x1024";
  if (aspectRatio === "9:16" || aspectRatio === "3:4") return "1024x1536";
  return "1536x1024";
}
