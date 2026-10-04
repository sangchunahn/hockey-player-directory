# Scouting cache invalidation map

**Code:** `src/lib/scouting/mutation-hooks.ts`
**Keys:** `scoutingKeys` in `src/lib/scouting/query-keys.ts`
**Consumers:** UI routes (next step) and the acceptance checks for criterion 6 ("cache
freshness") in `docs/scouting-data-requirements.md`.

## Rules

1. **Refresh only related keys.** Every `invalidateQueries` call passes a
   `scoutingKeys.*` prefix. Never call it bare, and never call `queryClient.clear()`.
2. **A failed write refreshes nothing.** The writes return `{ data, error }`. The hooks'
   `mutationFn` throws `ScoutingMutationError` when `error` is set, so `onError` runs and
   `onSuccess` does not. The board keeps its last good values and shows the message.
3. **Event writes always refresh aggregates.** Postgres recounts the totals. The browser
   never patches a count with `setQueryData`.
4. **Narrow by the saved row.** Event lists and boards refresh only when their filters
   could include the saved event: same `playerId`, same `gameId`, or that filter unset.
5. **Wait for the refetch.** `onSuccess` returns the invalidation promise, so
   `isPending` stays true until the visible lists show the change.
6. **Server state only.** UI state (open panels, selected chips) is not in the query
   cache. Components change it in their own `mutate(…, { onSuccess })` callbacks.

## Mutation → keys

| Mutation hook | Calls (`mutations.ts`) | Invalidates (`scoutingKeys`) | Scout reason |
|---|---|---|---|
| `useCreateScoutingEvent` | `createScoutingEvent` | `events()` filtered to lists/boards that could hold the new row (match on `playerId`, `gameId`, `eventType`, or unset) | The new goal appears on tonight's game board and that player's event list. |
| | | `aggregates()` (every `playerEventSummary`) | Goal and event totals go up by one, recounted by the RPC. |
| `useUpdateScoutingEvent` | `updateScoutingEvent` | `events()` filtered to that event's `playerId` and `gameId`; any `eventType` filter | A corrected type moves the row between "goals" and "shots" lists. The old type is unknown, so every type filter refreshes. |
| | | `aggregates()` | The per-type counts shift (one fewer goal, one more shot). |
| `useUpdatePlayer` | `updatePlayer` | `playerDetail(id)` | The edited profile shows the new name or number. |
| | | `playerLists()` | A new team or position moves the player between filtered rosters. |
| | | `eventBoards()` | Board rows show the player's name and position. |
| | | `aggregates()` | Summary rows show name, position and team, and are filtered by position. |

## Deliberately NOT invalidated

| Write | Left alone | Why |
|---|---|---|
| `createScoutingEvent`, `updateScoutingEvent` | `playerLists()`, `playerDetail(id)`, `gameLists()`, `gameDetail(id)` | No player or game row changed. The roster cached earlier stays put. |
| `createScoutingEvent` | Lists and boards filtered to another player, game or type | They cannot contain the new row. |
| `updatePlayer` | `eventLists()` (raw rows) | Raw event rows hold only `player_id`, not player fields. |
| `updatePlayer` | `games()`, other players' details | Unrelated rows. |

## Writes with no hook (yet)

`mutations.ts` has no create-player, create-game or update-game helpers. Games are
not editable in the app yet, and who creates them is an open question in the
requirements. If one is added, add its hook here in the same commit. For example:
`createPlayer` invalidates `playerLists()`; `updateGame` invalidates `gameDetail(id)`,
`gameLists()`, `eventBoards()` and `aggregates()` (board rows and date filters use game
fields).

## Verified (2026-10-04)

The scenarios were replayed against a real `QueryClient` with the writes mocked.
- **Logging a goal** for player p1 in game g1 refreshed: the g1 board, the unfiltered
  board, p1's list, the goals list, and both summaries. It left alone: the roster, both
  player details, the game list and game detail, the g2 board, p2's list, and the
  shots list.
- **A failed write** threw `ScoutingMutationError` and refreshed nothing.
- **Changing an event's type** also refreshed the shots list.
- **Renaming a player** refreshed boards, but not raw event lists or games.
