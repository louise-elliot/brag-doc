# Auth and Server-Side Storage Design

**Date:** 2026-05-20
**Status:** Draft, pending user review

## Goal

Replace browser localStorage with per-user server-side storage, gated by email magic-link authentication. Existing on-device data auto-migrates on first sign-in. Account deletion is included.

## Decisions

1. **Vendor:** Supabase (auth + Postgres + Edge Functions). Single vendor, lowest friction for a solo project, plain Postgres underneath so escape is `pg_dump`.
2. **Sign-in:** Magic link only at launch. Google/Apple can be added later.
3. **DB access path:** Browser talks to Supabase directly via the JS client. Row Level Security (RLS) policies enforce per-user isolation at the database layer.
4. **FastAPI role:** Stays an LLM-only service. Adds JWT verification on every request. No DB access in this phase.
5. **Data scope:** Entries and settings move server-side. Coach conversation history stays ephemeral (future work).
6. **Migration:** Auto-upload localStorage to the user's account on first sign-in, then clear localStorage. Silent on success; toast on failure with a retry next sign-in.
7. **Signed-out UX:** Forced sign-in. No anonymous mode.
8. **Account deletion:** Included. Settings gains a "Delete account" action backed by a Supabase Edge Function with the service role key.

## Architecture

```
┌──────────────┐         ┌────────────────┐
│  Next.js     │ ──JWT──▶│  FastAPI       │ ──▶ Anthropic
│  (browser)   │         │  (LLM only)    │
│              │         └────────────────┘
│              │           verifies JWT against
│              │           Supabase JWKS
│              │
│              │ ──SDK──▶ ┌────────────────┐
└──────────────┘          │  Supabase      │
                          │  - Auth        │
                          │  - Postgres    │
                          │  - RLS         │
                          │  - Edge Funcs  │
                          └────────────────┘
```

Three actors:
- **Browser** holds the Supabase session via `@supabase/ssr` cookies. Reads/writes entries and settings directly against Postgres through the Supabase JS client. Calls FastAPI for LLM endpoints with the JWT in the `Authorization` header.
- **FastAPI** verifies the Supabase JWT on every request using the Supabase JWKS endpoint (cached, periodically refreshed). Rejects invalid/expired tokens with 401. Extracts `user_id` for logging.
- **Supabase** is the only stateful component: auth, Postgres, RLS, plus one Edge Function for account deletion.

## Data Model

Supabase provides `auth.users` out of the box. We add two app tables:

### `entries`

| Column        | Type          | Notes                                |
|---------------|---------------|--------------------------------------|
| `id`          | uuid          | Primary key, default `gen_random_uuid()` |
| `user_id`     | uuid          | References `auth.users(id)` ON DELETE CASCADE |
| `date`        | date          | Entry date (YYYY-MM-DD)              |
| `prompt`      | text          | Prompt shown to user                 |
| `original`    | text          | User's original text                 |
| `reframed`    | text          | Nullable                             |
| `tags`        | text[]        | Tag names                            |
| `coach_notes` | text[]        | Nullable                             |
| `created_at`  | timestamptz   | Default `now()`                      |

Index: `(user_id, date DESC, created_at DESC)` to match the existing sort order.

### `settings`

One row per user (acts as a profile).

| Column           | Type          | Notes                              |
|------------------|---------------|------------------------------------|
| `user_id`        | uuid          | Primary key, references `auth.users(id)` ON DELETE CASCADE |
| `coaching_style` | text          | Default `'trusted-mentor'`         |
| `custom_tags`    | text[]        | Default `[]`                       |
| `user_context`   | jsonb         | Nullable                           |
| `updated_at`     | timestamptz   | Default `now()`                    |

### Naming

Postgres uses snake_case. App code stays camelCase via Supabase client column mapping (or a thin adapter in `lib/`).

### "First sign-in" detection

Presence of a `settings` row is the signal. No separate migrations log table.

## Row Level Security

Enabled on both tables. Policies:

```sql
-- entries
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY entries_select ON entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY entries_insert ON entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY entries_update ON entries
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY entries_delete ON entries
  FOR DELETE USING (auth.uid() = user_id);

-- settings: same shape, scoped by user_id
```

These policies are committed in `supabase/migrations/` alongside the schema. They are the keystone of the isolation model and have dedicated integration tests (see Testing).

## Auth Flow

### Sign-in (magic link)

1. User lands on app while signed out → redirected to `/sign-in`.
2. User enters email → `supabase.auth.signInWithOtp({ email })`.
3. Supabase sends a magic-link email.
4. User clicks the link → lands on `/auth/callback?token=...` → session cookie is set → redirected to `/`.
5. App reads session from cookie. All subsequent Supabase queries automatically include the JWT.

### First-time setup

After a successful session is established, the app queries for a `settings` row.

- **No row:** First sign-in path — run migration (below), then insert a default settings row.
- **Row exists:** Returning user — load data normally.

### Migration step

```
1. Read localStorage keys: "byline-entries", and any settings keys.
2. If entries exist (any non-empty array):
     a. Bulk insert entries (transactional, via a Postgres function) with this user_id.
     b. Upsert settings row from localStorage values.
3. On success: clear both localStorage keys.
4. Continue to app.
```

Failure modes:
- **Network failure mid-migration:** Postgres function ensures atomicity. localStorage is only cleared on success. User sees a non-blocking toast: "Couldn't sync your old entries — we'll try again next sign-in." Subsequent sign-ins retry.
- **No localStorage data:** Skip migration, create default settings row.
- **Returning user on a new device with stale localStorage:** Settings row already exists, so migration is skipped. The device's localStorage is discarded after sign-in with a one-time toast: "You're signed in. Your entries are synced from your account; we cleared this device's local copy." Server data is canonical.

### Sign-out

- Clears the session cookie via `supabase.auth.signOut()`.
- Does not touch any data — entries remain on the server.
- Returns user to `/sign-in`.

### FastAPI JWT verification

- Browser sends `Authorization: Bearer <jwt>` on calls to `/api/reframe`, `/api/generate-brag-doc`, `/coach-turn`, `/coach-reframe`.
- A FastAPI dependency `get_current_user(token)` verifies the JWT signature against Supabase's JWKS (cached in-process, refreshed on schema rotation).
- Invalid, expired, or missing tokens → 401.
- Valid → extracts `user_id`, attaches to request context for logging.
- No DB queries from FastAPI in this phase.

## UI Changes

### New pages and surfaces

- **`/sign-in`** — Email input + "Send magic link" button. Confirmation state after sending: "Check your email — we sent a sign-in link to *email*."
- **`/auth/callback`** — Handles token exchange; shows a brief "Signing you in…" state.

### Settings drawer

Existing settings (coaching style, custom tags, user_context) remain; their data source flips from localStorage to Supabase. Saves use optimistic updates with rollback on failure.

Two new sections at the bottom:

1. **Account**
   - Shows signed-in email (read-only).
   - "Sign out" button.

2. **Danger zone**
   - Existing "Clear all data" is repurposed: now deletes all `entries` rows for the user, preserving settings and account. Confirmation modal stays.
   - New "Delete account" button. Opens a confirmation modal requiring the user to type their email. On confirm, calls the `delete-account` Edge Function. On success: clears session, redirects to `/sign-in` with a "Your account has been deleted" banner.

## Account Deletion

A Supabase Edge Function `delete-account`, invoked by the authenticated client, performs (with the service role key):

1. `DELETE FROM entries WHERE user_id = auth.uid()`
2. `DELETE FROM settings WHERE user_id = auth.uid()`
3. `auth.admin.deleteUser(auth.uid())`

Wrapped so that a failure on any step leaves prior steps undone where possible. ON DELETE CASCADE on the `user_id` foreign keys means deleting the auth user alone would also clear data — explicit deletes first are belt-and-braces for clarity and observability.

### Why an Edge Function, not FastAPI

Deleting from `auth.users` requires the service role key. Keeping it in a Supabase Edge Function is a smaller blast radius than putting it in FastAPI, which currently has no DB or admin responsibilities. If FastAPI later needs DB access, this can be revisited.

## Testing Strategy

### Unit tests (Vitest)

- `entries.ts` → `entries.ts` (reimplemented against Supabase client). Tests mock the client and assert query shape and result handling. The old localStorage-based tests are deleted.
- `settings.ts` → same treatment.
- `auth.ts` (new) — sign-in helpers, session handling, sign-out.
- `migration.ts` (new) — simulates localStorage with entries + settings, verifies bulk insert is called with correct payload, asserts localStorage is cleared on success and preserved on failure.

### RLS integration tests (Vitest, real Supabase test project)

Non-negotiable. Run in CI against a dedicated test project (separate from prod):

- Two test users, A and B.
- Insert entries and settings for each.
- Signed in as A:
  - SELECT user B's entry by id → zero rows.
  - UPDATE user B's entry → affects zero rows.
  - DELETE user B's entry → affects zero rows.
  - INSERT with `user_id = B` → rejected.
- Same matrix for `settings`.

These tests are the only thing between "RLS policy bug" and "data leak between users." They run in CI on every PR.

### Playwright E2E

- **`auth.spec.ts`** (new) — sign-in flow. Uses a Supabase test fixture to seed a signed-in session directly (skipping the email round-trip).
- **`migration.spec.ts`** (new) — seeds localStorage with entries before navigating, completes sign-in, verifies entries appear from the server and localStorage is empty.
- **`account-deletion.spec.ts`** (new) — creates a user, populates data, runs delete flow, verifies redirect to `/sign-in`, signs in again with the same email and verifies no leftover data.
- Existing E2E (`journal.spec`, `brag-doc.spec`, `persistence.spec`) — updated to seed a signed-in session in `beforeEach`. Persistence test redefined: reload → still signed in → entries still load (from server, not localStorage).

### FastAPI tests (pytest)

- JWT verification dependency: valid → 200, expired → 401, wrong signature → 401, missing → 401, malformed → 401.
- Existing endpoint tests get a valid-token fixture.

## Rollout

### Environment setup

- Two Supabase projects: `byline-prod`, `byline-test`. The test project is used by CI for RLS integration tests.
- Frontend env (added):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, safe to ship to the browser; RLS does the protecting)
- FastAPI env (added):
  - `SUPABASE_URL`
  - `SUPABASE_JWT_SECRET` (or `SUPABASE_JWKS_URL`, depending on verification approach)
- `.env.example` updated in both `frontend/` and `backend/`.

### Schema in version control

- All schema lives in `supabase/migrations/` SQL files, committed to git.
- RLS policies are part of those migrations.
- Schema changes in prod happen via `supabase db push` from a deploy, never via the dashboard.

### Deploy order

1. Provision Supabase prod project; apply schema + RLS migrations.
2. Set env vars in Vercel (frontend) and FastAPI host.
3. Deploy FastAPI with JWT verification active.
4. Deploy frontend with sign-in gating active.

No gradual rollout — when the frontend ships, sign-in is required. Acceptable because there are no users yet besides the developer, whose localStorage will be auto-migrated on their first sign-in.

### Error visibility

Sentry is a separate backlog item. For this work, migration failures are logged to the browser console with a clear marker (`[migration:fail]`) so we can debug from server access logs or DevTools after launch.

## Cost outlook

- Supabase free tier: 500 MB DB, 50k monthly active users, 2 projects. Comfortably covers prod + test for the foreseeable future.
- Vercel free tier: unchanged.
- FastAPI host: unchanged.

## Out of Scope (deferred)

- Sentry / error tracking — separate backlog item.
- Rate limiting per user — separate backlog item.
- BYOK option — separate backlog item.
- Coach conversation persistence — future work.
- Google / Apple sign-in — added later if needed.
- Data export — early follow-up after launch.
- Onboarding flow — early follow-up after launch.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| RLS policy bug leaks data across users | Dedicated RLS integration test suite, runs on every PR |
| Migration fails partially, user loses data | Transactional Postgres function; localStorage only cleared on success |
| Magic-link email goes to spam | Use Supabase's default email sender at first; switch to a custom domain via Resend/Postmark if delivery issues surface |
| JWT verification breaks FastAPI for legitimate users | JWKS cache with refresh on signature failure; fixture-based tests cover the failure modes |
| Vendor lock-in to Supabase | Schema is plain Postgres; data exportable via `pg_dump`; auth is the only piece that's vendor-specific and can be replaced with Auth.js + the same Postgres DB |
