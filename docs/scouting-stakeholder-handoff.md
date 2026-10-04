# Northline Hockey — Scouting Data Layer Stakeholder Handoff

**Sprint:** 3, Typed Data Access and Cached Server State
**Date:** 2026-10-04
**Audience:** Scouts, ops, and engineering, including readers who will not open the repo
**Status:** Ready for handoff. In-scope work is complete and live-verified with seed data.
It is **not** production-hardened (see §3).
**Core promise:** *A schema change should not silently break the board.*

---

## 1. For scouts and ops (plain summary)

**What you can do now:**
- **Players:** see every player and narrow the list by position (F/D/G) or team.
- **Games:** see the game list, newest first.
- **Events:** see every logged event, with the player's name and the game's date and
  teams on each row. Narrow the board to one player, one game, both, or one event type.
- **Log an event:** a goal, assist, shot, hit, penalty or written note, for a player in
  a game.
- **Player summary:** goals, assists, shots, hits, penalties, notes, total events, and
  how many games each player has events in. Narrow it by position or date range.

**Totals come from the database.** It counts every matching event in one step. Your
browser never adds up rows, so totals can't drift from the event list.

**The board updates itself after you save.** The event board and player totals refresh
on their own within a moment, without reloading the page. Lists your save could not
have changed, such as the roster, are left alone, so the app stays fast.

**When something goes wrong, you see a clear message**, not a blank page. For example:
"A note event needs note text." A failed save leaves the board as it was.

**Why you can trust it:** if engineering renames or removes something in the database,
the project's type check fails during development and points at the broken file. A
change like that reaches your screen only as a visible error, never as wrong numbers.

---

## 2. What we built (in scope)

### 2.1 Entities and relationships

| Entity | Role for scouts | Keys / relationships |
|---|---|---|
| `players` | Who is being evaluated: name, position (F/D/G), team label, optional sweater number | uuid primary key; referenced by events |
| `games` | Context: date, home team, away team | uuid primary key; one game per date + matchup; referenced by events |
| `scouting_events` | One observation of one player in one game: type, optional period (1–5), optional note (required for `note`) | Foreign keys to `players` and `games`, both required, `ON DELETE RESTRICT` |

**Key decisions** (`docs/scouting-schema-notes.md`): position and event type are fixed
lists in the database (enums), not free text. Events link to players and games **by id,
never by name**, so correcting a player's name or team never orphans their events.
Deletes are blocked while events exist, because deletion is out of scope.

**Why this protects the board:** Postgres enforces the relationships with keys and
checks, not UI string matching. An event for a player or game that doesn't exist is
rejected by the database (verified: error `23503`).

### 2.2 Typed data-access boundary

Screens may only use the functions listed in `docs/scouting-data-access-api.md`:

| Layer | Path | What it provides |
|---|---|---|
| Generated types | `src/types/database.ts` | Generated from the live schema by `npm run gen:types`. Never hand-edited. |
| Reads | `src/lib/scouting/queries.ts` | `listPlayers`, `getPlayerById`, `listGames`, `getGameById`, `listEvents`, `listEventsWithPlayer` |
| Writes | `src/lib/scouting/mutations.ts` | `createScoutingEvent`, `updateScoutingEvent`, `updatePlayer`: return `{ data, error }` with scout-readable messages |
| Aggregate | `src/lib/scouting/rpc.ts` | `getPlayerEventSummary`, the only place `.rpc()` is called |
| Cached reads | `src/lib/scouting/hooks.ts` | `usePlayers`, `usePlayer`, `useGames`, `useGame`, `useEvents`, `useEventBoard`, `usePlayerEventSummary` |
| Cached writes | `src/lib/scouting/mutation-hooks.ts` | `useCreateScoutingEvent`, `useUpdateScoutingEvent`, `useUpdatePlayer` |
| Cache keys | `src/lib/scouting/query-keys.ts` | `scoutingKeys`, the only place cache keys are built |

**Boundary rules:**
- Routes import hooks only.
- Nothing outside `src/lib/scouting/` imports the Supabase client.
- No `.rpc()` call exists outside `rpc.ts`.
- No SQL strings in app code.
- No `any` or casts to silence type errors.

New data needs get a new typed helper, added to the API doc in the same commit.

**Why this protects the board:** every table, column, filter and RPC argument is
checked against the generated types. Renaming two columns in those types produced 14
`tsc` errors across 5 files (re-run 2026-10-04): loud in development, not silent in
production.

### 2.3 RPC aggregate

- **What:** `public.player_event_summary(p_position, p_played_from, p_played_to,
  p_game_id)`, defined in `supabase/migrations/002_scouting_aggregates_rpc.sql`. It
  returns one row per player with events: the six per-type counts, the total, and the
  number of distinct games, sorted by name.
- **How:** one SQL query that joins the tables, groups by player, and counts per type
  with `COUNT(*) FILTER`. There are no loops, and nothing is counted in the browser.
- **Security:** it runs with the caller's own permissions, so it counts only rows that
  Row Level Security lets the caller see. Its search path is pinned. Execute rights are
  granted to `anon`, `authenticated` and `service_role` only.
- **Why this protects the board:** the function's arguments and result columns are in
  the generated types. A wrong argument name or a missing column fails `tsc`, and
  `npm run gen:types` refuses to write types that are missing this function.

### 2.4 Cache invalidation rules

Full map: `docs/scouting-cache-invalidation-map.md`

| After this write | Refreshes | Deliberately left alone |
|---|---|---|
| Log an event (`useCreateScoutingEvent`) | Event lists and boards that could contain it (same player, game or type, or unfiltered), plus every player summary | Roster, player and game details, game list |
| Correct an event (`useUpdateScoutingEvent`) | That player's and game's event lists and boards under any type filter, plus every summary | Same as above |
| Correct a player (`useUpdatePlayer`) | That player's detail, all rosters, event boards (they show names), summaries | Raw event lists, games |

**Rules:**
- A failed save refreshes nothing.
- Saving waits until the visible lists have refetched.
- Totals are refetched from the database, never patched in the browser.
- Nothing refreshes the whole cache.

**Why this protects the board:** the writes and the lists share one key factory, so a
save can't "forget" a view on screen.

### 2.5 Acceptance snapshot

From `docs/scouting-acceptance-verification.md`: a live walk-through on 2026-10-04 of
`/scouting/players`, `/scouting/events` and `/scouting/aggregates`, against the
Supabase project with hand-countable seed data.

| Area | Result | Evidence in one line |
|---|---|---|
| Reads, joins, filters (R1–R4) | **Pass** | Board rows show player and game. Filters run on the server. Avery + 2026-09-20 = 3 events = hand count. Empty states are safe. |
| RPC aggregate (A1–A3) | **Pass** | One RPC request. Every count matches hand counts. After a logged goal, Drew Gray went from 0 to 1 goals, 1 to 2 events, and 1 to 2 games. |
| Freshness after a write (C1–C3) | **Pass** | Without a reload, the board showed the new goal. Only the save and the board refetch ran; the roster and games were untouched. |
| Safe errors, DB join integrity (E1–E2) | **Pass** | A bad note event showed a message and sent nothing. A missing player id was rejected by the foreign key. |
| Write isolation (E3) | **Waived** | There is no edit-event screen yet. It is covered by code review and the local database test, not by a live click. |
| Client/server boundary (E4) | **Waived (partial)** | No service-role key is in the browser bundle. **But** the public Supabase client is, so access currently rests on Row Level Security alone. |

**Not claimed:** this was a manual smoke pass on one machine with seed data. It is not
end-to-end automation, a load test, or a security sign-off.

---

## 3. Explicitly out of scope (next sprint or later)

Do **not** treat these as done:

1. **Auth roles.** There is no login and no scout, coach or admin roles. Supabase Auth
   role mapping is not built. "Who recorded this event" is not tracked.
2. **Playwright coverage depth.** Only smoke-test routes and a manual acceptance pass
   exist. There is no automated end-to-end suite, no CI browser runs, and no
   edge-case E2E.
3. **Production RLS policy polish.** RLS is on for all three tables, and the repo
   migrations add no policies. For the smoke test, the owner applied five temporary
   **"smoke:" policies** through the dashboard. They are **not in the repo**. They let
   anyone with the app's public key read the data and log or edit events. Replacing
   them with role-based policies, policy tests and per-role access proofs is
   next-sprint work. Until then, don't share the app URL widely.
4. **Server-only data access (E4).** The scouting hooks call Supabase from the browser
   with the public key. Moving reads and writes behind server functions is a
   follow-up.
5. **Product scope from the requirements doc:**
   - fan pages, ticketing, payments
   - video
   - fantasy or betting
   - live stat feeds
   - deleting players, games or events
   - charts and dashboards
6. **Missing write paths:** create player, create game, and edit game. No helpers or
   hooks exist, and who creates games is an open question.

---

## 4. How schema evolution works next time

1. Write a **new** file in `supabase/migrations/`. Never edit an applied migration, and
   never change production by hand only.
2. Apply it. 001 and 002 were applied through the dashboard SQL Editor, so the CLI has
   no migration history. Before switching to `supabase db push`, follow the repair step
   in `docs/typegen-notes.md`.
3. Run `npm run gen:types`. It refuses to write if an expected table or RPC is missing.
   Commit the regenerated types **in the same commit** as the migration.
4. Run `npx tsc --noEmit` and fix every reported helper. Don't cast errors away.
5. If a list or write is new, add a typed helper and a `scoutingKeys` entry. Update
   `docs/scouting-data-access-api.md` and `docs/scouting-cache-invalidation-map.md`.
6. Re-run the rows in `docs/scouting-acceptance-verification.md` that the change
   touches.
7. Update this handoff if anything a scout sees has changed.

This loop is how we keep the promise: **a schema change should not silently break the
board.**

---

## 5. Artifact index

| Doc / area | Path |
|---|---|
| Requirements and success criteria | `docs/scouting-data-requirements.md` |
| Schema notes and decisions | `docs/scouting-schema-notes.md` |
| Type generation recipe | `docs/typegen-notes.md` |
| Data-access public API | `docs/scouting-data-access-api.md` |
| Cache invalidation map | `docs/scouting-cache-invalidation-map.md` |
| Acceptance verification | `docs/scouting-acceptance-verification.md` |
| This handoff | `docs/scouting-stakeholder-handoff.md` |
| Migrations | `supabase/migrations/001_scouting_schema.sql`, `002_scouting_aggregates_rpc.sql` |
| Smoke-test routes | `src/routes/scouting/players.tsx`, `events.tsx`, `aggregates.tsx` |

---

## 6. Recommended next-sprint boundaries

| Track | Goal | Depends on this sprint |
|---|---|---|
| Auth and RLS | Login, scout/ops roles, role-based policies replacing "smoke:", a "recorded by" column on events | Stable tables, typed API, the RLS-on default from 001 |
| Server boundary | Move scouting reads and writes behind server functions so no database client ships to the browser (closes E4) | The hook layer: only the data source behind each hook changes |
| E2E quality | Playwright suite for the R/A/C rows, run in CI | Stable routes and key factory; acceptance rows as test specs |
| Product UX | Edit-event screen (closes E3 live), player/game creation, richer filters | Mutation hooks and invalidation map |
| Ops hygiene | Set `VITE_SUPABASE_*` in Vercel; fix the local `npm run dev` Nitro error; adopt CLI migration history | `.env.example`, `docs/typegen-notes.md` |

**Open questions carried forward** (from the schema notes and requirements):
- Should `players` merge with Sprint 2's `directory_people`? That table also has RLS off.
- Who creates games?
- Is a 1–5 period range right for the leagues Northline scouts?

---

## 7. Sign-off

| Role | Name | Date | Notes |
|---|---|---|---|
| Scout lead | | | |
| Engineering | sangchunahn | 2026-10-04 | In-scope work verified live; see §2.5 and §3 caveats |
| Ops (optional) | | | |
