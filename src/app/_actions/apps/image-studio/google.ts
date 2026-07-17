"use server";

import { type LayoutType } from "@/components/notebook/presentation/utils/parser";
import { env } from "@/env";
import { auth } from "@/backend/auth";

type GoogleImageSearchItem = {
  link?: string;
  title?: string;
  displayLink?: string;
  image?: {
    thumbnailLink?: string;
    contextLink?: string;
    width?: number | string;
    height?: number | string;
  };
};

type GoogleImageSearchResponse = {
  items?: GoogleImageSearchItem[];
};

type GoogleImageSearchResult = {
  url: string;
  thumb?: string;
  title?: string;
  source?: string;
  width?: number;
  height?: number;
};

function parseImageDimension(
  value: number | string | undefined,
): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : undefined;
}

function isAtLeast1080p(image: GoogleImageSearchResult): boolean {
  if (!image.width || !image.height) {
    return false;
  }

  const shorterSide = Math.min(image.width, image.height);
  const longerSide = Math.max(image.width, image.height);

  return shorterSide >= 1080 && longerSide >= 1920;
}

function pickBestRelevantGoogleImage(
  images: GoogleImageSearchResult[],
): GoogleImageSearchResult | undefined {
  return images.find(isAtLeast1080p) ?? images[0];
}

export async function searchGoogleImages(query: string): Promise<{
  success: boolean;
  images?: GoogleImageSearchResult[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "You must be logged in to get images" };
    }

    if (!env.GOOGLE_CUSTOM_SEARCH_API_KEY || !env.SEARCH_ENGINE_CX) {
      return { success: false, error: "Google image search is not configured" };
    }

    const params = new URLSearchParams({
      key: env.GOOGLE_CUSTOM_SEARCH_API_KEY,
      cx: env.SEARCH_ENGINE_CX,
      searchType: "image",
      q: query,
      num: "10",
      safe: "active",
    });
    const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) {
      throw new Error(`Google Custom Search API error: ${res.status}`);
    }
    const data = (await res.json()) as GoogleImageSearchResponse;

    const images = (data.items ?? []).flatMap((it) => {
      if (!it.link) {
        return [];
      }

      const width = parseImageDimension(it.image?.width);
      const height = parseImageDimension(it.image?.height);

      return [
        {
          url: it.link,
          thumb: it.image?.thumbnailLink,
          title: it.title,
          source: it.image?.contextLink ?? it.displayLink,
          width,
          height,
        },
      ];
    });
    return { success: true, images };
  } catch (error) {
    console.error("Error searching Google images:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search images",
    };
  }
}

export async function getImageFromGoogle(
  query: string,
  _layoutType?: LayoutType,
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "You must be logged in to get images" };
    }

    const res = await searchGoogleImages(query);
    if (!res.success || !res.images || res.images.length === 0) {
      return { success: false, error: "No images found for this query" };
    }
    const selectedImage = pickBestRelevantGoogleImage(res.images);
    if (!selectedImage?.url) {
      return { success: false, error: "No images found for this query" };
    }
    return { success: true, imageUrl: selectedImage.url };
  } catch (error) {
    console.error("Error getting Google image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get image",
    };
  }
}
