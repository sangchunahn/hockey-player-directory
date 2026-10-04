# Scouting data-access public API

**Status:** locked 2026-10-03 (Sprint 3). Types regenerated after migration 002.
**Consumers:** UI routes, server functions, and the TanStack Query hooks added next.

Northline scouts trust the board only if every list, write, and total goes through one
typed layer. UI code talks to Supabase **only** through the functions below. Anything
not listed here is private.

---

## Allowed imports (public)

### `src/lib/scouting/queries.ts` — reads (throw `ScoutingQueryError` on failure)

| Function | Scout use | Filters |
|---|---|---|
| `listPlayers(filters?)` | Roster / player list (V1), name A→Z | `position`, `teamLabel` |
| `getPlayerById(id)` | Player detail page; `null` if not found | — |
| `listGames(filters?)` | Game list (V2), newest first | `playedFrom`, `playedTo` |
| `getGameById(id)` | Game detail page; `null` if not found | — |
| `listEvents(filters?)` | Raw event rows (V3) | `playerId`, `gameId`, `eventType` |
| `listEventsWithPlayer(filters?)` | **Board rows**: events with player + game joined, e.g. "events in this game with player names" | same as `listEvents` |

Types: `PlayerRow`, `GameRow`, `ScoutingEventRow`, `EventWithPlayer`,
`PlayerPosition`, `ScoutingEventType`, `PlayerListFilters`, `GameListFilters`,
`EventListFilters`, `ScoutingQueryError`.

### `src/lib/scouting/mutations.ts` — writes (return `{ data, error }`, never throw)

| Function | Scout use |
|---|---|
| `createScoutingEvent(input)` | Log a goal, shot, hit, … or a **note** about a player (`event_type: 'note'`) |
| `updateScoutingEvent(eventId, patch)` | Correct one event's type, period, or note |
| `updatePlayer(playerId, patch)` | Ops: correct one player's name, position, team, or number |

Types: `CreateScoutingEventInput`, `UpdateScoutingEventPatch`, `UpdatePlayerPatch`,
`MutationResult`, `MutationError`.

### `src/lib/scouting/rpc.ts` — set-based totals (throws `ScoutingQueryError`)

| Function | Scout use | Filters |
|---|---|---|
| `getPlayerEventSummary(filters?)` | Per-player summary (V4): goals, assists, shots, hits, penalties, notes, total events, distinct games — e.g. "goals by player this month" | `position`, `playedFrom`, `playedTo`, `gameId` |

Types: `PlayerEventSummaryFilters`, `PlayerEventSummaryRow` (= generated
`Functions['player_event_summary']['Returns'][number]`).

---

## Private (do not import from routes, components, or hooks)

- **`src/lib/supabase/client.ts` (`getSupabase`)**: imported only by
  `src/lib/scouting/*`. No `getSupabase().from(...)` anywhere else.
- **`app/lib/supabase.server.ts`**: the service-role client. Never in scouting UI code
  (Sprint 2 boundary).
- **`.rpc('...')` outside `src/lib/scouting/rpc.ts`**: no RPC names as strings anywhere
  else.
- **Hand-written SQL or PostgREST strings in app code**: schema changes go in
  `supabase/migrations/`.
- **Internal helpers inside the modules** (`unwrapList`, `applyEventFilters`,
  `runWrite`, …) are not exported and are not part of this API.

## Type contract

- Every helper is typed from `src/types/database.ts`. That file is generated and must
  never be hand-edited.
- Callers must not cast results (`as any`, `as SomeRow`) or use `@ts-ignore` to get
  around a type error. A type error means the schema changed, so fix the caller.
- After any migration that changes tables or RPCs: apply it, run `npm run gen:types`
  (it refuses to write types missing an expected table or RPC), and commit the types
  **in the same commit** as the migration, **before** any UI uses the change.

## Stability rule

If a new scout screen needs data that isn't exposed here:

1. Add a typed helper in `src/lib/scouting/` (`queries.ts` for reads, `mutations.ts`
   for writes, `rpc.ts` plus a migration for aggregates).
2. Add it to this doc in the same commit.

Do not bypass the layer "just this once". Renaming or removing a listed function is a
breaking change. Update every caller and this doc together.
