# Confidence Journal MVP Test Strategy## Testing Strategy

## Unit Tests (Vitest + React Testing Library)

- Data layer: CRUD operations on localStorage entries, date filtering, tag filtering
- Components: entry form submission, tag selection, tab switching, brag doc display, copy to clipboard
- API routes: reframe and brag-doc endpoints (mock the Claude API call)

## Integration Tests (Playwright)

- Full daily flow: open app, see prompt, write entry, save, see reframing appear side-by-side
- Brag doc generation: create several entries, switch to Brag Doc tab, generate, verify output, copy to clipboard
- Persistence: add entries, reload page, verify entries persist
- Error state: API route returns error, verify entry still saves and error message displays
