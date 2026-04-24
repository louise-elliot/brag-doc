import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/reframe", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reframed: "Reframed." }),
    })
  );
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("add a new category and use it on a journal entry", async ({ page }) => {
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByLabel("New category name").fill("focus");
  await page.getByRole("button", { name: "Add" }).click();

  await page.getByRole("tab", { name: "Journal" }).click();
  await page
    .locator('textarea[placeholder="Write about your win..."]')
    .fill("Stayed heads-down on the migration");
  await page.getByRole("button", { name: "focus", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.locator("p", { hasText: "Stayed heads-down on the migration" }).first()
  ).toBeVisible();
  await expect(page.getByText("focus", { exact: true }).first()).toBeVisible();
});

test("deleting a category removes it from the picker but leaves past entries tagged", async ({
  page,
}) => {
  // Save an entry tagged 'leadership'
  await page
    .locator('textarea[placeholder="Write about your win..."]')
    .fill("Led the planning session");
  await page.getByRole("button", { name: "leadership", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Win logged")).toBeVisible();

  // Delete leadership in Settings
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Delete leadership" }).click();

  // Back on Journal the picker no longer has a leadership button
  await page.getByRole("tab", { name: "Journal" }).click();
  await expect(
    page.getByRole("button", { name: "leadership", exact: true })
  ).toHaveCount(0);

  // But the past entry still shows the leadership tag
  await expect(
    page.locator("span", { hasText: "leadership" }).first()
  ).toBeVisible();
});

test("renaming a category rewrites the tag on past entries", async ({
  page,
}) => {
  await page
    .locator('textarea[placeholder="Write about your win..."]')
    .fill("Paired with a teammate on the refactor");
  await page.getByRole("button", { name: "mentoring", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Win logged")).toBeVisible();

  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Rename mentoring" }).click();
  const input = page.getByLabel("Rename mentoring");
  await input.fill("coaching");
  await input.press("Enter");

  await page.getByRole("tab", { name: "Journal" }).click();
  await expect(page.getByText("coaching", { exact: true }).first()).toBeVisible();
  await expect(
    page.locator("span", { hasText: "mentoring" })
  ).toHaveCount(0);
});
