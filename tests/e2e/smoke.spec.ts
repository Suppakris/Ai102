import { expect, test } from "@playwright/test";

// Deliberately anonymous: real Google OAuth is restored (see
// src/server/auth.ts), so an E2E suite that needs to actually sign in would
// need a test Google account wired through CI secrets — out of scope for
// this smoke pass. These checks instead verify the public surface and that
// auth actually gates what it's supposed to, without needing credentials.

test("homepage responds and renders", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/Presentation AI/);
});

test("sign-in page is reachable and offers Google sign-in", async ({ page }) => {
  const response = await page.goto("/auth/signin");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
});

test("protected presentation-generation API rejects unauthenticated requests", async ({
  request,
}) => {
  const response = await request.post("/api/presentation/generate", {
    data: { title: "test", outline: ["a"], language: "en-US" },
  });
  expect(response.status()).toBe(401);
});
