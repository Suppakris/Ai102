# Ai102

A local-first AI presentation generator — a customized build derived from [ALLWEONE's presentation-ai](https://github.com/allweonedev/presentation-ai), stripped down for a college project. Text generation runs on local Ollama by default, or through OpenRouter for reproducible prompt testing. No login wall.

## 🔗 Quick Links

- [Contributing Guidelines](CONTRIBUTING.md)

## 📋 Table of Contents

- [What's Different From Upstream](#-whats-different-from-upstream)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Run on Docker](#run-on-docker)
- [Team Workflow](#-team-workflow)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [Known Issues](#-known-issues)
- [Contributing](#-contributing)
- [License](#-license)


## 🎓 What's Different From Upstream

This fork disables everything that requires a paid account or a login system, so it can run as a self-contained coursework build:

- **Auth is disabled.** `src/server/auth.ts` is stubbed to always return a fixed demo admin user. No Google OAuth, no `NEXTAUTH_*` vars needed. Because the demo user's role is always `ADMIN`, every "admin-only" feature (see Known Issues) is effectively open to everyone in this build. To restore real login, revert that file and set the Google/NextAuth env vars again.
- **Text generation has two backends, selected by env.** Local Ollama is the default; setting `LLM_PROVIDER=openrouter` routes every text request through OpenRouter's OpenAI-compatible API instead (`src/lib/model-picker.ts`) — used for prompt testing, where results must not depend on whose machine ran the model. Per-user BYOK cloud providers (OpenAI, LM Studio, Groq) remain removed. Legacy provider values (`openai`, `lmstudio`) from old persisted client state are caught and silently redirected to the default model instead of erroring.
- **Slide verification agents.** `POST /api/presentation/verify` runs a two-agent quality pipeline over a generated slide: a verifier agent scores it against a rubric (schema, factual grounding, language, layout) reasoning step-by-step and asking questions instead of guessing when context is missing; below-threshold slides are regenerated from the verifier's fixes in a bounded loop; an independent reviewer agent then double-checks the verdict and returns recommendations (`src/ai/agents/verification/`).
- **Image generation still uses cloud providers** — FAL (Flux models) is the default and primary path (`src/app/_actions/presentation/generate-slide-image.ts`), with a Together AI path also present as a secondary/legacy provider (`src/app/_actions/image/generate.ts`).

## 🌟 Features

### Core Functionality

- AI-powered outline generation, then full slide generation, running on a local Ollama model
- Editable outlines before finalizing
- Real-time slide generation
- Auto-save
- In-editor chat agent (`presentation_agent`, LangGraph + Postgres-backed memory) that can edit an existing deck: change slide layout/background, replace or regenerate images, create/delete/regenerate slides, switch or create themes, and run a web search (needs `TAVILY_API_KEY`)

### Design & Customization

- Multiple built-in themes (see `src/lib/presentation/themes.ts`)
- Custom theme creation
- PPTX theme import

### Presentation Tools

- Present directly from the app
- Public sharing links
- PowerPoint export (`.pptx`)
- Charts, infographics, media embeds
- Rich text editing via Plate Editor
- Inline comments/discussions on slide content

### Images

- AI image generation via FAL (Flux models — default: Flux 2 Flash; several other Flux/GPT-image models are admin-gated, which is moot since every user is admin in this build)
- Secondary image generation via Together AI (FLUX.1 family)
- Stock photos via Unsplash, Pixabay, and Giphy
- Google Custom Search image lookup (`src/app/_actions/apps/image-studio/google.ts`)

## 🧰 Tech Stack

| Category            | Technologies                                                        |
| ------------------- | -------------------------------------------------------------------- |
| **Framework**       | Next.js 16, React 19, TypeScript                                     |
| **Styling**         | Tailwind CSS v4                                                      |
| **Database**        | Supabase with Prisma ORM.                                            |
| **Text Generation**| Ollama (local, default) or OpenRouter (`LLM_PROVIDER=openrouter`), via LangChain + LangGraph agent |
| **Image Generation**| FAL (Flux models, primary), Together AI (secondary path)             |
| **UI Components**   | Radix UI                                                              |
| **Text Editor**     | Plate Editor (`platejs`)                                             |
| **File Uploads**     | UploadThing                                                          |
| **Lint/Format**      | Biome (canonical — see `lint`/`check` scripts)                       |

## 🚀 Getting Started

### Prerequisites

- Next.js 16
- pnpm (repo is pinned to `pnpm@11.1.3`; uses `pnpm-lock.yaml` / `pnpm-workspace.yaml`)
- PostgreSQL database (Supabase or Neon both confirmed to work)
- [Ollama](https://ollama.com) installed and running locally, with at least one model pulled (e.g. `ollama pull llama3.2:3b`)
- Optional provider keys depending on which features you want (see [Environment Variables](#environment-variables) below)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Suppakris/Ai102.git
   cd Ai102
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

   `postinstall` runs `prisma generate` automatically.

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in at least `DATABASE_URL`. See [Environment Variables](#environment-variables) for everything else.

4. **Set up the database** — see [Database Setup](#database-setup) below.

5. **Start Ollama and pull a model** (if you haven't already)

   ```bash
   ollama pull llama3.2:3b
   ```

6. **Run the dev server**

   ```bash
   pnpm dev
   ```

   The app runs at `http://localhost:3000` and redirects straight to `/presentation` (there's no separate marketing page, and no login screen — see [What's Different From Upstream](#-whats-different-from-upstream)).

### Environment Variables

Copy `.env.example` to `.env` and fill in what you need. `.env.example` is the source of truth; the notable ones:

| Variable | Required? | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | **Required** | Postgres connection string, used at runtime and for migrations. For Supabase, use the **Transaction pooler** (port 6543) — this app runs on Vercel serverless functions, and Session/Direct connections exhaust a pooler's max-clients limit fast since they're held for the life of the client instead of released per query. |
| `FAL_API_KEY` | Optional | Primary AI image provider (FAL/Flux). Without it, image generation fails gracefully with a "not configured" error. |
| `LLM_PROVIDER` | Optional | Text-generation backend: `ollama` (default, local) or `openrouter` (hosted, reproducible — used for prompt testing). |
| `OPENROUTER_API_KEY` | With `LLM_PROVIDER=openrouter` | OpenRouter API key ([openrouter.ai/keys](https://openrouter.ai/keys)). |
| `OPENROUTER_BASE_URL` | Optional | Override the OpenRouter endpoint (default `https://openrouter.ai/api/v1`); point it at any local OpenAI-compatible server to exercise the same code path locally. |
| `OPENROUTER_DEFAULT_MODEL` | Optional | OpenRouter model when the client didn't pick one (default `meta-llama/llama-3.3-70b-instruct:free`). |
| `OLLAMA_BASE_URL` | Optional | Point at a remote/tunneled Ollama instance (e.g. via ngrok) instead of localhost. |
| `OLLAMA_DEFAULT_MODEL` | Optional | Override the default model (`llama3.2:3b`). |
| `OLLAMA_NUM_CTX` | Optional | Context window in tokens (default: 8192). Ollama's own default (often 2048) is smaller than this app's generation system prompt, which makes the model see truncated instructions and produce broken decks. Lower it only if generation requests start timing out on slow/CPU-only hardware. |
| `OLLAMA_MAX_OUTPUT_TOKENS` | Optional | Max output tokens per generation request. Unset by default. Same trade-off as `OLLAMA_NUM_CTX`. |
| `TOGETHER_AI_API_KEY` | Optional | Secondary image generation path (Together AI FLUX models). |
| `UPLOADTHING_TOKEN` | Optional | Image storage for AI-generated images. |
| `UNSPLASH_ACCESS_KEY` | Optional | Stock photo search. |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` + `SEARCH_ENGINE_CX` | Optional | Google Custom Search image lookup. |
| `TAVILY_API_KEY` | Optional | Web search tool for the outline generator and the in-editor chat agent. |

All optional integrations degrade gracefully when unset — features that need them just no-op with an error message instead of crashing. Auth-related vars (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`NEXTAUTH_SECRET`/`NEXTAUTH_URL`) are commented out and not needed since login is stubbed.

### Database Setup

The schema is managed with **SQL migrations** (`prisma/migrations/`). Once `DATABASE_URL` is set:

```bash
pnpm db:migrate:deploy   # prisma migrate deploy — applies all pending migrations
pnpm db:studio      # optional: browse the DB with Prisma Studio
```

When you change `prisma/schema.prisma`, create a new migration (this also applies it to your dev database):

```bash
pnpm db:migrate:dev      # prisma migrate dev — generates a new SQL migration from the schema diff
```

Commit the generated folder under `prisma/migrations/` — that SQL file *is* the schema change. `pnpm db:push` still exists for throwaway prototyping, but it bypasses migration history; don't use it on a shared database.

> **Migrating an existing `db push` database:** if your DB already has the schema (created via `db:push` before migrations existed), baseline it once instead of re-running the initial migration:
> `pnpm exec prisma migrate resolve --applied 0_init`

There's no separate seed step required to boot the app — the stubbed demo user is upserted automatically on first request.

### Run on Docker

The whole stack (front-end + back-end + Postgres) runs on Docker with nothing installed on the host except Docker itself:

```bash
docker compose up --build
```

Boot order is handled for you: Postgres starts and becomes healthy → a one-shot `migrate` container runs `prisma migrate deploy` → the app starts at `http://localhost:3000`.

LLM access from inside the container:

- **Ollama on the host** (default): the compose file points `OLLAMA_BASE_URL` at `host.docker.internal:11434`, which reaches the Ollama instance running on your machine.
- **OpenRouter**: create a `.env` file next to `docker-compose.yml` with `LLM_PROVIDER=openrouter` and `OPENROUTER_API_KEY=sk-or-...` — no Ollama needed at all.

The database is persisted in the `db-data` volume; `docker compose down -v` wipes it.

## 👥 Team Workflow

Work is split into two independent tracks so both can move in parallel without stepping on each other:

| | **Track 1 — Prompt Testing** | **Track 2 — DevOps** |
| --- | --- | --- |
| **Owns** | Prompt templates, agent behavior, model/provider selection, output quality | Docker, database migrations, environment config, deployment |
| **Files** | `src/ai/**`, `src/lib/presentation/*prompt*`, `src/lib/model-picker.ts`, `src/app/api/presentation/**` | `Dockerfile`, `docker-compose.yml`, `prisma/migrations/**`, `prisma/schema.prisma`, `.env.example`, Vercel settings |
| **Test loop** | Run the app against OpenRouter (`LLM_PROVIDER=openrouter`) for reproducible model behavior, or local Ollama for free iteration; judge output with the slide audit agent (`POST /api/presentation/audit-slide`) | `docker compose up --build` must boot a working app from a clean checkout; schema changes ship as SQL migrations via `pnpm db:migrate:dev` |
| **PR scope** | Prompt/agent changes only — no infra files | Infra changes only — no prompt edits |

Rules of the road:

1. A schema change is a **DevOps-track** change even if a prompt PR needs it — split it out.
2. Prompt changes are judged by verification score (see the verification agent), not by eyeballing one lucky generation.
3. Both tracks branch from `main` and merge via PR; neither track pushes to `main` directly.

## 📖 Usage

1. Start the app (`pnpm dev`) and go to `http://localhost:3000` — you're dropped straight into `/presentation` as the demo admin user.
2. Create a new presentation from `/presentation/create`: describe the topic, review/edit the generated outline, then generate the full deck.
3. In the editor, use the built-in themes or create a custom one, edit slides directly, or use the in-editor chat agent to ask for changes (layout, images, new/regenerated slides, theme changes).
4. Export to `.pptx`, present directly from the browser, or generate a public share link.

## 📁 Project Structure
```text
High-level map of `src/`:

├── app/` — Next.js App Router routes.
  └── presentation/` — the main app surface: create flow, generation-in-progress view, and the editor/viewer (`[id]/`).
  └── share/` — public read-only share view for a presentation.
  └── api/` — route handlers: the presentation chat agent (`agent/presentation/`), outline/slide/image/diagram generation, the stubbed auth endpoint, UploadThing's route.
  └── actions/` — Server Actions for image generation, notebook/presentation CRUD, and the image-studio tool (multi-provider image search).
```
```text
  └── ai/` — the presentation-editing agent: `agents/presentation/createAgent.ts` (LangGraph agent with Supabase-backed chat memory), `tools/` (slide/theme/image editing tools + web search), `lib/` (Postgres checkpointing, pasted-content middleware).
  └── components/notebook/` — the primary implementation of the slide-outline UI, theming UI, editor plugins, and image editor. "Notebook" here just means "a presentation project" — it's not a separate note-taking product. Includes a small early-stage `notes/` sub-mode.
  └── components/presentation/` — the app-shell/viewer chrome (sidebar, edit panel, zoom/scroll, present mode) that composes pieces from `components/notebook/`.
```
```text
  └── lib/model-picker.ts` — the LLM resolver: Ollama by default, OpenRouter when LLM_PROVIDER=openrouter (see [What's Different From Upstream](#-whats-different-from-upstream)).
  └── lib/notebook/` — data model for attaching source files to a presentation project, and the agent activity timeline shown in the chat UI.
  └── lib/presentation/themes.ts` — built-in theme definitions.
  └── lib/observability/` — a homegrown, console-only structured logger. No external service (no Sentry/PostHog/etc.) is wired up — nothing to configure here.
  └── server/` — `auth.ts` (the demo-user stub), `ai/` (LangChain↔AI SDK message conversion), `share/` (share-link authorization).
  └── config/`, `constants/` — slide sizing/format presets, the FAL image model catalog, and infographic chart templates.
  └── provider/` — root-level React providers (session, React Query, theme).
```

## ⚠️ Known Issues

- **Document/RAG search is scaffolded but not implemented.** The notebook attachment model has `ragId`/`processingStatus` fields, and `PINECONE_API_KEY` is declared, but there's no actual vector-search tool wired into the agent. Don't expect "chat with your uploaded document" to work yet.
- **`/auth/signin` still renders a "Sign in with Google" button** that goes nowhere useful — dead leftover from upstream since auth is stubbed. Harmless, but confusing if you stumble onto it.
- **"Admin-only" gating on some image models is a no-op in this build** — the demo user is always `role: ADMIN`, so those features work for everyone.
- Both Biome and Prettier are configured; Biome is canonical (it's what `lint`/`check` scripts run).

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

MIT — see [LICENSE](LICENSE). Originally copyright ALLWEONE Team; this fork is a derivative work for coursework purposes.
