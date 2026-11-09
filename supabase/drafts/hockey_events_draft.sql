-- DRAFT ONLY. NOT APPLIED. NOT in supabase/migrations on purpose.
-- Do not run this until provider identity exists (docs/handoff/sprint5-api-decisions.md:
-- identity first, saving second). It mirrors docs/ingestion/storage-rule.md.

create table if not exists public.hockey_events (
  id uuid primary key default gen_random_uuid(),
  -- the idempotency key: one provider event id maps to one stored event
  provider_event_id text not null unique,
  event_type text not null check (event_type in ('goal', 'penalty')),
  period integer not null check (period between 1 and 5),
  created_at timestamptz not null default now()
);

-- Default deny: no policies are granted here. Staff access is decided in a later step.
alter table public.hockey_events enable row level security;
