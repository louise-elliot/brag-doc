-- Per-user acknowledgement that entry text is sent to Anthropic for AI features.
alter table public.settings
  add column ai_consent boolean not null default false;
