# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# Multi-stage build:
#   deps    → install node_modules (runs `prisma generate` via postinstall)
#   migrate → deps + schema, used by docker-compose as a one-shot
#             `prisma migrate deploy` job before the app starts
#   build   → next build (standalone output)
#   runner  → minimal production image, no pnpm / full node_modules
# ─────────────────────────────────────────────────────────────

FROM node:24-alpine AS base
# corepack activates the pnpm version pinned in package.json#packageManager
RUN npm install -g corepack@latest && corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY patches ./patches
# postinstall runs `prisma generate`, which needs the schema present
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM deps AS migrate
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# .dockerignore excludes the generated Prisma client, so regenerate before
# building. Env validation is skipped: runtime env comes from docker-compose.
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec prisma generate && pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
