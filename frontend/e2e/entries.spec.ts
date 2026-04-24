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

async function createEntry(
  page: import("@playwright/test").Page,
  text: string,
  tagName = "leadership"
) {
  const textarea = page.locator(
    'textarea[placeholder="Write about your win..."]'
  );
  await textarea.fill(text);
  await page.getByRole("button", { name: tagName, exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Win logged")).toBeVisible();
  // Dismiss the reframe card and wait for the textarea to clear so subsequent
  // locators don't match content from the new-entry form or the reframe card.
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(textarea).toHaveValue("");
}

function timelineEntry(page: import("@playwright/test").Page, text: string) {
  return page.locator("main p", { hasText: text });
}

test("editing an entry's text clears the reframed version and exposes 'Reframe again'", async ({
  page,
}) => {
  await createEntry(page, "Led the standup today");

  await expect(page.getByText("Show reframed")).toBeVisible();

  await page.getByRole("button", { name: "Edit entry" }).click();
  const textarea = page.getByRole("textbox", { name: "Edit entry text" });
  await textarea.fill("Led and facilitated the standup with 8 people");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(
    timelineEntry(page, "Led and facilitated the standup with 8 people")
  ).toBeVisible();
  await expect(page.getByText("Show reframed")).toHaveCount(0);
  await expect(page.getByText("Reframe again")).toBeVisible();
});

test("editing only the tags preserves the reframed version", async ({
  page,
}) => {
  await createEntry(page, "Led the release");

  await expect(page.getByText("Show reframed")).toBeVisible();

  await page.getByRole("button", { name: "Edit entry" }).click();
  const editForm = page.getByRole("group", { name: "Edit entry" });
  // Swap leadership -> technical via the picker inside the edit form
  await editForm.getByRole("button", { name: "leadership", exact: true }).click();
  await editForm.getByRole("button", { name: "technical", exact: true }).click();
  await editForm.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByText("Show reframed")).toBeVisible();
  await expect(
    page.locator("span", { hasText: "technical" }).first()
  ).toBeVisible();
});

test("deleting an entry removes it and stays gone after reload", async ({
  page,
}) => {
  await createEntry(page, "Entry to delete");

  await expect(timelineEntry(page, "Entry to delete")).toBeVisible();

  await page.getByRole("button", { name: "Delete entry" }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();

  await expect(timelineEntry(page, "Entry to delete")).toHaveCount(0);

  await page.reload();
  await expect(timelineEntry(page, "Entry to delete")).toHaveCount(0);
});
