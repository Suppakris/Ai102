# Ai102

A local-first AI presentation generator — a customized, Ollama-only build derived from [ALLWEONE's presentation-ai](https://github.com/allweonedev/presentation-ai), stripped down for a college project. No cloud LLM required, no paid APIs required to run it end to end. Sign-in is real OAuth via GitHub (required), with optional Google and Discord login (free, no billing) — see [Admin access](#admin-access) for granting a user full access after their first sign-in.

## 🔗 Quick Links

- [Architecture](ARCHITECTURE.md) — folder layout, frontend/backend split, request flow
- [Contributing Guidelines](CONTRIBUTING.md)
- 📕 [Project Manual (English)](<Ai102-Project-Manual-EN .pdf>) · [คู่มือภาษาไทย](<Ai102-Project-Manual-TH .pdf>) — full PDF manual (V2.0): setup, Docker, migrations, review/auto-fix usage

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

- **Auth is real OAuth** (`src/backend/auth.ts`, via Auth.js/NextAuth v5 + Prisma). GitHub is the required provider — see `.env.example` for the required `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`/`NEXTAUTH_SECRET`/`NEXTAUTH_URL`. Google and Discord are optional extra login providers: set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and/or `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` to show their sign-in buttons, or leave them unset to keep GitHub-only (the sign-in page only renders buttons for providers with credentials configured). All three are free, no billing required. New sign-ins default to `role: USER` (not admin); see [Admin access](#admin-access) to grant someone full access.
  - **Only test social sign-in against the real deployed domain, never a Vercel PR preview link.** OAuth Apps support exactly one callback URL (set to the production domain), so a sign-in started from a preview URL will always fail with `InvalidCheck`/`error=Configuration` — the PKCE cookie gets set on the preview's hostname but the provider redirects the callback to production. This is expected, not a bug.
- **Text generation defaults to Ollama, with OpenRouter as an optional paid upgrade** (`src/lib/model-picker.ts`). Every request resolves to a model served from `OLLAMA_BASE_URL`'s native API (not the OpenAI-compat endpoint — that silently drops Ollama-specific options like `num_ctx`) unless `OPENROUTER_API_KEY` is set, in which case an "OpenRouter (paid)" group appears in the model picker with 6 preset cloud models (`src/constants/text-models.ts`) that any signed-in user can select — whoever owns the key gets billed per token, same pattern as the FAL image upgrade below. Legacy provider values (`openai`, `lmstudio`) from old persisted client state are caught and silently redirected to the default Ollama model instead of erroring.
- **Image generation is free by default.** [Pollinations.ai](https://pollinations.ai) (no API key) is the default provider everywhere images are generated (`src/backend/queue/image-generation.ts`). FAL (Flux models) is still wired in as an optional, admin-gated paid upgrade if `FAL_API_KEY` is set; Together AI's code path exists but isn't used by any active feature.
- **File uploads are self-hosted.** Images, fonts, and document attachments are stored by the app itself (`POST /api/files/upload`, served back from `GET /api/files/[id]`) instead of a third-party file host that needed its own account and token. Bytes live in Postgres — see the `UploadedFile` model for why the filesystem isn't used. Uploaded images are resized and re-encoded to WebP in the browser before upload, so typical slide images land around 200KB.
- **Backend logic lives under `src/backend/`.** Db, auth, tenant, rate-limiting, the image queue, and the LangGraph presentation agent are consolidated there — see [ARCHITECTURE.md](ARCHITECTURE.md) for the full frontend/backend split.

## 🌟 Features

### Core Functionality

- AI-powered outline generation, then full slide generation, running on a local Ollama model
- Use your own documents as source material: drop a **PDF, Word (.docx), Excel (.xlsx/.xls), CSV, or text/Markdown** file into the prompt box — parsed entirely in the browser (never uploaded), trimmed to the model's context budget (`src/lib/presentation/pdf-extract.ts`, `office-extract.ts`)
- Editable outlines before finalizing
- Real-time slide generation
- Auto-save
- In-editor chat agent (`presentation_agent`, LangGraph + Postgres-backed memory) that can edit an existing deck: change slide layout/background, replace or regenerate images, create/delete/regenerate slides, switch or create themes, and run a web search (needs `TAVILY_API_KEY`)

### AI Deck Review

- One-click **Review** button in the editor header: an AI auditor scores the deck 0-10 on clarity, design, and content accuracy, with a pass / needs-revision verdict
- Claim audit: every verifiable factual claim (numbers, dates, named entities) is marked Supported / Unsupported / Unverifiable — the reviewer is instructed to flag what it can't verify rather than guess (advice and opinions are judged under clarity, not audited)
- Asks clarifying questions instead of reviewing when a deck is too sparse to judge; image-only decks are never scored blind
- Feedback comes back in the deck's own language (Thai decks get Thai feedback)
- The presentation's own prompt + outline are sent as `source_context`, so claims that trace back to the outline can be genuinely verified instead of all coming back "Unverifiable"
- **Auto-fix**: when a deck fails review, one click has the AI rewrite the flagged slides (unsupported claims removed or softened, never given invented backing), re-review the result, and apply it to the editor — with a one-click Undo and full history (Ctrl+Z) support. All-or-nothing apply: if the rewrite can't be parsed back into slides, the deck is left untouched
- Backend: `reviewSlides()` / `reviewAndRevise()` in `src/backend/ai/reviewSlides.ts` (the latter runs at most ONE corrective rewrite pass and re-reviews it), served by `POST /api/presentation/review-deck` (session auth + rate limit). JSON output is schema-enforced — no fence-stripping or parse-and-hope
- Test harnesses: `pnpm review:test` (5 sample decks + revision loop) and `pnpm review:bash` (8 adversarial decks incl. the production XML slide format); both need a reachable Ollama (`OLLAMA_BASE_URL`) or `OPENROUTER_API_KEY` with the `--openrouter` flag
- v1 scope: reviews are shown in the dialog but not persisted — stored review history is a planned post-MVP addition

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

- AI image generation via Pollinations.ai (free, no API key, default) with FAL (Flux models) available as an optional paid upgrade
- Stock photos via Unsplash, Pixabay, and Giphy
- Google Custom Search image lookup (`src/app/_actions/apps/image-studio/google.ts`)

## 🧰 Tech Stack

| Category            | Technologies                                                        |
| ------------------- | -------------------------------------------------------------------- |
| **Framework**       | Next.js 16, React 19, TypeScript                                     |
| **Styling**         | Tailwind CSS v4                                                      |
| **Database**        | PostgreSQL (Supabase in prod, Docker Postgres locally) via Prisma ORM + committed SQL migrations |
| **Text Generation**| Ollama (local, OpenAI-compatible endpoint), via LangChain + LangGraph agent |
| **Image Generation**| Pollinations.ai (free, default), FAL (Flux models, optional/paid)     |
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

   The app runs at `http://localhost:3000`. Signed-out visitors see the landing page; signing in (GitHub, or Google/Discord if configured) takes you to the `/presentation` dashboard — see [What's Different From Upstream](#-whats-different-from-upstream).

### Environment Variables

Copy `.env.example` to `.env` and fill in what you need. `.env.example` is the source of truth; the notable ones:

| Variable | Required? | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | **Required** | Postgres connection string, used at runtime and for migrations. For Supabase, use the **Transaction pooler** (port 6543) — this app runs on Vercel serverless functions, and Session/Direct connections exhaust a pooler's max-clients limit fast since they're held for the life of the client instead of released per query. |
| `FAL_API_KEY` | Optional | Paid AI image upgrade (FAL/Flux), admin-gated. Image generation works with no key at all via the free Pollinations.ai default. |
| `OLLAMA_BASE_URL` | Optional | Point at a remote/tunneled Ollama instance (e.g. via ngrok) instead of localhost. |
| `OLLAMA_DEFAULT_MODEL` | Optional | Override the default model (`llama3.2:3b`). |
| `OLLAMA_NUM_CTX` | Optional | Context window in tokens (default: 8192). Ollama's own default (often 2048) is smaller than this app's generation system prompt, which makes the model see truncated instructions and produce broken decks. Lower it only if generation requests start timing out on slow/CPU-only hardware. |
| `OLLAMA_MAX_OUTPUT_TOKENS` | Optional | Max output tokens per generation request. Unset by default. Same trade-off as `OLLAMA_NUM_CTX`. |
| `OPENROUTER_API_KEY` | Optional | Cloud text-generation alternative ([OpenRouter](https://openrouter.ai)), not admin-gated — any signed-in user can pick a preset cloud model once this key is set. The list has **4 free-tier models and 6 paid ones**, so this key can be created and used without spending anything (see below). Text generation works with no key at all via the free Ollama default. |
| `TOGETHER_AI_API_KEY` | Optional | Legacy code path, not used by any active feature. |
| `UNSPLASH_ACCESS_KEY` | Optional | Stock photo search. |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` + `SEARCH_ENGINE_CX` | Optional | Google Custom Search image lookup. |
| `TAVILY_API_KEY` | Optional | Web search tool for the outline generator and the in-editor chat agent. |

All optional integrations degrade gracefully when unset — features that need them just no-op with an error message instead of crashing.

### File uploads

Uploads go to this app's own storage, not a third-party host:

- `POST /api/files/upload` — session-authenticated, rate limited (30 per 5 min), MIME-allowlisted, 4MB maximum
- `GET /api/files/[id]` — serves the bytes; unauthenticated by design, because these URLs are embedded in slides, exports, thumbnails and `@font-face` rules. Ids are cuids, so the security model is "unguessable URL" — don't put genuinely private files here.

**Size limit, and why it can't simply be raised:** Vercel caps serverless request bodies at ~4.5MB. Self-hosted uploads pass through the app's own function, so that platform limit is the app's limit too. The previous third-party uploader avoided it by sending bytes directly to the vendor. Practical consequences:

- Images are resized to 1600px and re-encoded as WebP in the browser first, so real photos comfortably fit. SVG and GIF are passed through untouched (rasterising them would lose vector data or animation).
- **Video upload is not supported** and returns a clear error rather than failing confusingly.

Storing bytes in Postgres is not what a large product would do — object storage is the conventional answer. It's chosen here because it needs no third-party account and no budget. The practical ceiling is the database's free-tier size, so keep an eye on it if uploads become heavy.

### OpenRouter free tier

`OPENROUTER_API_KEY` does **not** require a credit card. OpenRouter publishes free-tier models (ids ending in `:free`) that cost nothing per token, and four of them are preset in `src/constants/text-models.ts`. Creating a key without adding billing means the paid models in the picker simply fail rather than charging anyone — useful when the project has no budget.

This exists mainly as a **fallback**: the app's default text provider is a self-hosted Ollama server, and when that machine is off or its tunnel URL has rotated, generation and review stop working entirely. A free OpenRouter model keeps them running.

Measured behaviour of the default free model (`nvidia/nemotron-3-super-120b-a12b:free`) against `pnpm review:test`:

- **Structured output is reliable** — valid schema-conforming JSON on every run, no parse failures. Claim auditing on flawed decks is accurate, and the Auto-fix loop lifted test decks 4.0 → 10.0 and 3.7 → 9.0.
- **Scoring of *good* decks is not repeatable.** The same passing deck scored 9.33 with no unsupported claims on one run, and 7.0 *with* an unsupported claim on the next — meaning a sound deck can occasionally be told it needs revision. Local `qwen2.5:7b` returns identical scores for identical input, so Ollama remains the better default.
- **Latency varies a lot.** Individual reviews took 10–24s, but consecutive runs queued far longer. Free-tier requests are rate limited and share capacity with everyone else, which is a real risk during a live demo.

Free models may also log prompts for provider training. The paid ids in the picker (GPT-5, Claude Haiku 4.5, Gemini 2.5 Flash, and others) need no code change to start using — set a funded key and pick one.

Auth vars are **required**, not optional: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — see `.env.example` for how to get each one (all free). Without them the app won't boot in production. `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` are optional — set either pair to add that provider's "Sign in with..." button; leave both blank to skip it.

### Admin access

New GitHub sign-ins default to `role: USER`. Most features work fine at that role — image generation, for example, is free and available to everyone — but a few (paid FAL image models, editing system themes) are admin-gated. To grant someone admin after their first sign-in:

```bash
pnpm db:studio   # opens Prisma Studio — open the User table, set role = ADMIN for their row
```

Or via SQL: `UPDATE "User" SET role = 'ADMIN' WHERE email = 'their@email.com';`

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

> **Migrating an existing `db push` database:** if your DB already has the schema (created via `db:push` before migrations existed), baseline it once instead of re-running the migrations — mark **each** folder under `prisma/migrations/` as applied:
>
> ```bash
> pnpm exec prisma migrate resolve --applied 0_init
> pnpm exec prisma migrate resolve --applied 20260714110000_add_slide_audit
> pnpm exec prisma migrate resolve --applied 20260718150000_add_tenancy_and_agent_threads
> ```
>
> After baselining, `pnpm db:migrate:deploy` reports "No pending migrations" and future migrations apply normally.

There's no separate seed step required — signing in with GitHub creates the user record automatically via the Prisma adapter. See [Admin access](#admin-access) above to grant a user elevated access afterward.

### Run on Docker

The whole stack (front-end + back-end + Postgres + Redis + the image-generation worker) runs on Docker with nothing installed on the host except Docker itself:

```bash
docker compose up --build
```

Boot order is handled for you: Postgres starts and becomes healthy → a one-shot `migrate` container runs `prisma migrate deploy` (SQL migrations from `prisma/migrations/`) → the app starts at `http://localhost:3000`, alongside a separate BullMQ worker container that consumes the Redis-backed image-generation queue.

Auth inside Docker uses the same env vars as everywhere else: set real `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` (and optionally the Google/Discord pairs) in a `.env` file next to `docker-compose.yml`; with the placeholder defaults the stack boots but sign-in won't work.

LLM access from inside the container:

- **Ollama on the host** (default): the compose file points `OLLAMA_BASE_URL` at `host.docker.internal:11434`, which reaches the Ollama instance running on your machine.
- **OpenRouter**: create a `.env` file next to `docker-compose.yml` with `LLM_PROVIDER=openrouter` and `OPENROUTER_API_KEY=sk-or-...` — no Ollama needed at all.

The database is persisted in the `db-data` volume; `docker compose down -v` wipes it.

## 👥 Team Workflow

Work is split into two independent tracks so both can move in parallel without stepping on each other:

| | **Track 1 — Prompt Testing** | **Track 2 — DevOps** |
| --- | --- | --- |
| **Owns** | Prompt templates, agent behavior, model/provider selection, output quality | Docker, database migrations, environment config, deployment |
| **Files** | `src/backend/agent/**`, `src/lib/presentation/*prompt*`, `src/lib/model-picker.ts`, `src/app/api/presentation/**` | `Dockerfile`, `docker-compose.yml`, `prisma/migrations/**`, `prisma/schema.prisma`, `.env.example`, Vercel settings |
| **Test loop** | Run the app against OpenRouter (`LLM_PROVIDER=openrouter`) for reproducible model behavior, or local Ollama for free iteration; judge output with the slide audit agent (`POST /api/presentation/audit-slide`) | `docker compose up --build` must boot a working app from a clean checkout; schema changes ship as SQL migrations via `pnpm db:migrate:dev` |
| **PR scope** | Prompt/agent changes only — no infra files | Infra changes only — no prompt edits |

Rules of the road:

1. A schema change is a **DevOps-track** change even if a prompt PR needs it — split it out.
2. Prompt changes are judged by verification score (see the verification agent), not by eyeballing one lucky generation.
3. Both tracks branch from `main` and merge via PR; neither track pushes to `main` directly.

## 📖 Usage

1. Start the app (`pnpm dev`) and go to `http://localhost:3000` — sign in with GitHub, then grant yourself admin (see [Admin access](#admin-access)) if you need admin-only features.
2. Create a new presentation from `/presentation/create`: describe the topic, review/edit the generated outline, then generate the full deck.
3. In the editor, use the built-in themes or create a custom one, edit slides directly, or use the in-editor chat agent to ask for changes (layout, images, new/regenerated slides, theme changes).
4. Export to `.pptx`, present directly from the browser, or generate a public share link.

## 📁 Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full frontend/backend split and a
request-flow diagram. Quick map of `src/`:

**Frontend**
```text
├── app/`                Next.js App Router routes (pages).
  └── presentation/`     main app surface: create flow, generation-in-progress view, editor/viewer (`[id]/`).
  └── share/`            public read-only share view for a presentation.
  └── api/`              thin route handlers that delegate to src/backend/**.
  └── _actions/`         Server Actions ("use server") — UI-adjacent entry points, delegate to src/backend/**.
├── components/notebook/` the primary slide-outline UI, theming UI, editor plugins, image editor. "Notebook" = "a presentation project", not a separate note-taking product.
├── components/presentation/` app-shell/viewer chrome (sidebar, edit panel, zoom/scroll, present mode).
├── hooks/`, states/`, provider/`, styles/` client-side hooks, state, root providers, global styles.
```

**Backend** (`src/backend/**` — see [ARCHITECTURE.md](ARCHITECTURE.md))
```text
├── db.ts                Prisma client.
├── auth.ts              Auth.js/NextAuth v5 config (GitHub required; Google/Discord optional).
├── tenant.ts            multi-tenant resolution.
├── rate-limit.ts        request rate limiting.
├── share/`              share-link authorization.
├── queue/`              BullMQ image-generation queue + Pollinations.ai/FAL providers.
├── ai/chatMessages.ts   chat message persistence helpers.
├── agent/`              the presentation-editing agent: agent/agents/presentation/createAgent.ts
                          (LangGraph agent, Postgres-backed chat memory), agent/tools/ (slide/theme/
                          image editing tools + web search), agent/lib/ (Postgres checkpointing,
                          pasted-content middleware).
```

**Shared by both layers**
```text
├── lib/model-picker.ts  the Ollama-only LLM resolver (see [What's Different From Upstream](#-whats-different-from-upstream)).
├── lib/notebook/`       data model for attaching source files to a presentation project, and the agent activity timeline.
├── lib/presentation/themes.ts` built-in theme definitions.
├── lib/observability/`  a homegrown, console-only structured logger. No external service wired up.
├── config/`, constants/` slide sizing/format presets, the image-model catalog (Pollinations.ai + FAL), infographic chart templates.
```

## ⚠️ Known Issues

- **Document/RAG search is scaffolded but not implemented.** The notebook attachment model has `ragId`/`processingStatus` fields, and `PINECONE_API_KEY` is declared, but there's no actual vector-search tool wired into the agent. Don't expect "chat with your uploaded document" to work yet.
- **New sign-ins default to `role: USER`, not admin.** A few features (paid FAL image models, editing system themes) stay hidden until someone grants the account admin — see [Admin access](#admin-access). Core features (generating a presentation, free AI images) work for every signed-in user regardless of role.
- Both Biome and Prettier are configured; Biome is canonical (it's what `lint`/`check` scripts run).

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

MIT — see [LICENSE](LICENSE). Originally copyright ALLWEONE Team; this fork is a derivative work for coursework purposes.
