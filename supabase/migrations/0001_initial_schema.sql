-- entries: one row per journal entry
create table public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  prompt      text not null,
  original    text not null,
  reframed    text,
  tags        text[] not null default '{}',
  coach_notes text[],
  created_at  timestamptz not null default now()
);

create index entries_user_date_created_idx
  on public.entries (user_id, date desc, created_at desc);

-- settings: one row per user
create table public.settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  coaching_style text not null default 'trusted-mentor',
  custom_tags    text[] not null default '{}',
  user_context   jsonb,
  updated_at     timestamptz not null default now()
);
