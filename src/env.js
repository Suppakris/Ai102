import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    TAVILY_API_KEY: z.string().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    OPENAI_API_KEY: z.string().optional(),
    OLLAMA_BASE_URL: z.string().optional(),
    OLLAMA_DEFAULT_MODEL: z.string().optional(),
    OLLAMA_NUM_CTX: z.coerce.number().int().positive().optional(),
    OLLAMA_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().optional(),
    UPLOADTHING_TOKEN: z.string().optional(),
    GOOGLE_CUSTOM_SEARCH_API_KEY: z.string().optional(),
    SEARCH_ENGINE_CX: z.string().optional(),
    TOGETHER_AI_API_KEY: z.string().optional(),
    FAL_API_KEY: z.string().optional(),
    PINECONE_API_KEY: z.string().optional(),
    // Job queue (BullMQ) backing store. Unset in dev: image-generation jobs
    // just run inline in-process instead of going through a queue/worker.
    REDIS_URL: z.string().optional(),
    GITHUB_CLIENT_ID: z.string(),
    GITHUB_CLIENT_SECRET: z.string(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_CLIENT_SECRET: z.string().optional(),
    // Optional, paid, opt-in text-generation upgrade over the free Ollama
    // default — see src/constants/text-models.ts for the selectable models.
    OPENROUTER_API_KEY: z.string().optional(),
    UNSPLASH_ACCESS_KEY: z.string().optional(),
    // Accepts a bare host (e.g. Vercel's own VERCEL_URL, or a value someone
    // pasted without a protocol) and normalizes it to a full URL. Without
    // this, a protocol-less NEXTAUTH_URL passes validation (previously just
    // z.string() on Vercel) but then crashes every request at runtime with
    // "TypeError: Invalid URL" wherever NextAuth calls `new URL()` on it.
    NEXTAUTH_URL: z.preprocess((str) => {
      const value = process.env.VERCEL_URL ?? str;
      if (typeof value === "string" && value && !/^https?:\/\//.test(value)) {
        return `https://${value}`;
      }
      return value;
    }, z.string().url()),
    NEXTAUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
  },

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
    OLLAMA_DEFAULT_MODEL: process.env.OLLAMA_DEFAULT_MODEL,
    OLLAMA_NUM_CTX: process.env.OLLAMA_NUM_CTX,
    OLLAMA_MAX_OUTPUT_TOKENS: process.env.OLLAMA_MAX_OUTPUT_TOKENS,
    UPLOADTHING_TOKEN: process.env.UPLOADTHING_TOKEN,
    GOOGLE_CUSTOM_SEARCH_API_KEY: process.env.GOOGLE_CUSTOM_SEARCH_API_KEY,
    SEARCH_ENGINE_CX: process.env.SEARCH_ENGINE_CX,
    TOGETHER_AI_API_KEY: process.env.TOGETHER_AI_API_KEY,
    FAL_API_KEY: process.env.FAL_API_KEY,
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    REDIS_URL: process.env.REDIS_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
