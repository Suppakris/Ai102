"use client";

import { Youtube } from "lucide-react";
import { nanoid } from "nanoid";
import { KEYS, type TElement } from "platejs";
// NOTE: These are React components now!
import { type ReactElement } from "react";

export interface EmbedConfig {
  name: string;
  urlPattern: RegExp;
  embedUrlGenerator: (url: string) => string;
  icon?: string;
}

export type EmbedTypeConfigItem = {
  name: string;
  icon: ReactElement;
  description: string;
  placeholder: string;
  urlPattern: RegExp;
  embedUrlGenerator: (url: string) => string;
};

// Filtered EMBED_CONFIGS that only includes embed types defined in mediaEmbedItems
const EMBED_CONFIGS: Record<string, EmbedConfig> = {
  youtube: {
    name: "YouTube",
    // Supports: youtube.com/watch?v=, youtu.be/, youtube.com/embed/, youtube.com/v/, youtube.com/shorts/
    urlPattern:
      /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    embedUrlGenerator: (url: string) => {
      const match = url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
      );
      const videoId = match?.[1];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    },
  },
};

export type MediaEmbedItem = {
  key: string;
  label: string;
  embedType: string;
  icon: ReactElement;
  description: string;
};

export const mediaEmbedItems: MediaEmbedItem[] = [
  {
    key: "youtube",
    label: "YouTube",
    embedType: "youtube",
    icon: <Youtube className="size-7" />,
    description: "Embed YouTube videos",
  },
];

export function createMediaEmbedNode(embedType: string): TElement {
  return {
    type: KEYS.mediaEmbed,
    url: "",
    provider: embedType,
    id: nanoid(),
    children: [{ text: "" }],
  } as TElement;
}

// Create embedTypeConfig that combines mediaEmbedItems with EMBED_CONFIGS
export const embedTypeConfig = mediaEmbedItems.reduce(
  (config, item) => {
    const embedConfig = EMBED_CONFIGS[item.embedType];
    if (embedConfig) {
      config[item.embedType] = {
        name: item.label,
        icon: item.icon,
        description: item.description,
        placeholder: `Enter ${item.label} URL...`,
        urlPattern: embedConfig.urlPattern,
        embedUrlGenerator: embedConfig.embedUrlGenerator,
      };
    }
    return config;
  },
  {} as Record<string, EmbedTypeConfigItem>,
);

// Utility functions for embed handling
export function detectEmbedType(url: string): string | null {
  for (const [type, config] of Object.entries(EMBED_CONFIGS)) {
    if (config.urlPattern.test(url)) {
      return type;
    }
  }
  return null;
}

export function generateEmbedUrl(url: string, embedType?: string): string {
  // Auto-detect if type not provided
  const type = embedType || detectEmbedType(url);
  if (!type) return url;

  const config = EMBED_CONFIGS[type];
  if (!config) return url;

  return config.embedUrlGenerator(url);
}

export function isValidEmbedUrl(url: string, embedType?: string): boolean {
  // Auto-detect if type not provided
  const type = embedType || detectEmbedType(url);
  if (!type) return false;

  const config = EMBED_CONFIGS[type];
  if (!config) return false;

  return config.urlPattern.test(url);
}

export function getEmbedConfig(embedType: string): EmbedConfig | null {
  return EMBED_CONFIGS[embedType] || null;
}

export function getAllEmbedTypes(): Array<{
  type: string;
  config: EmbedConfig;
}> {
  return Object.entries(EMBED_CONFIGS).map(([type, config]) => ({
    type,
    config,
  }));
}

export function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  );
  return match?.[1] || null;
}

function extractTwitterTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/i);
  return match?.[2] || null;
}

function extractLoomVideoId(url: string): string | null {
  const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/i);
  return match?.[1] || null;
}

function extractVimeoVideoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return match?.[1] || null;
}

function extractCodePenId(url: string): string | null {
  const match = url.match(
    /codepen\.io\/([^/]+)\/(?:pen|embed)\/([a-zA-Z0-9]+)/i,
  );
  return match?.[2] || null;
}

export function extractEmbedId(url: string, embedType?: string): string | null {
  const type = embedType || detectEmbedType(url);
  if (!type) return null;

  switch (type) {
    case "youtube":
      return extractYouTubeVideoId(url);
    case "twitter":
      return extractTwitterTweetId(url);
    case "loom":
      return extractLoomVideoId(url);
    case "vimeo":
      return extractVimeoVideoId(url);
    case "codepen":
      return extractCodePenId(url);
    default:
      return null;
  }
}
