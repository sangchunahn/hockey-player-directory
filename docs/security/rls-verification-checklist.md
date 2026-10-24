# RLS + session verification checklist (Hockey staff)

**Goal:** prove each role gets only the scouting rows the policy allows, and signed-out
callers get nothing, **on the server/API path**, not just on screen.
**Sources of truth:** `docs/security/rls-policy-spec.md` and
`supabase/migrations/20250321000000_hockey_staff_rls.sql`.
**Code under test:** `src/lib/auth/require-session.ts` (session gate) and
`src/server/scouting-notes.ts` (`listScoutingNotes`, used by `/scouting`).

> **Hiding is not passing.** A row only counts as Pass if the denied role gets **zero
> rows from the server or database**. A page that merely doesn't render a row, while the
> server function or REST API still returns it, is a **Fail**.

## Expected results (from the policy spec)

| Caller | `/scouting` notes (`scouting_events`) | Sports-science rows | Can log scouting events? |
| --- | --- | --- | --- |
| Signed out | **None.** "Sign in" prompt; server returns `signed-out` / 401 | None | No |
| Scouting | **All notes** (team-wide) | **None** | Yes, as themselves; edit own only |
| Coaching | **None** ("0 notes visible to your role") | **None** | No |
| Medical | **None** | **All** (spec D2) | No |
| Signed in, no `staff_profiles` row | **None** | None | No |

## Before you start

- [ ] **Supabase project is running** (not paused).
- [ ] **Migration `20250321000000_hockey_staff_rls.sql` applied** (Dashboard → SQL Editor).
- [ ] **Test users exist**, one per role. Create them in Authentication → Users → Add
      user, with **Auto Confirm**. Then give each a role in the SQL Editor:
      `insert into public.staff_profiles (user_id, role) values ('<user id>', 'scouting');`
      Do the same for `coaching` and `medical`.
- [ ] At least one scouting **note** exists (the Sprint 3 seed has two).
- [ ] You can sign in at `/login` and fully sign out between roles (use the **Sign out**
      link, then reload).

**Two ways to test each role:**
1. **App path:** sign in at `/login`, then open `/scouting`.
2. **Database path (no app):** in the SQL Editor, run the queries as that user, so you
   test RLS itself:
   ```
   begin;
   set local role authenticated;
   select set_config('request.jwt.claims', '{"sub":"<user id>","role":"authenticated"}', true);
   select count(*) from public.scouting_events where note is not null;
   select count(*) from public.sports_science_records;
   rollback;
   ```
   The `rollback` means nothing you try is saved.

---

## A. Signed-out visitor

| Step | Action | Pass looks like | Fail looks like |
|------|--------|-----------------|-----------------|
| A1 | With no session, open `/scouting` | "Sign in to see scouting notes", no note text in the page HTML, no browser calls to Supabase | Any note text, or any row returned |
| A2 | Sign in, then **Sign out**, then reload `/scouting` | Back to the sign-in prompt | Notes still visible after sign-out (stale session) |
| A3 | Signed out, call the REST API directly with only the public anon key: `GET /rest/v1/scouting_events` | Error or `[]`. The migration revokes all `anon` table privileges | Rows returned |

Result: A1 ☑ **Pass** · A2 ☐ **Blocked** (needs a test user + live Supabase) · A3 ☐ **Blocked** (Supabase paused; passes in the local DB check: anon gets a permission error)
Notes: A1 run 2026-10-24 on the local production build: the page showed the sign-in
prompt, the browser made **0** Supabase calls, and the HTML had no note text. A3 in local
Postgres: anon `select` on `scouting_events` and `sports_science_records` refused, and
`player_event_summary()` refused.

## B. Scouting staff

| Step | Action | Pass looks like | Fail looks like |
|------|--------|-----------------|-----------------|
| B1 | Sign in as the scouting user, open `/scouting` | Every note listed (seed: 2), with player and game; "Signed in as <scout email>" | Empty list, or an error |
| B2 | Database path as the scout: count sports-science rows | **0** | Any medical row |
| B3 | Database path as the scout: insert a note event **with another user's id** in `recorded_by` | Refused (RLS error 42501) | Insert succeeds (authorship spoofing) |
| B4 | Database path as the scout: change the `player_id` of their own event | Refused (permission error) | Event moves to another player |

Result: ☐ **Blocked live** (Supabase paused) · ☑ **Pass in local DB**
Notes: local Postgres run (migrations 001 + 002 + Sprint 3 state + RLS migration). Scout
read 10/10 scouting rows and 0 sports-science rows. Spoofed `recorded_by` → 42501.
Changing `player_id` → 42501. The scout could still correct type and note on their own
event. Another scout's edit touched 0 rows.

## C. Coaching staff

| Step | Action | Pass looks like | Fail looks like |
|------|--------|-----------------|-----------------|
| C1 | Sign in as coaching, open `/scouting` | "0 notes visible to your role" and no note text | Any scouting note |
| C2 | Compare with B1 | Scout sees notes; coach sees 0, from the **same** server query | Both see the same notes |
| C3 | Database path as the coach: `update public.scouting_events set note = 'x'` (**no WHERE**) | **0 rows** updated | Any row changed |
| C4 | Database path as the coach: count sports-science rows | **0** | Any medical row |

Result: ☐ **Blocked live** · ☑ **Pass in local DB**
Notes: coach read players 5, games 3, scouting 0, sports-science 0, own profile 1. A
no-WHERE update touched 0 scouting rows and 0 medical rows. Scouting summary returned 0
rows for the coach versus 4 for the scout.

## D. Medical staff

| Step | Action | Pass looks like | Fail looks like |
|------|--------|-----------------|-----------------|
| D1 | Sign in as medical, open `/scouting` | "0 notes visible to your role" | Any scouting note |
| D2 | Database path as the medic: count sports-science rows | All rows (spec D2) | 0 rows (false deny) |
| D3 | Database path as the medic: insert a scouting event | Refused (42501) | Insert succeeds |
| D4 | Database path as the medic: `delete from public.sports_science_records` | **0 rows** deleted (no delete policy) | Rows deleted |

Result: ☐ **Blocked live** · ☑ **Pass in local DB**
Notes: medic read scouting 0 and sports-science 2 of 2. Recording a measurement set
`recorded_by` to the medic. A scouting insert was refused. Delete touched 0 rows.

## E. Server path uses the session gate

| Step | Action | Pass looks like | Fail looks like |
|------|--------|-----------------|-----------------|
| E1 | Read `src/server/scouting-notes.ts` | `requireSession()` runs **before** the query, the query uses `session.supabase` (the user-bound server client), and there's no role parameter or role filter | Query before the session check, a browser client, a service-role key, or a role taken from the request |
| E2 | `npx vitest run src/lib/auth/require-session.test.ts` | Success case passes **and** every no-session or bad-session case fails closed | Only a happy-path test |
| E3 | Read `src/routes/scouting/index.tsx` | Loads only through `listScoutingNotes()`; no Supabase client or table query in the route | Route queries `scouting_events` itself |

Result: E1 ☑ **Pass** · E2 ☑ **Pass** · E3 ☑ **Pass**
Notes: E2 run 2026-10-24: **8/8 passed**, covering success, safe fields only, no
cookie, forged token, no user, Auth unreachable, a throwing verify call, and no caller
input. **Mutation check:** with the fail-closed branch temporarily disabled, 4 tests
failed, so the tests really guard the gate. The full suite is 20/20.

## F. Other roles and edge cases

| Step | Action | Pass looks like | Fail looks like |
|------|--------|-----------------|-----------------|
| F1 | A signed-in user **with no** `staff_profiles` row opens `/scouting` | 0 notes | Any note |
| F2 | As the coach, try `update public.staff_profiles set role = 'scouting'` on your own row | 0 rows updated (no self-promotion) | Role changes |

Result: ☐ **Blocked live** · ☑ **Pass in local DB** (no-role user saw 0 rows in every
table; self-promotion touched 0 rows; adding your own profile was refused)

---

## Failures → which layer to fix

| Symptom | Most likely layer | Look at |
|---|---|---|
| Signed-out request gets rows | Session gate or server path | `require-session.ts` (fails closed?), `scouting-notes.ts` (gate before the query?) |
| Every role sees the same notes | Server client or migration | Is the query using `session.supabase`, not a browser or service-role client? Is the migration applied? Any leftover "smoke:" policy? |
| A role sees **too many** rows | RLS policy | The matching policy in the migration vs. the spec table (look for `USING (true)` or a wrong role name) |
| A role sees **too few** rows (false deny) | Role data | A `staff_profiles` row with the right role for that user |
| Unit test fails | Test or helper | Decide which one is wrong against the spec **before** editing. Never loosen the helper to get a green run. |

**Fix loop:**
1. Name the failing row.
2. Re-read the matching spec section.
3. Fix that one layer.
4. Re-run Vitest and the failed rows only.

## Sign-off

- **Tester:** sangchunahn (walk-through with Claude Code)
- **Date:** 2026-10-24
- **Vitest `require-session`:** ☑ Pass (8/8; mutation check confirmed the fail-closed cases)
- **Checklist overall:** ☑ **Partial**
  - **Pass:** A1, E1–E3, plus B, C, D, F in a local Postgres copy (34/34 checks).
  - **Blocked:** the live A2, A3, B, C, D, F rows.
  - **Blockers:**
    1. The Supabase project `bsjodruzecdaymnxjade` is **paused**. Its address does not
       resolve, so it must be restored in the dashboard.
    2. The RLS migration is not yet applied to it.
    3. There are no test users per role yet.
  - Re-run the blocked rows once those are done. Sprint 4 verification is not "done"
    until they pass.
