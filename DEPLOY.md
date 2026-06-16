# Deploy and Operations Runbook

## Hosts

- **Frontend (prod):** Vercel — `https://byline-beige.vercel.app`
- **Backend (prod):** Fly.io — `https://byline-api.fly.dev` (region `lhr`)
- **Backend (staging):** Fly.io — `https://byline-api-staging.fly.dev`
- **Database + auth:** Supabase
  - prod: `sayjxhiikkoaknkckxav.supabase.co`
  - test: `idmtuzubldwrypngkikv.supabase.co`

## Routine deploys

Push to `main` → CI runs (vitest, lint, tsc, build, pytest) → Vercel auto-deploys frontend → Fly Action auto-deploys backend. No manual steps.

PR → CI runs on the PR → Vercel creates a frontend preview at `byline-beige-git-<branch>.vercel.app` → Fly Action creates `byline-api-pr-<n>.fly.dev`. Both destroy on PR close.

Branch protection on `main` requires CI green before merge.

## Secrets

### Rotate `ANTHROPIC_API_KEY`

```bash
fly secrets set ANTHROPIC_API_KEY='sk-ant-new-key' --app byline-api
fly secrets set ANTHROPIC_API_KEY='sk-ant-new-key' --app byline-api-staging
# Also update the GitHub repo secret `ANTHROPIC_API_KEY` so PR previews get the new key
```

**Important:** always use single quotes around values, and paste on a single line. Newlines in secret values cause hard-to-diagnose runtime errors.

### Rotate Supabase JWKS URL (rare — only if migrating projects)

```bash
fly secrets set SUPABASE_JWKS_URL='https://<new-ref>.supabase.co/auth/v1/.well-known/jwks.json' --app byline-api
```

### Configure rate-limiting secrets

The backend enforces per-user daily AI request caps, backed by a Postgres counter it reaches via PostgREST using the service-role key. Set these on each backend app:

```bash
fly secrets set SUPABASE_URL='https://<ref>.supabase.co' SUPABASE_SERVICE_ROLE_KEY='<service-role-key>' --app byline-api
fly secrets set SUPABASE_URL='https://<ref>.supabase.co' SUPABASE_SERVICE_ROLE_KEY='<service-role-key>' --app byline-api-staging
```

Find the service-role key in the Supabase dashboard → Project Settings → API. If these are unset the backend fails open (requests are allowed). Optional per-endpoint daily caps override the defaults (coach turn 30, reframe 3, brag doc 2):

```bash
fly secrets set RATE_LIMIT_COACH_TURN='30' RATE_LIMIT_COACH_REFRAME='3' RATE_LIMIT_BRAG_DOC='2' --app byline-api
```

Requires migration `0005_usage_counters` applied to the target Supabase project (see "Apply a new DB migration to prod").

### Cost tracking / admin dashboard

```bash
fly secrets set DAILY_BUDGET_USD='5.00' ADMIN_EMAILS='you@example.com' --app byline-api
fly secrets set DAILY_BUDGET_USD='5.00' ADMIN_EMAILS='you@example.com' --app byline-api-staging
```

`DAILY_BUDGET_USD` is the service-wide daily spend ceiling; once a day's estimated LLM cost reaches it, the AI endpoints return 503 until the next UTC day (fails open if the spend store is unreachable). `ADMIN_EMAILS` gates the `/admin` cost dashboard. Requires migration `0006_llm_usage` applied (see the migration section).

## Logs

- **Backend prod:** `fly logs --app byline-api`
- **Backend staging:** `fly logs --app byline-api-staging`
- **Frontend:** Vercel dashboard → Project → Logs tab (filter to Functions / Runtime)
- **Edge Functions:** Supabase dashboard → Functions → `delete-account` → Logs

## Roll back

### Backend (Fly)

```bash
fly releases --app byline-api               # find previous version
fly deploy --image registry.fly.io/byline-api:deployment-<id> --app byline-api
```

Simpler — revert the offending commit on `main`; the deploy Action re-deploys the previous code:

```bash
git revert <bad-commit-sha>
git push
```

### Frontend (Vercel)

Vercel dashboard → Deployments → find the previous good deployment → ⋯ → **Promote to Production**. Instant.

## Apply a new DB migration to prod

NEVER apply migrations from CI. Always manually.

```bash
cd <repo-root>
supabase link --project-ref sayjxhiikkoaknkckxav
supabase db push
supabase link --project-ref idmtuzubldwrypngkikv   # re-link to test for daily dev
```

## Deploy or update a Supabase Edge Function

```bash
supabase link --project-ref sayjxhiikkoaknkckxav
supabase functions deploy <function-name>
supabase link --project-ref idmtuzubldwrypngkikv
```

## Cost monitoring

- **Fly:** `fly dashboard byline-api` (web UI shows usage and bill)
- **Vercel:** dashboard → Settings → Usage
- **Supabase:** dashboard → Settings → Usage. Free tier covers 500MB DB + 50k MAU.
- **Anthropic:** console.anthropic.com → Usage. Set a hard budget cap there as a backstop.

## Common gotchas

- **Magic-link emails landing in spam.** Default Supabase sender has a poor reputation. Configure custom SMTP (Resend / Postmark) before opening to real users.
- **Supabase free-tier auth rate limit.** 4 emails/hour, plus a per-email cooldown. If running E2E tests in CI, throttle or batch.
- **Newline in `fly secrets set` values.** Multi-line shell paste can sneak a `\n` into a secret. Always single-line, single-quoted. Symptom: `httpx.InvalidURL: Invalid non-printable ASCII character`.
- **Vercel env vars require a redeploy** to take effect on existing deployments. Setting an env var doesn't reapply to running instances.
- **Supabase Auth URL Configuration must include both bare prod URL and preview wildcard.** Otherwise sign-in works locally but fails silently from preview URLs.

## Log forwarding (Axiom)

The backend emits structured JSON logs to stdout (one object per line: request id, user id, endpoint, latency, token usage, cost). Forwarding is done at the infra layer so the request path never depends on the log vendor.

1. Create an Axiom dataset (e.g. `byline`) and an API token with ingest permission.
2. Deploy the community fly-log-shipper, configured for the Axiom sink:

```bash
git clone https://github.com/superfly/fly-log-shipper && cd fly-log-shipper
fly launch --no-deploy
fly secrets set ORG=<your-fly-org> ACCESS_TOKEN=<fly-api-token> \
  AXIOM_TOKEN=<axiom-ingest-token> AXIOM_DATASET=byline --app <shipper-app-name>
fly deploy
```

The shipper reads the org's logs (including `byline-api`) and forwards them to Axiom. No application redeploy is needed; if Axiom is down, the API is unaffected.
