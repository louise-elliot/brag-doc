import { test, expect } from "@playwright/test";

test("entries persist across page reloads", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.fill('textarea[placeholder="Write about your win..."]', "Persisted entry");
  await page.click('button:has-text("Save")');
  await expect(page.locator("text=Persisted entry")).toBeVisible();

  await page.reload();
  await expect(page.locator("text=Persisted entry")).toBeVisible();
});

test("clear all data removes entries", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.fill('textarea[placeholder="Write about your win..."]', "To be deleted");
  await page.click('button:has-text("Save")');

  await page.click('button[role="tab"]:has-text("Settings")');
  await page.click('button:has-text("Clear all data")');
  await page.click('button:has-text("Yes, delete everything")');

  await page.click('button[role="tab"]:has-text("Journal")');
  await expect(page.locator("text=No entries yet")).toBeVisible();
});
