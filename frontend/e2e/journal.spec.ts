import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/reframe", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reframed: "A confident version of your win." }),
    })
  );
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

  await expect(page.locator("p:has-text('I led the standup today')")).toBeVisible();
  await expect(page.locator("span:has-text('leadership')").first()).toBeVisible();
});

test("save button is disabled when text is empty", async ({ page }) => {
  await expect(page.locator('button:has-text("Save")')).toBeDisabled();
});

test("clears textarea after save", async ({ page }) => {
  const textarea = page.locator('textarea[placeholder="Write about your win..."]');
  await textarea.fill("Something great");
  await page.click('button:has-text("Save")');
  await expect(textarea).toHaveValue("", { timeout: 2000 });
});

test("refresh-prompt button swaps the daily prompt and shows a tooltip on hover", async ({
  page,
}) => {
  const promptLocator = page.locator("main p").first();
  const initialPrompt = await promptLocator.textContent();

  const refreshButton = page.getByRole("button", { name: "Try another prompt" });
  await refreshButton.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Try another prompt");

  await refreshButton.click();
  await expect(promptLocator).not.toHaveText(initialPrompt ?? "");
});
