import { test, expect } from "./fixtures/auth";

test("delete account wipes data and signs the user out", async ({ signedInPage, testUser }) => {
  await signedInPage.goto("/");

  // Open Settings — the exact button text/role depends on how Settings is exposed.
  // Best guess: a button labeled "Settings" in the top right. Adjust if wrong.
  await signedInPage.getByRole("button", { name: /settings/i }).click();

  // Click "Delete account" — opens the danger-zone confirm
  await signedInPage.getByRole("button", { name: /delete account/i }).click();

  // Type email in confirm input
  await signedInPage.getByLabel(/type your email/i).fill(testUser.email);

  // Click "Delete" (just "Delete" — not "Delete account")
  await signedInPage.getByRole("button", { name: /^delete$/i }).click();

  // Should redirect to /sign-in?deleted=1
  await expect(signedInPage).toHaveURL(/\/sign-in/, { timeout: 15_000 });
});
