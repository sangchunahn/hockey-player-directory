# RLS Policy Specification — Hockey Staff Data

**Sources:** `docs/security/role-access-matrix.md` (who may do what; the only source of
access rules) and `docs/security/auth-session-plan.md` (how identity reaches the server).
**Feeds:** the RLS SQL migration in the next step.
**Status:** plain-language intent only, with no SQL. Every sentence marked *USING* or
*WITH CHECK* below becomes a policy condition.
**Date:** 2026-10-24

## Purpose

Coaching, scouting and medical staff share the same database tables but must see
**different rows**. Postgres row-level security (RLS) enforces that inside the database,
so it holds for screens, server functions, the browser client, and direct REST calls
alike. Hiding a page is never the enforcement.

---

## Identity linkage (must match the auth-session plan)

- **Auth source:** the Supabase Auth session. Server functions verify it with
  `requireSession()` (`getUser()`), then query **with the user-bound server client**, so
  inside Postgres the caller is `auth.uid()` with the `authenticated` role.
- **Staff mapping (new table `staff_profiles`):** one row per staff member, with
  `user_id` = the Auth user id (primary key, references the Auth user) and a `role`
  field.
- **Role field:** `staff_profiles.role` holds exactly one of `coaching`, `scouting`,
  `medical`. These are the matrix names; there are no other values.
- **Current-role lookup:** policies read the caller's role through one helper,
  "current staff role" = the `role` on the `staff_profiles` row whose `user_id` is
  `auth.uid()`, or **none** if there is no such row.
  - The helper runs with owner rights and a pinned search path, so it can read
    `staff_profiles` without the policy calling itself in a loop.
  - It only ever answers for the caller themselves.
- **No role means no access.** A signed-in user without a `staff_profiles` row is treated
  as having no role and passes **no** policy below.
- **Signed-out (`anon`):** no policies are granted to `anon` on any table in this spec.
  RLS on plus no matching policy means zero rows.
- **Who assigns roles (decision D1, resolves matrix Q1 for this sprint):** roles are
  set by an administrator in the Supabase dashboard or with the service role. Staff can
  read their own profile row but can never insert or change any profile row, so nobody
  can promote themselves. Self-service role management is out of scope.

---

## Tables in scope

| Table | Matrix data kind(s) | Sensitivity | Shared? | Notes |
| --- | --- | --- | --- | --- |
| `scouting_events` | scouting_notes (the `note` column and `note`-type events) and scouting_events (stat events) | High: competitive intel | Same table for all staff; scouting sees rows, coaching and medical see none | Gets a new `recorded_by` column (the author's Auth id) so "own rows" can be checked |
| `sports_science_records` (**new**) | medical_or_sports_science_data | Highest: health and performance | Same table for all staff; medical sees rows, coaching and scouting see none | Created in the migration: athlete (references `players`), measurement fields, `recorded_by`, timestamps |
| `players` | player_roster_shared_fields | Low: shared facts | All three roles read | Writes denied for all (matrix Q5) |
| `games` | game_schedule_shared_fields | Low: shared facts | All three roles read | Writes denied for all (matrix Q6) |
| `staff_profiles` (**new**) | staff_role_assignment | Medium: who holds which role | Own row only | Writes denied for all staff (D1) |
| `player_event_summary` (function) | scouting_summary | High: derived from scouting rows | Follows `scouting_events` | Already runs with the caller's rights, so it counts only rows the caller can read |

**Not in this migration:** `practice_or_game_plans` has no table yet; when one is
created it gets a section here first. `directory_people` (Sprint 2) stays as it is and
is tracked as matrix Q9.

---

## Policy intents by table

**Same tables, different rows:** the scouting and medical sections below are the core
proof. Every role queries the same `scouting_events` and `sports_science_records`
tables, and the policies decide which rows come back. Two roles are fully denied on
each table, so they get zero rows and cannot write.

### Table: `scouting_events` (scouting notes and scouting stat events)

RLS: **ENABLED** (already on since 001). All temporary **"smoke:" policies are dropped.**

#### SELECT
| Role | Allow? | USING intent |
| --- | --- | --- |
| scouting | **Yes** | Every row (team-wide), when the caller's current staff role is `scouting`. Matrix: scouting_notes R and scouting_events R, team-wide. |
| coaching | **No** | No rows. Matrix rule 1. |
| medical | **No** | No rows. Matrix rule 4. |

#### INSERT
| Role | Allow? | WITH CHECK intent |
| --- | --- | --- |
| scouting | **Yes** | The caller's role is `scouting` **and** the new row's `recorded_by` equals the caller (`auth.uid()`). A scout can't log an event as someone else. Foreign keys still require a real player and game. |
| coaching | **No** | Deny. Matrix rule 6. |
| medical | **No** | Deny. Matrix rule 6. |

#### UPDATE
| Role | Allow? | USING + WITH CHECK intent |
| --- | --- | --- |
| scouting | **Yes, own rows** | USING: the caller is `scouting` and the row's `recorded_by` is the caller. WITH CHECK: the same must still hold after the change, so `recorded_by` can't be handed to someone else. Matrix Q3 keeps "own only" until decided. Rows logged before this migration have no author, so no scout can edit them. |
| coaching | **No** | Deny. |
| medical | **No** | Deny. |

#### DELETE
| Role | Allow? | USING intent |
| --- | --- | --- |
| scouting | **No** | Deny. Deletion is out of scope; corrections are updates. |
| coaching | **No** | Deny. |
| medical | **No** | Deny. |

### Table: `sports_science_records` (new)

RLS: **ENABLED** at creation.

#### SELECT
| Role | Allow? | USING intent |
| --- | --- | --- |
| medical | **Yes** | Rows within care scope when the caller's role is `medical`. **Decision D2:** for v1, care scope = all athletes (team-wide). This is a stated assumption pending matrix Q4. If stakeholders choose per-medic caseloads, this condition narrows to "athlete is assigned to the caller" in a later migration, never wider. |
| coaching | **No** | No rows, not even summaries. Matrix rule 2; the matrix grants coaching nothing here. |
| scouting | **No** | No rows. Matrix rule 3. |

#### INSERT / UPDATE / DELETE
| Role | INSERT (WITH CHECK) | UPDATE (USING + WITH CHECK) | DELETE | Intent |
| --- | --- | --- | --- | --- |
| medical | **Yes:** role is `medical` and `recorded_by` = caller | **Yes:** role is `medical` before and after; `recorded_by` cannot be changed to someone else | **No** | Medical writes within care scope (D2). Deletion is out of scope. |
| coaching | **No** | **No** | **No** | Deny all writes. |
| scouting | **No** | **No** | **No** | Deny all writes. |

### Table: `players` (shared roster fields)

RLS: **ENABLED.** "smoke:" read policy dropped.

| Role | SELECT (USING) | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| coaching | **Yes:** caller has any staff role | **No** | **No** | **No** |
| scouting | **Yes:** same | **No** | **No** | **No** |
| medical | **Yes:** same | **No** | **No** | **No** |

These columns are shared identity facts only (matrix rule 7). They hold no private
fields. Writes are denied until matrix Q5 names an owner.

### Table: `games` (shared schedule fields)

RLS: **ENABLED.** "smoke:" read policy dropped.

| Role | SELECT (USING) | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| coaching | **Yes:** caller has any staff role | **No** | **No** | **No** |
| scouting | **Yes:** same | **No** | **No** | **No** |
| medical | **Yes:** same | **No** | **No** | **No** |

Writes are denied until matrix Q6 names an owner.

### Table: `staff_profiles` (new)

RLS: **ENABLED** at creation.

| Role | SELECT (USING) | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| coaching | **Own row only:** `user_id` is the caller | **No** | **No** | **No** |
| scouting | **Own row only** | **No** | **No** | **No** |
| medical | **Own row only** | **No** | **No** | **No** |

An administrator manages roles outside the app (D1). The current-role helper reads this
table for the caller only.

### Function: `player_event_summary` (scouting totals)

No policy of its own. It runs with the **caller's** rights, so it inherits the
`scouting_events` SELECT rules. Scouting gets real totals; coaching and medical get
**zero rows** (matrix: coaching Deny pending Q2, medical Deny). EXECUTE is **revoked
from `anon`**, since signed-out callers are denied everything, and kept for
`authenticated`.

---

## Cross-cutting rules

1. **Same tables, different rows.** Filtering happens in Postgres policies, never by
   hiding buttons or pages.
2. **Default deny.** A role-and-operation pair not marked **Yes** above gets **no**
   permissive policy. No policy for `anon`. No "allow all" policy anywhere.
3. **One role system.** Roles come only from `staff_profiles.role` through the
   current-role helper. Never from JWT fields the user can edit, browser flags, or
   request parameters. The values match the matrix and session plan exactly.
4. **No bypass for staff requests.** App server functions query with the user-bound
   server client from `requireSession()`, so RLS applies. The service-role client
   (`app/lib/supabase.server.ts`) bypasses RLS and is only for admin and system work,
   such as assigning roles. It never answers a staff member's data request.
5. **Authorship is enforced, not trusted.** `recorded_by` must equal the caller on
   every insert and stay equal on update. The browser can't set someone else as author.
6. **Remove the temporary access.** The migration drops all five "smoke:" policies from
   Sprint 3 testing. After it runs, signed-out requests return zero rows everywhere.
7. **Open questions stay closed.** Matrix Q2–Q9 are not answered by loosening anything;
   each undecided cell above is **No**.

---

## Traceability

| Matrix row / rule | Table | Policies covered here |
| --- | --- | --- |
| scouting_notes (coaching Deny, scouting R+W, medical Deny) | `scouting_events` | SELECT, INSERT, UPDATE, DELETE |
| scouting_events stat rows (same cells) | `scouting_events` | Same section |
| scouting_summary (coaching Deny pending Q2, scouting R, medical Deny) | `player_event_summary` | Inherits `scouting_events` SELECT; `anon` EXECUTE revoked |
| medical_or_sports_science_data (medical R+W care scope; others Deny) | `sports_science_records` | SELECT, INSERT, UPDATE, DELETE; D2 |
| player_roster_shared_fields (R all; W Deny) | `players` | SELECT; writes Deny |
| game_schedule_shared_fields (R all; W Deny) | `games` | SELECT; writes Deny |
| staff_role_assignment (own row R; W Deny) | `staff_profiles` | SELECT own; writes Deny; D1 |
| Rule 5: signed-out denied everywhere | all tables | No `anon` policies; smoke policies dropped |
| Rule 6: no writing another group's rows | all tables | INSERT/UPDATE limited to owning role |
| Rule 8: aggregate must not leak | `player_event_summary` | Caller-rights function under RLS |
| practice_or_game_plans | (no table yet) | Deferred; spec section added before the table exists |

## Decisions made in this spec (need stakeholder confirmation)

- **D1, role assignment:** `staff_profiles(user_id, role)`, managed only by an admin
  outside the app. This resolves matrix Q1 for Sprint 4.
- **D2, medical care scope:** all athletes for v1. It can only be narrowed later,
  never widened.

## Ready for migration when

- [x] Every sensitive matrix data area maps to a table section above
- [x] Every role has an explicit **Yes** or **No** for SELECT, INSERT, UPDATE and DELETE on every table
- [x] Identity linkage matches the auth-session plan (verified session, user-bound client, server-side role record)
- [x] "Same tables, different rows" is stated for scouting and sports-science data
- [x] No SQL needed to understand the rules
- [ ] Stakeholders confirm D1 and D2
