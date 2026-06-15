-- Per-user, per-endpoint, per-day request counters for rate limiting.
create table public.usage_counters (
  user_id   uuid not null references auth.users(id) on delete cascade,
  endpoint  text not null,          -- 'coach_turn' | 'coach_reframe' | 'brag_doc'
  day       date not null,          -- UTC calendar day
  request_count int  not null default 0,
  primary key (user_id, endpoint, day)
);

alter table public.usage_counters enable row level security;
-- No policies: only the service role (which bypasses RLS) touches this table.

-- Atomic check-then-increment. Returns whether the request is allowed (i.e. the
-- count was below p_limit) and the resulting count. Blocked requests do NOT increment.
create or replace function public.increment_usage(
  p_user_id  uuid,
  p_endpoint text,
  p_day      date,
  p_limit    int
)
returns table (allowed boolean, request_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.usage_counters (user_id, endpoint, day, request_count)
  values (p_user_id, p_endpoint, p_day, 0)
  on conflict (user_id, endpoint, day) do nothing;

  select c.request_count into v_count
  from public.usage_counters c
  where c.user_id = p_user_id and c.endpoint = p_endpoint and c.day = p_day
  for update;

  if v_count >= p_limit then
    return query select false, v_count;
    return;
  end if;

  update public.usage_counters c
  set request_count = c.request_count + 1
  where c.user_id = p_user_id and c.endpoint = p_endpoint and c.day = p_day
  returning c.request_count into v_count;

  return query select true, v_count;
end;
$$;

-- Only the backend (service role) may call this. Prevent users invoking it directly.
revoke execute on function public.increment_usage(uuid, text, date, int) from public, anon, authenticated;
grant execute on function public.increment_usage(uuid, text, date, int) to service_role;
