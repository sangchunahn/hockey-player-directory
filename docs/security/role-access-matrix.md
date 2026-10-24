# Role Access Matrix — Hockey Staff (Sprint 4)

**Source brief:** `docs/security/hockey-staff-access-brief.md` (the rules referenced as
§ and rule numbers below come from that file)
**Purpose:** the contract for app session checks and, later, Postgres row-level
security (RLS). Later code must match this table. If code and table disagree, the
code is wrong.
**Roles (columns):** coaching | scouting | medical. There are no other roles; see the
open questions.
**Date:** 2026-10-23

## How to read this matrix

- **R** = may read matching rows
- **W** = may create or update matching rows
- **R+W** = both
- **Deny** = no read and no write
- **Row scope** says *which* rows: team-wide, own (rows the person created), care
  scope, or field-limited. A cell without a scope is not finished.
- **Signed-out visitors** are not a role. They get **Deny on every row** (rule 5).

## Matrix

| Data kind (logical) | Coaching | Scouting | Medical | Row scope and why |
| --- | --- | --- | --- | --- |
| **player_roster_shared_fields** (`players`: display name, position, team label, sweater #) | R | R | R | **Team-wide, field-limited** to those four fields. These are the shared facts every group needs to find a player (§2). They never carry note text or medical measures (rule 7). **W: Deny for all three**, because the brief gives no staff group the job of editing players (Q5). |
| **game_schedule_shared_fields** (`games`: date, home team, away team) | R | R | R | **Team-wide.** Shared facts (§2). **W: Deny for all three**, because who creates games is undecided (Q6). |
| **scouting_notes** (`scouting_events.note` text and `note`-type events) | **Deny** | **R+W** | **Deny** | **Scouting R: team-wide**, meaning all scouting notes (§3). **Scouting W:** create with themselves as the recorded author; update **own notes only** until Q3 decides whether scouts may correct each other's. **Coaching: Deny** (rule 1). **Medical: Deny** (rule 4). |
| **scouting_events** (stat observations: goal, assist, shot, hit, penalty; no note text) | **Deny** | **R+W** | **Deny** | Same scope as scouting notes. **Coaching: Deny** (rule 1: "scouting-only event rows"). **Medical: Deny** (rule 4: "scouting events"). Only scouting may log or correct them (rule 6). |
| **scouting_summary** (per-player totals from the `player_event_summary` aggregate) | **Deny** *(pending Q2)* | R | **Deny** | **Scouting: team-wide** totals. **Coaching:** the brief allows it only *if stakeholders approve* (§3), so it is Deny until Q2 says yes. **Medical: Deny.** The aggregate must not show totals from rows the caller can't read (rule 8). **W: Deny for all**, because totals are computed, never edited. |
| **medical_or_sports_science_data** (no table yet; planned this sprint) | **Deny** | **Deny** | **R+W** | **Medical: care scope.** Whether that means all athletes or only an assigned caseload is undecided (Q4). Until then, implementers must not assume "all rows" without stakeholder sign-off. **Coaching: Deny** (rule 2). **Scouting: Deny** (rule 3). |
| **practice_or_game_plans** (no table yet) | **R+W** | **Deny** | **Deny** | **Coaching: team-wide.** Planning practices and games is coaching's goal (§3). **Scouting** and **medical: Deny**, because the brief allows neither (deny-by-default). If coaches later want to share availability or opponent context, add a separate, narrower row. Never open up full plans. |
| **staff_role_assignment** (which role each signed-in person holds) | R | R | R | **Own row only.** Each person may see their own role, so the app can show the right screens. **W: Deny for all three.** Nobody may grant themselves a role; how roles are assigned is Q1. |

## Role summaries

### Coaching
- **Primary need:** plan practices and games, using shared player and game facts.
- **May:** read the roster and schedule; read and write coaching plans.
- **Must not:** read or write scouting notes, scouting events, or medical and
  sports-science data. No scouting totals unless Q2 approves.

### Scouting
- **Primary need:** record and review player evaluations.
- **May:** read the roster and schedule; read all scouting notes, events and totals;
  log events as themselves; correct their own.
- **Must not:** read or write medical and sports-science data, or coaching plans.

### Medical
- **Primary need:** sports-science and medical data for athletes in their care.
- **May:** read the roster and schedule; read and write medical data within care
  scope.
- **Must not:** read or write scouting notes, scouting events, scouting totals, or
  coaching plans.

## Deny-by-default

Any role-and-data pair not explicitly allowed above is **denied**. That includes
data kinds added later until this matrix gets a row for them. **Signed-out
requests are denied everywhere.**

Hiding a page or a button is **not** how these rules are enforced (§5). They must hold
on every path:
- screens
- server functions
- the browser's Supabase client
- direct REST calls with a copied token
- the summary aggregate

## Open questions (resolve before the RLS migration)

1. **Role assignment:** how is a signed-in person mapped to coaching, scouting or
   medical? Who is allowed to assign or change a role, and where is that recorded?
   The role must come from a server-side source the user cannot edit, never from a
   browser flag.
2. **Coaching and scouting totals:** may coaches read per-player counts (goals,
   shots…) without note text? Until answered, it is **Deny**.
3. **Correcting another scout's work:** may a scout edit events another scout
   logged, or only their own? Until answered, **own only**. This needs an author
   column on scouting events (in scope in brief §6).
4. **Medical care scope:** all athletes, or only athletes assigned to that medic? If
   assigned, what records the assignment?
5. **Player record edits:** the Sprint 3 brief had an ops/data-steward role that edits
   players. Is that a fourth role, or part of an existing one? Until answered, **no
   one** edits players through the app.
6. **Game creation:** who may create or edit games? Until answered, **Deny**.
7. **Dual roles:** can one person hold two roles (for example coach and scout)? If
   yes, is access the union of both columns, or a stricter rule?
8. **Break-glass access:** who may open medical data in an emergency outside these
   rules, and how is that logged? This is out of scope for Sprint 4.
9. **`directory_people` (Sprint 2):** RLS is currently off. Does it hold anything
   sensitive, and which matrix row does it belong to?
10. **Today's temporary "smoke:" policies** (dashboard only) give signed-out visitors
    read and write access. They contradict this matrix, and the RLS migration must
    remove them.

## Acceptance for implementers

- [x] Three roles match the brief's staff groups (coaching, scouting, medical).
- [x] Every sensitive data kind from the brief is its own row: scouting notes,
      scouting events, scouting summary, medical/sports-science.
- [x] Medical raw data is **Deny** for coaching and scouting.
- [x] Scouting notes, events and totals are **Deny** for medical.
- [x] Every allow cell has a row scope (team-wide, own, care scope, field-limited).
- [x] Signed-out visitors are denied everywhere.
- [x] Open questions list everything the brief did not decide, starting with role
      assignment.
- [ ] Stakeholders have answered Q1–Q7 before the RLS migration is written.
