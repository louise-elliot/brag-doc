import { test, expect } from "./fixtures/auth";
import { test as basePwTest } from "@playwright/test";

test("signed-in user lands on the journal", async ({ signedInPage }) => {
  await signedInPage.goto("/");
  await expect(signedInPage).toHaveURL("/");
  await expect(signedInPage.getByText(/Daily Wins/i)).toBeVisible();
});

basePwTest("signed-out user is redirected to /sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in/);
});
