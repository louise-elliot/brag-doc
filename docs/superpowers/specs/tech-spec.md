# Confidence Journal MVP Technical Design Spec

## Tech Stack Summary

- Next.js (App Router, client-rendered)
- TypeScript
- Tailwind CSS
- Vitest + React Testing Library
- Playwright
- Anthropic SDK (@anthropic-ai/sdk)
- localStorage for persistence

## Architecture

- Single-page Next.js app (App Router) in `frontend/` subdirectory
- Client-rendered with three tabs: Journal, Brag Doc, Settings
- Data stored in browser localStorage
- Two Next.js API routes for AI features (Claude API proxy)
- Tailwind CSS for styling


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

~9 rotating prompts selected randomly per day, e.g.:
- "What impact did you make today?"
- "What challenge did you navigate?"
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
5. User can dismiss the reframing, edit it, or accept it (which updates the `original` field in localStorage to the reframed text)
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




