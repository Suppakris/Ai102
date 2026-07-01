import "dotenv/config";

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    seed: "node prisma/seed.js",
  },
  datasource: {
    // Read process.env directly (not prisma's throwing env() helper) so that
    // `prisma generate` during `pnpm install` does NOT fail when DATABASE_URL
    // isn't set yet — generate doesn't need a live DB. The real value is
    // required at runtime (src/server/db.ts) and for migrations (db:push).
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:5432/placeholder",
  },
});
//3