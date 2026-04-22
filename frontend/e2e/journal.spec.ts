import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("displays a daily prompt", async ({ page }) => {
  await expect(page.locator("main")).toContainText("?");
});

test("saves an entry and shows it in the list", async ({ page }) => {
  await page.fill('textarea[placeholder="Write about your win..."]', "I led the standup today");
  await page.click("text=leadership");
  await page.click('button:has-text("Save")');

  await expect(page.locator("text=I led the standup today")).toBeVisible();
  await expect(page.locator("span:has-text('leadership')")).toBeVisible();
});

test("save button is disabled when text is empty", async ({ page }) => {
  await expect(page.locator('button:has-text("Save")')).toBeDisabled();
});

test("clears textarea after save", async ({ page }) => {
  const textarea = page.locator('textarea[placeholder="Write about your win..."]');
  await textarea.fill("Something great");
  await page.click('button:has-text("Save")');
  await expect(textarea).toHaveValue("");
});
