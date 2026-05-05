import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  let turnCalls = 0;
  await page.route("**/api/coach/turn", async (route) => {
    turnCalls += 1;
    const body =
      turnCalls === 1
        ? {
            text: "Who specifically benefited from the migration?",
            notes: ["missing-audience"],
          }
        : { text: "How big was the impact?", notes: [] };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route("**/api/coach/reframe", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reframed: "Led the migration that unblocked 40 platform engineers",
        notes: ["hedging", "missing-audience"],
      }),
    })
  );
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("user can talk through an entry with the coach and accept the reframe", async ({
  page,
}) => {
  await page.fill(
    'textarea[placeholder="Write about your win..."]',
    "I just helped a bit with the migration"
  );
  await page.click('button:has-text("Save")');

  await expect(
    page.locator("p:has-text('I just helped a bit with the migration')")
  ).toBeVisible();

  await page.click('button:has-text("Talk it through with the coach")');

  await expect(
    page.locator("text=Who specifically benefited from the migration?")
  ).toBeVisible();
  await expect(page.locator("text=missing-audience").first()).toBeVisible();

  await page.fill(
    'textarea[id^="coach-reply-"]',
    "The platform team — about 40 engineers"
  );
  await page.click('button:has-text("Send reply")');

  await expect(page.locator("text=How big was the impact?")).toBeVisible();

  await page.click('button:has-text("Reframe it now")');

  await expect(
    page.locator(
      'textarea:has-text("Led the migration that unblocked 40 platform engineers")'
    )
  ).toBeVisible();

  await page.click('button:has-text("Accept")');

  await expect(page.locator("text=hedging").first()).toBeVisible();
  await expect(
    page.locator('button:has-text("Talk it through with the coach")')
  ).toHaveCount(0);
});

test("dismissing the reframe retires the button but keeps the entry untouched", async ({
  page,
}) => {
  await page.fill(
    'textarea[placeholder="Write about your win..."]',
    "I just helped a bit with the migration"
  );
  await page.click('button:has-text("Save")');

  await page.click('button:has-text("Talk it through with the coach")');
  await expect(
    page.locator("text=Who specifically benefited from the migration?")
  ).toBeVisible();

  await page.click('button:has-text("Reframe it now")');
  await page.click('button:has-text("Dismiss")');

  await expect(
    page.locator('button:has-text("Talk it through with the coach")')
  ).toHaveCount(0);
  await expect(
    page.locator("p:has-text('I just helped a bit with the migration')")
  ).toBeVisible();
  await expect(page.locator('button:has-text("Show reframed")')).toHaveCount(0);
});

test("closing the coach mid-conversation keeps the button available", async ({
  page,
}) => {
  await page.fill(
    'textarea[placeholder="Write about your win..."]',
    "I just helped a bit with the migration"
  );
  await page.click('button:has-text("Save")');

  await page.click('button:has-text("Talk it through with the coach")');
  await expect(
    page.locator("text=Who specifically benefited from the migration?")
  ).toBeVisible();

  await page.click('button[aria-label="Close coach"]');

  await expect(
    page.locator('button:has-text("Talk it through with the coach")')
  ).toBeVisible();
});
