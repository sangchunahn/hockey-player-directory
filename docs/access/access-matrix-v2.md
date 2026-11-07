# Access matrix v2

**Date:** 2026-11-07

## Purpose

This file is the **contract for a later database change. It is not that change.** It
contains no SQL and adds no file under `supabase/migrations/`. It adds the assistant
scout and the video analyst, keeps coaching, scouting and medical on the grid, and adds
the rule for medical flags on shared screens.

Version 1 (`docs/security/role-access-matrix.md`) stays the record for the original
three roles. Every one of their cells below is either carried forward unchanged or
narrowed because the audit said so.

## Sources

Only these three files (plus the earlier matrix) may decide a cell. Nothing is invented.

- `docs/access/new-roles-brief.md`: the **only** source for what the assistant scout
  and video analyst need.
- `docs/access/overgrant-audit.md`: the **only** source for cells that get **smaller**
  than they are today.
- `docs/access/service-role-key-rule.md`: the **only** source for the master key.

## How to read a cell

- **Deny** means the role cannot see or change that data.
- **See** means look only. It does not include add, change, or delete.
- **Add own** and **Change own** are separate yeses, each limited to rows that person
  recorded.
- **Never** means this role must not use the service-role key.
- **A cell that is not a needed allow is Deny.** Silence in the brief is Deny, not a
  quiet yes.

## Roles

- **Assistant scout:** "a junior scout who supports the scouting staff at games and in
  reviews" (brief).
- **Video analyst:** "reviews game video and lines it up with what scouts recorded"
  (brief).
- **Coaching:** unchanged job from the earlier matrix (plans practices and games).
- **Scouting:** unchanged job from the earlier matrix (records and reviews player
  evaluations).
- **Medical:** unchanged job from the earlier matrix (health and sports-science data for
  athletes in their care).

## Data areas

- **Scouting notes:** written opinions and observations about players as hockey
  prospects (goals, assists, shots, hits, penalties, written notes). Not health records.
- **Game data:** the game schedule (date, home team, away team) and the player list
  (name, position, team, sweater number). Nothing medical.
- **Medical records:** injury and health records.
- **Sports-science data:** body measurements, training load, and injury-risk numbers.
  Not game video, and not a scout's note about skating.
- **Medical flags in shared scouting views:** short markers such as "injured", "not
  cleared" or "injured reserve" that can show on a player list, player page, or scouting
  screen.

## Matrix

| Role | Data area | Action | Because |
| --- | --- | --- | --- |
| Assistant scout | Scouting notes | See | The brief says they read the scouting notes and observations the scouting staff record, to support scouting at games and in reviews. |
| Assistant scout | Scouting notes | Add own; Change own | The brief says they add their own observations from games they watch and correct only those. They may not change anyone else's notes. |
| Assistant scout | Game data | See | The brief says they need the schedule and player list to find the right game and player. |
| Assistant scout | Medical records | Deny | This job must not see medical data. |
| Assistant scout | Sports-science data | Deny | This job must not see sports-science data. |
| Assistant scout | Medical flags in shared scouting views | Deny | A flag on a scouting screen is still medical information. |
| Assistant scout | Service-role key | Never | Staff screens use the signed-in person. Allowed server jobs: none (`service-role-key-rule.md`). |
| Video analyst | Scouting notes | See | The brief says they read scouting notes and observations to line video moments up with them. |
| Video analyst | Scouting notes | Deny add, change, delete | The brief makes this job read-only. Matching video to notes never requires writing a note. |
| Video analyst | Game data | See | The brief says they need the schedule and player list to find the game and players in the video. |
| Video analyst | Medical records | Deny | This job must not see medical data. |
| Video analyst | Sports-science data | Deny | Performance on video is not sports-science data. |
| Video analyst | Medical flags in shared scouting views | Deny | A flag on a scouting screen is still medical information. |
| Video analyst | Service-role key | Never | Staff screens use the signed-in person. Allowed server jobs: none. |
| Coaching | Scouting notes | Deny (unchanged) | Earlier matrix: coaching does not read scouting notes. Not widened while adding new roles. |
| Coaching | Game data | See (unchanged) | Earlier matrix: shared player and schedule facts for planning practices and games. |
| Coaching | Medical records | Deny (unchanged) | No new medical allow. |
| Coaching | Sports-science data | Deny (unchanged) | No new sports-science allow. |
| Coaching | Medical flags in shared scouting views | **Deny (narrowed)** | The audit found "injured reserve" shown on `/players` and player pages. That grant is closed; no new allow. |
| Coaching | Service-role key | Never | Staff screens use the signed-in person. |
| Scouting | Scouting notes | See; Add own; Change own (unchanged) | Earlier matrix: scouts read all notes and record or correct their own. |
| Scouting | Game data | See (unchanged) | Earlier matrix: shared player and schedule facts. |
| Scouting | Medical records | Deny (unchanged) | No new medical allow. |
| Scouting | Sports-science data | Deny (unchanged) | No new sports-science allow. |
| Scouting | Medical flags in shared scouting views | **Deny (narrowed)** | Shared scouting views must hide medical flags, even though an older screen showed them. A tightening, not a new duty. |
| Scouting | Service-role key | Never | Staff screens use the signed-in person. |
| Medical | Scouting notes | Deny (unchanged) | Earlier matrix: medical must not read scouting notes. |
| Medical | Game data | See (unchanged) | Earlier matrix: shared player and schedule facts. |
| Medical | Medical records | See; Add; Change (unchanged, care scope) | Earlier matrix: medical owns health records for athletes in their care. Not widened. |
| Medical | Sports-science data | See; Add; Change (unchanged, care scope) | Earlier matrix: medical owns sports-science records. Not widened. |
| Medical | Medical flags in shared scouting views | See (unchanged) | The flag is medical's own information, already covered by their medical-records access. No other role gains it. |
| Medical | Service-role key | Never | Even medical screens use the signed-in person, not the master key. |
| All roles | Delete any scouting, medical or sports-science record | Deny (unchanged) | Earlier matrix: corrections are edits; deletion is out of scope. |
| Signed-out visitor | Every data area above | Deny (unchanged) | Earlier matrix rule 5: signed-out visitors get nothing. |

### Rows added for other too-open items the audit named

| Item (from the audit) | Who | Action | Because |
| --- | --- | --- | --- |
| Roster status `ir` returned by the roster loader (`src/server/directoryLoader.ts`) | Every role except medical; signed-out visitors | **Deny** the status value | The loader sends the injury flag with every player. Hiding it on screen is not enough, so the value must not leave the server for these callers. |
| Staff and player directory (`/directory`, `getDirectoryEntries`, table `directory_people`) | Signed-out visitors | **Deny** | No job needs the directory served to people who aren't signed in. |
| Staff and player directory | Assistant scout, video analyst, coaching, scouting, medical | See (names, role, team, position, number only) | Shared facts for finding a colleague or player. No medical columns. |
| Staff and player directory | The server function that serves it | **Must run as the signed-in person, never the service-role key** | `service-role-key-rule.md` allows no job to use the key. The audit found this function using it. |
| Pages under `/players`, `/scouting`, `/directory` | Signed-out visitors | **Deny** (show the sign-in prompt, no data) | The audit found every page open without sign-in. Signed-out visitors get nothing. |
| Free-text scouting notes | Assistant scout, video analyst, scouting | See (as above). Notes must not be used to record injuries or health. | Scouting notes may be read by these roles, so health remarks belong in medical records, which stay sealed. |

## Shared scouting views

- **A shared scouting view** is a screen or saved query that mixes scouting or game
  information for people to open together. Examples: the player list, a player's page,
  the scouting notes page, the event board, and the per-player summary.
- **Medical flags must be left out** of every shared scouting view that the assistant
  scout, the video analyst, or the scouting role can open. Coaching too, after the
  narrowing above.
- **The flag must not be sent to the page at all** for those roles. Hiding it on screen
  is not enough.
- **Hiding the medical table is not enough** if the flag still shows on that screen.
  That is a separate cell, and it is **Deny**.

## Service-role key

- **No staff role may use the service-role key.** Every staff row above says Never.
- **The only jobs that may use it** are the ones in
  `docs/access/service-role-key-rule.md`, and that list is **none**.
- **This file does not add new jobs** to that list.

## Narrowed from the audit

| Too-broad grant (audit) | Old, wide cell | Narrower cell (this file) |
| --- | --- | --- |
| "Injured reserve" on `/players` and `/players/$playerId` | Every role and signed-out visitors: See the injury flag | Medical: See. Everyone else: **Deny** the flag in every shared view. |
| Roster loader returns `status` with every player | Anyone: receives `ir` | Medical only. Not sent to any other caller. |
| `getDirectoryEntries` uses the service-role key over `directory_people` (RLS off) | Signed-out visitors: See all; key: used | Signed-out: **Deny**. Staff: See shared fields only. Key: **Never**. |
| Pages open without sign-in | Signed-out visitors: open every page | Signed-out: **Deny** data, and see the sign-in prompt. |
| Free-text scouting notes could carry health remarks | Readers of notes could read health details | Notes stay scouting-only. Health remarks go in medical records, which stay sealed. |

## Existing roles

- **Coaching, scouting and medical stay as they were,** except for the narrower cells
  above. Those cells are the medical flags in shared views, the roster status, the
  directory, and signed-out access.
- **No new allows for coaching or scouting.** This file does not give them anything on
  medical records, sports-science data, or medical flags.

## Not in this file

No SQL. No file under `supabase/migrations/`. No staff email. No test list. The next
step drafts the database change from this contract.
