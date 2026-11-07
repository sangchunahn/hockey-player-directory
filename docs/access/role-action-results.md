# Role-by-action break-test results

## How to read this table

- **A pass means the gate did the right thing,** not that a person got the data.
- **If the action should be denied,** pass means the person was blocked or saw no sealed
  data.
- **If the action should be allowed,** pass means the person could still do the job.
- **A forbidden action that succeeds is a fail,** even when the test command exits
  cleanly. "Green" only means the runner liked the assertions it found. A missing or
  wrong assertion can make green lie, so every row below says what the person actually
  tried and what actually came back.
- **Every row has a plain-language sentence.** None says only "pass" or "exit code 0".

## Run record

- **Date:** 2026-11-07
- **Database:** my own course Supabase project, `bsjodruzecdaymnxjade`, after applying
  `20250321000000_hockey_staff_rls.sql` and then
  `supabase/migrations/20260418120000_least_privilege_new_staff_roles.sql`.
- **Test file:** `tests/access/least-privilege-roles.test.ts`
- **Migration:** `supabase/migrations/20260418120000_least_privilege_new_staff_roles.sql`
- **Cases taken from:** `docs/access/adversarial-test-cases.md`
- **Rules checked against:** `docs/access/access-matrix-v2.md`
- **Test accounts:** three fake staff logins made only for testing, one per role. Their
  details are environment variables in the git-ignored `.env.local`, never in a
  committed file:

  | Role | Email variable | Password variable |
  | --- | --- | --- |
  | Assistant scout | `TEST_ASSISTANT_SCOUT_EMAIL` | `TEST_ASSISTANT_SCOUT_PASSWORD` |
  | Video analyst | `TEST_VIDEO_ANALYST_EMAIL` | `TEST_VIDEO_ANALYST_PASSWORD` |
  | Medical (control) | `TEST_MEDICAL_EMAIL` | `TEST_MEDICAL_PASSWORD` |

  Before the run, each account was checked to sign in and report its role
  (`assistant_scout`, `video_analyst`, `medical`).
- **How the tests act:** every attempt runs **as that test account**, using the public
  key plus that person's own sign-in. **No test uses the service-role (master) key,**
  and the test file refuses to run if given one.
- **Command the agent ran:**
  `node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/access/least-privilege-roles.test.ts --reporter=verbose`
- **First-run summary in my own words:**
  1. **Before the test accounts existed:** the 18 database cases were skipped, and the
     test named the missing settings. The **two shared-screen flag cases failed**: the
     player list and player pages handed 4 players marked "injured reserve" to anyone,
     including the assistant scout and the video analyst. That was a real leak.
  2. **After the flag fix (see the tightening log),** the next live attempts couldn't
     sign in, because the Supabase test users' passwords didn't match the settings yet.
     That was a test-account setup problem, not a gate result, so no gate verdict was
     recorded from those runs.
  3. **Final run, with all three accounts signed in under their real roles:** all 20
     cases did what the matrix says, 20 of 20. The control case shows medical staff can
     still read medical data, so the blocks below are a working seal and not a bug that
     hides medical data from everyone.

## Results

| Case | Role | Action | Expected | Observed | Gate result | What this means for hockey operations |
| --- | --- | --- | --- | --- | --- | --- |
| AS-READ-MED | Assistant scout | Read medical or injury data | Deny | Blocked (0 rows) | Pass | The assistant scout asked for a player's injury measurement and got nothing back. Health records stay with medical. |
| AS-CHANGE-MED | Assistant scout | Change or add medical data | Deny | Blocked (0 rows changed; new record refused) | Pass | The assistant scout tried to edit a health record and to add a new one; the database refused both, so a scout can't tamper with medical files. |
| AS-READ-SS | Assistant scout | Read sports-science data | Deny | Blocked (0 rows) | Pass | The assistant scout asked for a training-load number and got nothing, so body and training data stay sealed. |
| AS-CHANGE-SS | Assistant scout | Change or delete sports-science data | Deny | Blocked (0 rows changed or deleted) | Pass | The assistant scout tried to change and delete a training record; nothing changed. |
| AS-FLAG-SHARED (database) | Assistant scout | See medical flags in the shared player list | Deny | Blocked (no flag field on any player row) | Pass | The player list the assistant scout opens carries name, position, team and number, and nothing about injuries. |
| AS-FLAG-SHARED (screens) | Assistant scout | See "injured reserve" on `/players` or a player page | Deny | Blocked (no injury status sent) | Pass | The roster and player pages no longer receive injury status at all. **This one failed first**; see the tightening log. |
| AS-READ-SCOUT | Assistant scout | Read scouting notes | Allow | Succeeded | Pass | The assistant scout could read scouting notes, which they need to support the scouting staff. |
| AS-READ-GAME | Assistant scout | Read game data | Allow | Succeeded | Pass | The assistant scout could read the schedule and player list, so they can find the right game and player. |
| AS-CHANGE-OWN-SCOUT | Assistant scout | Add and correct their own note | Allow | Succeeded (recorded as them) | Pass | The assistant scout logged an observation, and it was recorded under their name; they could fix it afterwards. Their one needed write still works. |
| VA-READ-MED | Video analyst | Read medical or injury data | Deny | Blocked (0 rows) | Pass | The video analyst asked for an injury measurement and got nothing back. Checked as the analyst's own account, not copied from the scout. |
| VA-CHANGE-MED | Video analyst | Change or add medical data | Deny | Blocked (0 rows changed; new record refused) | Pass | The video analyst could not edit or add health records. |
| VA-READ-SS | Video analyst | Read sports-science data | Deny | Blocked (0 rows) | Pass | Studying performance on video does not open training-load numbers; the analyst got none. |
| VA-CHANGE-SS | Video analyst | Change or delete sports-science data | Deny | Blocked (0 rows changed or deleted) | Pass | The video analyst could not change or delete training records. |
| VA-FLAG-SHARED (database) | Video analyst | See medical flags in the shared player list | Deny | Blocked (no flag field on any player row) | Pass | The player list the analyst opens has no injury field. |
| VA-FLAG-SHARED (screens) | Video analyst | See "injured reserve" on `/players` or a player page | Deny | Blocked (no injury status sent) | Pass | The roster and player pages don't show the analyst who is injured. **This one also failed first.** |
| VA-READ-SCOUT | Video analyst | Read scouting notes | Allow | Succeeded | Pass | The video analyst could read scouting notes, which they need to line video up with what scouts saw. |
| VA-READ-GAME | Video analyst | Read game data | Allow | Succeeded | Pass | The video analyst could read the schedule and player list to find the game and players in the video. |
| VA-CHANGE-SCOUT | Video analyst | Add or change a scouting note | Deny | Blocked (new note refused; edit changed 0 rows) | Pass | The video analyst tried to write a scouting note and was refused. Their job is read-only. |
| MED-READ-MED (control) | Medical | Read medical data | Allow | Succeeded (both medical rows returned) | Pass | Medical staff can still see medical records, which proves the blocks above are a real seal, not an outage. |
| ANON-READ-SCOUT | Signed-out visitor | Read scouting notes and medical data | Deny | Blocked (refused, no rows) | Pass | Someone who isn't signed in gets no scouting or medical data. The temporary open access from earlier testing is closed. |

## Tightening log

- **Did any forbidden access succeed on the first run?** **Yes.** The shared player list
  and player pages gave "injured reserve" status (4 players) to every visitor, including
  the assistant scout and the video analyst.
- **What changed, in plain language:** the flag came from app code, not the database, so
  the fix went beyond the two files this step lists. I chose this explicitly so the
  sealed-flag rule would hold. In commit `e094907`:
  - **The roster loader** (`src/server/directoryLoader.ts`) now sends shared screens
    only name, position, number and team. Injury status never leaves the server.
  - **The "injured only" filter was removed,** because that filter is itself a list of
    injured players.
  - **The "· IR" tag and the "Roster status" line** were removed from `/players` and the
    player page.
- **What changed in `supabase/migrations/20260418120000_least_privilege_new_staff_roles.sql`:**
  nothing. Every database deny held on the first live run, so the migration didn't need
  tightening.
- **What changed in `tests/access/least-privilege-roles.test.ts`:** the shared-screen
  check became **stricter, not looser**. It now rejects any flag-like field or `ir` value
  on any player record the shared screens receive, and it still expects deny. No
  assertion was flipped to allow, and no case was removed.
- **Re-run result, in plain language:**
  - After the fix, both shared-screen flag cases pass.
  - In the final live run, all 20 cases did what the matrix says: every sealed read or
    change was blocked, and every allowed scouting and game read still worked.
- **Side effect to know about:**
  - **Each run adds one "Break-test observation" scouting note** recorded by the
    assistant-scout test account. Notes can't be deleted, by design.
  - **The medical test account added two marker records** (`break_test_injury_status`,
    `break_test_training_load`) the first time, and reuses them after that.

## Not in this file

This file is the proof table only. The access decision note and the staff message are
later steps.
