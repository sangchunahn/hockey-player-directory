-- 20250321000000_hockey_staff_rls.sql
--
-- Row-level security for hockey staff, implementing docs/security/rls-policy-spec.md
-- (source of truth). Section tags like [spec: scouting_events SELECT] point to the
-- spec line each statement enforces.
--
-- Same tables, different rows: coaching, scouting and medical query the same
-- tables, and Postgres decides which rows each one gets, on EVERY path (app
-- screens, server functions, the browser client, direct REST calls). Default
-- deny: anything not granted by a policy below returns zero rows or is refused.
--
-- Identity [spec: Identity linkage]: the caller is auth.uid() (a session verified
-- by Supabase Auth). Their role comes ONLY from public.staff_profiles via
-- public.current_staff_role(), never from a browser value or an editable JWT field.
--
-- Depends on 001_scouting_schema.sql (tables, set_updated_at) and
-- 002_scouting_aggregates_rpc.sql (player_event_summary).

-- =============================================================================
-- 0. Remove the temporary Sprint 3 smoke-test access   [spec: cross-cutting rule 6]
--    (applied in the dashboard, never a migration; gave anon read + event writes)
-- =============================================================================
drop policy if exists "smoke: read players"    on public.players;
drop policy if exists "smoke: read games"      on public.games;
drop policy if exists "smoke: read events"     on public.scouting_events;
drop policy if exists "smoke: log events"      on public.scouting_events;
drop policy if exists "smoke: correct events"  on public.scouting_events;

-- =============================================================================
-- 1. Staff roles and profiles   [spec: Identity linkage, D1, staff_profiles]
-- =============================================================================
create type public.staff_role as enum ('coaching', 'scouting', 'medical');

create table public.staff_profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       public.staff_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff_profiles is
  'One row per staff member: which role (coaching/scouting/medical) a Supabase Auth user holds. Managed by an admin outside the app (spec D1); staff can read only their own row.';

create trigger staff_profiles_set_updated_at
  before update on public.staff_profiles
  for each row execute function public.set_updated_at();

alter table public.staff_profiles enable row level security;

-- =============================================================================
-- 2. Role helper   [spec: Identity linkage — "current staff role"]
--    SECURITY DEFINER so policies can read staff_profiles without re-triggering
--    its own RLS. It only ever answers for auth.uid() (the caller). Empty
--    search_path, everything schema-qualified. Returns NULL for signed-out users
--    and users with no profile, and NULL passes no policy below.
-- =============================================================================
create function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select sp.role
  from public.staff_profiles sp
  where sp.user_id = auth.uid();
$$;

revoke all on function public.current_staff_role() from public, anon;
grant execute on function public.current_staff_role() to authenticated;

-- =============================================================================
-- 3. Authorship: recorded_by   [spec: cross-cutting rule 5]
--    Defaults to the caller. Policies require it to equal the caller on insert,
--    and this trigger makes it unchangeable on update, so the browser can never
--    set or hand off authorship.
-- =============================================================================
create function public.keep_recorded_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.recorded_by := old.recorded_by;
  return new;
end;
$$;

-- Existing rows (Sprint 3 seed) have no author, so no scout can edit them.
alter table public.scouting_events
  add column recorded_by uuid default auth.uid() references auth.users (id) on delete set null;

create index scouting_events_recorded_by_idx on public.scouting_events (recorded_by);

create trigger scouting_events_keep_recorded_by
  before update on public.scouting_events
  for each row execute function public.keep_recorded_by();

-- =============================================================================
-- 4. Sports-science records (new)   [spec: Tables in scope — sports_science_records]
-- =============================================================================
create table public.sports_science_records (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete restrict,
  measured_on date not null,
  metric      text not null,
  value       numeric not null,
  unit        text,
  note        text,
  recorded_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint sports_science_records_metric_not_blank check (btrim(metric) <> ''),
  constraint sports_science_records_unit_not_blank   check (unit is null or btrim(unit) <> ''),
  constraint sports_science_records_note_not_blank   check (note is null or btrim(note) <> '')
);

comment on table public.sports_science_records is
  'Health and performance measurements per athlete. Medical role only (spec: sports_science_records).';

create index sports_science_records_player_idx on public.sports_science_records (player_id, measured_on desc);

create trigger sports_science_records_set_updated_at
  before update on public.sports_science_records
  for each row execute function public.set_updated_at();

create trigger sports_science_records_keep_recorded_by
  before update on public.sports_science_records
  for each row execute function public.keep_recorded_by();

alter table public.sports_science_records enable row level security;

-- =============================================================================
-- 5. RLS on every table (001 already enabled the first three; repeated so this
--    file states it explicitly)   [spec: "RLS: ENABLED" on each table]
-- =============================================================================
alter table public.players         enable row level security;
alter table public.games           enable row level security;
alter table public.scouting_events enable row level security;

-- Signed-out callers get no table privileges at all   [spec: rule 2, Identity linkage]
revoke all on public.staff_profiles, public.players, public.games,
              public.scouting_events, public.sports_science_records from anon;

-- =============================================================================
-- 6. Policies. Only the cells the spec marks **Yes**. Every other
--    role/operation has no policy, so it is denied (including every DELETE).
-- =============================================================================

-- ---- staff_profiles   [spec: staff_profiles — own row only; writes No] ----
create policy "staff_profiles: read own row"
  on public.staff_profiles for select to authenticated
  using (user_id = auth.uid());

-- ---- players   [spec: players — SELECT Yes for any staff role; writes No] ----
create policy "players: staff read"
  on public.players for select to authenticated
  using (public.current_staff_role() is not null);

-- ---- games   [spec: games — SELECT Yes for any staff role; writes No] ----
create policy "games: staff read"
  on public.games for select to authenticated
  using (public.current_staff_role() is not null);

-- ---- scouting_events: scouting only   [spec: scouting_events] ----
-- SELECT: scouting, team-wide. Coaching No (matrix rule 1). Medical No (rule 4).
create policy "scouting_events: scouting reads all"
  on public.scouting_events for select to authenticated
  using (public.current_staff_role() = 'scouting');

-- INSERT: scouting, logged as themselves. Coaching/medical No (rule 6).
create policy "scouting_events: scouting logs own"
  on public.scouting_events for insert to authenticated
  with check (
    public.current_staff_role() = 'scouting'
    and recorded_by = auth.uid()
  );

-- UPDATE: scouting, own rows only (matrix Q3). Author unchangeable via trigger.
create policy "scouting_events: scouting corrects own"
  on public.scouting_events for update to authenticated
  using (
    public.current_staff_role() = 'scouting'
    and recorded_by = auth.uid()
  )
  with check (
    public.current_staff_role() = 'scouting'
    and recorded_by = auth.uid()
  );
-- DELETE: no policy for anyone (deletion out of scope).

-- Refine pass: a correction may change only type, period or note
-- (docs/scouting-data-requirements.md, "Update an event"). Column-level
-- privileges stop even an event's own author from moving it to another player
-- or game. updated_at is still set by its trigger.
revoke update on public.scouting_events from authenticated;
grant update (event_type, period, note) on public.scouting_events to authenticated;

-- ---- sports_science_records: medical only, the strictest   [spec: sports_science_records] ----
-- SELECT: medical, care scope = all athletes for v1 (spec D2). Coaching No
-- (rule 2), scouting No (rule 3). No USING (true) anywhere.
create policy "sports_science_records: medical reads"
  on public.sports_science_records for select to authenticated
  using (public.current_staff_role() = 'medical');

-- INSERT: medical, recorded as themselves.
create policy "sports_science_records: medical records own"
  on public.sports_science_records for insert to authenticated
  with check (
    public.current_staff_role() = 'medical'
    and recorded_by = auth.uid()
  );

-- UPDATE: medical before and after. Author kept by trigger.
create policy "sports_science_records: medical updates"
  on public.sports_science_records for update to authenticated
  using (public.current_staff_role() = 'medical')
  with check (public.current_staff_role() = 'medical');
-- DELETE: no policy for anyone.

-- =============================================================================
-- 7. Scouting totals   [spec: Function player_event_summary]
--    SECURITY INVOKER (from 002), so it counts only scouting_events rows the
--    caller can SELECT: scouting gets totals, coaching/medical get zero rows.
--    Signed-out callers may not run it at all.
-- =============================================================================
revoke execute on function public.player_event_summary(public.player_position, date, date, uuid) from anon;
