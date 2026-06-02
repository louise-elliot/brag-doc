import { test, expect } from "./fixtures/auth";

test("localStorage entries upload on first sign-in", async ({ signedInContext }) => {
  const page = await signedInContext.newPage();

  // Navigate to a page where localStorage will persist for the next nav
  await page.goto("/sign-in");

  // Seed localStorage BEFORE going to the app — the proxy will let /sign-in through.
  await page.evaluate(() => {
    localStorage.setItem("byline-entries", JSON.stringify([{
      id: crypto.randomUUID(),
      date: "2026-05-18",
      prompt: "what shipped?",
      original: "I shipped the search feature",
      reframed: null,
      tags: ["technical"],
      coachNotes: null,
      createdAt: "2026-05-18T10:00:00Z",
    }]));
  });

  // Now navigate to /. The signedInContext already has the auth cookie set.
  // The proxy will let us through. App.tsx will call runFirstSignInMigration on mount.
  await page.goto("/");

  // The migrated entry should appear in the entry list.
  await expect(page.getByText("I shipped the search feature")).toBeVisible({ timeout: 15_000 });

  // localStorage should be cleared after successful migration.
  const remaining = await page.evaluate(() => localStorage.getItem("byline-entries"));
  expect(remaining).toBeNull();
});
