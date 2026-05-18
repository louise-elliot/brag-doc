import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("changing coaching style is sent on the next coach turn", async ({
  page,
}) => {
  let capturedBody: Record<string, unknown> = {};

  await page.route("**/api/coach/turn", async (route) => {
    capturedBody = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ text: "Great start — tell me more.", notes: [] }),
    });
  });

  await page.route("**/api/coach/reframe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reframed: "Reframed text", notes: [] }),
    });
  });

  // Go to Settings and pick "The Hype Woman"
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "The Hype Woman" }).click();

  // Go to Journal, save an entry, then open the coach
  await page.getByRole("tab", { name: "Journal" }).click();
  await page
    .locator('textarea[placeholder="Write about your win..."]')
    .fill("I shipped a new feature today");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.locator("p", { hasText: "I shipped a new feature today" }).first()
  ).toBeVisible();

  await page.click('button:has-text("Talk it through with the coach")');

  await expect(page.locator("text=Great start — tell me more.")).toBeVisible();

  expect(capturedBody.coaching_style).toBe("hype-woman");
  expect(capturedBody.user_context).toBeNull();
});

test("user_context is sent to the coach when set in Settings", async ({
  page,
}) => {
  let capturedBody: Record<string, unknown> = {};

  await page.route("**/api/coach/turn", async (route) => {
    capturedBody = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ text: "Tell me more about that.", notes: [] }),
    });
  });

  await page.route("**/api/coach/reframe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reframed: "Reframed text", notes: [] }),
    });
  });

  // Go to Settings and fill in context
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByLabel("Headline").fill("Senior backend engineer at a fintech");
  await page
    .getByLabel("What else should the coach know?")
    .fill("Working towards staff promotion");
  // Trigger blur to persist the values
  await page.click("body");

  // Go to Journal, save an entry, then open the coach
  await page.getByRole("tab", { name: "Journal" }).click();
  await page
    .locator('textarea[placeholder="Write about your win..."]')
    .fill("I led the incident response today");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.locator("p", { hasText: "I led the incident response today" }).first()
  ).toBeVisible();

  await page.click('button:has-text("Talk it through with the coach")');

  await expect(page.locator("text=Tell me more about that.")).toBeVisible();

  const context = capturedBody.user_context as Record<string, unknown>;
  expect(context.headline).toBe("Senior backend engineer at a fintech");
});

test("coaching style choice persists across reloads", async ({ page }) => {
  // Pick "The Bold Coach" in Settings
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "The Bold Coach" }).click();

  // Reload and navigate back to Settings
  await page.reload();
  await page.getByRole("tab", { name: "Settings" }).click();

  // The Bold Coach radio should still be selected
  await expect(
    page.getByRole("radio", { name: "The Bold Coach" })
  ).toHaveAttribute("aria-checked", "true");
});
