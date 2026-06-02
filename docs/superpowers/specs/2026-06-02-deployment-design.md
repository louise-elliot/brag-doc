# Deployment Design

**Date:** 2026-06-02
**Status:** Draft, pending user review

## Goal

Take the Byline app live on hosted infrastructure: frontend on Vercel, FastAPI on Fly.io, both pointed at the prod Supabase project. Wire CI to gate merges; wire per-PR preview environments to give risky changes a safe place to land.

## Decisions

1. **Frontend host:** Vercel (default for Next.js; no real alternative).
2. **Backend host:** Fly.io. Docker-based, hibernates cheaply when idle, low latency from London (`lhr` region).
3. **Environments:** Prod + a thin always-on backend staging app on Fly (`byline-api-staging.fly.dev`) that Vercel previews point at. No separate staging frontend or staging Supabase — PR previews on Vercel fill that role. Per-PR Fly apps also exist for backend-only changes.
4. **Domain:** Default subdomains for now (`byline.vercel.app`, `byline-api.fly.dev`). Custom domain is a later 30-minute follow-up.
5. **CI:** GitHub Actions, required to pass before merge to `main`.
6. **PR previews:** Vercel auto-creates frontend previews; a GitHub Action creates per-PR Fly apps for the backend. Both point at the **test Supabase project** (`idmtuzubldwrypngkikv`) so experiments don't touch prod data.
7. **DB migrations to prod:** Applied manually from the developer's local Supabase CLI. Not automated by CI.

## Architecture

```
                          ┌─────────────────────────────┐
                          │  GitHub: main branch        │
                          │  + pull requests            │
                          └──────────────┬──────────────┘
                                         │ on push / PR
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
              ▼                          ▼                          ▼
    ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
    │  GitHub Actions │         │  Vercel         │         │  Fly.io         │
    │  CI: vitest,    │         │  frontend       │         │  FastAPI        │
    │  lint, tsc,     │         │  PR previews    │         │  PR previews    │
    │  build, pytest  │         │  (automatic)    │         │  (via Action)   │
    │  REQUIRED       │         │                 │         │                 │
    └─────────────────┘         └────────┬────────┘         └────────┬────────┘
                                         │                            │
                                         │ JWT via                    │ verifies
                                         │ Authorization              │ Supabase
                                         │ header                     │ JWT
                                         │                            │
                                         └──────────┬─────────────────┘
                                                    │
                                                    ▼
                                          ┌─────────────────┐
                                          │  Supabase prod  │
                                          │  - Auth         │
                                          │  - Postgres     │
                                          │  - Edge Funcs   │
                                          └─────────────────┘
```

Four hosts, one prod environment each. PR previews are ephemeral and point at the existing test Supabase project.

## CI/CD Flow

### On a PR

1. Branch is pushed; PR is opened.
2. GitHub Actions runs `ci.yml` in parallel:
   - Frontend job: `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npx vitest run` → `npm run build`
   - Backend job: `uv sync` → `uv run pytest -v`
3. Both jobs must pass. Required status checks gate merging.
4. Vercel automatically builds the frontend preview at `byline-git-<branch>.vercel.app`, with env vars scoped to "Preview" (pointed at test Supabase).
5. `fly-pr-preview.yml` runs on PR open/sync. It creates an ephemeral Fly app named `byline-api-pr-<n>.fly.dev`, deploys the current branch, and posts the URL as a PR comment. On PR close it destroys the app.
6. Reviewers can open both preview URLs and test end-to-end.

### On merge to main

1. CI re-runs on `main`.
2. Vercel auto-deploys production frontend to `byline.vercel.app` with production-scoped env vars (pointed at prod Supabase).
3. `fly-deploy.yml` deploys the backend to `byline-api.fly.dev` with production-scoped secrets.
4. Both deploys are atomic with rollback: Fly hits `/health`; Vercel hits the root path. Failed healthchecks keep the previous version live.

## Files Added

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | Test/lint/typecheck/build/pytest matrix on PR + push to main |
| `.github/workflows/fly-deploy.yml` | Backend prod deploy on push to main |
| `.github/workflows/fly-pr-preview.yml` | Per-PR Fly app create/deploy/destroy |
| `fly.toml` | App config: name, region (`lhr`), healthcheck, machine size, autostop |
| `backend/Dockerfile` | `python:3.12-slim` base, uv-installed deps, uvicorn |
| `.dockerignore` | Excludes `__pycache__`, `tests/`, `.venv`, etc. |
| `DEPLOY.md` | Runbook: rotate secrets, view logs, roll back, apply migrations |

## Configuration Files

### `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev
COPY backend/ ./
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### `fly.toml` (repo root)

```toml
app = "byline-api"
primary_region = "lhr"

[build]
  dockerfile = "backend/Dockerfile"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[http_service.checks]]
  interval = "30s"
  timeout = "5s"
  grace_period = "10s"
  method = "GET"
  path = "/health"

[[vm]]
  size = "shared-cpu-1x"
  memory = "256mb"
```

`auto_stop_machines = "stop"` + `min_machines_running = 0` keeps cost low when idle; first request after idle adds ~1-2s wake time. Acceptable because Anthropic calls already dominate latency.

### `.github/workflows/ci.yml`

Runs on every PR and push to main. Matrix of frontend + backend jobs.

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npx vitest run
      - run: npm run build

  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync
      - run: uv run pytest -v
```

### `.github/workflows/fly-deploy.yml`

```yaml
name: Deploy backend to Fly
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

### `.github/workflows/fly-pr-preview.yml`

Creates an ephemeral Fly app per PR, named `byline-api-pr-<n>`. Uses `flyctl-actions` to deploy on open/sync, destroy on close.

```yaml
name: PR backend preview
on:
  pull_request:
    types: [opened, reopened, synchronize, closed]

jobs:
  preview:
    runs-on: ubuntu-latest
    if: github.event.action != 'closed'
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: |
          APP_NAME="byline-api-pr-${{ github.event.number }}"
          flyctl apps create "$APP_NAME" --org personal || true
          flyctl secrets set \
            ANTHROPIC_API_KEY="${{ secrets.ANTHROPIC_API_KEY }}" \
            SUPABASE_JWKS_URL="${{ secrets.SUPABASE_JWKS_URL_TEST }}" \
            SUPABASE_JWT_AUDIENCE="authenticated" \
            --app "$APP_NAME"
          flyctl deploy --remote-only --app "$APP_NAME"
          echo "PREVIEW_URL=https://$APP_NAME.fly.dev" >> $GITHUB_ENV
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
      - uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `Backend preview: ${process.env.PREVIEW_URL}`
            })

  destroy:
    runs-on: ubuntu-latest
    if: github.event.action == 'closed'
    steps:
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl apps destroy "byline-api-pr-${{ github.event.number }}" --yes
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## Secrets

Each host stores its own.

### Fly.io (set via `fly secrets set`)

| Secret | Value source |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic console |
| `SUPABASE_JWKS_URL` | `https://<prod-ref>.supabase.co/auth/v1/.well-known/jwks.json` |
| `SUPABASE_JWT_AUDIENCE` | `authenticated` |

### Vercel (Project Settings → Environment Variables)

Set both Production and Preview scopes — Production pointed at prod Supabase, Preview pointed at test Supabase.

| Variable | Production value | Preview value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | prod Supabase URL | test Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon key | test anon key |
| `PYTHON_SERVICE_URL` | `https://byline-api.fly.dev` | `https://byline-api-pr-<n>.fly.dev` (set per-preview via PR comment workflow, or use a single staging-ish URL) |

Note on `PYTHON_SERVICE_URL` for previews: since each PR's Fly app has a unique name, the Vercel preview can't statically point at it. Two options:
- (a) Frontend previews use the prod backend URL — riskier (preview frontend hits prod backend, but JWT verification means only signed-in test-Supabase users could even authenticate, which would fail against prod Supabase).
- (b) Frontend previews point at a single fixed staging-style Fly app (`byline-api-staging.fly.dev`) that always runs.

**Decision:** (b). Add a permanent `byline-api-staging.fly.dev` Fly app pointed at the test Supabase project. Vercel preview env points at it. PR-specific Fly apps still exist for backend-only changes but the frontend preview doesn't auto-route to them. Tradeoff: slight extra cost (~$3/month for staging) for simplicity.

This is a deviation from the earlier "no staging" decision but it's lightweight — staging only exists at the backend layer, no separate Supabase, no separate frontend.

### GitHub Actions (repo Settings → Secrets and variables → Actions)

| Secret | Purpose |
|---|---|
| `FLY_API_TOKEN` | From `fly auth token` — lets Actions deploy |
| `ANTHROPIC_API_KEY` | For PR preview Fly apps (passed at create time) |
| `SUPABASE_JWKS_URL_TEST` | Test Supabase JWKS URL, for PR previews |

### What's NOT a secret

`SUPABASE_SERVICE_ROLE_KEY` lives only inside the Supabase Edge Function `delete-account`, which Supabase auto-injects. We never put it in Vercel, Fly, or GitHub Actions.

## Supabase Auth Configuration

The prod Supabase project's Auth settings need to know about our hosted URLs. In the prod Supabase dashboard → Authentication → URL Configuration:

- **Site URL:** `https://byline.vercel.app`
- **Redirect URLs:** `https://byline.vercel.app/auth/callback`, `https://byline-git-*.vercel.app/auth/callback` (wildcard so PR previews work)

Magic link emails will fail to redirect properly if these aren't configured.

## Cutover Sequence

The order of operations to go from "this branch is mergeable" to "live on the internet."

### 1. Prepare the prod Supabase project (5 min)

Switch CLI link to prod, apply migrations, deploy Edge Function, switch back:

```bash
supabase link --project-ref <byline-prod-ref>
supabase db push                                     # applies 0001, 0002, 0003
supabase functions deploy delete-account             # deploys delete-account
supabase link --project-ref idmtuzubldwrypngkikv     # re-link to test for daily dev
```

Verify in the prod Supabase dashboard that `entries` and `settings` tables exist with RLS enabled.

### 2. Add Dockerfile + fly.toml (one PR) (10 min)

Open a PR with the two infra files. Don't deploy yet. CI should run and pass on this PR even before Fly is involved.

### 3. Manual first deploy to Fly (10 min)

Before wiring CI, run the first deploy by hand to make sure the image actually works:

```bash
fly auth login
fly launch --no-deploy --copy-config --name byline-api
fly secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  SUPABASE_JWKS_URL=https://<prod-ref>.supabase.co/auth/v1/.well-known/jwks.json \
  SUPABASE_JWT_AUDIENCE=authenticated
fly deploy
curl https://byline-api.fly.dev/health   # expect {"status":"ok"}
```

Repeat for the staging app: `fly launch --no-deploy --copy-config --name byline-api-staging` with test-Supabase secrets.

### 4. Add GitHub Actions (15 min)

Add the three workflow files. Push `FLY_API_TOKEN`, `ANTHROPIC_API_KEY`, and `SUPABASE_JWKS_URL_TEST` to GitHub repo secrets.

### 5. Connect Vercel (10 min)

In the Vercel dashboard:
- New Project → import the GitHub repo
- Root directory: `frontend`
- Add Production env vars (prod Supabase URL/anon, `PYTHON_SERVICE_URL=https://byline-api.fly.dev`)
- Add Preview env vars (test Supabase URL/anon, `PYTHON_SERVICE_URL=https://byline-api-staging.fly.dev`)
- First deploy — confirm `https://byline.vercel.app` loads `/sign-in`

Update prod Supabase Auth → URL Configuration with the Site URL and Redirect URL patterns above.

### 6. Smoke test against prod (10 min)

In a fresh browser profile, hit `https://byline.vercel.app` and run through the manual QA list (sign-in, write an entry, settings, sign-out). Your dev localStorage won't migrate — that's expected (different domain). You're the first prod user.

### 7. Enforce CI on `main` (2 min)

GitHub repo → Settings → Branches → Add branch protection rule for `main`:
- Require status checks to pass before merging
- Required checks: `frontend`, `backend`

### 8. Write `DEPLOY.md` runbook (15 min)

Repo root. Covers:
- Rotating a secret (Fly: `fly secrets set NAME=value`; Vercel: dashboard)
- Viewing logs (`fly logs --app byline-api`; Vercel dashboard → Deployments → Functions tab)
- Rolling back (Fly: `fly releases` → `fly deploy --image <previous-tag>`; Vercel: dashboard → previous deployment → "Promote to Production")
- Applying a new DB migration to prod (manual: `supabase link --project-ref <prod>` → `supabase db push` → `supabase link --project-ref <test>`)

**Total time:** ~75 minutes if nothing surprises. Plan for double on the first attempt.

## Out of Scope

- **Custom domain.** Defer until after first prod traffic. Switching is one Vercel env var + DNS records on whoever you buy the domain from.
- **Staging environment beyond a single Fly backend app.** PR previews fill the role for the frontend.
- **Automated prod DB migrations from CI.** Too risky for a solo project; manual until there's a real review/approval gate.
- **Sentry / observability.** Separate backlog item. `fly logs` and Vercel's built-in log viewer are the baseline.
- **Rate limiting, cost tracking, BYOK.** Separate backlog items.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Prod Supabase Auth URL Configuration forgotten → magic links go to wrong domain or fail entirely | Explicitly listed in Step 5 of cutover; smoke test in Step 6 will catch it |
| Fly cold-start adds latency on first request | Auto-stop is acceptable because Anthropic API latency already dominates (~3s); if it becomes a UX problem, set `min_machines_running = 1` (~$3/month) |
| PR preview Fly apps accumulate cost if not destroyed properly | Action destroys on PR close; backstop is periodic `fly apps list` audit; long-stale PRs auto-close after some time on most workflows |
| Vercel preview env hits prod Supabase by accident → leaks/pollutes prod data | Strict separation of Preview vs Production env vars in Vercel; preview points at test Supabase |
| Service role key leaks | Never stored outside the Supabase Edge Function. Auto-injected by Supabase. Audited by virtue of being absent from every other host |
| Secrets in repo by mistake | `.gitignore` excludes `.env`, `.env.local`, `.supabase/`. The GitHub Action only consumes secrets via `${{ secrets.NAME }}` references, never inlined |

## What Success Looks Like

- `https://byline.vercel.app` loads `/sign-in` for a signed-out visitor.
- Magic link email arrives within 30s, click lands you on `/`.
- Writing an entry persists across browser sessions and devices.
- Settings/coach/brag-doc all work against prod Supabase + prod Fly backend.
- A pushed PR creates a preview URL within 5 minutes; merging deploys to prod within 5 minutes.
- A failing test blocks merge.
