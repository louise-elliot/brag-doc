# Confidence Journal

Daily wins journal for women in tech. Write entries, reframe self-critical language with Claude, generate a brag doc for performance reviews. Data lives in `localStorage`; AI calls are proxied through two Next.js API routes.

## Setup

Copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`.

```
npm install
```

## Scripts

- `npm run dev` — start dev server on :3000
- `npm run build` — production build
- `npm test` — Vitest unit tests
- `npm run test:e2e` — Playwright end-to-end tests
- `npm run lint` — ESLint
