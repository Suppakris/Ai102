# Ai102 — Implementation Plan (OpenRouter Migration + Slide-Audit Agent + DevOps)

**Repo:** github.com/Suppakris/Ai102 — a local-first AI presentation generator, forked from ALLWEONE's `presentation-ai` and stripped down to run **Ollama-only** for a college project. Next.js 16 (App Router) + React 19 + TypeScript, Tailwind v4, Radix UI, Prisma over Supabase Postgres, LangChain + LangGraph for the generation pipeline and in-editor chat agent, pnpm as package manager, deployed to Vercel.

This plan is grounded in the actual code (cloned and inspected directly), not a generic template. File paths and function names below are real.

---

## Current State (confirmed from the repo)

| Area | Current state |
|---|---|
| LLM provider | **Ollama-only.** `src/lib/model-picker.ts` hardcodes `ChatOllama` from `@langchain/ollama`. Cloud providers (OpenAI, OpenRouter, Groq, LM Studio) were deliberately stripped out per the README. |
| Where it's used | 7 API routes (`generate`, `generate-slide`, `outline`, `generate-image-slides`, `prompt-to-diagram`, `edit-diagram`, `text-to-diagram`) plus `src/ai/agents/presentation/createAgent.ts` (the in-editor chat agent) all call `modelPicker()` / `assertModelIsConfigured()` / `ensureModelIsReady()` from `src/lib/modelPicker.ts` (a re-export shim over `model-picker.ts`). |
| Dependencies | `@langchain/openai` (1.4.5) **is already installed** — it's just unused. This means OpenRouter support needs zero new packages, only a code change, since OpenRouter exposes an OpenAI-compatible `/chat/completions` endpoint. |
| Database migrations | **No versioned migrations exist.** `pnpm db:push` (`prisma generate && prisma db push`) is the only DB command in `package.json` — this pushes the schema directly with no SQL migration history. `prisma.config.ts` already has a `migrations.seed` hook defined, but `prisma migrate` itself is never invoked anywhere. |
| Docker | **No Dockerfile or docker-compose.yml in the repo at all.** This is a from-scratch addition, not an update. |
| Slide auditing / scoring | **Does not exist yet.** There is no "auditor" or scoring concept anywhere in the codebase — this is new functionality to design and add, not a fix to existing code. |
| Env validation | `src/env.js` uses `@t3-oss/env-nextjs` + zod. `next.config.js` already documents a `SKIP_ENV_VALIDATION` escape hatch "especially useful for Docker builds" — i.e. Docker was anticipated but never actually implemented. |

---

## Batch 1 — Prompt Testing & AI Logic

### 1.1 Provider Migration: Ollama-only → OpenRouter

Rather than ripping out Ollama (the README frames "no cloud LLM required" as a selling point of this fork), the cleanest change is to make `model-picker.ts` provider-aware again, defaulting to Ollama but resolving to OpenRouter when a provider/key is configured — restoring the multi-provider behavior the upstream project had, but through OpenRouter instead of separate OpenAI/Groq/LM Studio integrations.

**`src/env.js`** — add OpenRouter vars:
```javascript
// add inside `server: {}`
OPENROUTER_API_KEY: z.string().optional(),
OPENROUTER_BASE_URL: z.string().optional(), // default handled in code
OPENROUTER_DEFAULT_MODEL: z.string().optional(),

// add inside `runtimeEnv: {}`
OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
OPENROUTER_DEFAULT_MODEL: process.env.OPENROUTER_DEFAULT_MODEL,
```

**`src/lib/model-picker.ts`** — add an OpenRouter branch alongside the existing Ollama one. `@langchain/openai`'s `ChatOpenAI` accepts a custom `baseURL` via `configuration`, so this is additive, not a rewrite of the Ollama path:

```typescript
import { ChatOpenAI } from "@langchain/openai";
// ...existing ChatOllama import stays

const OPENROUTER_BASE_URL =
  env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
export const DEFAULT_OPENROUTER_MODEL =
  env.OPENROUTER_DEFAULT_MODEL?.trim() || "anthropic/claude-sonnet-4.5";

// Extend resolveModelId's provider branch:
function resolveModelId(modelProviderOrModel: string, modelId?: string): string {
  if (modelProviderOrModel === "ollama") {
    return modelId?.trim() || DEFAULT_OLLAMA_MODEL;
  }
  if (modelProviderOrModel === "openrouter") {
    return modelId?.trim() || DEFAULT_OPENROUTER_MODEL;
  }
  // ...legacy provider handling stays as-is
}

// New branch in modelPicker():
export function modelPicker(modelProviderOrModel: string, modelId?: string) {
  if (modelProviderOrModel === "openrouter") {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error(
        "OPENROUTER_API_KEY is not set — cannot use the openrouter provider.",
      );
    }
    const resolvedModelId = resolveModelId(modelProviderOrModel, modelId);
    modelLogger.info("Creating OpenRouter model client", {
      provider: "openrouter",
      modelId: resolvedModelId,
    });
    return new ChatOpenAI({
      model: resolvedModelId,
      apiKey: env.OPENROUTER_API_KEY,
      configuration: { baseURL: OPENROUTER_BASE_URL },
    });
  }

  // ...existing Ollama branch unchanged below
}
```

`assertModelIsConfigured` / `ensureModelIsReady` should short-circuit for `openrouter` (no local pull/readiness check needed — just validate the key is present) instead of running the Ollama tags/pull flow.

**Call sites need no changes.** Because all 7 routes + `createAgent.ts` already pass `modelProvider` straight through from the request/UI to `modelPicker()`, once the picker itself is provider-aware, the only remaining UI work is re-enabling the "AI Provider & API Key" selector in Settings to offer `openrouter` again (it currently only offers `ollama` per the README's stripped-down auth/provider UI).

**Fallback behavior:** keep Ollama as the literal default (`modelProvider = "ollama"` in each route's destructuring) so the "no cloud LLM required" property of this fork is preserved for anyone who doesn't set `OPENROUTER_API_KEY` — OpenRouter becomes opt-in, not a hard replacement.

### 1.2 Persona Definition — the Slide-Auditor Agent

This is new. Add it as its own LangGraph-style agent, following the existing pattern in `src/ai/agents/presentation/createAgent.ts` (same directory conventions, same `modelPicker` usage) rather than inventing a new pattern.

**`src/ai/agents/presentation/createAuditAgent.ts`**
```typescript
import { createAgent } from "langchain";
import { modelPicker, DEFAULT_OPENROUTER_MODEL } from "@/lib/modelPicker";

export const AUDITOR_SYSTEM_PROMPT = `You are an expert slide auditor.
You review generated presentation slides (in the app's XML slide format) against
the outline and any source context they were generated from.

Your job: catch content the model invented, not present in the outline/context.

Follow this process, in order, before scoring:
Step 1 — List every factual claim, statistic, or named entity on the slide.
Step 2 — For each, mark SUPPORTED / UNSUPPORTED / INSUFFICIENT_CONTEXT against
the outline and source context provided. Do not guess — if you can't verify it
from what was given to you, it is INSUFFICIENT_CONTEXT, not SUPPORTED.
Step 3 — Only after Steps 1-2, assign a score 0-100 using: content accuracy (40pts),
outline alignment (30pts), clarity/structure (20pts), design consistency (10pts).
Step 4 — List concrete revision instructions for anything not SUPPORTED.

Return ONLY valid JSON, no prose outside it:
{
  "claims": [{"claim": "", "status": "SUPPORTED|UNSUPPORTED|INSUFFICIENT_CONTEXT", "note": ""}],
  "score": 0,
  "pass": false,
  "revision_notes": []
}`;

export function createAuditAgent() {
  // Recommend routing the auditor through OpenRouter even when generation
  // itself stays on Ollama — audit quality benefits more from a stronger
  // model than raw generation does, and it's a low-volume call (once per
  // slide/deck, not per token streamed).
  const llm = modelPicker("openrouter", DEFAULT_OPENROUTER_MODEL);
  return createAgent({
    model: llm,
    tools: [],
    name: "slide_audit_agent",
    systemPrompt: AUDITOR_SYSTEM_PROMPT,
  });
}
```

### 1.3 Scoring & Revision Loop

New route, sitting next to the existing `src/app/api/presentation/generate-slide/route.ts`, so it slots into the same request lifecycle as the rest of the generation API:

**`src/app/api/presentation/audit-slide/route.ts`**
```typescript
import { NextResponse } from "next/server";
import { createAuditAgent } from "@/ai/agents/presentation/createAuditAgent";
import { auth } from "@/server/auth";

const MAX_REVISION_ROUNDS = 3;
const PASS_THRESHOLD = 80;

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slideXml, outline, sourceContext, round = 0 } = await req.json();

  if (!hasEnoughContext(outline, sourceContext)) {
    return NextResponse.json({
      score: null,
      pass: false,
      revision_notes: ["Insufficient outline/source context supplied for audit — generate with more detail or attach source material first."],
    });
  }

  const agent = createAuditAgent();
  const result = await agent.invoke({
    messages: [{ role: "user", content: JSON.stringify({ slideXml, outline, sourceContext }) }],
  });

  const parsed = JSON.parse(result.messages.at(-1)?.content as string);
  const pass = parsed.pass || parsed.score >= PASS_THRESHOLD;

  return NextResponse.json({ ...parsed, pass, round, maxRoundsReached: round >= MAX_REVISION_ROUNDS });
}

function hasEnoughContext(outline: unknown, sourceContext: unknown, minLength = 200): boolean {
  const outlineLen = JSON.stringify(outline ?? "").length;
  const contextLen = JSON.stringify(sourceContext ?? "").length;
  return outlineLen + contextLen >= minLength;
}
```

**Client-side loop** (in the editor, wherever slide generation is triggered — e.g. alongside the existing `generate-slide` call): on `pass: false` and `maxRoundsReached: false`, call the existing `regenerate_slide` tool (already present in `src/ai/tools/presentation/tools.ts` per the agent's tool list) with the `revision_notes` folded into the regeneration instructions, then re-submit to `/api/presentation/audit-slide` with `round + 1`.

### 1.4 Anti-Hallucination Measures

Two concrete, code-level fixes — not just prompt wording:

**a) The context-length guard above (`hasEnoughContext`)** stops the audit call entirely when there's not enough outline/source material to check claims against, rather than letting the model guess and call it "supported."

**b) Fix the actual root cause already documented in this repo:** `model-picker.ts`'s own comments explain that `OLLAMA_NUM_CTX` (default 8192) matters because Ollama's native default context (often 2048–4096) truncates this app's generation system prompt, and truncated instructions are called out as **"a direct cause of format-rule violations (blank slides, duplicated content, ignored density settings)"** — which functions the same as hallucination from the user's point of view. Action: confirm `OLLAMA_NUM_CTX` is actually set to 8192+ in every deployment env (not just documented in `.env.example`), since this is a known, already-diagnosed cause of bad output specific to this codebase, separate from adding an auditor.

**c) Step-by-step forcing** is handled in the auditor's own system prompt (1.2 above) — claims listed and marked before any score is produced, not the auditor jumping straight to a verdict.

### 1.5 Double-Check / Reviewer Agent

A second, independent pass — deliberately not reusing the auditor's own conversation/context — modeled the same way as `createAuditAgent()`:

```typescript
export const REVIEWER_SYSTEM_PROMPT = `You are a senior fact-checking reviewer.
You will receive an audit report and the original outline/source context.
Do NOT re-score from scratch — instead:
1. Spot any claim the auditor marked SUPPORTED that isn't actually backed by the context.
2. Spot any claim the auditor missed entirely.
3. Recommend whether the auditor's score should stand, increase, or decrease, with reasons.
Be skeptical by default — flag anything uncertain rather than assume it's fine.
Return ONLY JSON: { "agreement": "confirm|revise_up|revise_down", "notes": [], "adjusted_score": 0 }`;

export function createReviewAgent() {
  const llm = modelPicker("openrouter", DEFAULT_OPENROUTER_MODEL);
  return createAgent({ model: llm, tools: [], name: "slide_review_agent", systemPrompt: REVIEWER_SYSTEM_PROMPT });
}
```

Call this from `audit-slide/route.ts` after the primary audit, before returning `pass`/`revision_notes` to the client, and persist both reports (see 2.2 below for the schema).

---

## Batch 2 — DevOps & Infrastructure Setup

### 2.1 Dockerization

There's no Dockerfile in the repo today, so this is new. Key constraints from the actual repo: **pnpm** (not npm/yarn — `pnpm-lock.yaml` + `pnpm-workspace.yaml` are present and `pnpm@11.1.3` is pinned), **Next.js 16**, and **Prisma generates two separate clients** (`edge-light` runtime for the app, `nodejs` runtime for migrations — see `prisma/schema.prisma`'s two `generator` blocks), so both need to run in the build stage.

**`next.config.js`** needs one addition for a slim runtime image:
```javascript
const config = {
  output: "standalone",
  // ...existing images config stays
};
```

**`Dockerfile`**
```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# SKIP_ENV_VALIDATION is already wired for exactly this case — see next.config.js
ENV SKIP_ENV_VALIDATION=1
RUN pnpm db:generate
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

**`docker-compose.yml`**
```yaml
version: "3.9"
services:
  app:
    build: .
    restart: unless-stopped
    env_file: .env
    ports:
      - "3000:3000"
    # DATABASE_URL points at Supabase's transaction pooler (see .env.example) —
    # no local db service needed unless you want an offline dev copy.

  # Optional: local Postgres instead of Supabase for fully offline dev
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  db_data:
```

**Ollama from inside the container:** if the app runs in Docker but Ollama runs on the host (not containerized — it needs GPU/host access), set `OLLAMA_BASE_URL=http://host.docker.internal:11434` in the container's env instead of `localhost`, or keep using the existing `ngrok`-tunneled URL pattern the README already documents for remote Ollama.

### 2.2 Database & Migration System

The concrete gap here isn't "no migration tool" — Prisma is already the ORM and `prisma.config.ts` already has a `migrations.seed` hook defined. The gap is that **`pnpm db:push` is used instead of `prisma migrate`**, so there is no versioned SQL history at all right now; every schema change just gets pushed live with no record of what changed or when.

**Fix — add real migration scripts to `package.json`:**
```json
{
  "scripts": {
    "db:migrate:dev": "prisma generate && prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:push": "prisma generate && prisma db push"
  }
}
```
Keep `db:push` around for quick local prototyping if the team wants it, but **`db:migrate:dev` becomes the real workflow** for anything going to a shared environment — it writes actual SQL under `prisma/migrations/<timestamp>_<name>/migration.sql`, which is the structured migration history the task calls for, and that folder gets committed to git like any other code.

**New schema for the audit feature (Batch 1's output needs somewhere to persist):**
```prisma
model SlideAudit {
  id             String   @id @default(cuid())
  slideId        String
  round          Int      @default(0)
  score          Int?
  pass           Boolean  @default(false)
  claims         Json?
  revisionNotes  Json?    @map("revision_notes")
  reviewerNotes  Json?    @map("reviewer_notes")
  createdAt      DateTime @default(now()) @map("created_at")
}
```
Add this model to `prisma/schema.prisma`, then:
```bash
pnpm db:migrate:dev --name add-slide-audit-table
```

**In CI/production**, run `prisma migrate deploy` (non-interactive, applies only pending migrations) as a pre-boot step — this can live in the Docker `CMD` or as a separate Vercel build step:
```yaml
  app:
    command: sh -c "npx prisma migrate deploy && node server.js"
```

**Supabase note (already correctly documented in this repo's `.env.example`):** `DATABASE_URL` must be the **transaction pooler** (port 6543) for runtime, since this app runs on Vercel serverless functions where session/direct connections exhaust the pooler's max-clients limit fast. `prisma migrate` needs a **direct** connection for DDL though — add a second `DIRECT_URL` env var and reference it in `prisma.config.ts`'s `migrations` block if migrate commands start failing against the pooled URL.

---

## Suggested Execution Order

| Step | Batch | Task | Depends on |
|---|---|---|---|
| 1 | 2 | Switch `db:push` → `prisma migrate dev`, add `SlideAudit` model | — |
| 2 | 2 | Add `next.config.js` standalone output, Dockerfile, docker-compose | Step 1 |
| 3 | 1 | Add OpenRouter branch to `model-picker.ts` + `env.js` vars | — |
| 4 | 1 | Build `createAuditAgent.ts` + persona prompt | Step 3 |
| 5 | 1 | Add context-length guard, confirm `OLLAMA_NUM_CTX` is set correctly in all envs | Step 4 |
| 6 | 1 | Build `/api/presentation/audit-slide` route + client revision loop | Steps 4, 5, 1 (SlideAudit table) |
| 7 | 1 | Add `createReviewAgent.ts` double-check pass | Step 6 |
| 8 | 2 | Wire migration-deploy + env validation into Docker `CMD`, test end-to-end | Steps 2, 6, 7 |

Batches can run in parallel — Batch 1 only needs `OPENROUTER_API_KEY` and a Postgres connection (Supabase directly, no Docker needed) to develop and test against.

---

## Open Questions to Confirm Before Building

- Which OpenRouter model to standardize on for the auditor/reviewer specifically (separate choice from whatever model users pick for generation) — cost matters more here since audit runs automatically, not per user request.
- Whether the audit loop should block deck finalization on failure, or just surface a warning/score to the user and let them decide (the README's "no login wall, coursework build" framing suggests a soft warning may fit better than a hard gate).
- Whether `DIRECT_URL` needs to be added now, or only if `prisma migrate` against the pooled connection actually fails in testing — worth just trying `migrate dev` against the current `DATABASE_URL` first since Supabase's transaction pooler sometimes tolerates DDL for smaller schemas.
- Confirm whether Docker is meant for production self-hosting or just local/CI parity — Vercel is the deployment target per the README, and `output: "standalone"` is mainly useful for local dev/CI parity rather than replacing the Vercel build pipeline.
