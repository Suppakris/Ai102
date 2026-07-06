# Ai102

A local-first AI presentation generator — a customized, Ollama-only build derived from [ALLWEONE's presentation-ai](https://github.com/allweonedev/presentation-ai), stripped down for a college project. No cloud LLM required, no login wall.

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
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [Known Issues](#-known-issues)
- [Contributing](#-contributing)
- [License](#-license)


## 🎓 What's Different From Upstream

This fork disables everything that requires a paid account or a login system, so it can run as a self-contained coursework build:

- **Auth is disabled.** `src/server/auth.ts` is stubbed to always return a fixed demo admin user. No Google OAuth, no `NEXTAUTH_*` vars needed. Because the demo user's role is always `ADMIN`, every "admin-only" feature (see Known Issues) is effectively open to everyone in this build. To restore real login, revert that file and set the Google/NextAuth env vars again.
- **Text generation is Ollama-only.** All cloud text providers (OpenAI, LM Studio, OpenRouter, Groq/BYOK) have been removed from `src/lib/model-picker.ts`. Every request resolves to a model served from `OLLAMA_BASE_URL`'s OpenAI-compatible endpoint. Legacy provider values (`openai`, `lmstudio`) from old persisted client state are caught and silently redirected to the default Ollama model instead of erroring.
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
| **Database**        | PostgreSQL with Prisma ORM (Neon and node-postgres adapters both present) |
| **Text Generation**| Ollama (local, OpenAI-compatible endpoint), via LangChain + LangGraph agent |
| **Image Generation**| FAL (Flux models, primary), Together AI (secondary path)             |
| **UI Components**   | Radix UI                                                              |
| **Text Editor**     | Plate Editor (`platejs`)                                             |
| **File Uploads**     | UploadThing                                                          |
| **Drag & Drop**      | DND Kit                                                              |
| **Lint/Format**      | Biome (canonical — see `lint`/`check` scripts)                       |

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
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
| `OLLAMA_BASE_URL` | Optional | Point at a remote/tunneled Ollama instance (e.g. via ngrok) instead of localhost. |
| `OLLAMA_DEFAULT_MODEL` | Optional | Override the default model (`llama3.2:3b`). |
| `OLLAMA_NUM_CTX` | Optional | Context window in tokens (default: 8192). Ollama defaults most models to a small context (often 2048) regardless of what the model supports, which can silently truncate a long presentation generation mid-deck. |
| `OLLAMA_MAX_OUTPUT_TOKENS` | Optional | Max output tokens per generation request (default: 4096). |
| `TOGETHER_AI_API_KEY` | Optional | Secondary image generation path (Together AI FLUX models). |
| `UPLOADTHING_TOKEN` | Optional | Image storage for AI-generated images. |
| `UNSPLASH_ACCESS_KEY` | Optional | Stock photo search. |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` + `SEARCH_ENGINE_CX` | Optional | Google Custom Search image lookup. |
| `TAVILY_API_KEY` | Optional | Web search tool for the outline generator and the in-editor chat agent. |

All optional integrations degrade gracefully when unset — features that need them just no-op with an error message instead of crashing. Auth-related vars (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`NEXTAUTH_SECRET`/`NEXTAUTH_URL`) are commented out and not needed since login is stubbed.

### Database Setup

Once `DATABASE_URL` is set:

```bash
pnpm db:push       # prisma generate + prisma db push — applies the schema
pnpm db:studio      # optional: browse the DB with Prisma Studio
```

There's no separate seed step required to boot the app — the stubbed demo user is upserted automatically on first request.

## 📖 Usage

1. Start the app (`pnpm dev`) and go to `http://localhost:3000` — you're dropped straight into `/presentation` as the demo admin user.
2. Create a new presentation from `/presentation/create`: describe the topic, review/edit the generated outline, then generate the full deck.
3. In the editor, use the built-in themes or create a custom one, edit slides directly, or use the in-editor chat agent to ask for changes (layout, images, new/regenerated slides, theme changes).
4. Export to `.pptx`, present directly from the browser, or generate a public share link.

## 📁 Project Structure

High-level map of `src/`:

- **`app/`** — Next.js App Router routes.
  - `presentation/` — the main app surface: create flow, generation-in-progress view, and the editor/viewer (`[id]/`).
  - `share/` — public read-only share view for a presentation.
  - `api/` — route handlers: the presentation chat agent (`agent/presentation/`), outline/slide/image/diagram generation, the stubbed auth endpoint, UploadThing's route.
  - `_actions/` — Server Actions for image generation, notebook/presentation CRUD, and the image-studio tool (multi-provider image search).
  - `auth/` — sign-in/sign-out pages. Currently dead UI (see Known Issues).
- **`ai/`** — the presentation-editing agent: `agents/presentation/createAgent.ts` (LangGraph agent with Postgres-backed chat memory), `tools/` (slide/theme/image editing tools + web search), `lib/` (Postgres checkpointing, pasted-content middleware).
- **`components/notebook/`** — the primary implementation of the slide-outline UI, theming UI, editor plugins, and image editor. "Notebook" here just means "a presentation project" — it's not a separate note-taking product. Includes a small early-stage `notes/` sub-mode.
- **`components/presentation/`** — the app-shell/viewer chrome (sidebar, edit panel, zoom/scroll, present mode) that composes pieces from `components/notebook/`.
- **`lib/model-picker.ts`** — the Ollama-only LLM resolver (see [What's Different From Upstream](#-whats-different-from-upstream)).
- **`lib/notebook/`** — data model for attaching source files to a presentation project, and the agent activity timeline shown in the chat UI.
- **`lib/presentation/themes.ts`** — built-in theme definitions.
- **`lib/observability/`** — a homegrown, console-only structured logger. No external service (no Sentry/PostHog/etc.) is wired up — nothing to configure here.
- **`server/`** — `auth.ts` (the demo-user stub), `ai/` (LangChain↔AI SDK message conversion), `share/` (share-link authorization).
- **`config/`, `constants/`** — slide sizing/format presets, the FAL image model catalog, and infographic chart templates.
- **`provider/`** — root-level React providers (session, React Query, theme).

## ⚠️ Known Issues

- **Document/RAG search is scaffolded but not implemented.** The notebook attachment model has `ragId`/`processingStatus` fields, and `PINECONE_API_KEY` is declared, but there's no actual vector-search tool wired into the agent. Don't expect "chat with your uploaded document" to work yet.
- **`/auth/signin` still renders a "Sign in with Google" button** that goes nowhere useful — dead leftover from upstream since auth is stubbed. Harmless, but confusing if you stumble onto it.
- **"Admin-only" gating on some image models is a no-op in this build** — the demo user is always `role: ADMIN`, so those features work for everyone.
- Both Biome and Prettier are configured; Biome is canonical (it's what `lint`/`check` scripts run).

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

MIT — see [LICENSE](LICENSE). Originally copyright ALLWEONE Team; this fork is a derivative work for coursework purposes.
