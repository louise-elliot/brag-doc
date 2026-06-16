-- One row per LLM call, for cost tracking and the admin dashboard.
create table public.llm_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users(id) on delete set null,
  endpoint      text not null,        -- 'coach_turn' | 'coach_reframe' | 'brag_doc'
  model         text not null,
  input_tokens  int  not null,
  output_tokens int  not null,
  cost_usd      numeric(12,6) not null,
  latency_ms    int  not null,
  request_id    text,
  day           date not null default (now() at time zone 'utc')::date,
  created_at    timestamptz not null default now()
);
create index llm_usage_day_idx on public.llm_usage (day);

alter table public.llm_usage enable row level security;
-- No policies: only the service role (which bypasses RLS) reads/writes this table.

-- Budget-cap pre-check: total estimated spend for a UTC day.
create or replace function public.daily_spend_usd(p_day date)
returns numeric language sql security definer set search_path = public as $$
  select coalesce(sum(cost_usd), 0) from public.llm_usage where day = p_day;
$$;

-- Dashboard: per-day totals for the last p_days days (inclusive of today).
create or replace function public.daily_cost_series(p_days int)
returns table (day date, cost_usd numeric, request_count bigint)
language sql security definer set search_path = public as $$
  select day, sum(cost_usd) as cost_usd, count(*) as request_count
  from public.llm_usage
  where day >= (current_date - (p_days - 1))
  group by day order by day;
$$;

-- Dashboard: breakdown by endpoint + model since a date.
create or replace function public.cost_breakdown(p_since date)
returns table (endpoint text, model text, cost_usd numeric, request_count bigint,
               input_tokens bigint, output_tokens bigint)
language sql security definer set search_path = public as $$
  select endpoint, model, sum(cost_usd) as cost_usd, count(*) as request_count,
         sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens
  from public.llm_usage
  where day >= p_since
  group by endpoint, model order by cost_usd desc;
$$;

-- Only the backend (service role) may call these.
revoke execute on function public.daily_spend_usd(date) from public, anon, authenticated;
revoke execute on function public.daily_cost_series(integer) from public, anon, authenticated;
revoke execute on function public.cost_breakdown(date) from public, anon, authenticated;
grant execute on function public.daily_spend_usd(date) to service_role;
grant execute on function public.daily_cost_series(integer) to service_role;
grant execute on function public.cost_breakdown(date) to service_role;
