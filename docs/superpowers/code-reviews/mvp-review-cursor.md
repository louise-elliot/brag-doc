# Cursor Code Review — Confidence Journal
**Date:** 2026-04-22  
**Scope:** Full read-only review of `frontend/` app code, API routes, unit/e2e tests, and project specs/docs consistency  
**Method:** Static review of implementation + tests (no code changes made)
## Findings (Highest severity first)
### High
1. **Privacy/trust mismatch in Settings copy vs actual data flow**
   - **Evidence:** `Settings` says entries “never leave your device,” but app sends entry content to backend AI routes for reframing and brag generation.
   - `frontend/src/components/Settings.tsx`
   - `frontend/src/components/App.tsx`
   - `frontend/src/components/BragDoc.tsx`
   - **Impact:** User trust and compliance risk; UI copy is factually incorrect for core features.
   - **Remedial action:** Update copy to explicitly explain when data is sent for AI processing; add contextual notice near “Save/Reframe” and “Generate”.
2. **Timezone/date bug (`toISOString`) can store/display wrong “today”**
   - **Evidence:** Date strings are derived from UTC ISO date parts.
   - `frontend/src/components/App.tsx`
   - `frontend/src/components/BragDoc.tsx`
   - **Impact:** Users in non-UTC time zones can see entries bucketed under the wrong day and wrong range filtering.
   - **Remedial action:** Use local-date formatting helper (`getFullYear/getMonth/getDate`) consistently for `YYYY-MM-DD`.
3. **Brag Doc loading state can get stuck on thrown fetch/network errors**
   - **Evidence:** `generate()` lacks `try/catch/finally`; `setLoading(false)` is not guaranteed on thrown errors.
   - `frontend/src/components/BragDoc.tsx`
   - **Impact:** Indefinite “Generating...” state and unhandled rejection UX.
   - **Remedial action:** Wrap async logic in `try/catch/finally`; always clear loading and set an actionable error message on exception.
4. **Spec gap: missing “edit reframed text before accept” flow**
   - **Evidence:** Spec requires dismiss/edit/accept; current UI only supports accept/dismiss.
   - `docs/superpowers/specs/tech-spec.md`
   - `frontend/src/components/ReframeView.tsx`
   - **Impact:** Core product requirement is partially unmet.
   - **Remedial action:** Add editable reframed field and propagate edited text through accept handler.
### Medium
5. **Corrupt localStorage can crash data layer**
   - **Evidence:** Unprotected `JSON.parse` in storage read path.
   - `frontend/src/lib/entries.ts`
   - **Impact:** A malformed payload can break Journal/Brag Doc usage.
   - **Remedial action:** Add guarded parse (`try/catch`) with fallback reset to empty array.
6. **Raw backend/provider error details are returned to clients**
   - **Evidence:** API routes return `error.message` directly.
   - `frontend/src/app/api/reframe/route.ts`
   - `frontend/src/app/api/generate-brag-doc/route.ts`
   - **Impact:** Internal detail leakage and inconsistent user-facing errors.
   - **Remedial action:** Return generic client-safe errors; log details server-side only.
7. **Request JSON parse is outside route `try/catch`**
   - **Evidence:** `await request.json()` happens before route-level error handling.
   - `frontend/src/app/api/reframe/route.ts`
   - `frontend/src/app/api/generate-brag-doc/route.ts`
   - **Impact:** Invalid JSON may bypass intended API error shaping.
   - **Remedial action:** Move body parsing into guarded block; return clean 400 for invalid JSON.
8. **Accessibility: incomplete tab semantics**
   - **Evidence:** `role="tab"` is used, but no `tablist`/tabpanel wiring.
   - `frontend/src/components/App.tsx`
   - **Impact:** Reduced screen-reader and keyboard support.
   - **Remedial action:** Add `role="tablist"` to container and proper `aria-controls` + panel IDs/roles.
9. **Brag Doc date-range select has no accessible label**
   - **Evidence:** `<select>` rendered with no `<label>` or `aria-label`.
   - `frontend/src/components/BragDoc.tsx`
   - **Impact:** Assistive tech announces unnamed combobox.
   - **Remedial action:** Add visible label or `aria-label="Date range"`.
10. **E2E tests likely hit live AI route unintentionally**
    - **Evidence:** Save flow in Playwright tests triggers `/api/reframe` and there is no route stubbing.
    - `frontend/e2e/journal.spec.ts`
    - **Impact:** Flaky/slow/costly tests and hidden env coupling.
    - **Remedial action:** Stub `/api/reframe` and `/api/generate-brag-doc` in e2e, keep optional live smoke test behind flag.
11. **Non-stable same-day ordering in entry sorting**
    - **Evidence:** Sorting uses `date` only, not `createdAt` tie-break.
    - `frontend/src/lib/entries.ts`
    - **Impact:** Multiple same-day entries may not display true newest-first.
    - **Remedial action:** Add `createdAt` secondary sort key.
### Low
12. **Contract drift: brag-doc request omits spec’d `dateRange`**
    - **Evidence:** Client sends filtered entries only; spec includes optional `dateRange`.
    - `frontend/src/components/BragDoc.tsx`
    - `docs/superpowers/specs/tech-spec.md`
    - **Impact:** Minor drift now; can complicate future server filtering/auditing.
    - **Remedial action:** Include `dateRange` in payload or update spec to match implementation.
13. **Clipboard write result not handled**
    - **Evidence:** `navigator.clipboard.writeText` is fire-and-forget.
    - `frontend/src/components/BragDoc.tsx`
    - **Impact:** Permission/HTTPS failures can falsely show success.
    - **Remedial action:** Await and handle rejection with user feedback.
14. **Test gaps around failure branches and resilience**
    - **Evidence:** Existing tests focus mostly on happy paths and non-OK HTTP responses.
    - **Impact:** Regressions in exception handling/recovery can slip through.
    - **Remedial action:** Add tests for thrown fetch errors, malformed localStorage, route exception paths, and accessibility semantics.
---
## Open Questions / Assumptions
- Assumed product intent is accurate representation of AI data handling for user trust/compliance.
- Assumed local-time behavior (not UTC) is the desired interpretation of “today” and date-range UX.
- Assumed current specs are source of truth; if specs changed informally, align docs and implementation in one pass.
---
## Strengths
- Clean separation across UI components, storage layer, and API routes.
- Good baseline unit test coverage across components and route handlers.
- Entry-save path remains functional even when reframe fails (good resilience behavior).
- Prompt selection logic is deterministic and simple to reason about.
---
## Prioritized Remediation Plan
1. Fix privacy copy/data-flow disclosure and add explicit AI usage notice.
2. Fix local date helper usage (`App` + `BragDoc`).
3. Harden `BragDoc.generate()` with `try/catch/finally`.
4. Add safe localStorage parse fallback.
5. Sanitize API error responses and guard request-body parsing.
6. Close accessibility gaps (tabs + combobox labeling).
7. Add missing tests for thrown-error paths and corruption recovery.
8. Resolve spec drift (editable reframe + dateRange contract) by implementation or spec update.