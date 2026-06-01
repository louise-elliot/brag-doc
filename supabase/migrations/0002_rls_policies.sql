-- entries
alter table public.entries enable row level security;

create policy "entries_select_own" on public.entries
  for select using (auth.uid() = user_id);

create policy "entries_insert_own" on public.entries
  for insert with check (auth.uid() = user_id);

create policy "entries_update_own" on public.entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "entries_delete_own" on public.entries
  for delete using (auth.uid() = user_id);

-- settings
alter table public.settings enable row level security;

create policy "settings_select_own" on public.settings
  for select using (auth.uid() = user_id);

create policy "settings_insert_own" on public.settings
  for insert with check (auth.uid() = user_id);

create policy "settings_update_own" on public.settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "settings_delete_own" on public.settings
  for delete using (auth.uid() = user_id);
