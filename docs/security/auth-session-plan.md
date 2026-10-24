# Auth Session Plan — Hockey Staff (Sprint 4)

**Status:** plan only. No login code, client files, or SQL exist yet for this step.
**Inputs:** `docs/security/role-access-matrix.md` (what each role may see) and
`docs/security/hockey-staff-access-brief.md` (why).
**Date:** 2026-10-23

## Purpose

This plan covers **how we know who is asking**:
- how staff prove who they are with Supabase Auth;
- where the session lives;
- how TanStack Start server functions re-check it before any sensitive query.

**What each person may see** is decided by the role matrix, not here.

## Roles in scope (from the matrix)

- coaching
- scouting
- medical

There are no other roles. Signed-out visitors are not a role; the matrix denies them
everything. How a person *gets* a role is matrix open question Q1, and this plan does
not decide it.

---

## End-to-end sequence

1. **Login.** A staff member opens the sign-in page and enters their staff email and
   password. Supabase Auth checks them. On success it creates a **session**.
2. **Session storage.** The session is a short-lived **access token** plus a
   **refresh token**. They are stored in **cookies**, using Supabase's server-side
   auth helpers, so the browser sends them with every request automatically. No secret
   key is ever placed in front-end code.
3. **Server verify.** Before touching private data, a TanStack Start **server
   function** builds a **server Supabase client** from the request's cookies and runs
   a **require-session** helper. That helper asks Supabase Auth to *verify* the user,
   not just read the cookie. It then looks up the user's role from a server-side
   record. If anything is missing or invalid, it **stops** (fail closed).
4. **Data access.** Only then does the function query. The query runs **as that
   signed-in user**, so Postgres **row-level security (RLS)** can filter rows per role,
   following the matrix. RLS comes in a later step. The UI is never the only gate.

```text
Staff browser            TanStack Start server            Supabase Auth / Postgres
     |                            |                                  |
     |-- email + password ------->|-- sign in ---------------------->|
     |<-- session cookies --------|<-- session (access + refresh) ---|
     |                            |                                  |
     |-- "load scouting board" -->| server function                  |
     |   (cookies sent along)     |-- require-session: verify user ->|
     |                            |<-- user id (or "no session") ----|
     |                            |   no session? -> 401, no rows    |
     |                            |-- query AS this user ----------->|
     |<-- only allowed rows ------|<-- rows filtered by RLS (later) -|
```

---

## Browser Supabase client vs server Supabase client

| Client | Where it runs | Used for | Never used for |
|--------|---------------|----------|----------------|
| **Browser client** | The staff member's browser: sign-in page, sign-out button | Starting sign-in and sign-out; keeping the session cookies fresh | Deciding what someone is allowed to see. The browser can be edited by its user. |
| **Server client** | Inside TanStack Start server functions | Reading the session from the request's cookies, verifying it, and running queries as that user, so RLS applies | Anything in the browser bundle |

**Two clients that already exist, and what changes:**
- **`src/lib/supabase/client.ts`** (Sprint 3, anon key) is currently used by the
  scouting hooks *from the browser*. Sensitive scouting reads and writes move behind
  server functions that use the server client. That also closes acceptance row E4.
- **`app/lib/supabase.server.ts`** (Sprint 2, service-role key) **bypasses RLS
  entirely.** It must **never** answer a staff member's request for scouting or
  medical data, or every role check is skipped. It stays for trusted admin or system
  jobs only.

---

## Session rules (non-negotiable)

1. **Server proof only.** React state, a hidden menu, a URL, or a `role: "scout"` flag
   sent by the browser is **never** proof of identity or role.
2. **Verify, don't just read.** The server confirms the session with Supabase Auth
   (a "get the verified user" call). Reading whatever the cookie says is not enough,
   because a cookie can be forged or stale.
3. **Every sensitive server function checks again.** A check on one page does not
   carry over to another function.
4. **Fail closed.** If there is no session, or it is expired or invalid, return a
   "not signed in" error with **zero** private rows. No partial data, no fallback to
   the anon key, no fallback to the service-role key.
5. **Role from the server.** The role comes from a server-side record the user can't
   edit (matrix Q1), and its names match the matrix exactly: `coaching`, `scouting`,
   `medical`. A signed-in user with **no** role gets no sensitive data.
6. **Sign-out ends it everywhere.** Sign-out clears the session cookies. Later
   requests then fail the require-session check.

---

## Server functions that must call require-session (planned)

| Planned server entry | Matrix rows it touches | Why it needs the check |
|---|---|---|
| `getCurrentStaff` | staff_role_assignment (own row) | Says who is signed in and their role, so the UI can show the right screens. Returns "not signed in" otherwise. |
| `listScoutingBoard` / `listScoutingEvents` | scouting_notes, scouting_events | Note text and scouting events only after the session is verified. RLS then allows scouting only. |
| `getPlayerEventSummary` (server path) | scouting_summary | Totals are scouting data too. Coaching is Deny until matrix Q2 is answered. |
| `createScoutingEvent` / `updateScoutingEvent` (server path) | scouting_notes, scouting_events (W) | Writes need identity too. The author is recorded from the verified user, never from the form. |
| Future medical / sports-science loaders and writers | medical_or_sports_science_data | Same pattern: session first, role second, then query. |
| Future coaching-plan loaders and writers | practice_or_game_plans | Same pattern. |

**Shared roster and schedule reads** (`players`, `games`) are also behind a signed-in
check, because the matrix denies signed-out visitors everything.

**Sign-in and sign-out** create and clear the session. They are not data loaders, so
they don't call require-session, but they must use the right client for where they
run.

---

## What this plan deliberately defers

- The typed client files (browser and server) and the cookie-helper package (next step)
- The sign-in page, sign-out control, and their modules
- The actual `require-session` helper code and its tests
- Moving the Sprint 3 scouting hooks onto server functions
- Role assignment design (matrix Q1)
- **Postgres RLS policy SQL**, which replaces the temporary "smoke:" policies in a
  later step after the authorization concept check. RLS is where per-role row
  filtering is truly enforced.

## Acceptance checks for later agent work

- [ ] Browser and server Supabase clients are separate files, each used only where
      this plan says.
- [ ] Sign-in creates a real Supabase Auth session stored in cookies, not fake
      local-only "logged in" state.
- [ ] Every sensitive server function in the table above calls require-session
      **before** its query.
- [ ] require-session verifies the user with Supabase Auth, not just a cookie read.
- [ ] A call with no session, an expired session, or only a client "role" flag
      returns "not signed in" and zero private rows.
- [ ] No staff request is ever answered with the service-role client.
- [ ] Role names in code match the matrix: coaching, scouting, medical.
- [ ] The role matrix stays the source of truth; RLS (later) enforces its rows.

## Source links

- Role matrix: `docs/security/role-access-matrix.md`
- Access brief: `docs/security/hockey-staff-access-brief.md`
- Sprint 2 boundary rules: `docs/client-vs-server-inventory.md`
