import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/generate-brag-doc", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        bullets: [{ tag: "technical", points: ["Shipped the API"] }],
      }),
    })
  );
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

test("settings card shows all four controls with sensible defaults", async ({
  page,
}) => {
  await page.fill(
    'textarea[placeholder="Write about your win..."]',
    "Built the API"
  );
  await page.getByRole("button", { name: "technical", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();

  await page.getByRole("tab", { name: /brag doc/i }).click();

  await expect(
    page.getByRole("radiogroup", { name: "Timeframe" })
  ).toBeVisible();
  await expect(
    page.getByRole("radiogroup", { name: "Sections" })
  ).toBeVisible();
  await expect(page.getByLabel("Additional guidance")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "untagged", pressed: true })
  ).toBeVisible();
});

test("deselecting every tag chip disables Generate with helper text", async ({
  page,
}) => {
  await page.fill(
    'textarea[placeholder="Write about your win..."]',
    "Built the API"
  );
  await page.getByRole("button", { name: "technical", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();

  await page.getByRole("tab", { name: /brag doc/i }).click();

  // Deselect all six default tags + Untagged
  for (const name of [
    "leadership",
    "technical",
    "collaboration",
    "problem-solving",
    "communication",
    "mentoring",
    "untagged",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
  }

  await expect(page.getByRole("button", { name: "Generate" })).toBeDisabled();
  await expect(page.getByText("Select at least one tag")).toBeVisible();
});

test("chronological output renders without group headings", async ({
  page,
}) => {
  await page.unroute("**/api/generate-brag-doc");
  await page.route("**/api/generate-brag-doc", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        bullets: [{ tag: "", points: ["First bullet", "Second bullet"] }],
      })
    })
  );

  await page.fill(
    'textarea[placeholder="Write about your win..."]',
    "Built the API"
  );
  await page.getByRole("button", { name: "technical", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();

  await page.getByRole("tab", { name: /brag doc/i }).click();
  const organiseBy = page.getByRole("radiogroup", { name: "Sections" });
  await organiseBy.getByRole("radio", { name: "Timeline (no sections)" }).click();
  await page.getByRole("button", { name: "Generate" }).click();

  await expect(page.getByText("First bullet")).toBeVisible();
  await expect(page.getByText("Second bullet")).toBeVisible();
  await expect(page.locator("h3")).toHaveCount(0);
});
