# In-app AI Data Disclosure + Consent Gate — Design

**Date:** 2026-06-12
**Backlog item:** Privacy + legal — "Explicit 'data is sent to Anthropic when you use the coach' disclosure surfaced in-app, not only in legal docs." (in-app disclosure portion only)

## Goal

Surface an honest, in-app disclosure that a user's text is sent to Anthropic when they use AI features, backed by an explicit acknowledgement the user controls. Written legal documents (privacy policy, ToS, cookie policy) are out of scope for this work.

## Behavior

- A new **Privacy** tab in Settings holds an acknowledgement checkbox.
- Every AI feature that sends text to Anthropic is gated:
  - **Coach** — turns and reframe (`/api/coach/turn`, `/api/coach/reframe`)
  - **Brag Doc** generation (`/api/generate-brag-doc`)
- If a user triggers a gated action without having acknowledged, a one-time consent gate (modal) appears.
- On accept: the acknowledgement is persisted, the gate closes, and the originally-requested action proceeds. The user is told they can change this anytime in Settings → Privacy.
- On cancel: nothing runs.
- Unticking the checkbox in Settings re-arms the gate for the next AI action.

## Changes

### 1. Data & persistence

- Add `aiConsent: boolean` to `UserSettings` (`src/lib/types.ts`); default `false`.
- Update `DEFAULT_USER_SETTINGS` with `aiConsent: false`.
- `src/lib/settings.ts`: read the column in `rowToSettings`, write it in `writeSettings` payload.
- New Supabase migration `supabase/migrations/0004_add_ai_consent.sql`:
  ```sql
  alter table public.settings add column ai_consent boolean not null default false;
  ```
- Existing users default to `false` and so receive the gate on their next AI use — correct, since none have explicitly acknowledged.

### 2. Settings → Privacy tab

- Add `"privacy"` to the `Section` union and `SECTIONS` list in `src/components/SettingsDrawer.tsx`.
- New `PrivacyCard` component (in `src/components/Settings.tsx`, alongside the existing cards):
  - Short disclosure paragraph: when you use Coach or generate a Brag Doc, your entry text is sent to Anthropic to generate a response.
  - A checkbox bound to `aiConsent` that persists via `writeSettings` on toggle.
  - Copy noting that unticking will re-arm the consent prompt.

### 3. Consent gate + interception

- New `AiConsentGate` modal component:
  - Disclosure text matching the Privacy tab.
  - Primary button "I understand, continue" (accept); secondary "Cancel".
  - Line: "You can withdraw this anytime in Settings → Privacy."
- `App` owns the gate state and a guard helper:
  ```ts
  function requireAiConsent(run: () => void) {
    if (aiConsent) { run(); return; }
    setPendingAction(() => run);
    setGateOpen(true);
  }
  ```
  - On accept: `await writeSettings({ aiConsent: true })`, set local `aiConsent` state, close gate, invoke the pending action.
  - On cancel: clear pending action, close gate.
- `App` loads `aiConsent` once on mount into state.
- Thread the guard to the two trigger points via a single prop `requireAiConsent: (run: () => void) => void`:
  - `EntryList` "Coach me" button → `requireAiConsent(() => setCoachOpenId(entry.id))`
  - `BragDoc` "Generate" button → `requireAiConsent(() => generate())`

## Testing (TDD, matching existing Vitest + RTL patterns)

- `settings.test.ts`: read/write round-trips `aiConsent`.
- `PrivacyCard`: renders disclosure; toggling the checkbox persists via `writeSettings`.
- `AiConsentGate`: shown when an action is triggered without consent; accept persists and runs the pending action; cancel aborts and runs nothing.
- `EntryList`: "Coach me" with no consent opens the gate, not the Coach panel.
- `BragDoc`: "Generate" with no consent opens the gate, not the generation call.

## Out of scope

- Written privacy policy, terms of service, cookie policy.
- Any change to what data is actually sent or how the backend handles it.
