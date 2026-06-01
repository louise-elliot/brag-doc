-- Transactional bulk import for first-sign-in migration from localStorage.
-- Caller passes:
--   p_entries: jsonb array of entry rows
--   p_settings: jsonb object of settings fields (may be null)
-- Function runs as the calling user; RLS still applies because we use auth.uid().
create or replace function public.migrate_localstorage(
  p_entries jsonb,
  p_settings jsonb
)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'must be signed in';
  end if;

  -- Insert entries (skip if already present by id)
  if p_entries is not null and jsonb_array_length(p_entries) > 0 then
    insert into public.entries (
      id, user_id, date, prompt, original, reframed, tags, coach_notes, created_at
    )
    select
      coalesce((e->>'id')::uuid, gen_random_uuid()),
      v_user_id,
      (e->>'date')::date,
      e->>'prompt',
      e->>'original',
      e->>'reframed',
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(e->'tags')),
        '{}'::text[]
      ),
      case
        when e ? 'coachNotes' and jsonb_typeof(e->'coachNotes') = 'array'
          then (select array_agg(value::text) from jsonb_array_elements_text(e->'coachNotes'))
        else null
      end,
      coalesce((e->>'createdAt')::timestamptz, now())
    from jsonb_array_elements(p_entries) as e
    on conflict (id) do nothing;
  end if;

  -- Upsert settings
  insert into public.settings (user_id, coaching_style, custom_tags, user_context, updated_at)
  values (
    v_user_id,
    coalesce(p_settings->>'coaching_style', 'trusted-mentor'),
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(p_settings->'custom_tags')),
      '{}'::text[]
    ),
    p_settings->'user_context',
    now()
  )
  on conflict (user_id) do nothing;
end;
$$;
