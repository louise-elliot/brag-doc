import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
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
  await expect(textarea).toHaveValue("");
}

function timelineEntry(page: import("@playwright/test").Page, text: string) {
  return page.locator("main p", { hasText: text });
}

test("editing an entry's text updates it in the timeline", async ({
  page,
}) => {
  await createEntry(page, "Led the standup today");

  await page.getByRole("button", { name: "Edit entry" }).click();
  const textarea = page.getByRole("textbox", { name: "Edit entry text" });
  await textarea.fill("Led and facilitated the standup with 8 people");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(
    timelineEntry(page, "Led and facilitated the standup with 8 people")
  ).toBeVisible();
});

test("editing only the tags preserves the entry text", async ({
  page,
}) => {
  await createEntry(page, "Led the release");

  await page.getByRole("button", { name: "Edit entry" }).click();
  const editForm = page.getByRole("group", { name: "Edit entry" });
  await editForm.getByRole("button", { name: "leadership", exact: true }).click();
  await editForm.getByRole("button", { name: "technical", exact: true }).click();
  await editForm.getByRole("button", { name: "Save", exact: true }).click();

  await expect(timelineEntry(page, "Led the release")).toBeVisible();
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
