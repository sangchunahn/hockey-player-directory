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

## An open gap this file does not paper over

`docs/security/role-access-matrix.md` leaves open question 1 unanswered: how
a signed-in person's role is actually recorded and read back. Because of
that, `src/server/get-current-staff.ts` deliberately returns only `{ id,
email }` today — no `role` field exists yet to read. So right now,
`authorizeResource` always denies every call: it passes `role: null` into
`decideResourceAccess`, which denies by design when the role is unknown,
matching "no role means no access" in `docs/security/rls-policy-spec.md`.
`decideResourceAccess` itself is already correct against both matrices and
is exported so it can be unit-tested directly. Once a real role source
exists, wiring it in is a one-line change (replace the `null` with that
role) — this step does not build that source and does not edit
`src/server/get-current-staff.ts` or `src/server/scouting-notes.ts`.

A denied read and a missing read look identical to the caller: both throw
the same "Record not found" error from `authorizeResource`, so the app never
confirms that a rejected id belongs to someone else's real record.

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
   still denied today, because `role` resolves to `null` until
   `docs/security/role-access-matrix.md` open question 1 is answered and a
   real role source is wired in. `decideResourceAccess('scouting', 'scouting_note')`
   returns `'allow'` directly, showing the matrix logic is correct and ready
   for that wiring.
