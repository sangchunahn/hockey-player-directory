# Hockey Staff Access Brief

**Sprint:** 4, Identity and Access
**Date:** 2026-10-23
**Status:** Requirements only. No login code, no SQL, no new packages.
**Feeds:** the role-to-data matrix, staff sign-in, server session checks, and
row-level security (RLS) policies later in this sprint.

---

## 1. Problem summary

Hockey operations staff share the same app and the same database tables. Some of
those rows are private to one group:

- **Scouting notes** belong to scouting.
- **Sports-science / medical data** belongs to medical.

Coaching, scouting, and medical staff need **different rows** from the same kinds of
tables.

The rules must hold **even if someone skips the app's screens** and calls the API or
database directly. A rule that only works on the normal screen is not a rule.

---

## 2. Sensitive data (what we protect)

| Data | Where it lives today | Why it is sensitive | Example misuse if leaked |
| --- | --- | --- | --- |
| **Scouting notes** | `scouting_events` rows, especially the free-text `note` column and `note` events (Sprint 3) | Competitive intelligence: who we rate, who we want, and an opponent's weak spots | A coach or medical staffer reads draft targets, or an opponent's weaknesses get passed around outside scouting |
| **Sports-science / medical data** | Not in the database yet. Planned for this sprint (see §9) | Personal health and performance information about real athletes. Highest privacy expectation | A coach benches a player because of a private health measure, or medical details turn into locker-room gossip |

**Shared, non-sensitive facts:** player display name, position, team label, sweater
number, and game date and teams (`players`, `games`). Every staff group may see these,
because they are needed to find a player or a game. They must never carry private
note text or medical measures.

---

## 3. Staff groups and primary goals

Only these three groups exist in this brief. Any other role is an open question (§9).

| Staff group | Primary goal in the app | May see | Must not see |
| --- | --- | --- | --- |
| **Coaching** | Plan practices and games | Shared player and game facts. Coaching-appropriate summaries, such as event counts, **only if stakeholders approve** (§9) | Scouting note text. Any sports-science or medical row |
| **Scouting** | Record and review player evaluations | Shared facts. Scouting events and note text, plus the per-player scouting summary | Any sports-science or medical row |
| **Medical** | Track sports-science and medical data for athletes in their care | Shared facts. Sports-science and medical rows for their care scope | Scouting note text and scouting events. Coaching-only material |

---

## 4. What must never leak across roles

These are hard rules. "Must not" means the database refuses, not that a screen hides
it.

1. A **coaching** account must not read scouting note text or scouting-only event
   rows.
2. A **coaching** account must not read sports-science or medical rows.
3. A **scouting** account must not read sports-science or medical rows.
4. A **medical** account must not read scouting notes or scouting events.
5. A **signed-out** visitor must not read or write **any** scouting or medical row.
6. No staff group may **create or change** rows that belong to another group. For
   example, only scouting can log or correct scouting events.
7. Shared facts (§2) may be visible to every signed-in staff member. They must never
   be used to carry private note text or medical measures.
8. These rules apply to **every path**: screens, server functions, the browser's
   Supabase client, direct REST calls with a copied token, and the `player_event_summary`
   aggregate. A totals function must not reveal what its underlying rows are not
   allowed to show.

---

## 5. Why "hide it in the UI" is not enough

Hiding a menu link, a page, or a table column only changes what a **friendly screen**
shows. The data is still there:

- Anyone can open the browser's network tools, copy a request, and send it again.
- Anyone with a session token or the public key can call the API directly.
- **Today this is already true.** The Sprint 3 "smoke:" policies, applied in the
  dashboard for testing, let anyone holding the app's public key read every
  scouting note and log events, with no sign-in at all. Removing a page would change
  nothing.

Real protection needs all three layers:

1. **Authentication:** prove which staff member is signed in.
2. **Server-side session checks:** server functions re-check that identity before
   any sensitive query runs. The browser's word is never trusted on its own.
3. **Authorization in the database:** PostgreSQL row-level security returns only the
   rows a role may see, on **every** access path, including direct API calls.

The screen can then hide what a role can't use, for convenience, but never as the
protection.

---

## 6. In scope for this sprint (identity slice)

- Staff sign-in and sign-out, with verified sessions.
- A way to know each signed-in staff member's group: coaching, scouting, or medical.
- Server functions that refuse sensitive work when there is no valid session.
- A written role-to-data matrix built from this brief.
- RLS policies for coaching, scouting, and medical that **replace** the temporary
  "smoke:" policies. Signed-out access ends.
- One protected scouting data path that shows filtered reads: a scout sees the notes,
  a coach or medic does not.
- Recording **who logged** a scouting event. This was deferred in Sprint 3 until
  identity existed.

## 7. Out of scope (later work)

- Full HR onboarding of every employee account, or self-service sign-up.
- Fine-grained edit workflows inside medical charts.
- Per-player consent management and legal or compliance certification.
- Mobile-native apps, and exports to third-party data warehouses.
- Deleting players, games, or events (still out of scope from Sprint 3).

---

## 8. Success criteria (how we will know this brief worked)

- [ ] A new teammate can name the three staff groups and the two sensitive data types
      without reading the original client story.
- [ ] Every later matrix, auth, and RLS task points back to a numbered rule in §4.
- [ ] The brief says plainly that UI-only hiding is **not** protection (§5).
- [ ] By sprint end, a direct API call with a coaching or medical session returns
      **zero** scouting note rows, and a signed-out call returns **zero** scouting or
      medical rows.
- [ ] Stakeholders approve or correct this document before any policy is written.

---

## 9. Open questions for stakeholders

1. **Where will sports-science data live?** It has no table yet. Is it one table, or
   several (for example workload vs injury)?
2. **Should coaches see scouting totals** (goals, shots, and similar counts) without
   the note text? Or are all scouting outputs scouting-only?
3. **Can one person hold two roles** (for example coach and scout) in v1, or are roles
   exclusive?
4. **Is "care scope" all athletes**, or only the athletes assigned to that medic?
5. **What about the ops / data steward** from the Sprint 3 brief, who edits player
   records? Is that a fourth role, or part of an existing one?
6. **Who approves emergency "break-glass" access** to medical data outside normal role
   paths, and how is it logged?
7. **The Sprint 2 `directory_people` table** has RLS **off**. Does it hold anything
   sensitive, and should it fall under these rules?
