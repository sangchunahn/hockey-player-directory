# Break-tests: who I will pretend to be

**Status: not run yet.** This file does not say pass or fail; the next step runs the
tests and records results.

**How I filled Expected:** I copied allow or deny from `docs/access/access-matrix-v2.md`.
I did not guess. Every case cites its matrix row.

**Sources:**
- `docs/access/access-matrix-v2.md`: who may do what.
- `docs/access/migration-review-checklist.md`: what the review expects the database to
  refuse.
- `supabase/migrations/20260418120000_least_privilege_new_staff_roles.sql`: the change
  under test.

**Test file:** `tests/access/least-privilege-roles.test.ts`, run with Vitest.

**Rules:**
- Use the same role names and data names as the access matrix.
- No passwords, keys or tokens in this file. Test-account secrets are environment
  variables; only their **names** appear here.
- Every attempt runs **as the test account** with the public anon key plus that
  account's own sign-in. **Never the service-role key**, not even for setup. The tests
  never turn off row-level security, add a grant, or edit the migration.

**Where "medical data" and "sports-science data" live:** both are rows in
`sports_science_records`, the only medical table in the schema (`overgrant-audit.md`).
Medical cases use a health or injury measurement row; sports-science cases use a
training-load row. Both are sealed by the same medical-only rules.

**How allow and deny are judged:**
- **Allow read:** at least 1 row comes back.
- **Deny read:** 0 rows or a permission error. Row-level security hides rows, so a
  denied read usually returns an empty list, not an error.
- **Deny change:** a permission error, **or** 0 rows changed. The test asks the database
  to return the changed rows, so "0 changed" is visible.
- **Control:** the medical account must **see** the medical row. Without that, a bug that
  hid medical data from everyone would look like a pass.

## Environment variable names (names only)

| What | Variable name |
| --- | --- |
| Supabase project URL (public) | `VITE_SUPABASE_URL` |
| Supabase anon key (public, not the service-role key) | `VITE_SUPABASE_ANON_KEY` |
| Assistant scout email | `TEST_ASSISTANT_SCOUT_EMAIL` |
| Assistant scout password | `TEST_ASSISTANT_SCOUT_PASSWORD` |
| Video analyst email | `TEST_VIDEO_ANALYST_EMAIL` |
| Video analyst password | `TEST_VIDEO_ANALYST_PASSWORD` |
| Medical role email | `TEST_MEDICAL_EMAIL` |
| Medical role password | `TEST_MEDICAL_PASSWORD` |

Each test account needs a `staff_profiles` row with the matching role:
`assistant_scout`, `video_analyst`, or `medical`. If any variable is missing, the
database cases are **skipped** with the missing names listed, never silently passed.

## Actors

- **Assistant scout** (role `assistant_scout`)
- **Video analyst** (role `video_analyst`)
- **Medical** (role `medical`): control case only
- **Signed-out visitor**: one extra case

## Required cases

### AS-READ-SCOUT
- **Actor:** Assistant scout
- **Action:** read
- **Target:** scouting notes (`scouting_events`)
- **Expected:** allow
- **Matrix cell:** Assistant scout / Scouting notes / See
- **Why:** proves the new job can still do its work after the lock-down.
- **Test name:** `AS-READ-SCOUT: assistant scout can read scouting notes`

### AS-READ-GAME
- **Actor:** Assistant scout
- **Action:** read
- **Target:** game data (`games`, `players`)
- **Expected:** allow
- **Matrix cell:** Assistant scout / Game data / See
- **Why:** they need the schedule and player list to find the right game and player.
- **Test name:** `AS-READ-GAME: assistant scout can read game data`

### VA-READ-SCOUT
- **Actor:** Video analyst
- **Action:** read
- **Target:** scouting notes (`scouting_events`)
- **Expected:** allow
- **Matrix cell:** Video analyst / Scouting notes / See
- **Why:** they line up video moments with what scouts recorded.
- **Test name:** `VA-READ-SCOUT: video analyst can read scouting notes`

### VA-READ-GAME
- **Actor:** Video analyst
- **Action:** read
- **Target:** game data (`games`, `players`)
- **Expected:** allow
- **Matrix cell:** Video analyst / Game data / See
- **Why:** they need to find the game and players in the video.
- **Test name:** `VA-READ-GAME: video analyst can read game data`

### AS-READ-MED
- **Actor:** Assistant scout
- **Action:** read
- **Target:** medical data (health/injury rows in `sports_science_records`)
- **Expected:** deny
- **Matrix cell:** Assistant scout / Medical records / Deny
- **Why:** the core seal; a scout must never see a player's health record.
- **Test name:** `AS-READ-MED: assistant scout cannot read medical data`

### AS-CHANGE-MED
- **Actor:** Assistant scout
- **Action:** change (update the control row, and try to insert a new one)
- **Target:** medical data (`sports_science_records`)
- **Expected:** deny
- **Matrix cell:** Assistant scout / Medical records / Deny
- **Why:** a seal that blocks reading but allows writing still lets the wrong job tamper
  with health records.
- **Test name:** `AS-CHANGE-MED: assistant scout cannot change medical data`

### AS-READ-SS
- **Actor:** Assistant scout
- **Action:** read
- **Target:** sports-science data (training-load rows in `sports_science_records`)
- **Expected:** deny
- **Matrix cell:** Assistant scout / Sports-science data / Deny
- **Why:** body and training numbers are sealed the same as medical.
- **Test name:** `AS-READ-SS: assistant scout cannot read sports-science data`

### AS-CHANGE-SS
- **Actor:** Assistant scout
- **Action:** change
- **Target:** sports-science data (`sports_science_records`)
- **Expected:** deny
- **Matrix cell:** Assistant scout / Sports-science data / Deny
- **Why:** writing training numbers is sports-science work, not scouting.
- **Test name:** `AS-CHANGE-SS: assistant scout cannot change sports-science data`

### VA-READ-MED
- **Actor:** Video analyst
- **Action:** read
- **Target:** medical data (`sports_science_records`)
- **Expected:** deny
- **Matrix cell:** Video analyst / Medical records / Deny
- **Why:** checked separately from the assistant scout; one role passing says nothing
  about the other.
- **Test name:** `VA-READ-MED: video analyst cannot read medical data`

### VA-CHANGE-MED
- **Actor:** Video analyst
- **Action:** change
- **Target:** medical data (`sports_science_records`)
- **Expected:** deny
- **Matrix cell:** Video analyst / Medical records / Deny
- **Why:** a read-only job must not alter health records.
- **Test name:** `VA-CHANGE-MED: video analyst cannot change medical data`

### VA-READ-SS
- **Actor:** Video analyst
- **Action:** read
- **Target:** sports-science data (`sports_science_records`)
- **Expected:** deny
- **Matrix cell:** Video analyst / Sports-science data / Deny
- **Why:** performance on video is not sports-science data.
- **Test name:** `VA-READ-SS: video analyst cannot read sports-science data`

### VA-CHANGE-SS
- **Actor:** Video analyst
- **Action:** change
- **Target:** sports-science data (`sports_science_records`)
- **Expected:** deny
- **Matrix cell:** Video analyst / Sports-science data / Deny
- **Why:** same seal, write side.
- **Test name:** `VA-CHANGE-SS: video analyst cannot change sports-science data`

### AS-FLAG-SHARED
- **Actor:** Assistant scout
- **Action:** read
- **Target:** the shared **player list and player page** (`/players`, `/players/$playerId`,
  served by `listPlayers` / `getPlayerById` in `src/server/directoryLoader.ts`), and the
  shared `players` table
- **Expected:** deny (no injury or "injured reserve" flag reaches this job)
- **Matrix cell:** Assistant scout / Medical flags in shared scouting views / Deny
- **Why:** sealing the medical table means nothing if the player list still says
  "injured". The review marked this as residual risk, so this test should expose it.
- **Test name:** `AS-FLAG-SHARED: assistant scout gets no medical flag on the shared player list`

### VA-FLAG-SHARED
- **Actor:** Video analyst
- **Action:** read
- **Target:** the same shared player list and player page, and the `players` table
- **Expected:** deny
- **Matrix cell:** Video analyst / Medical flags in shared scouting views / Deny
- **Why:** same leak, checked for the second role.
- **Test name:** `VA-FLAG-SHARED: video analyst gets no medical flag on the shared player list`

### MED-READ-MED (control case)
- **Actor:** Medical
- **Action:** read
- **Target:** medical data (`sports_science_records`)
- **Expected:** allow
- **Matrix cell:** Medical / Medical records / See
- **Why:** **control.** If medical can't see medical rows either, the "deny" results above
  could be a total hide caused by a bug, not a working seal.
- **Test name:** `MED-READ-MED (control): medical can read medical data`

## Cases I added

### VA-CHANGE-SCOUT
- **Actor:** Video analyst
- **Action:** change (add a scouting note)
- **Target:** scouting notes (`scouting_events`)
- **Expected:** deny
- **Matrix cell:** Video analyst / Scouting notes / Deny add, change, delete
- **Why:** the brief makes the analyst read-only. A "See" allow must not quietly include
  writing.
- **Test name:** `VA-CHANGE-SCOUT: video analyst cannot add a scouting note`

### AS-CHANGE-OWN-SCOUT
- **Actor:** Assistant scout
- **Action:** change (add, then correct, their own note)
- **Target:** scouting notes (`scouting_events`)
- **Expected:** allow
- **Matrix cell:** Assistant scout / Scouting notes / Add own; Change own
- **Why:** proves the least-privilege rules didn't break the one write this job does need.
- **Test name:** `AS-CHANGE-OWN-SCOUT: assistant scout can add and correct their own note`

### ANON-READ-SCOUT
- **Actor:** Signed-out visitor
- **Action:** read
- **Target:** scouting notes and medical data
- **Expected:** deny
- **Matrix cell:** Signed-out visitor / Every data area / Deny
- **Why:** the Sprint 3 test access left scouting data open to signed-out visitors; this
  shows whether that is really closed.
- **Test name:** `ANON-READ-SCOUT: signed-out visitor gets no scouting or medical rows`
