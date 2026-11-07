# Over-grant audit

**Date:** 2026-11-07
**Source brief:** `docs/access/new-roles-brief.md`

This file lists access that **already exists** in the hockey app. It does **not**:
- rebuild staff sign-in or the server session checks;
- change or add database policies or any code;
- decide when the service-role key may be used;
- draft access matrix v2.

Those are later steps. Every name below was found in a file at the cited path.

**"Who can reach it" uses the repo's files as written.** One important difference: the
row-level security migration `supabase/migrations/20250321000000_hockey_staff_rls.sql`
is **in the repo but not yet applied** to the live Supabase project. Until it is, the
live database still runs the temporary Sprint 3 "smoke:" policies (see *Disagreements*).

## Roles judged

- **Assistant scout:** reads scouting notes and game observations; adds and corrects
  only their own observations; sees the game schedule and player list.
- **Video analyst:** reads scouting notes and game observations, **read-only**; sees the
  game schedule and player list.
- **Existing roles from the brief:** coaching, scouting, medical.
- **Sealed rule, in my words:** medical data, sports-science data, and any medical flag
  (such as "injured" or "injured reserve") must never reach the assistant scout or the
  video analyst. That covers shared screens like the player list, schedule, scouting
  notes and event board, even when the rest of the screen is allowed.

**Note:** neither new job exists in the app yet. The role list in the migration has only
`coaching`, `scouting` and `medical`.

## Where I looked

- **Paths searched:**
  - `supabase/migrations/` (all three files);
  - `src/routes/`, `src/server/`, `src/lib/` (`scouting/`, `auth/`, `supabase/`),
    `src/data/`, `src/components/`;
  - `app/server/`, `app/lib/`, `app/routes/`, `app/config/`.
- **Search words:** medical, sports-science, sports science, injury, injured, health,
  medical flag, status, ir, cleared, note, recorded_by, service role, service_role,
  `create table`, `create view`, `create function`, `createServerFn`, `.from(`, `.rpc(`.

## Inventory

### Tables

| Name | File path | Who can reach it | What it holds, in plain words |
| --- | --- | --- | --- |
| `players` | `supabase/migrations/001_scouting_schema.sql` | Read: any signed-in staff member with a role (RLS migration). No one writes through the app. | Player name, position, team, sweater number |
| `games` | `supabase/migrations/001_scouting_schema.sql` | Read: any signed-in staff member with a role. No writes. | Game date, home team, away team |
| `scouting_events` | `supabase/migrations/001_scouting_schema.sql` (+ `recorded_by` in the RLS migration) | Read: scouting only. Insert and correct: scouting, own rows only. Coaching and medical: none. | Scouting observations (goal, shot, hit, …) and free-text notes per player per game |
| `sports_science_records` | `supabase/migrations/20250321000000_hockey_staff_rls.sql` | Read and write: medical only. Everyone else: none. | Health and performance measurements per athlete |
| `staff_profiles` | `supabase/migrations/20250321000000_hockey_staff_rls.sql` | Each person reads only their own row. No one writes through the app. | Which role each staff member holds |
| `directory_people` | Not created by any migration in this repo. Used by `app/server/directory.ts` and typed in `app/lib/directory/mappers.ts`. | **Anyone, signed out included**, through `/directory`. RLS is **off** (`docs/scouting-schema-notes.md` open question 5), and the server reads it with the **service-role key**. | Players **and staff**: full name, role, team, position, jersey number |

There is also **non-database data:** `src/data/hockeySeed.ts` (the Sprint 1 static
roster and schedule). Anyone can reach it through `src/server/directoryLoader.ts`. It
holds player name, position, number, team, and a **roster status `active` / `ir`**.

### Columns

Includes every column that could hold medical, sports-science, injury or health
information.

| Table | Column | File path | Who can reach it | Could this be medical or sports-science? |
| --- | --- | --- | --- | --- |
| `players` | `display_name`, `position`, `team_label`, `sweater_number` | `supabase/migrations/001_scouting_schema.sql` | Any staff role | no |
| `games` | `played_on`, `home_team`, `away_team` | `supabase/migrations/001_scouting_schema.sql` | Any staff role | no |
| `scouting_events` | `event_type`, `period` | `supabase/migrations/001_scouting_schema.sql` | Scouting | no |
| `scouting_events` | **`note`** (free text) | `supabase/migrations/001_scouting_schema.sql` | Scouting (read and write their own) | **unknown.** Free text a scout types. Nothing stops "looked injured" or "limping" being written into a scouting note. |
| `scouting_events` | `recorded_by` | `supabase/migrations/20250321000000_hockey_staff_rls.sql` | Scouting | no (who logged it) |
| `sports_science_records` | `metric`, `value`, `unit`, `measured_on` | `supabase/migrations/20250321000000_hockey_staff_rls.sql` | Medical | **yes** |
| `sports_science_records` | `note` | `supabase/migrations/20250321000000_hockey_staff_rls.sql` | Medical | **yes** |
| `staff_profiles` | `role` | `supabase/migrations/20250321000000_hockey_staff_rls.sql` | Own row | no |
| `directory_people` | `full_name`, `role`, `team`, `position`, `jersey_no` | `app/lib/directory/mappers.ts` (row type) | Anyone (service role, RLS off) | no medical column in the code's column list. **unknown** whether the live table has other columns. |
| (seed data) | **`status`** (`active` / `ir`) | `src/data/hockeySeed.ts` | Anyone | **yes.** `ir` = injured reserve, a medical flag |

### Database views

A database view is a saved query that looks like a table.

| Name | File path | Who can reach it | Includes medical or sports-science fields? |
| --- | --- | --- | --- |
| None found | Searched `supabase/migrations/*.sql` for `create view` / `create or replace view` | — | — |

### Server functions

| Name | File path | Who can call it | What data it can return |
| --- | --- | --- | --- |
| `player_event_summary` (database function) | `supabase/migrations/002_scouting_aggregates_rpc.sql` | Signed-in callers (`anon` revoked in the RLS migration). Runs with the caller's rights, so scouting gets totals and everyone else gets 0 rows. | Per-player counts of goals, assists, shots, hits, penalties, notes; games played |
| `current_staff_role` (database function) | `supabase/migrations/20250321000000_hockey_staff_rls.sql` | Signed-in callers; answers only for themselves | The caller's own role |
| `set_updated_at`, `keep_recorded_by` (triggers) | `001_scouting_schema.sql`, `20250321000000_hockey_staff_rls.sql` | Not callable; they run on save | Nothing |
| `getDirectoryEntries` | `app/server/directory.ts` | **Anyone, signed out included** (no session check). Uses the **service-role client** `app/lib/supabase.server.ts`. | Directory rows of players and staff |
| `listScoutingNotes` | `src/server/scouting-notes.ts` | Signed-in staff only (`requireSession`); rows filtered by RLS | Scouting notes with player and game |
| `getCurrentStaff` | `src/server/get-current-staff.ts` | Signed-in staff only (`requireSession`) | Own id and email |
| `listPlayers`, `getPlayerById`, `listGames` (plain server loaders, not database) | `src/server/directoryLoader.ts` | **Anyone, signed out included** | Seed roster including **`status: 'ir'`**, and the schedule |
| Browser data helpers: `listPlayers`, `listGames`, `listEventsWithPlayer`, `getPlayerEventSummary`, `createScoutingEvent`, … | `src/lib/scouting/queries.ts`, `mutations.ts`, `rpc.ts` | Run **in the browser** with the public key plus the user's session. What returns is decided by RLS alone; there is no server session check. | Players, games, scouting events, totals |

### Shared screens

Pages more than one role can open. No route in `src/routes/` checks sign-in before the
page opens; only the data behind it is filtered.

| Screen or route | File path | Who can open it | Medical or sports-science fields shown? |
| --- | --- | --- | --- |
| `/` (home, featured players) | `src/routes/index.tsx` | Anyone | no (filters `status: 'active'`, so it hides IR without saying so) |
| **`/players`** | `src/routes/players/index.tsx` | Anyone | **yes.** Roster status filter `active` / `ir`, and the `ir` filter lists injured players |
| **`/players/$playerId`** | `src/routes/players/$playerId.tsx` | Anyone | **yes.** Shows "Roster status: **Injured reserve**" |
| `/games` | `src/routes/games/index.tsx` | Anyone | no |
| `/directory` | `app/routes/directory.tsx` | Anyone | no medical column in the code; staff and player list |
| `/login` | `src/routes/login.tsx` | Anyone | no |
| `/scouting` | `src/routes/scouting/index.tsx` | Anyone opens it; notes only for signed-in scouting | **unknown.** Free-text notes could mention an injury |
| `/scouting/players` | `src/routes/scouting/players.tsx` | Anyone opens it; data by RLS | no |
| `/scouting/events` | `src/routes/scouting/events.tsx` | Anyone opens it; data by RLS | **unknown.** Shows free-text notes |
| `/scouting/aggregates` | `src/routes/scouting/aggregates.tsx` | Anyone opens it; data by RLS | no (counts only) |

## Medical and sports-science paths

| Item | Kind | File path | Who can reach it | Who must not reach it |
| --- | --- | --- | --- | --- |
| `sports_science_records` | table | `supabase/migrations/20250321000000_hockey_staff_rls.sql` | Only signed-in medical staff can read or write these rows (once the migration is applied). | Coaching, scouting, the assistant scout, the video analyst, and signed-out visitors must never reach any row. |
| `sports_science_records.metric/value/unit/note` | columns | same file | Medical only, through the table rule. | Everyone except medical. |
| Roster status `ir` | column (seed data) | `src/data/hockeySeed.ts` | **Today: anyone**, through the `/players` filter and the player page. | The assistant scout and the video analyst must never see a player marked injured. Coaching and scouting are not cleared for it either, under the Sprint 4 matrix. |
| `/players` `ir` filter | shared screen | `src/routes/players/index.tsx` | **Today: anyone**, signed out included. | Assistant scout, video analyst, and anyone not medical. |
| "Roster status: Injured reserve" | shared screen | `src/routes/players/$playerId.tsx` | **Today: anyone.** | Assistant scout, video analyst, and anyone not medical. |
| `listPlayers` / `getPlayerById` (seed loader) | server function | `src/server/directoryLoader.ts` | **Today: anyone**; returns `status` with every player. | Assistant scout, video analyst, and anyone not medical, for the `status` value. |
| `scouting_events.note` | column (free text) | `supabase/migrations/001_scouting_schema.sql` | Scouting, and in future the two new jobs. | Not medical by design, but if a scout types injury details here they reach every role that reads notes. Unknown whether this has happened. |

## Learner marks: broader than the job

**I wrote these marks. The agent did not decide them.** They are judged against
`docs/access/new-roles-brief.md`.

| Item | Role that has too much | Why that job does not need it | Evidence file path |
| --- | --- | --- | --- |
| Roster status `ir` on `/players` (filter) and `/players/$playerId` ("Injured reserve") | Assistant scout, video analyst, and every other non-medical viewer, **including signed-out visitors** | The brief seals medical flags on shared screens. Knowing a player is on injured reserve is health information neither new job needs to find a player or a game. | `src/routes/players/index.tsx`, `src/routes/players/$playerId.tsx`, `src/data/hockeySeed.ts` |
| `listPlayers` / `getPlayerById` returning `status` | Same as above | The loader sends the injury flag even to callers who should never get it; hiding it on screen would not stop that | `src/server/directoryLoader.ts` |
| `getDirectoryEntries` through the **service-role key** with RLS off on `directory_people` | **Signed-out visitors**, and every role including the two new jobs | No job needs a staff and player directory served to people who aren't signed in; the master key skips every rule. | `app/server/directory.ts`, `app/lib/supabase.server.ts` |
| All `src/routes/` pages open without sign-in | Signed-out visitors | Even where the data is filtered, the pages themselves are open; the sealed screens above leak because of this | `src/routes/*` (no route checks a session) |
| `scouting_events.note` free text readable by everyone allowed to read scouting notes | Assistant scout, video analyst (once added) | They need observations, not health remarks a scout might type into a note | `supabase/migrations/001_scouting_schema.sql` |

## Disagreements and unknowns

- **Brief versus existing files:**
  - The brief says medical flags stay sealed on shared screens, but **`/players` and
    `/players/$playerId` already show "injured reserve" to anyone.** The files disagree
    with the brief; this audit does not change them.
  - The brief's two new jobs have **no role** in the files yet (`staff_role` lists only
    coaching, scouting and medical).
- **Repo versus the live database:** the RLS migration is not applied live. The live
  `scouting_events` table still allows **signed-out read and write** through the
  dashboard-only "smoke:" policies (`docs/security/rls-verification-checklist.md`).
  Every "scouting only" above is true for the files and not yet for the live database.
- **Service-role uses noticed, with no rule written here:** `getDirectoryEntries`
  (`app/server/directory.ts`) through `getSupabaseServerClient`
  (`app/lib/supabase.server.ts`). No other service-role use was found in `src/`.
- **Other unknowns:**
  - whether the live `directory_people` table has columns beyond the six the code
    selects;
  - whether any existing scouting note text mentions injuries;
  - the Sprint 3 browser scouting pages rely on RLS alone, with no server session check.

## Review notes

- **I compared names to files:** yes. I opened
  `supabase/migrations/20250321000000_hockey_staff_rls.sql`,
  `src/routes/players/$playerId.tsx` (line with "Injured reserve"),
  `src/data/hockeySeed.ts` (`status: 'ir'`), `app/server/directory.ts` (service-role
  client and `directory_people`), and `src/server/directoryLoader.ts`.
- **I did not ask for app-code or SQL edits in this step:** yes. Only this file was
  added.
- **Refine pass:** the first sweep looked only at migrations. A second pass over the
  routes and loaders found the `ir` roster status on `/players` and the player page,
  plus the service-role directory function. Both are now listed above.
