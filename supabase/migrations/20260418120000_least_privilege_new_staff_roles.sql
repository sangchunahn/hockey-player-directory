-- 20260418120000_least_privilege_new_staff_roles.sql
--
-- Least-privilege access for the two mid-season jobs: assistant scout and video analyst.
--
-- Implements (do not widen beyond these):
--   docs/access/access-matrix-v2.md      the contract: every cell below comes from it
--   docs/access/overgrant-audit.md       the only source for real table/column/function names
--                                        and for grants that get narrower
--   docs/access/service-role-key-rule.md no job may use the service-role key; nothing here
--                                        stores, grants, or runs as it
--
-- Builds on 20250321000000_hockey_staff_rls.sql. Same role system: the staff_role
-- list on public.staff_profiles, read through public.current_staff_role(). No
-- second role system and no new business tables.
--
-- DEFAULT DENY: a role gets rows only where a policy below (or the earlier
-- migration) explicitly allows it. Every cell the matrix marks Deny has no policy,
-- so it returns zero rows or refuses the write.
--
-- Policies compare current_staff_role()::text against plain text, so the new role
-- values can be added and used in the same run.
--
-- REVIEW BEFORE APPLYING. Do not run this on the live database until it has been
-- reviewed against the matrix and the earlier migration is applied.

-- =============================================================================
-- 1. The two new jobs become roles   [matrix v2: Roles]
-- =============================================================================
alter type public.staff_role add value if not exists 'assistant_scout';
alter type public.staff_role add value if not exists 'video_analyst';

-- =============================================================================
-- 2. Scouting notes: look-only for both new jobs, writes only for the assistant scout
-- =============================================================================

-- SELECT: scouting (unchanged) plus assistant scout and video analyst.
--   Matrix: Assistant scout / Scouting notes / See; Video analyst / Scouting notes / See.
--   Coaching and medical stay Deny (no row access).
drop policy if exists "scouting_events: scouting reads all" on public.scouting_events;
create policy "scouting_events: scouting roles read"
  on public.scouting_events for select to authenticated
  using (public.current_staff_role()::text in ('scouting', 'assistant_scout', 'video_analyst'));

-- INSERT: scouting (unchanged) plus assistant scout, recorded as themselves.
--   Matrix: Assistant scout / Scouting notes / Add own.
--   Video analyst / Scouting notes / Deny add: no policy grants it.
drop policy if exists "scouting_events: scouting logs own" on public.scouting_events;
create policy "scouting_events: scouting roles log own"
  on public.scouting_events for insert to authenticated
  with check (
    public.current_staff_role()::text in ('scouting', 'assistant_scout')
    and recorded_by = auth.uid()
  );

-- UPDATE: scouting (unchanged) plus assistant scout, own rows only, before and after.
--   Matrix: Assistant scout / Scouting notes / Change own. Video analyst: Deny change.
--   The earlier column limit (event_type, period, note) and the recorded_by
--   trigger still apply, so no one can move a note to another player or game,
--   or hand off authorship.
drop policy if exists "scouting_events: scouting corrects own" on public.scouting_events;
create policy "scouting_events: scouting roles correct own"
  on public.scouting_events for update to authenticated
  using (
    public.current_staff_role()::text in ('scouting', 'assistant_scout')
    and recorded_by = auth.uid()
  )
  with check (
    public.current_staff_role()::text in ('scouting', 'assistant_scout')
    and recorded_by = auth.uid()
  );

-- DELETE: no policy for any role (matrix: All roles / Delete / Deny).

-- =============================================================================
-- 3. Game data: players and games   [matrix v2: Game data / See for all five roles]
--    No change needed. The existing policies "players: staff read" and
--    "games: staff read" allow any signed-in person with a staff role, which now
--    includes both new jobs. They expose only shared columns (name, position,
--    team, sweater number; date and teams) and no medical flag column.
--    Writes stay denied for every role.
-- =============================================================================

-- =============================================================================
-- 4. Medical records and sports-science data stay sealed
--    [matrix v2: Medical records / Sports-science data: Deny for assistant scout,
--     video analyst, coaching, scouting; medical unchanged]
--    No change. public.sports_science_records keeps its medical-only policies
--    from 20250321000000_hockey_staff_rls.sql. Nothing here mentions the new roles
--    on that table, so default deny gives them zero rows and refuses every write.
-- =============================================================================

-- =============================================================================
-- 5. Shared views and medical flags   [matrix v2: Medical flags in shared
--    scouting views / Deny for every role except medical]
--    The audit found NO database views, so none are created or replaced here. No
--    shared table above has a medical flag column. The flag the audit found
--    ("injured reserve" on /players and player pages) lives in app data
--    (src/data/hockeySeed.ts via src/server/directoryLoader.ts), not the database,
--    so it is fixed in app code in a later step, not in SQL. Any future shared view
--    must list columns by name and leave medical and sports-science fields out.
-- =============================================================================

-- =============================================================================
-- 6. Scouting totals follow scouting notes
--    public.player_event_summary runs with the caller's rights (002), so it counts
--    only scouting_events rows the caller may read. Assistant scout and video
--    analyst therefore see totals built from the notes they may already See.
--    Coaching and medical still get zero rows. No grant changes.
-- =============================================================================

-- =============================================================================
-- 7. Staff directory: close the audit's signed-out over-grant
--    [matrix v2: Staff and player directory / signed-out Deny; staff See shared
--     fields]
--    public.directory_people (Sprint 2) is not created by any migration in this
--    repo, so this block runs only if the table exists. It turns RLS on, removes
--    signed-out access, and lets any signed-in staff role read it. The app's
--    directory function must stop using the service-role key; that is app code for
--    a later step.
-- =============================================================================
do $$
begin
  if to_regclass('public.directory_people') is not null then
    execute 'alter table public.directory_people enable row level security';
    execute 'revoke all on public.directory_people from anon';
    execute 'drop policy if exists "directory_people: staff read" on public.directory_people';
    execute $p$
      create policy "directory_people: staff read"
        on public.directory_people for select to authenticated
        using (public.current_staff_role() is not null)
    $p$;
  end if;
end
$$;

-- =============================================================================
-- 8. Service-role key   [docs/access/service-role-key-rule.md: allowed list = none]
--    Nothing in this file stores the key, grants anything to service_role, or
--    creates a function that runs with elevated rights for staff requests. Every
--    policy above is for "authenticated", the signed-in staff person's own login.
-- =============================================================================
