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
    // Text-generation backend. "ollama" (default) serves models from
    // OLLAMA_BASE_URL; "openrouter" routes every text request through
    // OpenRouter's OpenAI-compatible API (requires OPENROUTER_API_KEY).
    LLM_PROVIDER: z.enum(["ollama", "openrouter"]).optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_BASE_URL: z.string().url().optional(),
    OPENROUTER_DEFAULT_MODEL: z.string().optional(),
    OPENROUTER_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().optional(),
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
    // Auth is stubbed out (see src/server/auth.ts) — these are no longer
    // required. Kept optional so restoring real auth is just filling them in.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    UNSPLASH_ACCESS_KEY: z.string().optional(),
    NEXTAUTH_URL: z.string().optional(),
    NEXTAUTH_SECRET: z.string().optional(),
  },

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
    OPENROUTER_DEFAULT_MODEL: process.env.OPENROUTER_DEFAULT_MODEL,
    OPENROUTER_MAX_OUTPUT_TOKENS: process.env.OPENROUTER_MAX_OUTPUT_TOKENS,
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
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
