# Confidence Journal Implementation Plan Summary

**Goal:** Build a Next.js daily wins journal with AI reframing and brag doc generation.

**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind 4 + Vitest + Playwright + Anthropic SDK. Data in localStorage.

**Structure:** Single-page app with 3 tabs (Journal, Brag Doc, Settings) in `frontend/`, plus two API routes proxying Claude Haiku.

## 15 Tasks (TDD throughout)

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Scaffolding | `create-next-app`, vitest/playwright configs, `.env.local` |
| 2 | Types + Prompts | `Entry` interface, 6 tags, pool of 9 daily prompts |
| 3 | Data layer | localStorage CRUD + date-range filter |
| 4 | TagPicker | Toggleable tag chips |
| 5 | EntryForm | Prompt display, textarea, tag picker, save |
| 6 | ReframeView | Side-by-side original vs reframed + accept/dismiss |
| 7 | EntryList | Past entries with reframe toggle + empty state |
| 8 | `/api/reframe` | Claude Haiku call to reframe text |
| 9 | `/api/generate-brag-doc` | Synthesizes entries into grouped bullets (JSON) |
| 10 | BragDoc component | Date-range filter, generate, copy to clipboard |
| 11 | Settings | Clear-all-data with confirmation |
| 12 | App container | Tab nav + wires save→reframe flow |
| 13 | Run full unit suite | Verify all tests green |
| 14 | Playwright E2E | `journal.spec`, `brag-doc.spec`, `persistence.spec` |
| 15 | Final verification | Build, tests, manual smoke |

**Flow per task:** write failing test → verify red → implement → verify green → commit.
