import { defineConfig } from "@playwright/test";

// E2E smoke suite. Runs against a server the CI harness (or a developer)
// already has up — see .github/workflows/ci.yml, which boots the full
// docker-compose stack (db + migrate + redis + app) before this runs.
// Deliberately doesn't manage its own webServer/db lifecycle: that's the
// harness's job, so the same test file works locally against
// `docker compose up` or `pnpm dev` without changes.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
});
