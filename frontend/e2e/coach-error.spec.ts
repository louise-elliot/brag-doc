import { test, expect } from "@playwright/test";

test("coach turn failure renders inline error with retry", async ({ page }) => {
  let firstCall = true;
  await page.route("**/api/coach/turn", async (route) => {
    if (firstCall) {
      firstCall = false;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Coach turn failed" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ text: "Recovered.", notes: [] }),
      });
    }
  });

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.fill(
    'textarea[placeholder="Write about your win..."]',
    "Did a thing"
  );
  await page.click('button:has-text("Save")');
  await page.click('button:has-text("Talk it through with the coach")');

  await expect(page.locator("text=/coach didn['']t respond/i")).toBeVisible();
  await expect(page.locator('button:has-text("Retry")')).toBeVisible();

  await page.click('button:has-text("Retry")');

  await expect(page.locator("text=Recovered.")).toBeVisible();
});
