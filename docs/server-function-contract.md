# Server function contract — directory reads (Sprint 2, Topic 6)

**Date:** 2026-09-19
**Status:** Design only — no implementation in this file, and none in `app/server/directory.ts` yet
**Consumes:** `docs/boundary-risk-notes.md`, `docs/client-vs-server-inventory.md`
**Implemented by:** Topic 7 (`app/server/directory.ts`)

---

## Purpose

Load directory rows (players and staff) for the Hockey Operations Directory UI from
Supabase. Runs only on the server, using the service-role client in
`app/lib/supabase.server.ts`. The browser sends filter values and receives either safe
display rows or a safe error — never a credential, never a raw database row, never a
Supabase error object.

---

## Function identity

| | |
| --- | --- |
| **Export name** | `getDirectoryEntries` |
| **Module** | `app/server/directory.ts` (created in Topic 7 — not yet) |
| **Kind** | TanStack Start server function — the server-only entry point the route calls |
| **Reads** | `public.directory_people` via `getSupabaseServerClient()` |

---

## Data source

The table created in Topic 5, for reference — **the contract is written against these
exact column names** so the implementer does not have to guess:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `full_name` | text | Not null |
| `role` | text | `'player'` or `'staff'` (DB check constraint) |
| `team` | text | Nullable |
| `position` | text | Nullable. Free text (`'Center'`, `'Head Coach'`) — see mismatch note below |
| `jersey_no` | int | Nullable — staff have none |
| `created_at` | timestamptz | Not used by this function |

---

## Inputs

All optional, so the first UI can ask for "everything" and add filters later.

| Input | Type | Rules |
| --- | --- | --- |
| `search` | string | Trim. Empty/missing means no text filter. Case-insensitive match against `full_name`. Escape `%`, `_` and `\` before use — see note. |
| `role` | string | `'player'` or `'staff'`. Missing/empty means both. Any other value → `VALIDATION` error, **not** a silent fallback. |
| `limit` | number | Default `100`. Clamp to 1–200. Non-numeric → `VALIDATION`. Out-of-range clamps silently (not an error). |

**Two rules the implementer must not get wrong:**

1. **Filter in the query, not after it.** `search` and `role` must be applied in the
   Supabase query, before `limit`. Filtering an already-limited array in memory returns
   the wrong rows — ask for 100, filter to "Chen", and you search only the first 100
   rows instead of the table.
2. **Escape the search pattern.** In a SQL `ilike`, `%` and `_` are wildcards. A user
   typing `%` would match every row. Escaping is pure string work and is a unit-test
   target below.

**Never accepted from the browser:** raw SQL, column or table names, ordering
expressions, arbitrary option bags, or anything resembling a key or token. The input
surface is exactly the three fields above.

---

## Success output

```ts
type DirectoryEntry = {
  id: string                       // from `id` — stable, usable as a React key
  displayName: string              // from `full_name`
  role: 'player' | 'staff'         // from `role`
  teamName: string | null          // from `team`
  positionOrTitle: string | null   // from `position` — "Center" or "Head Coach"
  jerseyNumber: number | null      // from `jersey_no` — null for staff
}

type GetDirectoryEntriesSuccess = {
  ok: true
  entries: DirectoryEntry[]
  meta: {
    count: number                  // entries.length, for empty states
    appliedFilters: {
      search: string | null        // normalized value actually used
      role: 'player' | 'staff' | null
      limit: number                // after clamping
    }
  }
}
```

`meta.appliedFilters` reports what the server *actually used* after normalization, not
what was requested. That is what lets the UI say "no staff match 'Chen'" accurately.

### Example success

```json
{
  "ok": true,
  "entries": [
    { "id": "8f3a…", "displayName": "Alex Morgan", "role": "player",
      "teamName": "Ravens", "positionOrTitle": "Center", "jerseyNumber": 19 },
    { "id": "b120…", "displayName": "Pat Chen", "role": "staff",
      "teamName": "Ravens", "positionOrTitle": "Head Coach", "jerseyNumber": null }
  ],
  "meta": { "count": 2, "appliedFilters": { "search": null, "role": null, "limit": 100 } }
}
```

**An empty directory is success, not an error.** No rows → `ok: true`, `entries: []`,
`count: 0`. The UI renders an empty state. There is no `NOT_FOUND` code for a list.

### Fields deliberately NOT returned

- `created_at` — the UI has no use for it.
- Anything not listed above. The mapper builds a new object field by field; it never
  spreads the database row. A spread would leak whatever columns get added later.

---

## Error shapes

```ts
type GetDirectoryEntriesError = {
  ok: false
  error: {
    code: 'VALIDATION' | 'UPSTREAM' | 'UNKNOWN'
    message: string   // safe, human-readable, no secrets, no stack traces
    field?: 'search' | 'role' | 'limit'   // VALIDATION only — lets the UI mark the input
  }
}

type GetDirectoryEntriesResult = GetDirectoryEntriesSuccess | GetDirectoryEntriesError
```

Discriminated by `ok`, so the UI branches once and TypeScript narrows the rest.

| Situation | code | Message the browser sees |
| --- | --- | --- |
| Unknown `role`, non-numeric `limit` | `VALIDATION` | Names the bad input: `"Unknown role 'coach'. Expected 'player' or 'staff'."` Echo only the value the caller sent. |
| Supabase or network failure | `UPSTREAM` | `"Directory temporarily unavailable. Try again."` Full error logged server-side only. |
| Unexpected bug | `UNKNOWN` | `"Something went wrong loading the directory."` Details logged server-side only. |

`UNAUTHORIZED` is **reserved, not implemented** — there is no login yet. It is named
here so adding it in Sprint 4 does not change the success shape.

### Example validation error

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION",
    "field": "role",
    "message": "Unknown role 'coach'. Expected 'player' or 'staff'."
  }
}
```

### The rule that matters most

**Never return a Supabase error object, and never `JSON.stringify` one into a message.**
They can carry request configuration. Catch it, log the detail on the server, return
one of the three flat codes above.

---

## Pure logic vs I/O

This split is what makes the Vitest suite possible. Pure functions take plain objects
and return plain objects — no Supabase import, no env read, no network, no clock.

### Pure — suggested module `app/server/directoryMappers.ts`

| Function | Signature (plain language) | Why it is testable |
| --- | --- | --- |
| `normalizeDirectoryQuery` | raw input → normalized input, or a `VALIDATION` error | Table-driven: unknown role, `limit: 0` → 1, `limit: 9999` → 200, whitespace-only search → null |
| `buildSearchPattern` | user text → escaped `ilike` pattern | `"50%"` must not become a wildcard match |
| `mapRowToDirectoryEntry` | one DB row → one `DirectoryEntry` | Staff row with null `jersey_no` maps to `jerseyNumber: null`, not `0` or `undefined` |

### I/O — server only, in `app/server/directory.ts`

- Calling `getSupabaseServerClient()` (reads `serverEnv`).
- The `.from('directory_people').select(...)` query, filters, and `limit`.
- `try`/`catch` around the call, and server-side logging of the real error.
- Assembling the final result from mapped rows.

**The seam:** `directory.ts` does I/O and calls the pure helpers. Tests import
`directoryMappers.ts` directly and never touch Supabase or env. If a test needs a
Supabase mock to run, the split is in the wrong place.

---

## Boundary rules

Carried forward from the two prior docs:

- The service-role key never appears in the return type, in a message, in `meta`, or in
  a log line the browser can see.
- Only `app/server/directory.ts` (and other server modules) may import
  `app/lib/supabase.server.ts`. No route or component imports it — the check is a grep
  for `supabase.server` outside `app/server/`.
- The browser receives `DirectoryEntry` objects and safe error codes. Nothing else.
- Server-side logs may contain detail; responses may not.

---

## Two schema mismatches the implementer must handle

Recorded here so Topic 7 does not discover them mid-implementation.

**1. `directory_people` has no status column.** Sprint 1's seed rows carry
`status: 'active' | 'ir'`, and the scaffold for this contract suggests an `isActive`
field — but the new table has no column to derive it from. `isActive` is therefore
**omitted from `DirectoryEntry` in v1** rather than fabricated. This also sidesteps, for
now, the IR-visibility privacy question raised in
`docs/client-vs-server-inventory.md` §3: with no login, publishing who is injured was a
real concern. Add the column and the field together, deliberately, when auth lands.

**2. Position values do not match Sprint 1's filter.** The existing `/players` UI
filters by `'F' | 'D' | 'G'`; `directory_people.position` holds free text like
`'Center'`, `'Defense'`, `'Head Coach'`. This contract's `role` filter is a *different
axis* (player vs staff) and does not replace the position filter. Wiring the existing
position filter to real data is **out of scope for v1** — see Non-goals.

---

## Non-goals

- Create, update, or delete. Read-only.
- Pagination cursors — `limit` alone is enough for v1.
- Search ranking or fuzzy matching. Simple case-insensitive substring only.
- Sorting options from the caller. Server picks a stable order (`full_name`).
- Replacing `listGames` / `directorySummary`. Games stay on seed data this sprint.
- Mapping Sprint 1's `'F' | 'D' | 'G'` position filter onto the new table.
- Auth, roles, or per-user row filtering — Sprint 4.

---

## Acceptance checks for the implementer

1. `app/server/directory.ts` exports `getDirectoryEntries` as a TanStack Start server
   function; the route calls it rather than importing `supabase.server.ts`.
2. `grep -r "supabase.server" src app` shows importers only under `app/server/`.
3. Unknown `role` returns `ok: false`, `code: 'VALIDATION'`, `field: 'role'` — and no
   query is sent.
4. `search` and `role` are applied in the Supabase query, before `limit`.
5. A search containing `%` matches the literal character, not every row.
6. An empty table returns `ok: true` with `entries: []` — not an error.
7. A forced Supabase failure returns `code: 'UPSTREAM'` with no upstream detail in the
   response; the detail appears only in the server log.
8. Returned objects contain exactly the six `DirectoryEntry` fields — no `created_at`,
   no row spread.
9. The pure helpers are importable and testable with no Supabase or env available.
10. After `npm run build`, no `SERVICE_ROLE` string appears in the client assets.

---

## Traceability

- **Why secrets stay server-side:** `docs/boundary-risk-notes.md`
- **What may run where:** `docs/client-vs-server-inventory.md` — directory load = server,
  render = client
- **How secrets are read:** `app/config/env.ts` (`serverEnv`), `app/lib/supabase.server.ts`
