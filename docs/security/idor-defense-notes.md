# IDOR defense notes

## What this closes

A signed-in staff member must not open another player's confidential roster
or scouting record just by editing the player id or note id in the web
address — for example changing `/players/11111111-2222-4333-8444-555555555555`
to a neighboring id. That is an insecure direct object reference (IDOR):
treating a valid-looking id from the visitor as if it were permission to open
that record. `src/server/authorizeResource.ts` closes that for the two
resource kinds in scope here, `player` and `scouting_note`, by checking the
id's shape and the signed-in caller before any record is read.

## Safe identifiers

`src/server/authorizeResource.ts` accepts an id only when it matches a UUID
shape: 32 hex digits (`0-9a-f`) in groups of 8-4-4-4-12, hyphens included.
Quotes, spaces, and SQL keywords never match this pattern, so a malformed id
is rejected before any database call is made, not caught by a database error
afterward.

- **Rejected example:** `player';select`
- **Allowed example:** `11111111-2222-4333-8444-555555555555`

## Who may see the record

Role names below are copied from `docs/security/role-access-matrix.md` and
`docs/access/access-matrix-v2.md`. The TypeScript map (`MAY_READ`) uses these
same strings.

- `coaching` may read `player` only (shared roster/schedule facts).
- `scouting` may read `player` and `scouting_note`.
- `medical` may read `player` only (not scouting notes).
- `assistant_scout` may read `player` and `scouting_note`, per
  `docs/access/new-roles-brief.md` and `docs/access/access-matrix-v2.md`.
- `video_analyst` may read `player` and `scouting_note` (read-only in the
  matrix; this module only covers reads).
- Any role not listed, and a signed-out visitor, may read neither kind.

Both matrices treat players, games, and scouting data as **team-wide** for
every signed-in staff role — this is a single-team app, so there is no
per-team id to narrow access by. `decideResourceAccess` therefore takes only
a role and a resource kind, not a team id.

## Where the role now comes from

`src/server/get-current-staff.ts` reads the caller's role by calling
`public.current_staff_role()` (added in
`supabase/migrations/20250321000000_hockey_staff_rls.sql`) through the
per-request, session-bound client from `requireSession` — the public anon
key plus this person's own session cookies, **never the service-role key**.
That function reads only the caller's own `staff_profiles` row (`auth.uid()`
on the server, not a value the browser sends), which matches the
`staff_role_assignment: own row only` cell in
`docs/security/role-access-matrix.md`. Reading an already-assigned role this
way does not require role-access-matrix open question 1 (how an admin
*assigns* a role in the first place) to be answered; it only reads whatever
role, if any, already exists.

`authorizeResource` now passes that real role into `decideResourceAccess`
instead of a hardcoded `null`. `decideResourceAccess` itself was already
correct against both matrices and is exported so it can be unit-tested
directly; this step only replaces what feeds it.

**A failed role lookup must deny, never retry with a more privileged key.**
If the RPC call errors for any reason — the migration not applied to this
project yet, the function renamed, Supabase Auth briefly unreachable —
`getCurrentStaff` returns `role: null` for that request. A `null` role is
"no role means no access" in `docs/security/rls-policy-spec.md`: it is
**not** a signal to re-run the same lookup against the service-role client,
which bypasses RLS and must never answer a staff member's own request
(`src/lib/supabase/server.ts`, `docs/access/service-role-key-rule.md`). The
one and only role source for a signed-in staff member's own read is their
own session-bound client; if that fails, the read is denied, the same as if
the row was simply missing.

A denied read and a missing read still look identical to the caller: both
throw the same "Record not found" error from `authorizeResource`, so the app
never confirms that a rejected id belongs to someone else's real record.

## What this file must never do

- No service-role key and no service-role client.
- No new tables and no rewritten row-level security policies. Existing RLS
  (`docs/security/rls-policy-spec.md`) stays the database backstop
  regardless of what this file decides.
- No role taken from the browser. Until a real role source exists, the role
  is treated as unknown, never as whatever a request claims.

## Reviewer walk-through

1. An id like `player';select` is rejected by `assertSafeIdentifier` before
   `authorizeResource` ever calls `getCurrentStaff` or touches a query.
2. A signed-in caller with a valid UUID for `player` or `scouting_note` is
   now checked against their real role, read via
   `public.current_staff_role()` on their own session-bound client. A caller
   with no `staff_profiles` row, or any lookup failure, still resolves to
   `role: null` and is denied, the same fail-closed outcome as before this
   step. `decideResourceAccess('scouting', 'scouting_note')` returns
   `'allow'` directly, showing the matrix logic the real role now feeds into.
