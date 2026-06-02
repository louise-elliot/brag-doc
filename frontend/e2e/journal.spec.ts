import { test, expect } from "./fixtures/auth";

test.beforeEach(async ({ signedInPage: page }) => {
  await page.goto("/");
});

test("displays a daily prompt", async ({ signedInPage: page }) => {
  await expect(page.locator("main")).toContainText("?");
});

test("saves an entry and shows it in the list", async ({ signedInPage: page }) => {
  await page.fill('textarea[placeholder="Write about your win..."]', "I led the standup today");
  await page.click("text=leadership");
  await page.click('button:has-text("Save")');

  await expect(page.locator("p:has-text('I led the standup today')")).toBeVisible();
  await expect(page.locator("span:has-text('leadership')").first()).toBeVisible();
});

test("save button is disabled when text is empty", async ({ signedInPage: page }) => {
  await expect(page.locator('button:has-text("Save")')).toBeDisabled();
});

test("clears textarea after save", async ({ signedInPage: page }) => {
  const textarea = page.locator('textarea[placeholder="Write about your win..."]');
  await textarea.fill("Something great");
  await page.click('button:has-text("Save")');
  await expect(textarea).toHaveValue("", { timeout: 2000 });
});

test("refresh-prompt button changes the prompt", async ({ signedInPage: page }) => {
  const promptLocator = page.locator('p').filter({ hasText: /\?/ }).first();
  const initialPrompt = await promptLocator.textContent();

  const refreshButton = page.getByRole("button", { name: "Try another prompt" });
  await expect(refreshButton).toBeVisible();

  await refreshButton.click();
  await expect(promptLocator).not.toHaveText(initialPrompt ?? "");
});
