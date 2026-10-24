# Sprint 4 Handoff: Auth Sessions and Row-Level Security

**Project:** Hockey operations app (scouting notes and sports-science data)
**Sprint:** Sprint 4, Identity: Who You Are and What You May Do
**Date:** 2026-10-24
**Audience:** Hockey ops leads, product owners, and the next engineer or agent
**Related sources (this handoff does not override them):**
`docs/security/hockey-staff-access-brief.md` · `docs/security/role-access-matrix.md` ·
`docs/security/auth-session-plan.md` · `docs/security/rls-policy-spec.md` ·
`docs/security/rls-verification-checklist.md` ·
`supabase/migrations/20250321000000_hockey_staff_rls.sql`

> **Status in one line:** everything is **built and tested on a local copy of the
> database**. It is **not yet switched on in the live Supabase project**: the project
> is paused and the security migration has not been applied. Until it is, the live
> database still has Sprint 3's temporary open access (see §5, risk 1).

---

## 1. Sprint outcome (client story)

**The client's worry:** scouting notes and sports-science data live in shared tables,
but coaching, scouting and medical staff must not all see the same rows. The rules
must hold even if someone skips the app's screens and calls the API directly.

**What this sprint built**, in three layers:
1. **Sign-in:** staff sign in with email and password (Supabase Auth), which gives them
   a session.
2. **A server check on every protected request:** the server confirms that session with
   Supabase before doing anything. The browser's word is never trusted.
3. **Database rules by role (row-level security, RLS):** Postgres itself returns only
   the rows a role may see. Scouting notes go to scouts only, and sports-science
   records go to medical only.

### Privacy goals → controls

Each "must not" rule from the access brief (§4 of that doc):

| # | Privacy goal (access brief) | Control | Status | Evidence |
|---|---|---|---|---|
| 1 | Coaching must not read scouting notes or events | RLS: only `scouting` may read `scouting_events` | **Delivered, not yet live** | Migration; checklist C1–C3 pass on the local DB |
| 2 | Coaching must not read medical data | RLS: only `medical` may read `sports_science_records` | **Delivered, not yet live** | Checklist C4 local pass |
| 3 | Scouting must not read medical data | Same medical-only policy | **Delivered, not yet live** | Checklist B2 local pass |
| 4 | Medical must not read scouting notes or events | Scouting-only policy | **Delivered, not yet live** | Checklist D1 local pass |
| 5 | Signed-out visitors get nothing | Server check fails closed (401); no database access for `anon`; smoke policies dropped | **Partly delivered** | The app path passed live (checklist A1); the database half waits on the migration |
| 6 | No group writes another group's rows | Only scouts log or edit scouting events, as themselves; only medical writes medical rows; nobody deletes | **Delivered, not yet live** | Checklist B3, B4, D3, D4 local pass |
| 7 | Shared facts (names, positions, game dates) visible to staff only, with nothing private in them | Players and games readable by any staff role; no writes | **Delivered, not yet live** | Policy spec, `players` and `games` sections |
| 8 | Rules hold on every path, including the totals function | RLS sits in the database; the totals function runs with the caller's rights | **Delivered, not yet live** | Local check: scout gets 4 total rows, coach gets 0 |
| — | UI hiding is not protection | `/scouting` loads only through a server function; the page filters nothing itself | **Delivered** | `src/routes/scouting/index.tsx`; checklist E3 |
| — | Record who logged each event | `recorded_by` column, set automatically, can't be changed | **Delivered, not yet live** | Migration; checklist B3 |

**"Not yet live"** means: the code and SQL are finished and verified on a local
Postgres copy (34 of 34 checks), but the protection reaches real users only after the
migration is applied to Supabase (§4, steps 1–2).

---

## 2. What was delivered

### Sign-in sessions (Supabase Auth)
- **Staff sign-in page** at `/login`, with sign-in and sign-out helpers:
  `src/routes/login.tsx`, `src/lib/auth/sign-in.ts`, `src/lib/auth/sign-out.ts`.
  - Errors are plain ("Wrong email or password.").
  - Sign-out ends the session.
- **Two separate Supabase connections:**
  - `src/lib/supabase/client.ts`: browser side. Public settings only; it starts
    sign-in.
  - `src/lib/supabase/server.ts`: server side. It reads the signed-in user's session
    cookies. The build **fails** if browser code tries to import it.
- **Setting names** are documented in `.env.example` (placeholders only). The
  powerful service key is never used for staff requests.

### Server-side session check
- **`src/lib/auth/require-session.ts`:** the gate every protected server function calls
  first.
  - It asks Supabase Auth to *confirm* the session, not just read the cookie.
  - No session, or a fake or expired one, means it stops with "not signed in" (401) and
    no data.
  - If Supabase can't be reached, it also stops (503).
- **`src/server/get-current-staff.ts`:** returns who is signed in (`id`, `email`).
  **It does not return the role yet** (see §6).
- **`src/server/scouting-notes.ts`** and **`src/routes/scouting/index.tsx`:** the
  protected scouting notes page. The server checks the session, then queries **as that
  person**, so the database decides which notes they get.

### Database rules by role (RLS)
- **The rules, in plain words:** `docs/security/role-access-matrix.md` (who may do what)
  and `docs/security/rls-policy-spec.md` (row rules per table).
- **The SQL:** `supabase/migrations/20250321000000_hockey_staff_rls.sql`. It:
  - adds a `staff_profiles` table (one role per user) and a role lookup;
  - adds a new `sports_science_records` table;
  - enables RLS everywhere and adds the role policies;
  - removes the Sprint 3 test access.
  **Written and tested; not yet applied.**

### Proof
- **Automated:** `src/lib/auth/require-session.test.ts` has 8 tests covering signed in,
  no session, fake token, and Supabase down. All pass, and I confirmed they catch a
  broken gate.
- **Manual:** `docs/security/rls-verification-checklist.md`, with steps for signed-out,
  scouting, coaching, medical and no-role users. Current sign-off is **Partial**, with
  the blocked rows listed.

---

## 3. How staff get a coaching, scouting or medical role

There is **no admin screen** for this yet. Today it is a short engineer or admin task in
the Supabase dashboard:

1. **Create the user:** Supabase dashboard → Authentication → Users → **Add user** (their
   staff email). Tick **Auto Confirm**, or send an invite.
2. **Give them a role:** in the SQL Editor, add one row to `staff_profiles` with their
   user id and exactly one of `coaching`, `scouting` or `medical`. These spellings must
   match exactly. To change a role later, update that row.
3. **Have them sign in** at `/login`.
4. **Check it:** run that role's rows in `docs/security/rls-verification-checklist.md`.
   For example, a new coach should see "0 notes" on `/scouting`.

**Rules for ops:**
- **Treat a role change as a privileged action.** Two people agree on it, and re-run the
  checklist afterwards.
- **Staff cannot change their own role.** The database blocks it.
- **A signed-in user with no role sees nothing.** That's on purpose.
- **Not available yet:** an admin screen, syncing roles from HR, people holding two
  roles, and temporary "break-glass" access.

---

## 4. How to prove it works (verification)

1. **Restore the Supabase project** if it is paused (dashboard → Restore project).
2. **Apply the migration:** paste
   `supabase/migrations/20250321000000_hockey_staff_rls.sql` into the SQL Editor and
   run it, once.
3. **Create test users,** one per role, as in §3.
4. **Run the automated tests:** `npx vitest run src/lib/auth/require-session.test.ts`
   (or `npm test` for all).
5. **Walk the checklist** in `docs/security/rls-verification-checklist.md`, sections A–F,
   two ways:
   - **App path:** sign in, then open `/scouting`.
   - **Database path:** the SQL Editor queries shown in the checklist.
6. **Record pass or fail with the date** in the checklist's sign-off.

If a check fails, **never fix it by hiding something on screen**. Use the checklist's
"which layer to fix" table: session check, server function, or database policy.

---

## 5. Remaining risks

| # | Risk | Why it matters | What to do |
|---|---|---|---|
| 1 | **Live database still has Sprint 3's temporary open access** ("smoke:" policies) | Until the migration runs, anyone with the app's public key can read scouting notes and add events | Apply the migration as soon as the project is restored. It removes this access. |
| 2 | **Supabase project is paused** | Nothing live can be verified, and the app can't sign anyone in | Restore it, and use it at least weekly (free-tier projects pause when idle) |
| 3 | Wrong role on a staff profile | That person sees too much or too little | Two-person check on role changes; re-run the checklist |
| 4 | Service key misused | It bypasses every database rule | Server-only, never `VITE_`; only for admin jobs, never staff requests |
| 5 | New tables added without RLS | New data could be wide open | "RLS + policy spec section" is part of done for any new sensitive table |
| 6 | Sprint 3 scouting pages (`/scouting/players`, `/events`, `/aggregates`) still call Supabase from the browser | Safe once RLS is live, because the user's session is sent along, but they rely on RLS alone with no server check | Move them behind server functions (Sprint 3 follow-up E4) |
| 7 | The Sprint 2 `directory_people` table has RLS off | Not covered by these rules | Decide what it holds (matrix Q9) and add RLS |
| 8 | Vercel Production deploys failing since Sprint 3 | The public site still runs the Sprint 2 build, with no Supabase env vars | Fix the build from its log, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |
| 9 | No browser tests across roles, and no CI checks | A future change could break a rule unnoticed | Next topic (§6) |

---

## 6. What rolls into the next topic

1. **Admin role assignment:** a controlled way for trusted admins to set or change a
   staff role without hand-written SQL, with an audit trail. Return the role from
   `getCurrentStaff` so screens can adapt (still enforced by RLS).
2. **Playwright role journeys:** browser tests that sign in as each role, open
   `/scouting`, and assert scouts see notes while coaching and medical see "0 notes",
   plus the signed-out case.
3. **CI / Vercel safeguards:**
   - run `npm test` and the role journeys in GitHub Actions;
   - block deploys on failures;
   - fix the failing Vercel build;
   - confirm no service key ever appears in a `VITE_` variable or the browser bundle.
4. **Finish the migration rollout:** apply it live, complete the blocked checklist rows,
   and confirm decisions D1 (admin-assigned roles) and D2 (medical sees all athletes for
   v1).
5. **Medical screens:** `sports_science_records` exists with policies, but there's no
   page or server function for it yet.
6. **Open stakeholder questions** from the matrix: whether coaches may see scouting
   totals (Q2), whether scouts may edit each other's events (Q3), medical caseloads
   (Q4), who owns player and game records (Q5, Q6), and dual roles (Q7).

---

## 7. Decision log (plain language)

1. **Identity is checked on the server, every time.** A modified webpage or a "logged
   in" flag can't fake it. The server confirms the session with Supabase. *(session plan)*
2. **Confirm the session; don't just read the cookie.** We use Supabase's
   verify-the-user call, because a cookie alone could be forged or stale.
   *(require-session.ts)*
3. **Which rows you see is decided by the database,** so the rules hold even when someone
   skips the app. *(RLS migration)*
4. **Roles live in one place,** a `staff_profiles` table that staff can't edit. They never
   come from the browser. *(spec D1)*
5. **When unsure, deny.** Anything the brief didn't clearly allow is blocked until
   stakeholders decide. *(matrix open questions)*
6. **Nobody deletes scouting or medical records.** Corrections are edits, and a scout can
   edit only their own events and only the type, period and note. *(migration refine pass)*
7. **Medical sees all athletes for v1,** and that can only be narrowed later. *(spec D2)*
8. **Proof is part of the delivery.** That means tests that fail when the gate breaks, and
   a checklist that counts "hidden on screen" as a fail.

---

## 8. Sign-off

- [x] Privacy goals from the access brief mapped above (delivered, partly delivered, or not yet live, with evidence)
- [x] Role assignment steps match how `staff_profiles` and RLS actually work
- [x] Verification checklist path is correct and runnable once Supabase is restored
- [ ] Migration applied to the live Supabase project, and the checklist's blocked rows pass
- [ ] Residual risks and next-topic items reviewed with the stakeholder

**Prepared for:** Hockey operations and product
**Sprint status:** identity and per-role data access are **built and verified locally**;
**go-live waits on** restoring Supabase, applying the migration, and passing the live
checklist rows.
