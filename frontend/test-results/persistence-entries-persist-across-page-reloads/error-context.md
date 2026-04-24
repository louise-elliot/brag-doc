# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: persistence.spec.ts >> entries persist across page reloads
- Location: e2e/persistence.spec.ts:13:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('p:has-text(\'Persisted entry\')')
Expected: visible
Error: strict mode violation: locator('p:has-text(\'Persisted entry\')') resolved to 2 elements:
    1) <p>Persisted entry</p> aka getByText('Persisted entry').nth(1)
    2) <p>Persisted entry</p> aka getByText('Persisted entry').nth(2)

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('p:has-text(\'Persisted entry\')')

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
            - textbox "Write about your win..." [ref=e28]: Persisted entry
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
              - paragraph [ref=e48]: Persisted entry
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
            - generic [ref=e65]: 2026-04-24
            - paragraph [ref=e66]: Persisted entry
            - button "Show reframed" [ref=e67] [cursor=pointer]
  - button "Open Next.js Dev Tools" [ref=e73] [cursor=pointer]:
    - img [ref=e74]
  - alert [ref=e77]
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
  11 | });
  12 | 
  13 | test("entries persist across page reloads", async ({ page }) => {
  14 |   await page.goto("/");
  15 |   await page.evaluate(() => localStorage.clear());
  16 |   await page.reload();
  17 | 
  18 |   await page.fill('textarea[placeholder="Write about your win..."]', "Persisted entry");
  19 |   await page.click('button:has-text("Save")');
> 20 |   await expect(page.locator("p:has-text('Persisted entry')")).toBeVisible();
     |                                                               ^ Error: expect(locator).toBeVisible() failed
  21 | 
  22 |   await page.reload();
  23 |   await expect(page.locator("p:has-text('Persisted entry')")).toBeVisible();
  24 | });
  25 | 
  26 | test("clear all data removes entries", async ({ page }) => {
  27 |   await page.goto("/");
  28 |   await page.evaluate(() => localStorage.clear());
  29 |   await page.reload();
  30 | 
  31 |   await page.fill('textarea[placeholder="Write about your win..."]', "To be deleted");
  32 |   await page.click('button:has-text("Save")');
  33 | 
  34 |   await page.click('button[role="tab"]:has-text("Settings")');
  35 |   await page.click('button:has-text("Clear all data")');
  36 |   await page.click('button:has-text("Yes, delete everything")');
  37 | 
  38 |   await page.click('button[role="tab"]:has-text("Journal")');
  39 |   await expect(page.locator("text=No entries yet")).toBeVisible();
  40 | });
  41 | 
```