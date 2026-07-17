# Architecture

Ai102 is a single Next.js 16 application. It is **not** split into two deployable
services — instead, the codebase is organized so it is unambiguous which files
are "frontend" (UI) versus "backend" (server logic), while still using Next.js's
App Router for both pages and API routes.

This document exists for the project report/demo and for anyone new to the repo.

## Why one app instead of two

A physical split (separate frontend + backend processes/repos) was considered and
rejected for this project: the backend here isn't a simple CRUD API — it includes
a LangGraph AI agent with Postgres-backed conversation memory, a Redis-backed
image-generation queue, multi-tenant auth, and rate limiting. Splitting that into
a standalone service was judged too high-risk to finish correctly on the project
timeline. The folder-level split below gives the same "clear separation of
concerns" benefit for a report/demo, without the deployment and integration risk.

## Layers

```
┌─────────────────────────────────────────────────────────┐
│  Frontend                                                │
│  src/app/**            pages, layouts (App Router)       │
│  src/components/**     React components                  │
│  src/hooks/**          client-side hooks                 │
│  src/states/**         client state (zustand, etc.)      │
│  src/provider/**       root providers (session, theme)   │
│  src/styles/**         global styles                     │
└───────────────────────────┬───────────────────────────────┘
                             │ Server Actions ("use server")
                             │ + src/app/api/** route handlers
                             ▼
┌─────────────────────────────────────────────────────────┐
│  Backend  (src/backend/**)                                │
│  db.ts               Prisma client                       │
│  auth.ts             stubbed demo-admin auth              │
│  tenant.ts            multi-tenant resolution              │
│  rate-limit.ts        request rate limiting                │
│  share/**             public share-link authorization      │
│  queue/**             BullMQ image-generation queue        │
│                        + FAL / Pollinations.ai providers   │
│  ai/chatMessages.ts   chat message persistence helpers     │
│  agent/**              LangGraph presentation-editing agent │
│                        (agents/, tools/, lib/ — Postgres    │
│                        checkpointed memory)                 │
└───────────────────────────┬───────────────────────────────┘
                             │
                 ┌───────────┴────────────┐
                 ▼                        ▼
          PostgreSQL (Prisma)       Ollama (local LLM)
          Supabase/Neon free tier   OpenAI-compatible endpoint
```

`src/app/api/**` route handlers are intentionally thin: they parse the request,
call into `src/backend/**`, and shape the response. Server Actions under
`src/app/_actions/**` follow the same rule — the "use server" files are UI-adjacent
entry points, but the actual logic (DB queries, external API calls) lives in
`src/backend/**`.

## Request flow example: generating a slide image

1. UI component (`src/components/...`) calls the `generateSlideImageAction` server
   action (`src/app/_actions/presentation/generate-slide-image.ts`).
2. The action checks auth (`src/backend/auth.ts`) and rate limits
   (`src/backend/rate-limit.ts`).
3. It calls `runImageGeneration` (`src/backend/queue/image-generation.ts`), which
   either queues the job on Redis/BullMQ (if `REDIS_URL` is set) or runs it
   in-process.
4. The image is generated via **Pollinations.ai** (free, default) or FAL (paid,
   optional, admin-gated) — see [Free-only stack](#free-only-stack) below —
   then uploaded to UploadThing and recorded via Prisma (`src/backend/db.ts`).

## Free-only stack

Everything required to run and demo this project is free:

| Concern | Provider | Cost |
|---|---|---|
| Text generation (outlines, slides, chat agent) | Ollama, local | Free |
| AI image generation | Pollinations.ai, no API key | Free (default) |
| Database | Supabase or Neon free tier | Free |
| File storage | UploadThing free tier | Free |
| Stock photos | Unsplash free tier | Free |

FAL (paid AI images) is still wired in as an **optional, admin-gated upgrade** —
if `FAL_API_KEY` is set, higher-quality paid models become available, but nothing
requires it. Together AI's code path exists but is unused by any active feature.

## Folders not covered above

- `prisma/` — schema + SQL migrations (shared by the whole app, not "frontend" or
  "backend" code per se, but only ever touched from `src/backend/db.ts`).
- `src/config/`, `src/constants/` — shared config/constants (slide sizing,
  the image-model catalog, infographic templates) used by both layers.
- `src/lib/` — small shared utilities (client-safe helpers, observability logger,
  optional-integration guards) used by both layers.
- `src/types/` — shared TypeScript types.
