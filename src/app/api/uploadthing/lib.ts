import "server-only";

import { createUploadthing } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";

import { auth } from "@/backend/auth";

export const f = createUploadthing();
export const utapi = new UTApi();

export async function requireUploadThingUser(): Promise<{ userId: string }> {
  const session = await auth();
  if (!session) {
    throw new UploadThingError("Unauthorized");
  }

  return { userId: session.user.id };
}

export async function requireAdminUploadThingUser(): Promise<{
  userId: string;
}> {
  const session = await auth();
  if (!session?.user.isAdmin) {
    throw new UploadThingError("Unauthorized");
  }

  return { userId: session.user.id };
}

function getUploadThingFileKeyFromUrl(url: string): string | null {
  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    const pathnameParts = parsedUrl.pathname.split("/").filter(Boolean);
    return pathnameParts.at(-1) ?? null;
  } catch {
    const pathnameParts = trimmedUrl.split("/").filter(Boolean);
    return pathnameParts.at(-1) ?? null;
  }
}

export async function deleteUploadThingFiles(
  fileKeys: string | string[],
): Promise<void> {
  const normalizedKeys = [
    ...new Set(
      (Array.isArray(fileKeys) ? fileKeys : [fileKeys])
        .map((fileKey) => fileKey.trim())
        .filter((fileKey) => fileKey.length > 0),
    ),
  ];

  if (normalizedKeys.length === 0) {
    return;
  }

  await utapi.deleteFiles(normalizedKeys);
}

export async function deleteUploadThingFilesByUrls(
  urls: string | string[],
): Promise<void> {
  const normalizedKeys = (Array.isArray(urls) ? urls : [urls])
    .map(getUploadThingFileKeyFromUrl)
    .filter((fileKey): fileKey is string => fileKey !== null);

  await deleteUploadThingFiles(normalizedKeys);
}
