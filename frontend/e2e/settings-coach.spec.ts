import { test, expect } from "./fixtures/auth";

test.beforeEach(async ({ signedInPage: page }) => {
  await page.goto("/");
});

test("changing coaching style is sent on the next coach turn", async ({
  signedInPage: page,
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

  // Open Settings drawer and pick "The Hype Woman"
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("tab", { name: "Coach" }).click();
  const settingsWrite = page.waitForResponse(
    (resp) =>
      resp.url().includes("/rest/v1/settings") &&
      resp.request().method() !== "GET" &&
      resp.ok()
  );
  await page.getByRole("radio", { name: "The Hype Woman" }).click();
  await settingsWrite;
  await page.getByRole("button", { name: "Close settings" }).first().click();

  // Go to Journal, save an entry, then open the coach
  await page.getByRole("tab", { name: /daily wins/i }).click();
  await page
    .locator('textarea[placeholder="Write about your win..."]')
    .fill("I shipped a new feature today");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.locator("p", { hasText: "I shipped a new feature today" }).first()
  ).toBeVisible();

  await page.click('button:has-text("Coach me")');

  await expect(page.locator("text=Great start — tell me more.")).toBeVisible();

  expect(capturedBody.coaching_style).toBe("hype-woman");
  expect(capturedBody.user_context).toBeNull();
});

test("user_context is sent to the coach when set in Settings", async ({
  signedInPage: page,
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

  // Open Settings drawer and fill in context.
  await page.getByRole("button", { name: "Open settings" }).click();

  // The two fields each save on blur; sequence the writes so they don't race.
  const isSettingsUpsert = (resp: import("@playwright/test").Response) =>
    resp.url().includes("/rest/v1/settings") &&
    resp.request().method() !== "GET" &&
    resp.ok();

  const headlineWrite = page.waitForResponse(isSettingsUpsert);
  await page.getByLabel("Job Title").fill("Senior backend engineer at a fintech");
  await page.getByLabel("Job Title").evaluate((el) => (el as HTMLElement).blur());
  await headlineWrite;

  const notesWrite = page.waitForResponse(isSettingsUpsert);
  await page
    .getByLabel("What else do you want your coach to know?")
    .fill("Working towards staff promotion");
  await page
    .getByLabel("What else do you want your coach to know?")
    .evaluate((el) => (el as HTMLElement).blur());
  await notesWrite;

  await page.getByRole("button", { name: "Close settings" }).first().click();

  // Go to Journal, save an entry, then open the coach
  await page.getByRole("tab", { name: /daily wins/i }).click();
  await page
    .locator('textarea[placeholder="Write about your win..."]')
    .fill("I led the incident response today");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.locator("p", { hasText: "I led the incident response today" }).first()
  ).toBeVisible();

  await page.click('button:has-text("Coach me")');

  await expect(page.locator("text=Tell me more about that.")).toBeVisible();

  const context = capturedBody.user_context as Record<string, unknown>;
  expect(context.headline).toBe("Senior backend engineer at a fintech");
});

test("coaching style choice persists across reloads", async ({ signedInPage: page }) => {
  // Open Settings drawer and pick "The Bold Coach"
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("tab", { name: "Coach" }).click();

  // The write goes to Supabase REST; wait for the upsert to complete before reloading.
  const settingsWrite = page.waitForResponse(
    (resp) =>
      resp.url().includes("/rest/v1/settings") &&
      resp.request().method() !== "GET" &&
      resp.ok()
  );
  await page.getByRole("radio", { name: "The Bold Coach" }).click();
  await settingsWrite;

  // Reload and navigate back to Settings drawer
  await page.reload();
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("tab", { name: "Coach" }).click();

  // The Bold Coach radio should still be selected
  await expect(
    page.getByRole("radio", { name: "The Bold Coach" })
  ).toHaveAttribute("aria-checked", "true");
});
