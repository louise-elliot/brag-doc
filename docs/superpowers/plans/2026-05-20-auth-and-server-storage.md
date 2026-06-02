# Auth and Server-Side Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser localStorage with per-user Supabase storage (Postgres + RLS), gated by email magic-link auth. Migrate existing localStorage data on first sign-in. Include account deletion.

**Architecture:** Browser uses `@supabase/ssr` for session cookies and `@supabase/supabase-js` for direct DB access; Postgres Row Level Security enforces isolation. FastAPI verifies the Supabase JWT on every LLM call and stays DB-free. Account deletion runs in a Supabase Edge Function with the service role key.

**Tech Stack:** Next.js 16 (App Router) + TypeScript + Supabase JS / SSR + FastAPI + PyJWT for JWT verification. Vitest, Playwright, pytest.

**Note on Next.js:** Frontend uses Next.js 16, which has breaking changes from earlier versions. Before writing any code that touches Next.js APIs (middleware, route handlers, cookies, server components), consult `frontend/node_modules/next/dist/docs/` for the current shape.

**Note on commits:** The user prefers manual git commits. Commit *steps* below show the suggested message and files — pause for the user to run them rather than committing autonomously.

---

## File Structure Overview

### New files

**Supabase project files:**
- `supabase/migrations/0001_initial_schema.sql` — entries + settings tables, indexes
- `supabase/migrations/0002_rls_policies.sql` — RLS enable + policies
- `supabase/migrations/0003_migrate_localstorage_fn.sql` — transactional bulk-insert function
- `supabase/functions/delete-account/index.ts` — Deno Edge Function for account deletion
- `supabase/config.toml` — Supabase CLI config

**Frontend:**
- `frontend/src/lib/supabase/client.ts` — browser Supabase client
- `frontend/src/lib/supabase/server.ts` — server-side (route handler / middleware) Supabase client
- `frontend/src/lib/auth.ts` — sign-in / sign-out helpers
- `frontend/src/lib/migration.ts` — localStorage → Supabase first-sign-in migration
- `frontend/src/app/sign-in/page.tsx` — sign-in screen
- `frontend/src/app/auth/callback/route.ts` — magic-link callback handler
- `frontend/src/middleware.ts` — session refresh + route protection
- `frontend/src/lib/auth.test.ts`
- `frontend/src/lib/migration.test.ts`
- `frontend/e2e/auth.spec.ts`
- `frontend/e2e/migration.spec.ts`
- `frontend/e2e/account-deletion.spec.ts`
- `frontend/e2e/fixtures/auth.ts` — Playwright fixture that seeds a signed-in session
- `frontend/e2e/rls.spec.ts` — RLS isolation integration tests
- `frontend/.env.local.example` — documents required env vars

**Backend:**
- `backend/auth.py` — JWT verification dependency
- `backend/tests/test_auth.py` — JWT verification unit tests

### Modified files

- `frontend/src/lib/entries.ts` — reimplement against Supabase
- `frontend/src/lib/settings.ts` — reimplement against Supabase
- `frontend/src/lib/tags.ts` — read/write through `settings.custom_tags`
- `frontend/src/lib/entries.test.ts` — replace localStorage tests with Supabase-client mock tests
- `frontend/src/lib/settings.test.ts` — same
- `frontend/src/lib/tags.test.ts` — same
- `frontend/src/lib/coachApi.ts` — include `Authorization: Bearer <jwt>` header
- `frontend/src/components/App.tsx` — replace synchronous `getEntries()` with async load
- `frontend/src/components/SettingsDrawer.tsx` — Account + Danger zone sections
- `frontend/src/components/Settings.tsx` — same
- `frontend/src/app/api/*` — proxy routes forward the JWT to FastAPI
- `frontend/e2e/journal.spec.ts`, `brag-doc.spec.ts`, `persistence.spec.ts`, `coach.spec.ts`, `entries.spec.ts`, `categories.spec.ts`, `coach-error.spec.ts`, `settings-coach.spec.ts` — add signed-in session in `beforeEach`
- `backend/main.py` — apply JWT dependency to all non-health endpoints
- `backend/pyproject.toml` — add `pyjwt[crypto]`, `httpx` dependencies
- `frontend/package.json` — add `@supabase/ssr`, `@supabase/supabase-js`

---

## Phase 1 — Supabase project setup

### Task 1: Provision Supabase projects and capture env vars

**Files:**
- Create: `frontend/.env.local.example`
- Create: `backend/.env.example`
- Modify: `frontend/.env.local` (gitignored, local only)
- Modify: `backend/.env` (gitignored, local only)

This task is manual (uses the Supabase dashboard) but its output is the env files committed to git.

- [ ] **Step 1: Create two Supabase projects via the dashboard**

Open https://supabase.com/dashboard. Create two projects under your org:
- `byline-prod`
- `byline-test` (used by CI for RLS integration tests)

For each, record from Settings → API:
- `Project URL` (e.g. `https://abcd1234.supabase.co`)
- `anon` public key
- `service_role` secret key

From Settings → Auth, also record the JWT secret (for FastAPI verification) and confirm the JWKS endpoint URL (typically `https://<project>.supabase.co/auth/v1/.well-known/jwks.json`).

- [ ] **Step 2: Install the Supabase CLI locally**

Run: `brew install supabase/tap/supabase`
Expected: `supabase --version` prints a version.

- [ ] **Step 3: Initialize Supabase in the repo root**

Run from repo root: `supabase init`
Expected: creates `supabase/config.toml` and `supabase/` directory.

- [ ] **Step 4: Link the local project to the test Supabase project**

Run: `supabase link --project-ref <byline-test-ref>`
Expected: writes `.supabase/` (gitignored). Confirms link.

- [ ] **Step 5: Write env example files**

Create `frontend/.env.local.example`:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# FastAPI backend URL (already in use)
BACKEND_URL=http://localhost:8000
```

Create `backend/.env.example`:

```
ANTHROPIC_API_KEY=sk-ant-...

# Supabase JWT verification
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_AUDIENCE=authenticated
```

- [ ] **Step 6: Populate local .env files**

Copy `frontend/.env.local.example` → `frontend/.env.local` and fill in the test project's URL + anon key.
Copy `backend/.env.example` → `backend/.env` and fill in the test project's JWKS URL.
Do NOT commit either `.env.local` or `.env`.

- [ ] **Step 7: Commit**

```bash
git add supabase/config.toml frontend/.env.local.example backend/.env.example .gitignore
git commit -m "chore: scaffold Supabase project config and env examples"
```

(Ensure `.gitignore` already excludes `.env.local`, `.env`, and `.supabase/`. Add lines if missing.)

---

### Task 2: Schema migration — entries and settings tables

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_initial_schema.sql`:

```sql
-- entries: one row per journal entry
create table public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  prompt      text not null,
  original    text not null,
  reframed    text,
  tags        text[] not null default '{}',
  coach_notes text[],
  created_at  timestamptz not null default now()
);

create index entries_user_date_created_idx
  on public.entries (user_id, date desc, created_at desc);

-- settings: one row per user
create table public.settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  coaching_style text not null default 'trusted-mentor',
  custom_tags    text[] not null default '{}',
  user_context   jsonb,
  updated_at     timestamptz not null default now()
);
```

- [ ] **Step 2: Apply the migration to the test project**

Run from repo root: `supabase db push`
Expected: applies migration; output lists `0001_initial_schema.sql` as applied.

- [ ] **Step 3: Verify the schema in the dashboard**

Open Supabase Studio → Table Editor for the test project. Confirm `entries` and `settings` tables exist with the columns above.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_initial_schema.sql
git commit -m "feat(db): add entries and settings tables"
```

---

### Task 3: Row Level Security policies

**Files:**
- Create: `supabase/migrations/0002_rls_policies.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0002_rls_policies.sql`:

```sql
-- entries
alter table public.entries enable row level security;

create policy "entries_select_own" on public.entries
  for select using (auth.uid() = user_id);

create policy "entries_insert_own" on public.entries
  for insert with check (auth.uid() = user_id);

create policy "entries_update_own" on public.entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "entries_delete_own" on public.entries
  for delete using (auth.uid() = user_id);

-- settings
alter table public.settings enable row level security;

create policy "settings_select_own" on public.settings
  for select using (auth.uid() = user_id);

create policy "settings_insert_own" on public.settings
  for insert with check (auth.uid() = user_id);

create policy "settings_update_own" on public.settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "settings_delete_own" on public.settings
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply**

Run: `supabase db push`
Expected: `0002_rls_policies.sql` applied.

- [ ] **Step 3: Verify in Studio**

Auth → Policies for the test project. Both tables show four policies each, all scoped by `auth.uid() = user_id`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_rls_policies.sql
git commit -m "feat(db): enable RLS on entries and settings"
```

---

### Task 4: Transactional bulk-import function for migration

**Files:**
- Create: `supabase/migrations/0003_migrate_localstorage_fn.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_migrate_localstorage_fn.sql`:

```sql
-- Transactional bulk import for first-sign-in migration from localStorage.
-- Caller passes:
--   p_entries: jsonb array of entry rows
--   p_settings: jsonb object of settings fields (may be null)
-- Function runs as the calling user; RLS still applies because we use auth.uid().
create or replace function public.migrate_localstorage(
  p_entries jsonb,
  p_settings jsonb
)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'must be signed in';
  end if;

  -- Insert entries (skip if already present by id)
  if p_entries is not null and jsonb_array_length(p_entries) > 0 then
    insert into public.entries (
      id, user_id, date, prompt, original, reframed, tags, coach_notes, created_at
    )
    select
      coalesce((e->>'id')::uuid, gen_random_uuid()),
      v_user_id,
      (e->>'date')::date,
      e->>'prompt',
      e->>'original',
      e->>'reframed',
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(e->'tags')),
        '{}'::text[]
      ),
      case
        when e ? 'coachNotes' and jsonb_typeof(e->'coachNotes') = 'array'
          then (select array_agg(value::text) from jsonb_array_elements_text(e->'coachNotes'))
        else null
      end,
      coalesce((e->>'createdAt')::timestamptz, now())
    from jsonb_array_elements(p_entries) as e
    on conflict (id) do nothing;
  end if;

  -- Upsert settings
  insert into public.settings (user_id, coaching_style, custom_tags, user_context, updated_at)
  values (
    v_user_id,
    coalesce(p_settings->>'coaching_style', 'trusted-mentor'),
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(p_settings->'custom_tags')),
      '{}'::text[]
    ),
    p_settings->'user_context',
    now()
  )
  on conflict (user_id) do nothing;
end;
$$;
```

- [ ] **Step 2: Apply**

Run: `supabase db push`
Expected: `0003_migrate_localstorage_fn.sql` applied.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_migrate_localstorage_fn.sql
git commit -m "feat(db): add migrate_localstorage transactional function"
```

---

## Phase 2 — Frontend Supabase infrastructure

### Task 5: Install Supabase packages and check Next.js docs

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Read Next.js cookies / middleware docs**

Before installing anything, read `frontend/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.mdx` and `.../middleware.mdx` (or the equivalent files in this Next.js 16 install). Confirm the current API shapes for `cookies()` and `NextResponse` middleware — they have changed across versions.

- [ ] **Step 2: Install packages**

Run from `frontend/`: `npm install @supabase/ssr @supabase/supabase-js`
Expected: both added to `dependencies` in `package.json`.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): add @supabase/ssr and @supabase/supabase-js"
```

---

### Task 6: Browser Supabase client

**Files:**
- Create: `frontend/src/lib/supabase/client.ts`
- Test: `frontend/src/lib/supabase/client.test.ts`

- [ ] **Step 1: Write failing test**

Create `frontend/src/lib/supabase/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({ marker: "browser-client" })),
}));

describe("supabase browser client", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("creates a browser client using env vars", async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    const { getSupabaseBrowserClient } = await import("./client");
    const client = getSupabaseBrowserClient();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "anon-key"
    );
    expect(client).toEqual({ marker: "browser-client" });
  });

  it("returns the same client on subsequent calls (singleton)", async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    const { getSupabaseBrowserClient } = await import("./client");
    getSupabaseBrowserClient();
    getSupabaseBrowserClient();
    expect(createBrowserClient).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd frontend && npx vitest run src/lib/supabase/client.test.ts`
Expected: FAIL — module `./client` not found.

- [ ] **Step 3: Implement**

Create `frontend/src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (cached) return cached;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return cached;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd frontend && npx vitest run src/lib/supabase/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/supabase/client.ts frontend/src/lib/supabase/client.test.ts
git commit -m "feat(auth): add Supabase browser client"
```

---

### Task 7: Server Supabase client (for middleware + route handlers)

**Files:**
- Create: `frontend/src/lib/supabase/server.ts`

This client is used in Next.js route handlers (`/auth/callback`) and middleware. It bridges Next.js's `cookies()` API to Supabase's cookie storage.

- [ ] **Step 1: Confirm Next.js cookie API shape**

Before writing the file, verify the current shape of `cookies()` from `next/headers` in this Next.js 16 install. In recent versions it returns a Promise; the file below assumes that. Adjust if the install differs.

- [ ] **Step 2: Implement**

Create `frontend/src/lib/supabase/server.ts`:

```typescript
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll may be called from a Server Component; ignore.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/supabase/server.ts
git commit -m "feat(auth): add Supabase server client"
```

---

### Task 8: Middleware for session refresh and route protection

**Files:**
- Create: `frontend/src/middleware.ts`

- [ ] **Step 1: Implement**

Create `frontend/src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/sign-in", "/auth/callback"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }
  if (user && request.nextUrl.pathname === "/sign-in") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/middleware.ts
git commit -m "feat(auth): add session middleware with route protection"
```

---

## Phase 3 — Auth UI

### Task 9: Sign-in page

**Files:**
- Create: `frontend/src/app/sign-in/page.tsx`
- Test: `frontend/src/app/sign-in/page.test.tsx`

- [ ] **Step 1: Write failing test**

Create `frontend/src/app/sign-in/page.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import SignInPage from "./page";

const signInWithOtp = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signInWithOtp },
  }),
}));

describe("SignInPage", () => {
  it("sends a magic link to the entered email and shows confirmation", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: null });
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "user@example.com",
        options: { emailRedirectTo: expect.stringContaining("/auth/callback") },
      });
    });
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it("shows an error message when sign-in fails", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: { message: "rate limited" } });
    render(<SignInPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(await screen.findByText(/rate limited/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd frontend && npx vitest run src/app/sign-in/page.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `frontend/src/app/sign-in/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-display mb-2">Check your email</h1>
          <p>We sent a sign-in link to <strong>{email}</strong>. Click it to come back signed in.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={handleSubmit} className="max-w-md w-full space-y-4">
        <h1 className="text-3xl font-display">Sign in to Byline</h1>
        <label className="block">
          <span className="block text-sm mb-1">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full bg-primary-500 text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {status === "sending" ? "Sending..." : "Send magic link"}
        </button>
        {errorMessage && <p role="alert" className="text-error-500 text-sm">{errorMessage}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd frontend && npx vitest run src/app/sign-in/page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/sign-in/page.tsx frontend/src/app/sign-in/page.test.tsx
git commit -m "feat(auth): add sign-in page with magic link"
```

---

### Task 10: Magic-link callback handler

**Files:**
- Create: `frontend/src/app/auth/callback/route.ts`

- [ ] **Step 1: Implement**

Create `frontend/src/app/auth/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth-callback`);
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/auth/callback/route.ts
git commit -m "feat(auth): add magic-link callback handler"
```

---

### Task 11: Sign-out helper

**Files:**
- Create: `frontend/src/lib/auth.ts`
- Test: `frontend/src/lib/auth.test.ts`

- [ ] **Step 1: Write failing test**

Create `frontend/src/lib/auth.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

const signOut = vi.fn();
const getUser = vi.fn();
vi.mock("./supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signOut, getUser },
  }),
}));

describe("auth helpers", () => {
  it("signOut calls Supabase signOut", async () => {
    signOut.mockResolvedValueOnce({ error: null });
    const { signOutCurrentUser } = await import("./auth");
    await signOutCurrentUser();
    expect(signOut).toHaveBeenCalled();
  });

  it("getCurrentUser returns the user or null", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: "a@b.com" } }, error: null });
    const { getCurrentUser } = await import("./auth");
    const user = await getCurrentUser();
    expect(user).toEqual({ id: "u1", email: "a@b.com" });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd frontend && npx vitest run src/lib/auth.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `frontend/src/lib/auth.ts`:

```typescript
import { getSupabaseBrowserClient } from "./supabase/client";

export interface CurrentUser {
  id: string;
  email: string | null;
}

export async function signOutCurrentUser(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd frontend && npx vitest run src/lib/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/auth.ts frontend/src/lib/auth.test.ts
git commit -m "feat(auth): add signOut and getCurrentUser helpers"
```

---

## Phase 4 — Data layer migration

### Task 12: Replace entries.ts with Supabase implementation

**Files:**
- Modify: `frontend/src/lib/entries.ts`
- Modify: `frontend/src/lib/entries.test.ts`

The existing `entries.ts` is synchronous and localStorage-backed. The new one is async and Supabase-backed. All callers must be updated to `await`. We do the lib change first; callers in Task 19.

- [ ] **Step 1: Rewrite entries.test.ts**

Replace the entire contents of `frontend/src/lib/entries.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Entry } from "./types";

const chain = () => {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  c.from = vi.fn(() => c);
  c.select = vi.fn(() => c);
  c.insert = vi.fn(() => c);
  c.update = vi.fn(() => c);
  c.delete = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  c.gte = vi.fn(() => c);
  c.lte = vi.fn(() => c);
  c.order = vi.fn(() => c);
  c.single = vi.fn(() => c);
  return c;
};

const client = chain();
vi.mock("./supabase/client", () => ({
  getSupabaseBrowserClient: () => client,
}));

beforeEach(() => {
  Object.values(client).forEach((fn) => fn.mockClear && fn.mockClear());
});

describe("entries", () => {
  it("getEntries selects from entries ordered by date desc, created_at desc", async () => {
    const row = {
      id: "1", user_id: "u", date: "2026-05-20", prompt: "p", original: "o",
      reframed: null, tags: ["leadership"], coach_notes: null, created_at: "2026-05-20T00:00:00Z",
    };
    client.order.mockReturnValueOnce(Promise.resolve({ data: [row], error: null }));
    const { getEntries } = await import("./entries");
    const entries = await getEntries();
    expect(client.from).toHaveBeenCalledWith("entries");
    expect(entries[0]).toMatchObject({
      id: "1",
      date: "2026-05-20",
      createdAt: "2026-05-20T00:00:00Z",
      coachNotes: null,
      tags: ["leadership"],
    });
  });

  it("addEntry inserts and returns the row", async () => {
    const inserted = {
      id: "new-id", user_id: "u", date: "2026-05-20", prompt: "p", original: "o",
      reframed: null, tags: [], coach_notes: null, created_at: "2026-05-20T00:00:00Z",
    };
    client.single.mockReturnValueOnce(Promise.resolve({ data: inserted, error: null }));
    const { addEntry } = await import("./entries");
    const result = await addEntry({
      date: "2026-05-20", prompt: "p", original: "o", reframed: null, tags: [], coachNotes: null,
    } as Omit<Entry, "id" | "createdAt">);
    expect(client.insert).toHaveBeenCalled();
    expect(result.id).toBe("new-id");
  });

  it("deleteEntry deletes by id", async () => {
    client.eq.mockReturnValueOnce(Promise.resolve({ error: null }));
    const { deleteEntry } = await import("./entries");
    await deleteEntry("xyz");
    expect(client.delete).toHaveBeenCalled();
    expect(client.eq).toHaveBeenCalledWith("id", "xyz");
  });

  it("getEntriesByDateRange filters by date range", async () => {
    client.order.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));
    const { getEntriesByDateRange } = await import("./entries");
    await getEntriesByDateRange("2026-01-01", "2026-05-20");
    expect(client.gte).toHaveBeenCalledWith("date", "2026-01-01");
    expect(client.lte).toHaveBeenCalledWith("date", "2026-05-20");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd frontend && npx vitest run src/lib/entries.test.ts`
Expected: FAIL — old implementation references localStorage.

- [ ] **Step 3: Replace entries.ts**

Replace the entire contents of `frontend/src/lib/entries.ts` with:

```typescript
import type { Entry } from "./types";
import { getSupabaseBrowserClient } from "./supabase/client";

interface EntryRow {
  id: string;
  date: string;
  prompt: string;
  original: string;
  reframed: string | null;
  tags: string[];
  coach_notes: string[] | null;
  created_at: string;
}

function rowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    date: row.date,
    prompt: row.prompt,
    original: row.original,
    reframed: row.reframed,
    tags: row.tags,
    coachNotes: row.coach_notes,
    createdAt: row.created_at,
  };
}

export async function getEntries(): Promise<Entry[]> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("entries")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as EntryRow[]).map(rowToEntry);
}

export async function addEntry(
  data: Omit<Entry, "id" | "createdAt">
): Promise<Entry> {
  const client = getSupabaseBrowserClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("not signed in");
  const payload = {
    user_id: user.id,
    date: data.date,
    prompt: data.prompt,
    original: data.original,
    reframed: data.reframed,
    tags: data.tags,
    coach_notes: data.coachNotes,
  };
  const { data: row, error } = await client
    .from("entries")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return rowToEntry(row as EntryRow);
}

export async function updateEntry(
  id: string,
  updates: Partial<Pick<Entry, "original" | "reframed" | "tags" | "coachNotes">>
): Promise<void> {
  const client = getSupabaseBrowserClient();
  const payload: Record<string, unknown> = {};
  if (updates.original !== undefined) payload.original = updates.original;
  if (updates.reframed !== undefined) payload.reframed = updates.reframed;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.coachNotes !== undefined) payload.coach_notes = updates.coachNotes;
  const { error } = await client.from("entries").update(payload).eq("id", id);
  if (error) throw error;
}

export async function editEntry(
  id: string,
  updates: { original?: string; reframed?: string; tags?: string[] }
): Promise<void> {
  const client = getSupabaseBrowserClient();
  // Fetch current to detect "original changed" and clear reframed in that case
  const { data: current, error: fetchErr } = await client
    .from("entries").select("original").eq("id", id).single();
  if (fetchErr) throw fetchErr;
  const originalChanged =
    updates.original !== undefined && updates.original !== (current as { original: string }).original;
  const payload: Record<string, unknown> = {};
  if (updates.original !== undefined) payload.original = updates.original;
  if (updates.reframed !== undefined) payload.reframed = updates.reframed;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (originalChanged && updates.reframed === undefined) payload.reframed = null;
  const { error } = await client.from("entries").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { error } = await client.from("entries").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteAllEntries(): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("not signed in");
  const { error } = await client.from("entries").delete().eq("user_id", user.id);
  if (error) throw error;
}

export async function renameTagOnEntries(oldName: string, newName: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data, error: selErr } = await client
    .from("entries")
    .select("id, tags")
    .contains("tags", [oldName]);
  if (selErr) throw selErr;
  for (const row of (data as { id: string; tags: string[] }[])) {
    const next = row.tags.map((t) => (t === oldName ? newName : t));
    const { error } = await client.from("entries").update({ tags: next }).eq("id", row.id);
    if (error) throw error;
  }
}

export async function getEntriesByDateRange(
  start: string,
  end: string
): Promise<Entry[]> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("entries")
    .select("*")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as EntryRow[]).map(rowToEntry);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd frontend && npx vitest run src/lib/entries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/entries.ts frontend/src/lib/entries.test.ts
git commit -m "feat(data): port entries.ts to Supabase"
```

---

### Task 13: Replace settings.ts with Supabase implementation

**Files:**
- Modify: `frontend/src/lib/settings.ts`
- Modify: `frontend/src/lib/settings.test.ts`

- [ ] **Step 1: Rewrite settings.test.ts**

Replace the entire contents of `frontend/src/lib/settings.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const chain = () => {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  c.from = vi.fn(() => c);
  c.select = vi.fn(() => c);
  c.upsert = vi.fn(() => c);
  c.update = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  c.single = vi.fn(() => c);
  c.auth = { getUser: vi.fn() };
  return c;
};

const client = chain();
vi.mock("./supabase/client", () => ({
  getSupabaseBrowserClient: () => client,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("settings", () => {
  it("readSettings returns mapped fields from the settings row", async () => {
    client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    client.single.mockReturnValueOnce(Promise.resolve({
      data: {
        user_id: "u1",
        coaching_style: "hype-woman",
        custom_tags: [],
        user_context: { headline: "Eng manager", notes: "team of 6" },
      },
      error: null,
    }));
    const { readSettings } = await import("./settings");
    const result = await readSettings();
    expect(result).toEqual({
      coachingStyle: "hype-woman",
      contextHeadline: "Eng manager",
      contextNotes: "team of 6",
    });
  });

  it("readSettings returns defaults when no row exists", async () => {
    client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    client.single.mockReturnValueOnce(Promise.resolve({
      data: null,
      error: { code: "PGRST116" }, // 'no rows' from PostgREST
    }));
    const { readSettings } = await import("./settings");
    const result = await readSettings();
    expect(result).toEqual({
      coachingStyle: "trusted-mentor",
      contextHeadline: "",
      contextNotes: "",
    });
  });

  it("writeSettings upserts the row for the current user", async () => {
    client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    client.upsert.mockReturnValueOnce(Promise.resolve({ error: null }));
    const { writeSettings } = await import("./settings");
    await writeSettings({ coachingStyle: "bold-coach" });
    expect(client.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "u1",
      coaching_style: "bold-coach",
    }));
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd frontend && npx vitest run src/lib/settings.test.ts`
Expected: FAIL.

- [ ] **Step 3: Replace settings.ts**

Replace the entire contents of `frontend/src/lib/settings.ts` with:

```typescript
import {
  DEFAULT_USER_SETTINGS,
  type CoachingStyle,
  type UserSettings,
} from "./types";
import { getSupabaseBrowserClient } from "./supabase/client";

interface SettingsRow {
  user_id: string;
  coaching_style: CoachingStyle;
  custom_tags: string[];
  user_context: { headline: string; notes: string } | null;
}

async function getUserId(): Promise<string> {
  const client = getSupabaseBrowserClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("not signed in");
  return user.id;
}

function rowToSettings(row: SettingsRow): UserSettings {
  return {
    coachingStyle: row.coaching_style,
    contextHeadline: row.user_context?.headline ?? "",
    contextNotes: row.user_context?.notes ?? "",
  };
}

export async function readSettings(): Promise<UserSettings> {
  const client = getSupabaseBrowserClient();
  const userId = await getUserId();
  const { data, error } = await client
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) {
    // PGRST116 = no rows; treat as defaults
    if ((error as { code?: string }).code === "PGRST116") {
      return DEFAULT_USER_SETTINGS;
    }
    throw error;
  }
  return rowToSettings(data as SettingsRow);
}

export async function writeSettings(partial: Partial<UserSettings>): Promise<void> {
  const client = getSupabaseBrowserClient();
  const userId = await getUserId();
  const current = await readSettings();
  const next: UserSettings = { ...current, ...partial };
  const payload = {
    user_id: userId,
    coaching_style: next.coachingStyle,
    user_context: {
      headline: next.contextHeadline,
      notes: next.contextNotes,
    },
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from("settings").upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd frontend && npx vitest run src/lib/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/settings.ts frontend/src/lib/settings.test.ts
git commit -m "feat(data): port settings.ts to Supabase"
```

---

### Task 14: Port tags.ts to use settings.custom_tags

**Files:**
- Modify: `frontend/src/lib/tags.ts`
- Modify: `frontend/src/lib/tags.test.ts`

Defaults are hardcoded in the file; the user's effective tag list is stored in `settings.custom_tags`. If `custom_tags` is empty (first-time user), defaults apply.

- [ ] **Step 1: Rewrite tags.test.ts**

Replace `frontend/src/lib/tags.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const chain = () => {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  c.from = vi.fn(() => c);
  c.select = vi.fn(() => c);
  c.upsert = vi.fn(() => c);
  c.update = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  c.single = vi.fn(() => c);
  c.auth = { getUser: vi.fn() };
  return c;
};

const client = chain();
vi.mock("./supabase/client", () => ({
  getSupabaseBrowserClient: () => client,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tags", () => {
  it("getTags returns defaults when settings row has empty custom_tags", async () => {
    client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    client.single.mockReturnValueOnce(Promise.resolve({
      data: { custom_tags: [] }, error: null,
    }));
    const { getTags } = await import("./tags");
    const result = await getTags();
    expect(result.map((t) => t.name)).toEqual([
      "leadership", "technical", "collaboration",
      "problem-solving", "communication", "mentoring",
    ]);
  });

  it("getTags returns custom_tags when set", async () => {
    client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    client.single.mockReturnValueOnce(Promise.resolve({
      data: { custom_tags: ["alpha", "beta"] }, error: null,
    }));
    const { getTags } = await import("./tags");
    const result = await getTags();
    expect(result.map((t) => t.name)).toEqual(["alpha", "beta"]);
  });

  it("saveTags upserts the names into custom_tags", async () => {
    client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    client.upsert.mockReturnValueOnce(Promise.resolve({ error: null }));
    const { saveTags } = await import("./tags");
    await saveTags([{ name: "x" }, { name: "y" }]);
    expect(client.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", custom_tags: ["x", "y"] }),
      expect.objectContaining({ onConflict: "user_id" })
    );
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd frontend && npx vitest run src/lib/tags.test.ts`
Expected: FAIL.

- [ ] **Step 3: Replace tags.ts**

Replace `frontend/src/lib/tags.ts` with:

```typescript
import { getSupabaseBrowserClient } from "./supabase/client";

export interface TagDef {
  name: string;
}

const DEFAULT_TAGS: TagDef[] = [
  { name: "leadership" },
  { name: "technical" },
  { name: "collaboration" },
  { name: "problem-solving" },
  { name: "communication" },
  { name: "mentoring" },
];

async function getUserId(): Promise<string> {
  const client = getSupabaseBrowserClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("not signed in");
  return user.id;
}

export async function getTags(): Promise<TagDef[]> {
  const client = getSupabaseBrowserClient();
  const userId = await getUserId();
  const { data, error } = await client
    .from("settings")
    .select("custom_tags")
    .eq("user_id", userId)
    .single();
  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return DEFAULT_TAGS;
    throw error;
  }
  const custom = (data as { custom_tags: string[] }).custom_tags;
  if (!custom || custom.length === 0) return DEFAULT_TAGS;
  return custom.map((name) => ({ name }));
}

export async function saveTags(tags: TagDef[]): Promise<void> {
  const client = getSupabaseBrowserClient();
  const userId = await getUserId();
  const { error } = await client.from("settings").upsert(
    {
      user_id: userId,
      custom_tags: tags.map((t) => t.name),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd frontend && npx vitest run src/lib/tags.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/tags.ts frontend/src/lib/tags.test.ts
git commit -m "feat(data): port tags to settings.custom_tags"
```

---

### Task 15: First-sign-in migration helper

**Files:**
- Create: `frontend/src/lib/migration.ts`
- Test: `frontend/src/lib/migration.test.ts`

- [ ] **Step 1: Write failing test**

Create `frontend/src/lib/migration.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const getUser = vi.fn();
const single = vi.fn();
const eq = vi.fn(() => ({ single }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("./supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    rpc,
    auth: { getUser },
    from,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("migration", () => {
  it("does nothing when settings row already exists", async () => {
    single.mockResolvedValueOnce({ data: { user_id: "u1" }, error: null });
    const { runFirstSignInMigration } = await import("./migration");
    const result = await runFirstSignInMigration();
    expect(result).toBe("skipped-returning-user");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("when no settings row and no local data, creates default settings", async () => {
    single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    rpc.mockResolvedValueOnce({ error: null });
    const { runFirstSignInMigration } = await import("./migration");
    const result = await runFirstSignInMigration();
    expect(rpc).toHaveBeenCalledWith("migrate_localstorage", {
      p_entries: [],
      p_settings: { coaching_style: "trusted-mentor", custom_tags: [], user_context: null },
    });
    expect(result).toBe("migrated");
  });

  it("when localStorage has entries + settings, uploads them and clears localStorage", async () => {
    single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    rpc.mockResolvedValueOnce({ error: null });
    localStorage.setItem("byline-entries", JSON.stringify([
      { id: "e1", date: "2026-05-19", prompt: "p", original: "o",
        reframed: null, tags: ["x"], createdAt: "2026-05-19T00:00:00Z", coachNotes: null },
    ]));
    localStorage.setItem("byline-settings", JSON.stringify({
      coachingStyle: "bold-coach",
      contextHeadline: "EM",
      contextNotes: "notes",
    }));
    localStorage.setItem("byline:tags", JSON.stringify([{ name: "x" }, { name: "y" }]));

    const { runFirstSignInMigration } = await import("./migration");
    const result = await runFirstSignInMigration();

    expect(rpc).toHaveBeenCalledWith("migrate_localstorage", {
      p_entries: [
        expect.objectContaining({ id: "e1", date: "2026-05-19", tags: ["x"] }),
      ],
      p_settings: {
        coaching_style: "bold-coach",
        custom_tags: ["x", "y"],
        user_context: { headline: "EM", notes: "notes" },
      },
    });
    expect(localStorage.getItem("byline-entries")).toBeNull();
    expect(localStorage.getItem("byline-settings")).toBeNull();
    expect(localStorage.getItem("byline:tags")).toBeNull();
    expect(result).toBe("migrated");
  });

  it("leaves localStorage intact on RPC error", async () => {
    single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    rpc.mockResolvedValueOnce({ error: { message: "boom" } });
    localStorage.setItem("byline-entries", JSON.stringify([
      { id: "e1", date: "2026-05-19", prompt: "p", original: "o",
        reframed: null, tags: [], createdAt: "2026-05-19T00:00:00Z", coachNotes: null },
    ]));
    const { runFirstSignInMigration } = await import("./migration");
    const result = await runFirstSignInMigration();
    expect(localStorage.getItem("byline-entries")).not.toBeNull();
    expect(result).toBe("error");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd frontend && npx vitest run src/lib/migration.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/src/lib/migration.ts`:

```typescript
import { getSupabaseBrowserClient } from "./supabase/client";
import { DEFAULT_USER_SETTINGS } from "./types";

const LS_ENTRIES = "byline-entries";
const LS_SETTINGS = "byline-settings";
const LS_TAGS = "byline:tags";

interface LocalEntry {
  id: string;
  date: string;
  prompt: string;
  original: string;
  reframed: string | null;
  tags: string[];
  coachNotes: string[] | null;
  createdAt: string;
}

interface LocalSettings {
  coachingStyle?: string;
  contextHeadline?: string;
  contextNotes?: string;
}

interface LocalTag { name: string }

export type MigrationResult = "skipped-returning-user" | "migrated" | "error";

function readLocalEntries(): LocalEntry[] {
  const raw = localStorage.getItem(LS_ENTRIES);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalEntry[]) : [];
  } catch {
    return [];
  }
}

function readLocalSettings(): LocalSettings {
  const raw = localStorage.getItem(LS_SETTINGS);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed as LocalSettings : {};
  } catch {
    return {};
  }
}

function readLocalTags(): LocalTag[] {
  const raw = localStorage.getItem(LS_TAGS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalTag[]) : [];
  } catch {
    return [];
  }
}

function clearLocalStorage(): void {
  localStorage.removeItem(LS_ENTRIES);
  localStorage.removeItem(LS_SETTINGS);
  localStorage.removeItem(LS_TAGS);
}

export async function runFirstSignInMigration(): Promise<MigrationResult> {
  const client = getSupabaseBrowserClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return "error";

  // Returning user?
  const { data: existing, error: selErr } = await client
    .from("settings")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    // Stale localStorage on a returning-user device → drop it.
    clearLocalStorage();
    return "skipped-returning-user";
  }
  // PGRST116 means no row, anything else is unexpected.
  if (selErr && (selErr as { code?: string }).code !== "PGRST116") {
    console.error("[migration:fail]", selErr);
    return "error";
  }

  const entries = readLocalEntries();
  const settings = readLocalSettings();
  const tags = readLocalTags();

  const payload = {
    p_entries: entries,
    p_settings: {
      coaching_style: settings.coachingStyle ?? DEFAULT_USER_SETTINGS.coachingStyle,
      custom_tags: tags.map((t) => t.name),
      user_context:
        settings.contextHeadline || settings.contextNotes
          ? {
              headline: settings.contextHeadline ?? "",
              notes: settings.contextNotes ?? "",
            }
          : null,
    },
  };

  const { error } = await client.rpc("migrate_localstorage", payload);
  if (error) {
    console.error("[migration:fail]", error);
    return "error";
  }
  clearLocalStorage();
  return "migrated";
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd frontend && npx vitest run src/lib/migration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/migration.ts frontend/src/lib/migration.test.ts
git commit -m "feat(auth): add first-sign-in localStorage migration"
```

---

## Phase 5 — Wire App + UI to async data

### Task 16: Update App.tsx to use async data + run migration on first load

**Files:**
- Modify: `frontend/src/components/App.tsx`

The current App calls `getEntries()` and `getTags()` synchronously. They're now async. We also call `runFirstSignInMigration()` once on mount (if signed in) before loading data.

- [ ] **Step 1: Update App.tsx**

Open `frontend/src/components/App.tsx` and make these changes (showing the modified imports, `useEffect`, and handlers):

Replace the import block at top:

```typescript
import { useState, useCallback, useEffect } from "react";
import { EntryForm } from "./EntryForm";
import { EntryList } from "./EntryList";
import { BragDoc } from "./BragDoc";
import { SettingsDrawer } from "./SettingsDrawer";
import { AboutModal } from "./AboutModal";
import {
  getEntries,
  addEntry,
  updateEntry,
  deleteAllEntries,
  deleteEntry,
  editEntry,
  renameTagOnEntries,
} from "@/lib/entries";
import { getPromptForDate, getRandomPromptExcluding } from "@/lib/prompts";
import { getTags, saveTags, type TagDef } from "@/lib/tags";
import { runFirstSignInMigration } from "@/lib/migration";
import { todayLocal } from "@/lib/dates";
import type { Entry } from "@/lib/types";
```

Replace the `useEffect` that loads data with one that runs migration first:

```typescript
useEffect(() => {
  let cancelled = false;
  (async () => {
    await runFirstSignInMigration();
    if (cancelled) return;
    const [es, ts] = await Promise.all([getEntries(), getTags()]);
    if (cancelled) return;
    setEntries(es);
    setTags(ts);
  })();
  return () => { cancelled = true; };
}, []);
```

Update `refreshEntries` and `refreshTags` to be async:

```typescript
const refreshEntries = useCallback(async () => {
  const es = await getEntries();
  setEntries(es);
}, []);

const refreshTags = useCallback(async () => {
  const ts = await getTags();
  setTags(ts);
}, []);
```

Update all tag handlers to be async and await `saveTags`/`renameTagOnEntries`:

```typescript
async function handleAddTag(name: string) {
  const next = [...tags, { name }];
  await saveTags(next);
  setTags(next);
}

async function handleDeleteTag(name: string) {
  const next = tags.filter((t) => t.name !== name);
  await saveTags(next);
  setTags(next);
}

async function handleRenameTag(oldName: string, newName: string) {
  const next = tags.map((t) =>
    t.name === oldName ? { ...t, name: newName } : t
  );
  await saveTags(next);
  await renameTagOnEntries(oldName, newName);
  setTags(next);
  await refreshEntries();
}
```

Find every other use of `getEntries`, `addEntry`, `updateEntry`, `deleteAllEntries`, `deleteEntry`, `editEntry`, `renameTagOnEntries` in this file and `await` them. (Search for each function name and add `await`.)

- [ ] **Step 2: Update App.test.tsx**

Open `frontend/src/components/App.test.tsx`. For each call to `getEntries`/`addEntry`/etc. in mocks, wrap return values in `Promise.resolve(...)`. Add a mock for `runFirstSignInMigration` returning `Promise.resolve("skipped-returning-user")`. Use `await waitFor(...)` for assertions about loaded data.

Specifically, add this mock near other mocks at the top:

```typescript
vi.mock("@/lib/migration", () => ({
  runFirstSignInMigration: vi.fn(() => Promise.resolve("skipped-returning-user")),
}));
```

And convert existing mock returns to promises, e.g.:

```typescript
vi.mocked(getEntries).mockReturnValue(Promise.resolve([]));
```

- [ ] **Step 3: Run App.test.tsx, verify pass**

Run: `cd frontend && npx vitest run src/components/App.test.tsx`
Expected: PASS. Fix any await-related test failures by adding `waitFor` around assertions.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/App.tsx frontend/src/components/App.test.tsx
git commit -m "feat(app): async data loading and first-sign-in migration"
```

---

### Task 17: Update other components for async data layer

**Files:**
- Modify: `frontend/src/components/EntryForm.tsx`, `EntryList.tsx`, `BragDoc.tsx`, `Settings.tsx`, `SettingsDrawer.tsx`

These components call entries/settings/tags functions. Update each call to `await` the result.

- [ ] **Step 1: Search for synchronous calls**

Run: `cd frontend && grep -rn "addEntry\|updateEntry\|editEntry\|deleteEntry\|deleteAllEntries\|renameTagOnEntries\|getEntries\|getEntriesByDateRange\|readSettings\|writeSettings\|getTags\|saveTags" src/components`

For each match, add `await` and ensure the enclosing function is `async`. Pay attention to event handlers — they can be made `async` directly. Update any synchronous chained `.then()` flows to `await`.

- [ ] **Step 2: Update tests in tandem**

For each component test file (`*.test.tsx`), update mocks of those functions to return `Promise.resolve(...)`. Use `await waitFor(...)` for any assertion that depends on data appearing.

- [ ] **Step 3: Run full vitest suite, fix breakages**

Run: `cd frontend && npx vitest run`
Expected: all unit tests pass. If a test still references localStorage directly, replace it with mocked Supabase client expectations following the patterns in Tasks 12-15.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components
git commit -m "refactor(components): await async data layer"
```

---

## Phase 6 — Settings UI: account + danger zone

### Task 18: Add Account section (email + sign-out) to Settings

**Files:**
- Modify: `frontend/src/components/Settings.tsx` (and `SettingsDrawer.tsx` if it owns layout)
- Modify: `frontend/src/components/Settings.test.tsx`

- [ ] **Step 1: Write failing test**

Add to `frontend/src/components/Settings.test.tsx`:

```typescript
import { signOutCurrentUser, getCurrentUser } from "@/lib/auth";
vi.mock("@/lib/auth", () => ({
  signOutCurrentUser: vi.fn(() => Promise.resolve()),
  getCurrentUser: vi.fn(() => Promise.resolve({ id: "u1", email: "user@example.com" })),
}));

it("shows the signed-in email and signs out on click", async () => {
  render(<Settings /* existing props */ />);
  expect(await screen.findByText("user@example.com")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
  await waitFor(() => expect(signOutCurrentUser).toHaveBeenCalled());
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd frontend && npx vitest run src/components/Settings.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement in Settings.tsx**

Add a new section near the bottom of Settings (before any Danger zone):

```tsx
import { useEffect, useState } from "react";
import { getCurrentUser, signOutCurrentUser } from "@/lib/auth";

// inside the Settings component body:
const [email, setEmail] = useState<string | null>(null);

useEffect(() => {
  getCurrentUser().then((u) => setEmail(u?.email ?? null));
}, []);

async function handleSignOut() {
  await signOutCurrentUser();
  window.location.href = "/sign-in";
}

// in the rendered JSX, add:
<section className="border-t pt-6 mt-6">
  <h3 className="font-display text-lg mb-2">Account</h3>
  {email && <p className="text-sm text-neutral-500 mb-3">{email}</p>}
  <button
    type="button"
    onClick={handleSignOut}
    className="border rounded px-4 py-2 hover:bg-neutral-100"
  >
    Sign out
  </button>
</section>
```

- [ ] **Step 4: Run, verify pass**

Run: `cd frontend && npx vitest run src/components/Settings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Settings.tsx frontend/src/components/Settings.test.tsx
git commit -m "feat(settings): add Account section with sign-out"
```

---

### Task 19: Repurpose "Clear all data" to entries-only delete

**Files:**
- Modify: `frontend/src/components/Settings.tsx`
- Modify: `frontend/src/components/Settings.test.tsx`

The existing "Clear all data" already calls `deleteAllEntries`. That function now scopes to the signed-in user (Task 12). The only change is wording: it no longer wipes settings.

- [ ] **Step 1: Verify button copy says "Clear all entries"**

Open `frontend/src/components/Settings.tsx`. Find the existing button text and confirmation modal copy. Update them so the button label says "Clear all entries" and the modal says "This deletes your entries but keeps your account and coaching style."

- [ ] **Step 2: Update test**

Update the matching test in `Settings.test.tsx` to query the new copy.

- [ ] **Step 3: Run, verify pass**

Run: `cd frontend && npx vitest run src/components/Settings.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Settings.tsx frontend/src/components/Settings.test.tsx
git commit -m "feat(settings): rename Clear all data to Clear all entries"
```

---

### Task 20: Account-deletion Edge Function

**Files:**
- Create: `supabase/functions/delete-account/index.ts`
- Create: `supabase/functions/delete-account/deno.json`

- [ ] **Step 1: Implement**

Create `supabase/functions/delete-account/deno.json`:

```json
{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@^2"
  }
}
```

Create `supabase/functions/delete-account/index.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify caller's token by asking Supabase who they are.
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response("unauthorized", { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const userId = user.id;

  // Delete data first (explicit + observable). ON DELETE CASCADE would also handle this.
  const { error: entriesErr } = await admin.from("entries").delete().eq("user_id", userId);
  if (entriesErr) return new Response(JSON.stringify({ error: entriesErr.message }), { status: 500 });

  const { error: settingsErr } = await admin.from("settings").delete().eq("user_id", userId);
  if (settingsErr) return new Response(JSON.stringify({ error: settingsErr.message }), { status: 500 });

  const { error: userErr } = await admin.auth.admin.deleteUser(userId);
  if (userErr) return new Response(JSON.stringify({ error: userErr.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
```

- [ ] **Step 2: Deploy to test project**

Run from repo root: `supabase functions deploy delete-account`
Expected: function deployed; CLI prints the function URL.

- [ ] **Step 3: Set required secrets**

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase for Edge Functions — no manual secret setting needed.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/delete-account
git commit -m "feat(auth): add delete-account Edge Function"
```

---

### Task 21: Delete-account UI flow

**Files:**
- Modify: `frontend/src/components/Settings.tsx`
- Modify: `frontend/src/components/Settings.test.tsx`

- [ ] **Step 1: Write failing test**

Add to `frontend/src/components/Settings.test.tsx`:

```typescript
const invoke = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    functions: { invoke },
    auth: { signOut: vi.fn(() => Promise.resolve()) },
  }),
}));

it("requires typing email to enable Delete account button", async () => {
  // assumes getCurrentUser mock returns email "user@example.com" (see Task 18)
  render(<Settings /* existing props */ />);
  fireEvent.click(await screen.findByRole("button", { name: /delete account/i }));
  const confirmInput = await screen.findByLabelText(/type your email/i);
  const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
  expect(confirmBtn).toBeDisabled();
  fireEvent.change(confirmInput, { target: { value: "user@example.com" } });
  expect(confirmBtn).not.toBeDisabled();
});

it("invokes delete-account function and redirects", async () => {
  invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
  delete (window as { location?: Location }).location;
  (window as unknown as { location: { href: string } }).location = { href: "" };
  render(<Settings /* existing props */ />);
  fireEvent.click(await screen.findByRole("button", { name: /delete account/i }));
  fireEvent.change(await screen.findByLabelText(/type your email/i), {
    target: { value: "user@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("delete-account"));
  await waitFor(() => expect(window.location.href).toContain("/sign-in"));
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd frontend && npx vitest run src/components/Settings.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement in Settings.tsx**

Add a Danger zone section below Account:

```tsx
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// inside the component:
const [showDeleteAccount, setShowDeleteAccount] = useState(false);
const [confirmEmail, setConfirmEmail] = useState("");
const [deleteError, setDeleteError] = useState<string | null>(null);
const [deleting, setDeleting] = useState(false);

async function handleDeleteAccount() {
  setDeleting(true);
  setDeleteError(null);
  const client = getSupabaseBrowserClient();
  const { error } = await client.functions.invoke("delete-account");
  if (error) {
    setDeleteError(error.message);
    setDeleting(false);
    return;
  }
  await client.auth.signOut();
  window.location.href = "/sign-in?deleted=1";
}

// in the JSX:
<section className="border-t pt-6 mt-6">
  <h3 className="font-display text-lg mb-2 text-error-500">Danger zone</h3>
  <button
    type="button"
    onClick={() => setShowDeleteAccount(true)}
    className="border border-error-500 text-error-500 rounded px-4 py-2 hover:bg-error-50"
  >
    Delete account
  </button>
  {showDeleteAccount && (
    <div role="dialog" className="mt-4 border rounded p-4 bg-error-50">
      <p className="mb-3">
        This permanently deletes your entries, settings, and account.
        Type your email to confirm.
      </p>
      <label className="block mb-3">
        <span className="block text-sm mb-1">Type your email</span>
        <input
          type="email"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={confirmEmail !== email || deleting}
          className="bg-error-500 text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
        <button
          type="button"
          onClick={() => setShowDeleteAccount(false)}
          className="border rounded px-4 py-2"
        >
          Cancel
        </button>
      </div>
      {deleteError && <p role="alert" className="text-error-500 mt-2 text-sm">{deleteError}</p>}
    </div>
  )}
</section>
```

- [ ] **Step 4: Run, verify pass**

Run: `cd frontend && npx vitest run src/components/Settings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Settings.tsx frontend/src/components/Settings.test.tsx
git commit -m "feat(settings): add Delete account flow"
```

---

## Phase 7 — FastAPI JWT verification

### Task 22: Add JWT verification dependency

**Files:**
- Create: `backend/auth.py`
- Create: `backend/tests/test_auth.py`
- Modify: `backend/pyproject.toml`

- [ ] **Step 1: Add dependencies**

Run from `backend/`: `uv add "pyjwt[crypto]>=2.9.0" "httpx>=0.28.0"`
Expected: `pyproject.toml` updated; `uv.lock` updated.

- [ ] **Step 2: Write failing tests**

Create `backend/tests/test_auth.py`:

```python
import time
from unittest.mock import patch, MagicMock

import jwt
import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from auth import get_current_user, UserClaims


# Generate a key pair for tests
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_pem = _private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
)


def _make_token(claims: dict, kid: str = "test-kid", expired: bool = False) -> str:
    payload = {
        "sub": "user-123",
        "aud": "authenticated",
        "iat": int(time.time()) - 60,
        "exp": int(time.time()) - 10 if expired else int(time.time()) + 600,
        **claims,
    }
    return jwt.encode(payload, _pem, algorithm="RS256", headers={"kid": kid})


@pytest.fixture
def app_with_auth():
    app = FastAPI()

    @app.get("/protected")
    def protected(user: UserClaims = Depends(get_current_user)):
        return {"user_id": user.user_id}

    return app


@pytest.fixture(autouse=True)
def fake_jwks(monkeypatch):
    """Patch the JWKS fetcher to return our test public key."""
    from auth import _jwks_cache
    _jwks_cache.clear()

    public_key = _private_key.public_key()
    # PyJWT's PyJWK accepts a JWK dict; we build one with the public exponent + modulus.
    import base64
    numbers = public_key.public_numbers()

    def b64u(n: int) -> str:
        b = n.to_bytes((n.bit_length() + 7) // 8, "big")
        return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

    jwk = {
        "kty": "RSA",
        "kid": "test-kid",
        "alg": "RS256",
        "use": "sig",
        "n": b64u(numbers.n),
        "e": b64u(numbers.e),
    }

    monkeypatch.setattr("auth._fetch_jwks", lambda: {"keys": [jwk]})
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    yield


def test_valid_token_returns_200(app_with_auth):
    token = _make_token({})
    client = TestClient(app_with_auth)
    res = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json() == {"user_id": "user-123"}


def test_missing_token_returns_401(app_with_auth):
    client = TestClient(app_with_auth)
    res = client.get("/protected")
    assert res.status_code == 401


def test_malformed_token_returns_401(app_with_auth):
    client = TestClient(app_with_auth)
    res = client.get("/protected", headers={"Authorization": "Bearer not-a-jwt"})
    assert res.status_code == 401


def test_expired_token_returns_401(app_with_auth):
    token = _make_token({}, expired=True)
    client = TestClient(app_with_auth)
    res = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_unknown_kid_returns_401(app_with_auth):
    token = _make_token({}, kid="other-kid")
    client = TestClient(app_with_auth)
    res = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
```

- [ ] **Step 3: Run, verify fail**

Run: `cd backend && uv run pytest tests/test_auth.py -v`
Expected: FAIL — `auth` module not found.

- [ ] **Step 4: Implement**

Create `backend/auth.py`:

```python
"""JWT verification against Supabase JWKS."""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)

_jwks_cache: dict[str, Any] = {}
_JWKS_TTL_SECONDS = 600


@dataclass(frozen=True)
class UserClaims:
    user_id: str
    email: str | None


def _fetch_jwks() -> dict[str, Any]:
    url = os.environ["SUPABASE_JWKS_URL"]
    resp = httpx.get(url, timeout=5.0)
    resp.raise_for_status()
    return resp.json()


def _get_jwks(force: bool = False) -> dict[str, Any]:
    now = time.time()
    if not force and _jwks_cache.get("fetched_at", 0) + _JWKS_TTL_SECONDS > now:
        return _jwks_cache["jwks"]
    jwks = _fetch_jwks()
    _jwks_cache["jwks"] = jwks
    _jwks_cache["fetched_at"] = now
    return jwks


def _find_key(jwks: dict[str, Any], kid: str) -> dict[str, Any] | None:
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    return None


def _verify(token: str) -> dict[str, Any]:
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid token")
    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="invalid token")

    jwks = _get_jwks()
    jwk = _find_key(jwks, kid)
    if jwk is None:
        # Maybe JWKS rotated; refresh once and retry.
        jwks = _get_jwks(force=True)
        jwk = _find_key(jwks, kid)
        if jwk is None:
            raise HTTPException(status_code=401, detail="invalid token")

    public_key = jwt.PyJWK(jwk).key
    audience = os.environ.get("SUPABASE_JWT_AUDIENCE", "authenticated")
    try:
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256", "ES256"],
            audience=audience,
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid token")
    return claims


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> UserClaims:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="missing token")
    claims = _verify(credentials.credentials)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="invalid token")
    return UserClaims(user_id=user_id, email=claims.get("email"))
```

- [ ] **Step 5: Run, verify pass**

Run: `cd backend && uv run pytest tests/test_auth.py -v`
Expected: PASS for all five tests.

- [ ] **Step 6: Commit**

```bash
git add backend/auth.py backend/tests/test_auth.py backend/pyproject.toml backend/uv.lock
git commit -m "feat(backend): add Supabase JWT verification dependency"
```

---

### Task 23: Apply JWT verification to all non-health endpoints

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_brag_doc.py`, `backend/tests/test_coach.py`

- [ ] **Step 1: Add Depends(get_current_user) to each route**

Open `backend/main.py`. Add `from auth import get_current_user, UserClaims` at the top with other imports. Modify each route signature (except `/health`) to add `user: UserClaims = Depends(get_current_user)` as a parameter. Example:

```python
@app.post("/generate-brag-doc")
def brag_doc_route(
    body: BragDocRequest,
    user: UserClaims = Depends(get_current_user),
    client: Anthropic = Depends(get_anthropic_client),
):
    ...
```

Also include `user_id` in the logger context:

```python
logger.info("brag doc request", extra={"user_id": user.user_id})
```

- [ ] **Step 2: Update existing tests with a valid-token fixture**

Open `backend/tests/conftest.py` and add a fixture that bypasses JWT verification via dependency override:

```python
from auth import get_current_user, UserClaims

@pytest.fixture
def authed_user():
    app.dependency_overrides[get_current_user] = lambda: UserClaims(
        user_id="test-user", email="test@example.com"
    )
    yield UserClaims(user_id="test-user", email="test@example.com")
    app.dependency_overrides.pop(get_current_user, None)
```

In `test_brag_doc.py` and `test_coach.py`, add `authed_user` as a fixture parameter to every test (alongside `http_client`).

- [ ] **Step 3: Run, verify pass**

Run: `cd backend && uv run pytest -v`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/main.py backend/tests
git commit -m "feat(backend): require auth on all LLM endpoints"
```

---

### Task 24: Forward JWT from frontend API routes to FastAPI

**Files:**
- Modify: `frontend/src/app/api/coach/turn/route.ts`, `frontend/src/app/api/coach/reframe/route.ts`, `frontend/src/app/api/generate-brag-doc/route.ts` (paths as they exist)
- Modify: `frontend/src/lib/coachApi.ts`

Inspect the actual API route files to find the right modification points.

- [ ] **Step 1: Find the existing API routes**

Run: `cd frontend && find src/app/api -name "*.ts"`
For each file, open it and locate the `fetch()` to FastAPI.

- [ ] **Step 2: Read the Supabase session in each API route and forward the access token**

In each route handler, fetch the session via the server client and include the access token in the upstream `Authorization` header:

```typescript
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = await request.json();
  const upstream = await fetch(`${process.env.BACKEND_URL}/<existing-path>`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
```

Replace `<existing-path>` with the FastAPI path the current route forwards to.

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/api
git commit -m "feat(api): forward Supabase JWT from API routes to backend"
```

---

## Phase 8 — RLS integration tests

### Task 25: RLS isolation tests against the test Supabase project

**Files:**
- Create: `frontend/e2e/rls.spec.ts`
- Create: `frontend/e2e/fixtures/supabase-admin.ts`

These are Playwright tests because Playwright already runs against env-configured projects, but they don't use the browser — they hit Supabase directly with two different user JWTs. Alternatively run as Vitest integration tests; Playwright keeps everything in one place.

- [ ] **Step 1: Create the admin fixture (creates test users via service role)**

Create `frontend/e2e/fixtures/supabase-admin.ts`:

```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function createTestUser(email: string): Promise<{ id: string; accessToken: string }> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID() + "Aa1!",
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("user creation failed");

  // Generate an access token by signing in with magic-link admin shortcut:
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;
  // Exchange the action token for a session:
  const user = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: sess, error: vErr } = await user.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (vErr || !sess.session) throw vErr ?? new Error("session exchange failed");

  return { id: data.user.id, accessToken: sess.session.access_token };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}

export function userClient(accessToken: string): SupabaseClient {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
  return client;
}
```

- [ ] **Step 2: Write the RLS test spec**

Create `frontend/e2e/rls.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, userClient } from "./fixtures/supabase-admin";

test.describe("RLS isolation", () => {
  let userA: { id: string; accessToken: string };
  let userB: { id: string; accessToken: string };
  let bEntryId: string;

  test.beforeAll(async () => {
    userA = await createTestUser(`rls-a-${Date.now()}@example.test`);
    userB = await createTestUser(`rls-b-${Date.now()}@example.test`);

    const b = userClient(userB.accessToken);
    const { data, error } = await b.from("entries").insert({
      user_id: userB.id,
      date: "2026-05-19",
      prompt: "p",
      original: "user B entry",
      tags: [],
    }).select("id").single();
    if (error) throw error;
    bEntryId = (data as { id: string }).id;
  });

  test.afterAll(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  test("user A cannot SELECT user B's entry by id", async () => {
    const a = userClient(userA.accessToken);
    const { data } = await a.from("entries").select("*").eq("id", bEntryId);
    expect(data).toEqual([]);
  });

  test("user A cannot UPDATE user B's entry", async () => {
    const a = userClient(userA.accessToken);
    const { data, error } = await a
      .from("entries")
      .update({ original: "hacked" })
      .eq("id", bEntryId)
      .select("*");
    // Either zero rows affected, or an error — both are acceptable.
    expect(error || (data && data.length === 0)).toBeTruthy();
  });

  test("user A cannot DELETE user B's entry", async () => {
    const a = userClient(userA.accessToken);
    const { data, error } = await a.from("entries").delete().eq("id", bEntryId).select("*");
    expect(error || (data && data.length === 0)).toBeTruthy();
  });

  test("user A cannot INSERT a row with user B's user_id", async () => {
    const a = userClient(userA.accessToken);
    const { error } = await a.from("entries").insert({
      user_id: userB.id,
      date: "2026-05-19",
      prompt: "p",
      original: "spoofed",
      tags: [],
    });
    expect(error).not.toBeNull();
  });

  test("settings: user A cannot SELECT user B's settings", async () => {
    const b = userClient(userB.accessToken);
    await b.from("settings").upsert({
      user_id: userB.id,
      coaching_style: "hype-woman",
    });

    const a = userClient(userA.accessToken);
    const { data } = await a.from("settings").select("*").eq("user_id", userB.id);
    expect(data).toEqual([]);
  });
});
```

- [ ] **Step 3: Ensure SUPABASE_SERVICE_ROLE_KEY is available locally**

Add to `frontend/.env.local` (not committed): `SUPABASE_SERVICE_ROLE_KEY=<test project's service role key>`.

Add a guard to `frontend/.env.local.example`:

```
# Required for RLS integration tests (test project only — never put prod key here)
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 4: Run**

Run: `cd frontend && npx playwright test e2e/rls.spec.ts`
Expected: PASS — all five tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/rls.spec.ts frontend/e2e/fixtures/supabase-admin.ts frontend/.env.local.example
git commit -m "test(rls): add cross-user isolation suite"
```

---

## Phase 9 — Playwright E2E

### Task 26: Add Playwright auth fixture

**Files:**
- Create: `frontend/e2e/fixtures/auth.ts`

- [ ] **Step 1: Implement**

Create `frontend/e2e/fixtures/auth.ts`:

```typescript
import { test as base, expect, Page } from "@playwright/test";
import { createTestUser, deleteTestUser } from "./supabase-admin";

interface AuthFixture {
  signedInPage: Page;
  testUser: { id: string; email: string; accessToken: string };
}

export const test = base.extend<AuthFixture>({
  testUser: async ({}, use) => {
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
    const user = await createTestUser(email);
    await use({ id: user.id, email, accessToken: user.accessToken });
    await deleteTestUser(user.id);
  },
  signedInPage: async ({ browser, testUser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    // Seed Supabase session cookies by visiting a setup route that stores them.
    // Easiest portable path: navigate to /sign-in then inject the session via Supabase client in the page.
    await page.goto("/sign-in");
    await page.evaluate((token) => {
      // Supabase SSR stores cookies; we instead pre-set localStorage as a stop-gap if needed.
      // Most reliable approach: use page.context().addCookies() with the @supabase/ssr cookie name.
      // The cookie names are sb-<project-ref>-auth-token chunks; consult @supabase/ssr docs.
      window.localStorage.setItem(
        "test-fixture-access-token",
        token
      );
    }, testUser.accessToken);

    // Set Supabase auth cookies directly using the JS client to keep this fixture maintainable.
    await page.goto("/");
    await page.evaluate(async ({ url, anon, token, refreshToken }) => {
      const mod = await import("/_next/static/chunks/supabase-stub.js").catch(() => null);
      // Fallback: hit the same supabase-js the app uses and call setSession.
      const sb = (await import("@supabase/supabase-js")).createClient(url, anon);
      await sb.auth.setSession({ access_token: token, refresh_token: refreshToken });
    }, {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      token: testUser.accessToken,
      refreshToken: testUser.accessToken, // refresh not needed for short-lived test sessions
    });

    await use(page);
    await context.close();
  },
});

export { expect };
```

Note: setting the Supabase session inside a Playwright page is fiddly. A simpler alternative — and the one to use if the above proves unreliable — is to perform the magic-link verification end-to-end via the admin API, exchange the returned tokens, and then `page.context().addCookies()` with the exact cookie names `@supabase/ssr` writes (`sb-<ref>-auth-token`). Check what cookies appear in the browser after a real sign-in (DevTools → Application → Cookies) and replicate them via `addCookies`.

- [ ] **Step 2: Verify in an exploratory script**

Write a tiny throwaway test that uses `signedInPage` to visit `/` and asserts no redirect to `/sign-in`. If it redirects, iterate on the fixture (cookie-based approach is the fallback).

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/fixtures/auth.ts
git commit -m "test(e2e): add signed-in page fixture"
```

---

### Task 27: Auth, migration, and account-deletion E2E specs

**Files:**
- Create: `frontend/e2e/auth.spec.ts`
- Create: `frontend/e2e/migration.spec.ts`
- Create: `frontend/e2e/account-deletion.spec.ts`

- [ ] **Step 1: auth.spec.ts**

```typescript
import { test, expect } from "./fixtures/auth";

test("signed-in user lands on the journal", async ({ signedInPage }) => {
  await signedInPage.goto("/");
  await expect(signedInPage).toHaveURL("/");
  await expect(signedInPage.getByText(/Daily Wins/i)).toBeVisible();
});

test("signed-out user is redirected to /sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in/);
});
```

- [ ] **Step 2: migration.spec.ts**

```typescript
import { test, expect } from "./fixtures/auth";

test("localStorage entries upload on first sign-in", async ({ browser, testUser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Seed localStorage before sign-in
  await page.goto("/sign-in");
  await page.evaluate(() => {
    localStorage.setItem("byline-entries", JSON.stringify([{
      id: "local-1",
      date: "2026-05-18",
      prompt: "what shipped?",
      original: "I shipped the search feature",
      reframed: null,
      tags: ["technical"],
      coachNotes: null,
      createdAt: "2026-05-18T10:00:00Z",
    }]));
  });

  // Set session cookies for testUser (use same approach as fixture).
  // Pseudo:
  await page.evaluate(async ({ url, anon, token }) => {
    const sb = (await import("@supabase/supabase-js")).createClient(url, anon);
    await sb.auth.setSession({ access_token: token, refresh_token: token });
  }, {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    token: testUser.accessToken,
  });

  await page.goto("/");
  await expect(page.getByText("I shipped the search feature")).toBeVisible({ timeout: 10_000 });

  const remaining = await page.evaluate(() => localStorage.getItem("byline-entries"));
  expect(remaining).toBeNull();
});
```

- [ ] **Step 3: account-deletion.spec.ts**

```typescript
import { test, expect } from "./fixtures/auth";

test("delete account wipes data and signs the user out", async ({ signedInPage, testUser }) => {
  await signedInPage.goto("/");
  await signedInPage.getByRole("button", { name: /settings/i }).click();
  await signedInPage.getByRole("button", { name: /delete account/i }).click();
  await signedInPage.getByLabel(/type your email/i).fill(testUser.email);
  await signedInPage.getByRole("button", { name: /^delete$/i }).click();
  await expect(signedInPage).toHaveURL(/\/sign-in/, { timeout: 15_000 });
});
```

- [ ] **Step 4: Run all new specs**

Run: `cd frontend && npx playwright test e2e/auth.spec.ts e2e/migration.spec.ts e2e/account-deletion.spec.ts`
Expected: all green. Fix fixture issues as needed (see Task 26 note about cookie-based fallback).

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/auth.spec.ts frontend/e2e/migration.spec.ts frontend/e2e/account-deletion.spec.ts
git commit -m "test(e2e): add auth, migration, and account-deletion specs"
```

---

### Task 28: Update existing E2E specs to use signed-in fixture

**Files:**
- Modify: `frontend/e2e/journal.spec.ts`, `brag-doc.spec.ts`, `persistence.spec.ts`, `coach.spec.ts`, `entries.spec.ts`, `categories.spec.ts`, `coach-error.spec.ts`, `settings-coach.spec.ts`

- [ ] **Step 1: Replace the test import**

For each spec, change:

```typescript
import { test, expect } from "@playwright/test";
```

to:

```typescript
import { test, expect } from "./fixtures/auth";
```

- [ ] **Step 2: Change each test signature to take `signedInPage`**

Replace `({ page })` with `({ signedInPage: page })` (the alias keeps test bodies unchanged), OR change all uses of `page` to `signedInPage`. Do whichever fits the existing style.

- [ ] **Step 3: Update persistence.spec.ts semantics**

The current persistence test likely reloads and checks localStorage. Change it to:
- Seed an entry via the UI.
- Reload.
- Assert the entry is still visible (from the server) and the user is still signed in.

- [ ] **Step 4: Run all E2E**

Run: `cd frontend && npx playwright test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e
git commit -m "test(e2e): adopt signed-in fixture across specs"
```

---

## Phase 10 — Final verification

### Task 29: Run full test suites + manual smoke

- [ ] **Step 1: Frontend unit tests**

Run: `cd frontend && npx vitest run`
Expected: all green.

- [ ] **Step 2: Frontend lint + type-check + build**

Run: `cd frontend && npm run lint && npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 3: Frontend E2E (full)**

Run: `cd frontend && npx playwright test`
Expected: all green.

- [ ] **Step 4: Backend tests**

Run: `cd backend && uv run pytest -v`
Expected: all green.

- [ ] **Step 5: Manual smoke (browser)**

In a fresh browser profile:
- Visit the app → expect redirect to `/sign-in`.
- Sign in with your real email → click the magic link → land back on `/`.
- Confirm your previously-existing localStorage entries are now visible (migrated from your dev localStorage).
- Confirm DevTools → Application → Local Storage shows nothing under the `byline-*` keys.
- Add an entry → confirm it appears.
- Open Settings → confirm email is shown → sign out.
- Sign back in → entries still there.
- Open Settings → Delete account → type email → confirm → expect redirect to `/sign-in?deleted=1`.
- Sign in with the same email → expect a fresh, empty journal.

- [ ] **Step 6: Production deploy checklist (do not auto-run)**

Before promoting to prod:
- Apply migrations to the prod Supabase project: `supabase db push --linked --project-ref <prod-ref>`.
- Deploy `delete-account` Edge Function to prod: `supabase functions deploy delete-account --project-ref <prod-ref>`.
- Set prod env vars in Vercel and FastAPI host (URL + anon key on frontend, JWKS URL on backend).
- Deploy FastAPI.
- Deploy frontend.

- [ ] **Step 7: Commit any leftover doc changes**

```bash
git add .
git commit -m "chore: final verification pass"
```

---

## Self-review notes

Spec coverage:
- Sections 1–7 in the spec (architecture, data model, RLS, auth flow, settings UI, account deletion, testing, rollout) each map to one or more tasks above. Architecture / data model → Tasks 2-4. RLS → Tasks 3 + 25. Auth flow → Tasks 8-11. Migration → Tasks 4 + 15. Settings UI → Tasks 18-21. Account deletion → Tasks 20-21. JWT verification → Tasks 22-24. Testing strategy → Tasks 12-15 (unit), 25 (RLS), 26-28 (E2E), 22 (backend). Rollout → Task 29 Step 6.

Known risk in plan:
- Task 26 (Playwright signed-in fixture) is the most likely to need iteration. The shape of `@supabase/ssr` session cookies in tests is finicky; the cookie-based fallback approach is called out inline. Budget extra time here.
- Task 17 is intentionally broad ("update components"). The grep step is the way to find the work; in practice it's mechanical (`await` + `async`).
