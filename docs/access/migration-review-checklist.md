# Migration review checklist

This file is the sign-off for the least-privilege migration. Each result was checked
against the matrix or the key rule, not taken on trust.

## Sources reviewed

- **Migration:** `supabase/migrations/20260418120000_least_privilege_new_staff_roles.sql`
- **Access matrix:** `docs/access/access-matrix-v2.md`
- **Service-role key rule:** `docs/access/service-role-key-rule.md`
- **Also read, because the new file builds on it:**
  `supabase/migrations/20250321000000_hockey_staff_rls.sql`
- **Reviewer:** sangchunahn (review run with Claude Code as the coding agent)
- **Date:** 2026-11-07

## How to mark a result

- **pass:** compared with the matrix or the key rule, and the migration matches.
- **fail:** it does not match. No sign-off while any item is fail. The agent fixes the
  same file.
- **residual risk:** cannot be fixed inside this migration file. Says what is still open
  and why.

**Method:**
1. I had the agent describe each statement in plain words, without editing anything.
2. I searched the file for `PUBLIC`, `anon`, `authenticated`, `SECURITY DEFINER`, views,
   `grant` and `revoke`.
3. I ran the migration on a local copy of the database, on top of the earlier
   migrations. I signed in as coaching, scouting, medical, two assistant scouts, a video
   analyst, and a signed-out visitor, and counted which rows each could read or change
   (25 of 25 checks matched the matrix).

## Checks

### 1. Default deny

- **Result:** pass
- **Plain-language evidence:**
  - RLS stays on for `scouting_events`, `players`, `games`, `sports_science_records` and
    `staff_profiles` (turned on in the earlier migration). This file turns it on for
    `directory_people`.
  - The file adds only narrow allow rules. It adds no rule that allows every row (no
    `USING (true)` or `WITH CHECK (true)`), and the local run found none left anywhere.
  - It adds no delete rule.
- **What happens if no allow rule matches:** the row is not returned, and the write is
  refused. In the local run:
  - the video analyst's insert into scouting notes was refused (permission error);
  - their update with no filter changed **0** rows;
  - both new roles got **0** sports-science rows;
  - signed-out callers could not read `scouting_events` or `directory_people` at all.

### 2. Every policy maps to a matrix cell

| Policy or grant | Hockey role | Action | Matrix v2 says | Matches? |
| --- | --- | --- | --- | --- |
| "scouting_events: scouting roles read" | Scouting | See scouting notes | allow (unchanged) | yes |
| same policy | Assistant scout | See scouting notes | allow | yes |
| same policy | Video analyst | See scouting notes | allow | yes |
| same policy | Coaching, Medical | See scouting notes | deny | yes (not listed, so no rows) |
| "scouting_events: scouting roles log own" | Scouting, Assistant scout | Add own scouting notes | allow (own only) | yes (author must be the caller) |
| same policy | Video analyst | Add scouting notes | deny | yes (not listed) |
| "scouting_events: scouting roles correct own" | Scouting, Assistant scout | Change own scouting notes | allow (own only) | yes (own rows, before and after) |
| same policy | Video analyst | Change scouting notes | deny | yes (not listed) |
| (no delete policy) | All roles | Delete scouting notes | deny | yes |
| `alter type … add value` × 2 | Assistant scout, Video analyst | Become identifiable roles | matrix Roles section | yes |
| "directory_people: staff read" | All five staff roles | See directory (names, role, team, position, number) | allow | yes |
| `revoke all on directory_people from anon` | Signed-out visitor | See directory | deny | yes |
| (unchanged) "players: staff read", "games: staff read" | All five roles | See game data | allow | yes |
| (unchanged) sports-science policies, medical only | Assistant scout, Video analyst, Coaching, Scouting | Medical / sports-science | deny | yes (only `medical` is named) |

**Any rule I could not tie to a cell:** none.

### 3. Nothing is open to everyone

- **Result:** pass
- **What I found:**
  - **`PUBLIC`:** no grants to `PUBLIC` in this file. The word only appears as the
    schema name, such as `public.scouting_events`.
  - **`anon`:** appears once, in `revoke all on public.directory_people from anon`. That
    removes access; it doesn't grant it.
  - **`authenticated`:** appears on four policies. Each one is narrowed by a role check:
    `current_staff_role()::text in (...)`, or `is not null` for the directory. None is a
    blanket allow for every signed-in user.
- **Does any hit expose medical data, sports-science data, or a medical flag?** No.
  - The directory policy is the widest ("any staff role"), but `directory_people` holds
    only name, role, team, position and number.
  - No rule in this file touches `sports_science_records`.

### 4. Assistant scout: medical data sealed

- **Result:** pass
- **Plain-language evidence:**
  - Medical records live in `sports_science_records`, whose read and write rules name
    only `medical`. This file doesn't change them.
  - Locally, the assistant scout read **0** sports-science rows, and their insert and
    update were refused or changed 0 rows.

### 5. Assistant scout: sports-science data sealed

- **Result:** pass
- **Plain-language evidence:** same table and the same medical-only rules as check 4.
  The assistant scout appears in no rule on `sports_science_records`. Locally: 0 rows,
  write refused.

### 6. Assistant scout: medical flags hidden in shared views

- **Result:** residual risk
- **Which shared view I checked:**
  - **In the database:** none exist. This migration creates or replaces no view, and the
    audit found no database views. The shared tables the assistant scout can read
    (`players`, `games`, `scouting_events`, `directory_people`) have **no medical flag
    column**.
  - **In the app:** the shared screens `/players` and `/players/$playerId` still show
    "injured reserve". That flag comes from **app data** (`src/data/hockeySeed.ts`
    through `src/server/directoryLoader.ts`), not the database.
- **Caller's rights or owner's rights:** not applicable, since there is no view. The
  only function the new role reaches, `player_event_summary`, runs with the
  **caller's** rights (security invoker), so it counts only notes the caller may read.
- **Plain-language evidence:** in the database the assistant scout cannot reach a
  medical flag. In the app they still can, through the Sprint 1 roster pages. See
  *Residual risks*.

### 7. Video analyst: medical data sealed

- **Result:** pass
- **Plain-language evidence:** checked separately from the assistant scout.
  - `video_analyst` appears only in the scouting-notes read rule. It appears in no rule
    on `sports_science_records`.
  - Locally, the video analyst read **0** sports-science rows, their insert was refused,
    and their update changed 0 rows.

### 8. Video analyst: sports-science data sealed

- **Result:** pass
- **Plain-language evidence:** same as check 7, checked as the video analyst account.
  0 rows, write refused, 0 rows updated, 0 rows deleted.

### 9. Video analyst: medical flags hidden in shared views

- **Result:** residual risk
- **Which shared view I checked:** same as check 6.
  - **In the database:** no views. No shared table the analyst can read has a medical
    flag column.
  - **In the app:** the "injured reserve" flag on `/players` and `/players/$playerId`
    comes from app data, not the database.
- **Caller's rights or owner's rights:** not applicable, since there is no view.
  `player_event_summary` runs with the caller's rights.
- **Plain-language evidence:** sealed in the database; still visible through the app's
  Sprint 1 roster pages. See *Residual risks*.

### 10. Staff-facing requests do not use the service-role key to bypass seals

- **Result:** pass (for this migration), with residual risk elsewhere
- **Compared to this sentence in the key rule:** "Default deny. Any server job that is not
  on the allowed list below must not use the service-role key," with the allowed list
  being **None**.
- **Plain-language evidence (no secret values):**
  - Every new rule targets `authenticated`, the staff person's own login.
  - The file grants nothing to `service_role` (the local check found no table grants to
    it). It stores no key, contains no connection string, and creates no function.
- **SECURITY DEFINER function that returns sealed data, if any:** none in this file.
  The earlier migration's `current_staff_role()` is security definer, but it returns
  only the caller's own role and never medical or sports-science rows.

## Fixes sent back to the agent

| Failed check | What I saw | What I asked the agent to change | Re-checked result |
| --- | --- | --- | --- |
| none | No check failed. | No edit to the migration was needed. | n/a |

## Residual risks

| Check | What is still open | Why it was not fixed in this migration |
| --- | --- | --- |
| 6, 9 | "Injured reserve" still shows on `/players` and `/players/$playerId` to anyone, including the new roles | The flag lives in app data (`src/data/hockeySeed.ts`, `src/server/directoryLoader.ts`), not the database. A SQL migration can't remove it; app code must stop sending it to non-medical callers (later step). |
| 10 | `getDirectoryEntries` (`app/server/directory.ts`) still reads through the service-role key | That's application code, not this migration. This file does close the table itself to signed-out visitors, but the app function must switch to the staff person's login (later step). |
| 10 | `002_scouting_aggregates_rpc.sql` still grants `player_event_summary` execute to `service_role` | An older migration; no staff request uses that role. Remove it in a future clean-up migration to match the "none" rule exactly. |
| 4–9 | Free-text scouting notes, which both new roles may read, could contain injury remarks a scout typed | Not a database permission. The matrix says health remarks belong in medical records; this needs a staff guideline, not SQL. |
| all | This migration and the earlier RLS migration are **not applied** to the live database yet | The step says not to apply it until reviewed. The live database still runs the temporary Sprint 3 "smoke:" policies until both are applied. |

## Sign-off

- **Every required check is pass or residual risk:** yes
- **I did not create a second migration file:** yes
- **Sentence I could say to hockey operations:** "The assistant scout and the video
  analyst can now read scouting notes and game information, and only the assistant
  scout can add or fix their own notes. Medical and sports-science records stay locked
  to medical staff in the database itself. The one place an injury mark still shows,
  the old roster page, is being fixed next in the app."
