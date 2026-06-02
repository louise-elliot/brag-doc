import { test as base, expect, type Page, type BrowserContext } from "@playwright/test";
import { createTestUser, deleteTestUser } from "./supabase-admin";

interface TestUser {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

interface AuthFixture {
  testUser: TestUser;
  signedInPage: Page;
  signedInContext: BrowserContext;
}

/**
 * Base64-URL encode a string (no padding, URL-safe alphabet).
 * Matches the format @supabase/ssr writes to cookies.
 */
function stringToBase64Url(str: string): string {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Build the cookie value @supabase/ssr expects: "base64-" + base64url(JSON(session)).
 * The default cookieEncoding for createBrowserClient/createServerClient is "base64url".
 */
function buildSupabaseAuthCookieValue(testUser: TestUser): string {
  const session = {
    access_token: testUser.accessToken,
    refresh_token: testUser.refreshToken,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: { id: testUser.id, email: testUser.email },
  };
  return `base64-${stringToBase64Url(JSON.stringify(session))}`;
}

// MAX_CHUNK_SIZE from @supabase/ssr/dist/module/utils/chunker.js
const MAX_CHUNK_SIZE = 3180;

/**
 * Replicates @supabase/ssr's createChunks. The encoded value's
 * encodeURIComponent length must not exceed MAX_CHUNK_SIZE per chunk.
 * For a normal JWT-bearing session this is well under the limit, so usually
 * a single cookie. We still implement chunking for safety.
 */
function chunkCookie(name: string, value: string): { name: string; value: string }[] {
  const encoded = encodeURIComponent(value);
  if (encoded.length <= MAX_CHUNK_SIZE) {
    return [{ name, value }];
  }
  const parts: { name: string; value: string }[] = [];
  let remaining = encoded;
  let i = 0;
  while (remaining.length > 0) {
    let head = remaining.slice(0, MAX_CHUNK_SIZE);
    // Avoid splitting in the middle of a %XX escape sequence.
    const lastEscape = head.lastIndexOf("%");
    if (lastEscape > MAX_CHUNK_SIZE - 3) {
      head = head.slice(0, lastEscape);
    }
    parts.push({ name: `${name}.${i}`, value: decodeURIComponent(head) });
    remaining = remaining.slice(head.length);
    i += 1;
  }
  return parts;
}

export const test = base.extend<AuthFixture>({
  testUser: async ({}, use) => {
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
    const user = await createTestUser(email);
    await use({
      id: user.id,
      email,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
    });
    await deleteTestUser(user.id);
  },

  signedInContext: async ({ browser, testUser }, use) => {
    const context = await browser.newContext();

    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    const ref = url.hostname.split(".")[0];
    const cookieName = `sb-${ref}-auth-token`;
    const cookieValue = buildSupabaseAuthCookieValue(testUser);
    const cookies = chunkCookie(cookieName, cookieValue);

    // Playwright baseURL is http://localhost:3000 (see playwright.config.ts).
    await context.addCookies(
      cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      }))
    );

    await use(context);
    await context.close();
  },

  signedInPage: async ({ signedInContext }, use) => {
    const page = await signedInContext.newPage();
    await use(page);
  },
});

export { expect };
