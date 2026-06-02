# Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take Byline live on hosted infrastructure: Vercel (frontend), Fly.io (FastAPI backend), prod Supabase, with GitHub Actions CI required to merge and per-PR backend previews.

**Architecture:** Vercel auto-deploys the Next.js frontend on push to `main` and creates previews per PR. Fly.io hosts the FastAPI service in region `lhr`; a GitHub Action deploys to prod on push to `main` and creates ephemeral per-PR Fly apps. A single always-on `byline-api-staging.fly.dev` Fly app exists at the backend layer (pointed at the test Supabase project) so Vercel previews have a stable backend to call. Prod Supabase schema and Edge Functions are pushed manually from the developer's local Supabase CLI.

**Tech Stack:** Fly.io + Docker + Vercel + GitHub Actions + Supabase CLI.

**Note on manual vs. automatable tasks:** Several tasks below require actions in vendor dashboards or interactive CLI logins (Vercel, Fly, Supabase, GitHub repo settings). Those are explicitly marked **`[MANUAL]`**. Subagents cannot do them.

**Note on commits:** The user prefers manual git commits. Commit steps below show the suggested message and files — pause for the user to commit rather than committing autonomously.

---

## File Structure Overview

### New files

- `backend/Dockerfile` — Python 3.12-slim image, uv-installed deps, runs uvicorn
- `backend/.dockerignore` — excludes `__pycache__`, `tests/`, `.venv`
- `fly.toml` (repo root) — Fly app config
- `.github/workflows/ci.yml` — frontend + backend test/lint/typecheck/build matrix
- `.github/workflows/fly-deploy.yml` — backend prod deploy on push to main
- `.github/workflows/fly-pr-preview.yml` — per-PR Fly app create/deploy/destroy
- `DEPLOY.md` (repo root) — runbook: secrets, logs, rollback, prod migrations

### No code changes to existing files

This is a pure infrastructure change. App code is unchanged.

---

## Phase 1 — Prod Supabase prep

### Task 1: `[MANUAL]` Apply migrations and Edge Function to prod Supabase

**Files:**
- No files changed in this task; this is a CLI operation that updates the prod Supabase project's schema.

This is user-only because it touches the linked Supabase CLI session and the prod project.

- [ ] **Step 1: Re-link Supabase CLI to the prod project**

From repo root, run:

```
supabase link --project-ref <byline-prod-ref>
```

`<byline-prod-ref>` is the project ref of the `byline-prod` Supabase project. Find it in the Supabase dashboard URL (e.g. `https://supabase.com/dashboard/project/<ref>`).

Expected: CLI prompts for the prod project's DB password (you saved this when creating the project). After link succeeds, the CLI is now pointed at prod.

- [ ] **Step 2: Apply the schema migrations**

```
supabase db push
```

Expected output: `Applying migration 0001_initial_schema.sql`, `0002_rls_policies.sql`, `0003_migrate_localstorage_fn.sql`. No errors.

- [ ] **Step 3: Deploy the delete-account Edge Function**

```
supabase functions deploy delete-account
```

Expected: `Deployed Functions on project <ref>: delete-account`.

- [ ] **Step 4: Verify in the prod dashboard**

Open `https://supabase.com/dashboard/project/<byline-prod-ref>`.
- Table Editor → confirm `entries` and `settings` exist
- Auth → Policies → confirm 4 policies on each table
- Functions → confirm `delete-account` is deployed

- [ ] **Step 5: Re-link CLI back to the test project for daily dev**

```
supabase link --project-ref idmtuzubldwrypngkikv
```

Expected: re-linked. From here on, regular `supabase db push` during development applies to test, not prod.

---

## Phase 2 — Backend container + Fly config

### Task 2: Add the Dockerfile

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

- [ ] **Step 1: Create the Dockerfile**

Create `backend/Dockerfile`:

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

- [ ] **Step 2: Create the .dockerignore**

Create `backend/.dockerignore`:

```
__pycache__/
*.pyc
*.pyo
*.pyd
.venv/
.pytest_cache/
tests/
.env
.env.*
```

- [ ] **Step 3: Build the image locally to verify**

From repo root:

```
docker build -f backend/Dockerfile -t byline-api-local .
```

Expected: image builds. (If Docker isn't installed locally, skip this step — Fly will build remotely.)

- [ ] **Step 4: Commit**

```
git add backend/Dockerfile backend/.dockerignore
git commit -m "feat(backend): add Dockerfile for Fly.io deploy"
```

---

### Task 3: Add fly.toml

**Files:**
- Create: `fly.toml` (repo root)

- [ ] **Step 1: Create fly.toml**

Create `fly.toml` at the repo root:

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

- [ ] **Step 2: Commit**

```
git add fly.toml
git commit -m "feat: add fly.toml for prod backend deploy"
```

---

## Phase 3 — Manual first deploys to Fly

### Task 4: `[MANUAL]` First prod deploy to Fly

This validates the Dockerfile + fly.toml work before wiring up CI.

- [ ] **Step 1: Install flyctl and authenticate**

```
brew install flyctl
fly auth login
```

Expected: browser opens; you authorize the CLI.

- [ ] **Step 2: Create the prod Fly app**

From repo root:

```
fly launch --no-deploy --copy-config --name byline-api --org personal --region lhr
```

Expected: creates the Fly app `byline-api` using the committed `fly.toml`. Does NOT deploy yet.

If prompted "Would you like to copy its configuration to the new app?", answer YES. If asked about Postgres / Redis / etc., answer NO to all.

- [ ] **Step 3: Set production secrets on Fly**

```
fly secrets set \
  ANTHROPIC_API_KEY="sk-ant-..." \
  SUPABASE_JWKS_URL="https://<byline-prod-ref>.supabase.co/auth/v1/.well-known/jwks.json" \
  SUPABASE_JWT_AUDIENCE="authenticated" \
  --app byline-api
```

Substitute the real Anthropic key and prod Supabase ref.

Expected: `Secrets are staged for the first deployment`.

- [ ] **Step 4: First deploy**

```
fly deploy --app byline-api --remote-only
```

Expected: builds image remotely on Fly's builders, deploys, healthcheck passes. Outputs the app URL.

- [ ] **Step 5: Verify /health**

```
curl https://byline-api.fly.dev/health
```

Expected: `{"status":"ok"}`.

- [ ] **Step 6: Verify auth rejection**

```
curl -X POST https://byline-api.fly.dev/coach/turn -H "Content-Type: application/json" -d '{}'
```

Expected: HTTP 401 `{"detail":"missing token"}`. This confirms JWT verification is wired.

If any step fails, iterate on the Dockerfile / fly.toml locally before continuing.

---

### Task 5: `[MANUAL]` First staging deploy to Fly

A permanent always-on backend app pointed at the test Supabase project. Vercel previews call it.

- [ ] **Step 1: Create the staging Fly app**

```
fly launch --no-deploy --copy-config --name byline-api-staging --org personal --region lhr
```

Expected: creates `byline-api-staging`. Same fly.toml is reused.

- [ ] **Step 2: Set staging secrets (pointed at test Supabase)**

```
fly secrets set \
  ANTHROPIC_API_KEY="sk-ant-..." \
  SUPABASE_JWKS_URL="https://idmtuzubldwrypngkikv.supabase.co/auth/v1/.well-known/jwks.json" \
  SUPABASE_JWT_AUDIENCE="authenticated" \
  --app byline-api-staging
```

- [ ] **Step 3: Deploy**

```
fly deploy --app byline-api-staging --remote-only
```

- [ ] **Step 4: Verify**

```
curl https://byline-api-staging.fly.dev/health
```

Expected: `{"status":"ok"}`.

---

## Phase 4 — GitHub Actions

### Task 6: Add the CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the directory if it doesn't exist**

From repo root:

```
mkdir -p .github/workflows
```

- [ ] **Step 2: Create ci.yml**

Create `.github/workflows/ci.yml`:

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

- [ ] **Step 3: Commit and push to a feature branch**

```
git checkout -b ci-setup
git add .github/workflows/ci.yml
git commit -m "ci: add lint/test/typecheck/build for frontend and backend"
git push -u origin ci-setup
```

- [ ] **Step 4: Open a PR and verify CI runs**

```
gh pr create --title "ci: add GitHub Actions" --body "Adds the CI workflow"
```

Expected: GitHub Actions tab shows `CI` running with two jobs (`frontend`, `backend`). Both must pass before merging.

If a job fails, fix the underlying issue. Do NOT skip checks or disable the workflow.

- [ ] **Step 5: Merge the PR**

After CI passes, merge via the GitHub UI.

---

### Task 7: `[MANUAL]` Add Fly API token to GitHub repo secrets

The deploy workflows need a token to authenticate to Fly.

- [ ] **Step 1: Generate a Fly auth token**

```
fly auth token
```

Copy the output (long string starting with `fm1_` or similar).

- [ ] **Step 2: Add to GitHub repo secrets**

Open the repo on GitHub → Settings → Secrets and variables → Actions → New repository secret.

Add:
- **Name:** `FLY_API_TOKEN`
- **Value:** the token from Step 1

- [ ] **Step 3: Add `ANTHROPIC_API_KEY` and `SUPABASE_JWKS_URL_TEST` secrets**

Same UI, two more secrets:
- `ANTHROPIC_API_KEY` — your Anthropic key
- `SUPABASE_JWKS_URL_TEST` — `https://idmtuzubldwrypngkikv.supabase.co/auth/v1/.well-known/jwks.json`

These are used by the PR preview workflow to provision per-PR Fly apps.

---

### Task 8: Add the prod backend deploy workflow

**Files:**
- Create: `.github/workflows/fly-deploy.yml`

- [ ] **Step 1: Create fly-deploy.yml**

Create `.github/workflows/fly-deploy.yml`:

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
      - run: flyctl deploy --app byline-api --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

- [ ] **Step 2: Commit on a feature branch, open PR, merge after CI passes**

```
git checkout -b fly-deploy-workflow
git add .github/workflows/fly-deploy.yml
git commit -m "ci: auto-deploy backend to Fly on push to main"
git push -u origin fly-deploy-workflow
gh pr create --title "ci: backend prod deploy on main" --body "Adds auto-deploy on push to main"
```

Wait for CI green, then merge.

- [ ] **Step 3: Verify the merge triggered a deploy**

After merging, open GitHub Actions tab. A new `Deploy backend to Fly` run should appear. Wait for it to complete.

Expected: completes green; `fly status --app byline-api` shows a new release.

```
fly status --app byline-api
```

---

### Task 9: Add the PR preview workflow

**Files:**
- Create: `.github/workflows/fly-pr-preview.yml`

- [ ] **Step 1: Create fly-pr-preview.yml**

Create `.github/workflows/fly-pr-preview.yml`:

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
      - name: Deploy preview
        id: deploy
        run: |
          APP_NAME="byline-api-pr-${{ github.event.number }}"
          flyctl apps create "$APP_NAME" --org personal || true
          flyctl secrets set \
            ANTHROPIC_API_KEY="${{ secrets.ANTHROPIC_API_KEY }}" \
            SUPABASE_JWKS_URL="${{ secrets.SUPABASE_JWKS_URL_TEST }}" \
            SUPABASE_JWT_AUDIENCE="authenticated" \
            --app "$APP_NAME" --stage
          flyctl deploy --remote-only --app "$APP_NAME"
          echo "preview_url=https://$APP_NAME.fly.dev" >> $GITHUB_OUTPUT
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
      - name: Comment preview URL
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `Backend preview: ${{ steps.deploy.outputs.preview_url }}`
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

- [ ] **Step 2: Commit on a feature branch and open a PR**

```
git checkout -b pr-preview-workflow
git add .github/workflows/fly-pr-preview.yml
git commit -m "ci: per-PR Fly preview deploys"
git push -u origin pr-preview-workflow
gh pr create --title "ci: PR preview Fly apps" --body "Creates an ephemeral Fly app per PR for backend previews"
```

- [ ] **Step 3: Verify the preview workflow runs on its own PR**

Watch the GitHub Actions tab. The new workflow should trigger, create `byline-api-pr-<n>.fly.dev`, deploy it, and post a comment on the PR with the URL.

Verify the URL:

```
curl https://byline-api-pr-<n>.fly.dev/health
```

Expected: `{"status":"ok"}`.

- [ ] **Step 4: Merge after CI passes**

Merge via GitHub UI. After merging, watch that the `destroy` job runs and deletes the preview app:

```
fly apps list | grep pr
```

Expected: no `byline-api-pr-<n>` in the list.

---

## Phase 5 — Vercel + Supabase config

### Task 10: `[MANUAL]` Connect Vercel and set env vars

- [ ] **Step 1: Create the Vercel project**

Open `https://vercel.com/new`. Import the GitHub repo for this project.

Configuration:
- **Framework Preset:** Next.js (auto-detected)
- **Root Directory:** `frontend`
- **Build & Output Settings:** defaults
- **Install Command:** `npm ci`

Click "Deploy" — first deploy will likely fail because env vars aren't set yet. That's expected.

- [ ] **Step 2: Set Production environment variables**

In Vercel dashboard → Project → Settings → Environment Variables. Set these for the **Production** environment:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<byline-prod-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the prod project's anon key |
| `PYTHON_SERVICE_URL` | `https://byline-api.fly.dev` |

- [ ] **Step 3: Set Preview environment variables**

For the **Preview** environment, set:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://idmtuzubldwrypngkikv.supabase.co` (test project) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | test project's anon key |
| `PYTHON_SERVICE_URL` | `https://byline-api-staging.fly.dev` |

- [ ] **Step 4: Redeploy production**

Vercel dashboard → Deployments → latest → ⋯ → Redeploy.

Expected: succeeds, production URL is `https://<project-name>.vercel.app` (note the name Vercel assigned).

- [ ] **Step 5: Visit the deployed URL**

Open the URL in your browser.

Expected: redirects to `/sign-in` (proxy.ts is doing its job).

---

### Task 11: `[MANUAL]` Configure prod Supabase Auth URLs

Magic-link emails need to know where to redirect users.

- [ ] **Step 1: Open prod Supabase Auth settings**

Supabase dashboard for the prod project → Authentication → URL Configuration.

- [ ] **Step 2: Set Site URL**

```
https://<your-vercel-prod-url>.vercel.app
```

Use the actual production URL from Task 10 Step 4.

- [ ] **Step 3: Add Redirect URLs**

In the "Redirect URLs" list, add:

```
https://<your-vercel-prod-url>.vercel.app/auth/callback
https://<your-vercel-prod-url>-git-*.vercel.app/auth/callback
```

The wildcard pattern matches Vercel's PR preview URLs (e.g. `<project>-git-my-branch.vercel.app`).

Save.

- [ ] **Step 4: Also configure the test Supabase project for previews**

In the test Supabase project (`idmtuzubldwrypngkikv`) → Authentication → URL Configuration, add the same patterns. Vercel previews use the test project for auth, so its redirect list also needs to know about them.

(If localhost development is broken by changing the Site URL, you can leave Site URL pointed at `http://localhost:3000` and just add the Vercel URLs to Redirect URLs. Auth callback uses the Redirect URLs list, not the Site URL, for the actual redirect.)

---

## Phase 6 — Smoke test and branch protection

### Task 12: `[MANUAL]` Smoke test the prod deploy end-to-end

Open `https://<your-vercel-prod-url>.vercel.app` in a fresh browser profile or incognito window.

- [ ] **Step 1: Sign-in flow**

Visit the URL → expect redirect to `/sign-in`. Enter your real email. Click "Send magic link."

Wait for the email (usually 10-30s). Click the link. Expect to land on `/` signed in.

- [ ] **Step 2: Save an entry**

Write a test entry. Save. Confirm it appears in the entry list.

- [ ] **Step 3: Coach + brag doc**

Open coach panel, do one turn, accept the reframe. Switch to Brag Doc tab, generate, confirm output.

- [ ] **Step 4: Settings**

Open Settings → confirm your email shows under Account. Change coaching style. Reload. Confirm it persisted (now in Supabase prod).

- [ ] **Step 5: Sign out, sign back in**

Sign out → redirect to `/sign-in`. Sign back in with the same email. Expect your entry still there.

- [ ] **Step 6: Verify in Supabase dashboard**

Open Supabase prod → Table Editor → `entries`. Confirm your test entry row exists with your user_id.

If any step fails, debug before continuing. The most likely failure is forgotten Auth URL Configuration (Task 11) — magic link redirects to the wrong domain.

---

### Task 13: `[MANUAL]` Enforce CI on main via branch protection

- [ ] **Step 1: Open branch protection settings**

GitHub repo → Settings → Branches → Branch protection rules → Add rule.

- [ ] **Step 2: Configure the rule**

- **Branch name pattern:** `main`
- **Require a pull request before merging:** ON
- **Require status checks to pass before merging:** ON
  - Status checks: `frontend`, `backend`
- **Require branches to be up to date before merging:** ON
- Save.

- [ ] **Step 3: Verify**

Try to merge a PR with failing CI (open a tiny PR that breaks a test, push it, attempt merge). GitHub should block the merge button.

Close that throwaway PR.

---

## Phase 7 — Documentation

### Task 14: Write the DEPLOY.md runbook

**Files:**
- Create: `DEPLOY.md` (repo root)

- [ ] **Step 1: Create DEPLOY.md**

Create `DEPLOY.md`:

```markdown
# Deploy and Operations Runbook

## Hosts

- **Frontend (prod):** Vercel — `https://<vercel-prod-url>.vercel.app`
- **Backend (prod):** Fly.io — `https://byline-api.fly.dev` (region `lhr`)
- **Backend (staging):** Fly.io — `https://byline-api-staging.fly.dev`
- **Database + auth:** Supabase
  - prod: `<byline-prod-ref>.supabase.co`
  - test: `idmtuzubldwrypngkikv.supabase.co`

## Routine deploys

Push to `main` → CI runs → Vercel auto-deploys frontend → Fly Action auto-deploys backend. No manual steps.

PR → CI runs on the PR → Vercel creates a frontend preview at `<project>-git-<branch>.vercel.app` → Fly Action creates `byline-api-pr-<n>.fly.dev`. Both destroy on PR close.

## Secrets

### Rotate `ANTHROPIC_API_KEY`

```
fly secrets set ANTHROPIC_API_KEY="sk-ant-new-key" --app byline-api
fly secrets set ANTHROPIC_API_KEY="sk-ant-new-key" --app byline-api-staging
# Also update the GitHub repo secret `ANTHROPIC_API_KEY` so PR previews get the new key
```

### Rotate Supabase JWKS URL (rare — only if migrating projects)

```
fly secrets set SUPABASE_JWKS_URL="https://<new-ref>.supabase.co/auth/v1/.well-known/jwks.json" --app byline-api
```

## Logs

- **Backend prod:** `fly logs --app byline-api`
- **Backend staging:** `fly logs --app byline-api-staging`
- **Frontend:** Vercel dashboard → Deployments → latest → Functions / Logs tab
- **Edge Functions:** Supabase dashboard → Functions → `delete-account` → Logs

## Roll back

### Backend (Fly)

```
fly releases --app byline-api                   # find previous version number
fly deploy --image registry.fly.io/byline-api:deployment-<version> --app byline-api
```

Or simpler — revert the offending commit on `main`; the deploy Action will re-deploy the previous code.

### Frontend (Vercel)

Vercel dashboard → Deployments → find the previous good deployment → ⋯ → "Promote to Production." Instant.

## Apply a new DB migration to prod

```
cd <repo-root>
supabase link --project-ref <byline-prod-ref>
supabase db push
supabase link --project-ref idmtuzubldwrypngkikv   # re-link to test for daily dev
```

NEVER apply migrations from CI. Always manually.

## Deploy a new Edge Function or update an existing one

```
supabase link --project-ref <byline-prod-ref>
supabase functions deploy <function-name>
supabase link --project-ref idmtuzubldwrypngkikv
```

## Cost monitoring

- **Fly:** `fly dashboard byline-api` (web UI shows usage and bill)
- **Vercel:** dashboard → Settings → Usage
- **Supabase:** dashboard → Settings → Usage. Free tier covers 500MB DB + 50k MAU.
- **Anthropic:** console.anthropic.com → Usage. Set a hard budget cap there as a backstop.
```

- [ ] **Step 2: Commit and merge via PR**

```
git checkout -b deploy-runbook
git add DEPLOY.md
git commit -m "docs: add deploy and operations runbook"
git push -u origin deploy-runbook
gh pr create --title "docs: deploy runbook" --body "Adds DEPLOY.md"
```

Wait for CI, merge.

---

## Phase 8 — Final verification

### Task 15: Verify everything end-to-end

- [ ] **Step 1: Confirm all required infrastructure exists**

Run these and confirm each succeeds:

```
fly apps list                                                       # byline-api and byline-api-staging both present
curl https://byline-api.fly.dev/health                              # {"status":"ok"}
curl https://byline-api-staging.fly.dev/health                      # {"status":"ok"}
curl https://<vercel-prod-url>.vercel.app/sign-in -I                # 200 OK
```

- [ ] **Step 2: Confirm CI is green on main**

GitHub Actions tab → latest run on `main` → all green.

- [ ] **Step 3: Confirm branch protection is active**

Repo → Settings → Branches → main rule exists with required status checks.

- [ ] **Step 4: One final sign-in to prod**

Open `https://<vercel-prod-url>.vercel.app` in a fresh browser. Sign in. Write one entry. Sign out.

Open Supabase prod → Table Editor → `entries` → confirm the row.

- [ ] **Step 5: Make a deliberate test PR to exercise the full pipeline**

```
git checkout -b deploy-verify-test
echo "# verify deploy pipeline" >> README.md
git add README.md
git commit -m "test: verify deploy pipeline end-to-end"
git push -u origin deploy-verify-test
gh pr create --title "test: verify deploy pipeline" --body "Exercises CI, Vercel preview, Fly preview"
```

Watch:
- CI runs and passes on the PR
- Vercel posts a preview URL in PR comments
- Fly Action posts a preview URL in PR comments

Click both preview URLs and confirm they load. Then close the PR (without merging — this isn't a real change). Confirm:
- Vercel preview gets deleted automatically
- `fly apps list | grep pr` shows no `byline-api-pr-<n>`

- [ ] **Step 6: Done**

Everything is live. You can now invite real users.

---

## Self-review notes

**Spec coverage check:**
- Architecture and topology → Tasks 2, 3, 4, 5, 10 (the infrastructure files + manual setup of each host)
- CI/CD flow → Tasks 6, 8, 9 (the three workflow files)
- Files added → All seven listed files are created across Tasks 2, 3, 6, 8, 9, 14
- Secrets table → Task 4 Step 3, Task 5 Step 2, Task 7, Task 10 Steps 2-3
- Supabase Auth URL Configuration → Task 11
- Cutover sequence → Mirrored in Phases 1-7 in plan order
- Risks and mitigations → Embedded as warnings throughout (e.g. Task 11 mentions the most likely failure mode; Task 8 mentions auto-stop tradeoff is acceptable)

**Known gaps:**
- The frontend doesn't have a test specifically verifying the new Vercel preview env works against the staging Fly backend. The Task 15 Step 5 throwaway PR is the verification.
- The PR preview Fly Action doesn't include CORS-allow logic on the backend — but it doesn't need to, since the Fly app accepts requests from any origin (FastAPI default). If we later add CORS restrictions, the preview origin pattern would need to be allowlisted.
- Plan assumes `gh` CLI is installed for PR creation. If not, swap any `gh pr create` step for "open the PR via the GitHub web UI."
