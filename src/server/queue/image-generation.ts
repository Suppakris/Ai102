import { env } from "@/env";
import { requireOptionalIntegration } from "@/lib/env/optional-integrations";
import { db } from "@/server/db";
import { fal } from "@fal-ai/client";
import { Queue, QueueEvents, type JobsOptions } from "bullmq";
import Together from "together-ai";
import { UTApi, UTFile } from "uploadthing/server";
import { getRedisConnection } from "./redis";

export const IMAGE_GENERATION_QUEUE_NAME = "image-generation";

export type ImageGenerationJobData =
  | {
      provider: "together";
      prompt: string;
      model: string;
      userId: string;
    }
  | {
      provider: "fal";
      prompt: string;
      model: string;
      userId: string;
    };

export type ImageGenerationJobResult = {
  id: string;
  url: string;
  prompt: string;
};

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { age: 3600 },
  removeOnFail: { age: 86400 },
};

const utapi = new UTApi();

async function uploadGeneratedImage(
  sourceUrl: string,
  filenamePrefix: string,
): Promise<string> {
  const imageResponse = await fetch(sourceUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image from ${sourceUrl}`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const filename = `${filenamePrefix}_${Date.now()}.png`;
  const utFile = new UTFile([new Uint8Array(imageBuffer)], filename);

  const uploadResult = await utapi.uploadFiles([utFile]);
  const permanentUrl = uploadResult[0]?.data?.ufsUrl;
  if (!permanentUrl) {
    throw new Error("Failed to upload generated image to UploadThing");
  }
  return permanentUrl;
}

async function generateWithTogether(
  prompt: string,
  model: string,
): Promise<string> {
  const togetherConfig = requireOptionalIntegration({
    integration: "Together AI",
    envVar: "TOGETHER_AI_API_KEY",
    value: env.TOGETHER_AI_API_KEY,
    feature: "AI image generation",
  });
  if (!togetherConfig.ok) throw new Error(togetherConfig.error);

  const together = new Together({ apiKey: togetherConfig.value });
  const response = (await together.images.create({
    model,
    prompt,
    width: 1024,
    height: 768,
    steps: model.includes("schnell") ? 4 : 28,
    n: 1,
  })) as unknown as { data: { url: string }[] };

  const imageUrl = response.data[0]?.url;
  if (!imageUrl) throw new Error("Together AI did not return an image");
  return uploadGeneratedImage(imageUrl, prompt.substring(0, 20).replace(/[^a-z0-9]/gi, "_"));
}

async function generateWithFal(prompt: string, model: string): Promise<string> {
  const falConfig = requireOptionalIntegration({
    integration: "FAL",
    envVar: "FAL_API_KEY",
    value: env.FAL_API_KEY,
    feature: "slide image generation",
  });
  if (!falConfig.ok) throw new Error(falConfig.error);

  fal.config({ credentials: falConfig.value });
  const result = await fal.subscribe(model, {
    input: { prompt, num_images: 1, aspect_ratio: "16:9" },
  });

  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) throw new Error("fal.ai did not return an image");
  return uploadGeneratedImage(imageUrl, "slide");
}

// The unit of work run by the worker (see worker.ts) — or inline, in-process,
// when no Redis is configured (see runImageGeneration below).
export async function processImageGenerationJob(
  data: ImageGenerationJobData,
): Promise<ImageGenerationJobResult> {
  const permanentUrl =
    data.provider === "together"
      ? await generateWithTogether(data.prompt, data.model)
      : await generateWithFal(data.prompt, data.model);

  const generatedImage = await db.generatedImage.create({
    data: {
      url: permanentUrl,
      prompt: data.prompt,
      userId: data.userId,
    },
  });

  return {
    id: generatedImage.id,
    url: generatedImage.url,
    prompt: generatedImage.prompt,
  };
}

let queue: Queue<ImageGenerationJobData, ImageGenerationJobResult> | null | undefined;
let queueEvents: QueueEvents | null | undefined;

function getQueue() {
  if (queue !== undefined) return queue;
  const connection = getRedisConnection();
  if (!connection) {
    queue = null;
    return queue;
  }
  queue = new Queue(IMAGE_GENERATION_QUEUE_NAME, {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
  return queue;
}

function getQueueEvents() {
  if (queueEvents !== undefined) return queueEvents;
  const connection = getRedisConnection();
  if (!connection) {
    queueEvents = null;
    return queueEvents;
  }
  queueEvents = new QueueEvents(IMAGE_GENERATION_QUEUE_NAME, { connection });
  return queueEvents;
}

// Entry point used by the server actions that trigger image generation.
// When Redis is configured, the work is handed off to the BullMQ queue and
// this call awaits the (separate) worker process finishing it — retries and
// rate limiting happen there. Without Redis, it just runs inline, in-process,
// so local dev needs no extra infrastructure.
export async function runImageGeneration(
  data: ImageGenerationJobData,
): Promise<ImageGenerationJobResult> {
  const activeQueue = getQueue();
  const activeQueueEvents = getQueueEvents();

  if (!activeQueue || !activeQueueEvents) {
    return processImageGenerationJob(data);
  }

  const job = await activeQueue.add(data.provider, data);
  return job.waitUntilFinished(activeQueueEvents);
}
