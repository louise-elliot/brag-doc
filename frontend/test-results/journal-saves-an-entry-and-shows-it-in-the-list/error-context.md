# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: journal.spec.ts >> saves an entry and shows it in the list
- Location: e2e/journal.spec.ts:20:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('p:has-text(\'I led the standup today\')')
Expected: visible
Error: strict mode violation: locator('p:has-text(\'I led the standup today\')') resolved to 2 elements:
    1) <p>I led the standup today</p> aka getByText('I led the standup today').nth(1)
    2) <p>I led the standup today</p> aka getByText('I led the standup today').nth(2)

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('p:has-text(\'I led the standup today\')')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]: Confidence
      - generic [ref=e8]: Apr 24, 2026
    - tablist [ref=e9]:
      - tab "Journal" [selected] [ref=e10] [cursor=pointer]
      - tab "Brag Doc" [ref=e11] [cursor=pointer]
      - tab "Settings" [ref=e12] [cursor=pointer]
    - main [ref=e13]:
      - tabpanel "Journal" [ref=e14]:
        - generic [ref=e16]:
          - generic [ref=e17]:
            - generic [ref=e18]: Today's prompt
            - generic [ref=e19]:
              - paragraph [ref=e21]: What did you ship or deliver?
              - button "Try another prompt" [ref=e23] [cursor=pointer]:
                - img [ref=e24]
          - generic [ref=e27]:
            - textbox "Write about your win..." [ref=e28]: I led the standup today
            - generic [ref=e29]:
              - button "leadership" [ref=e30] [cursor=pointer]
              - button "technical" [ref=e31] [cursor=pointer]
              - button "collaboration" [ref=e32] [cursor=pointer]
              - button "problem-solving" [ref=e33] [cursor=pointer]
              - button "communication" [ref=e34] [cursor=pointer]
              - button "mentoring" [ref=e35] [cursor=pointer]
            - generic [ref=e36]:
              - button "Saved" [ref=e37] [cursor=pointer]
              - generic [ref=e38]: Win logged
        - generic [ref=e40]:
          - generic [ref=e42]:
            - generic [ref=e43]: AI Reframe
            - generic [ref=e44]: side-by-side
          - generic [ref=e45]:
            - generic [ref=e46]:
              - paragraph [ref=e47]: Your version
              - paragraph [ref=e48]: I led the standup today
            - generic [ref=e50]:
              - generic [ref=e51]: Reframed
              - textbox "Reframed" [ref=e52]: A confident version of your win.
          - generic [ref=e53]:
            - button "Accept" [ref=e54] [cursor=pointer]
            - button "Dismiss" [ref=e55] [cursor=pointer]
        - generic [ref=e56]:
          - generic [ref=e57]:
            - heading "Past Entries" [level=2] [ref=e58]
            - generic [ref=e59]: "1"
          - generic [ref=e63]:
            - generic [ref=e64]:
              - generic [ref=e65]: 2026-04-24
              - generic [ref=e67]: leadership
            - paragraph [ref=e68]: I led the standup today
            - button "Show reframed" [ref=e69] [cursor=pointer]
  - button "Open Next.js Dev Tools" [ref=e75] [cursor=pointer]:
    - img [ref=e76]
  - alert [ref=e79]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.beforeEach(async ({ page }) => {
  4  |   await page.route("**/api/reframe", (route) =>
  5  |     route.fulfill({
  6  |       status: 200,
  7  |       contentType: "application/json",
  8  |       body: JSON.stringify({ reframed: "A confident version of your win." }),
  9  |     })
  10 |   );
  11 |   await page.goto("/");
  12 |   await page.evaluate(() => localStorage.clear());
  13 |   await page.reload();
  14 | });
  15 | 
  16 | test("displays a daily prompt", async ({ page }) => {
  17 |   await expect(page.locator("main")).toContainText("?");
  18 | });
  19 | 
  20 | test("saves an entry and shows it in the list", async ({ page }) => {
  21 |   await page.fill('textarea[placeholder="Write about your win..."]', "I led the standup today");
  22 |   await page.click("text=leadership");
  23 |   await page.click('button:has-text("Save")');
  24 | 
> 25 |   await expect(page.locator("p:has-text('I led the standup today')")).toBeVisible();
     |                                                                       ^ Error: expect(locator).toBeVisible() failed
  26 |   await expect(page.locator("span:has-text('leadership')").first()).toBeVisible();
  27 | });
  28 | 
  29 | test("save button is disabled when text is empty", async ({ page }) => {
  30 |   await expect(page.locator('button:has-text("Save")')).toBeDisabled();
  31 | });
  32 | 
  33 | test("clears textarea after save", async ({ page }) => {
  34 |   const textarea = page.locator('textarea[placeholder="Write about your win..."]');
  35 |   await textarea.fill("Something great");
  36 |   await page.click('button:has-text("Save")');
  37 |   await expect(textarea).toHaveValue("", { timeout: 2000 });
  38 | });
  39 | 
  40 | test("refresh-prompt button swaps the daily prompt and shows a tooltip on hover", async ({
  41 |   page,
  42 | }) => {
  43 |   const promptLocator = page.locator("main p").first();
  44 |   const initialPrompt = await promptLocator.textContent();
  45 | 
  46 |   const refreshButton = page.getByRole("button", { name: "Try another prompt" });
  47 |   await refreshButton.hover();
  48 |   await expect(page.getByRole("tooltip")).toHaveText("Try another prompt");
  49 | 
  50 |   await refreshButton.click();
  51 |   await expect(promptLocator).not.toHaveText(initialPrompt ?? "");
  52 | });
  53 | 
```