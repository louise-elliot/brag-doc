# Confidence Journal -- MVP Design Spec

## Overview

A daily wins journal for women in tech that combats self-diminishment patterns identified in research. The app prompts users to log accomplishments, uses AI to reframe self-critical language, and generates a "brag doc" of impact-focused bullet points for performance reviews.

## Target User

Women in tech/corporate roles preparing for performance reviews. The tone, prompts, and AI reframing are tailored to patterns research identifies in this demographic: attributing success to luck or the team, hedging language, minimizing scope of contributions.

## Architecture

- Single-page Next.js app (App Router) in `frontend/` subdirectory
- Client-rendered with three tabs: Journal, Brag Doc, Settings
- Data stored in browser localStorage
- Two Next.js API routes for AI features (Claude API proxy)
- Tailwind CSS for styling
- Bold/empowering visual tone (dark palette, strong typography) -- to be refined with frontend-design skill

## Data Model

All data stored as JSON in localStorage under a single key.

```typescript
interface Entry {
  id: string           // uuid
  date: string         // ISO date (YYYY-MM-DD)
  prompt: string       // the question shown to the user
  original: string     // what the user wrote
  reframed: string | null  // AI-reframed version, null if not yet processed
  tags: string[]       // selected from predefined set
  createdAt: string    // ISO timestamp
}
```

### Predefined Tags

leadership, technical, collaboration, problem-solving, communication, mentoring

### Prompt Pool

~10 rotating prompts selected randomly per day, e.g.:
- "What impact did you make today?"
- "What challenge did you navigate?"
- "What did you do that someone more junior couldn't have?"
- "What decision did you drive forward?"
- "What did you teach or explain to someone?"
- "What problem did you solve that others hadn't?"
- "What did you ship or deliver?"
- "What feedback did you give that shaped an outcome?"
- "What risk did you take that paid off?"
- "What did you figure out that was hard?"

## User Flow

### Journal Tab (default)

1. User sees today's prompt with a text area below
2. User writes their entry and selects tags from the predefined set
3. User clicks "Save" -- entry is stored to localStorage
4. After saving, the app calls `/api/reframe` and displays the AI-reframed version side-by-side with the original
5. User can dismiss the reframing or accept it (which updates the `original` field in localStorage to the reframed text)
6. Below the entry form: scrollable list of past entries (newest first) showing date, original text, tags, and a toggle to reveal the reframed version

### Brag Doc Tab

1. User clicks "Generate" button
2. Optional date range filter: last 30 days, last quarter, last 6 months, all time
3. App sends entries to `/api/generate-brag-doc`
4. Displays impact-focused bullet points grouped by tag category
5. "Copy to clipboard" button for the generated output

### Settings Tab

- "Clear all data" button with confirmation dialog
- No other settings needed for MVP (API key is server-side)

## AI Integration

### Reframe Endpoint

`POST /api/reframe`

Request: `{ text: string }`
Response: `{ reframed: string }`

System prompt: Confidence coach for women in tech. Reframes accomplishments to be more direct, impactful, and free of self-diminishing language. Preserves facts but removes hedging, luck-attribution, and team-deflection. Keeps the same length.

### Brag Doc Endpoint

`POST /api/generate-brag-doc`

Request: `{ entries: Entry[], dateRange?: string }`
Response: `{ bullets: { tag: string, points: string[] }[] }`

System prompt: Synthesizes journal entries into concise, impact-focused bullet points grouped by tag category, suitable for pasting into a performance self-review.

### Model

Claude Haiku (claude-haiku-4-5-20251001) for both endpoints -- fast, low-cost, sufficient for reframing and summarization.

### Error Handling

If the API call fails, show an inline error message. The entry is still saved regardless -- reframing is a supplementary feature, not a blocker to journaling.

## Testing Strategy

### Unit Tests (Vitest + React Testing Library)

- Data layer: CRUD operations on localStorage entries, date filtering, tag filtering
- Components: entry form submission, tag selection, tab switching, brag doc display, copy to clipboard
- API routes: reframe and brag-doc endpoints (mock the Claude API call)

### Integration Tests (Playwright)

- Full daily flow: open app, see prompt, write entry, save, see reframing appear side-by-side
- Brag doc generation: create several entries, switch to Brag Doc tab, generate, verify output, copy to clipboard
- Persistence: add entries, reload page, verify entries persist
- Error state: API route returns error, verify entry still saves and error message displays

## Tech Stack Summary

- Next.js (App Router, client-rendered)
- TypeScript
- Tailwind CSS
- Vitest + React Testing Library
- Playwright
- Anthropic SDK (@anthropic-ai/sdk)
- localStorage for persistence
