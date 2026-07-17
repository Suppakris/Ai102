"use server";

import { z } from "zod";

import { auth } from "@/backend/auth";

const uploadedImagesInputSchema = z.object({
  limit: z.number().int().min(1).max(60).default(30),
  page: z.number().int().min(1).default(1),
});

export type UploadedPresentationImage = {
  createdAt: string;
  id: string;
  mimeType: string;
  name: string;
  url: string;
};

export async function getUploadedImages(input?: {
  limit?: number;
  page?: number;
}): Promise<UploadedPresentationImage[]> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Unauthorized");
  }

  uploadedImagesInputSchema.parse(input ?? {});

  return [];
}
