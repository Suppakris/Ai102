import "dotenv/config";

import { defineConfig } from "prisma/config";

// NOTE: the datasource url/directUrl live in prisma/schema.prisma via
// env(...). Resolving them there (instead of here) means `prisma generate`
// during install no longer throws when DATABASE_URL is unset — it's only
// read when actually connecting (migrations / queries).
export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    seed: "node prisma/seed.js",
  },
});
