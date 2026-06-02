import { test, expect } from "./fixtures/auth";

test("entries persist across page reloads", async ({ signedInPage: page }) => {
  await page.goto("/");

  await page.fill('textarea[placeholder="Write about your win..."]', "Persisted entry");
  await page.click('button:has-text("Save")');
  await expect(page.locator("p:has-text('Persisted entry')")).toBeVisible();

  // Reload — the entry should be re-loaded from Supabase (server-side store).
  await page.reload();
  await expect(page.locator("p:has-text('Persisted entry')")).toBeVisible();
});

test("clear all entries removes entries", async ({ signedInPage: page }) => {
  await page.goto("/");

  await page.fill('textarea[placeholder="Write about your win..."]', "To be deleted");
  await page.click('button:has-text("Save")');

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("tab", { name: "Data" }).click();
  await page.click('button:has-text("Clear all entries")');
  await page.click('button:has-text("Yes, delete everything")');
  await page.getByRole("button", { name: "Close settings" }).first().click();

  await expect(page.getByText("No wins yet")).toBeVisible();
});
