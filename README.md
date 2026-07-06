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

- **Auth is disabled.** `src/server/auth.ts` is stubbed to always return a fixed demo admin user. No Google OAuth, no `NEXTAUTH_*` vars needed. To restore real login, revert that file and set the Google/NextAuth env vars again.
- **Text generation is Ollama-only.** All cloud text providers (OpenAI, LM Studio, OpenRouter, Groq/BYOK) have been removed from `src/lib/model-picker.ts`. Every request resolves to a model served from `OLLAMA_BASE_URL`'s OpenAI-compatible endpoint. Legacy provider values (`openai`, `lmstudio`) from old persisted client state are caught and silently redirected to the default Ollama model instead of erroring.
- **Image generation still uses cloud providers** — FAL (Flux models) is the default and primary path, with a Together AI path also present in `src/app/_actions/image/generate.ts`.

## 🌟 Features

### Core Functionality

- AI-powered outline generation, then full slide generation, running on a local Ollama model
- Editable outlines before finalizing
- Real-time slide generation
- Auto-save

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

### Images

- AI image generation via FAL (Flux models — default: Flux 2 Flash)
- Stock photos via Unsplash
- Google Custom Search image lookup (`src/app/_actions/apps/image-studio/google.ts`)

## 🧰 Tech Stack

| Category           | Technologies                                    |
| ------------------ | ------------------------------------------------ |
| **Framework**      | Next.js, React, TypeScript                        |
| **Styling**        | Tailwind CSS                                      |
| **Database**       | PostgreSQL with Prisma ORM                        |
| **Text Generation**| Ollama (local, OpenAI-compatible endpoint)        |
| **Image Generation**| FAL (Flux models), Together AI (secondary path)  |
| **UI Components**  | Radix UI                                          |
| **Text Editor**    | Plate Editor                                      |
| **File Uploads**   | UploadThing                                       |
| **Drag & Drop**    | DND Kit                                           |

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
- pnpm (repo uses `pnpm-lock.yaml` / `pnpm-workspace.yaml`)
- PostgreSQL database (Supabase or Neon both confirmed to work)
- [Ollama](https://ollama.com) installed and running locally, with at least one model pulled (e.g. `ollama pull llama3.2:3b`)
- Optional provider keys depending on which features you want:
  - FAL API key (AI image generation)
  - Together AI API key (secondary image generation path)
  - Google Custom Search API key + Search Engine CX (image lookup)
  - Unsplash access key (stock images)
  - Tavily API key (web search for outlines)
  - UploadThing token (image storage)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Suppakris/Ai102.git
   cd Ai102
----------------------------------------
