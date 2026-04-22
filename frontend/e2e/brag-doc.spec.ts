import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("shows empty state on Brag Doc tab with no entries", async ({ page }) => {
  await page.click('button[role="tab"]:has-text("Brag Doc")');
  await expect(page.locator("text=Add some journal entries first")).toBeVisible();
});

test("generate button appears when entries exist", async ({ page }) => {
  await page.fill('textarea[placeholder="Write about your win..."]', "Built the API");
  await page.click("text=technical");
  await page.click('button:has-text("Save")');

  await page.click('button[role="tab"]:has-text("Brag Doc")');
  await expect(page.locator('button:has-text("Generate")')).toBeVisible();
});
