// TanStack Query mutation hooks for scouting WRITES — one per write in
// ./mutations.ts. Each hook runs the typed write, then invalidates ONLY the
// cached views that write can change (docs/scouting-cache-invalidation-map.md).
//
// Rules this module keeps:
//   - mutationFn only calls the typed writes in ./mutations.ts. No Supabase
//     client, .from(), or .rpc() here.
//   - Those writes return { data, error } instead of throwing. mutationFn turns
//     an error into a thrown ScoutingMutationError, so a failed save runs
//     onError (UI shows the message) and NEVER onSuccess. Nothing is
//     invalidated, and the board keeps its last good values.
//   - Every invalidation uses a scoutingKeys factory prefix. Never a bare
//     invalidateQueries() or queryClient.clear(), and never a hand-typed key.
//   - Keys are invalidated, not hand-edited: totals are recounted by Postgres,
//     never patched in the browser with setQueryData.
//   - onSuccess returns the invalidation promise, so the mutation stays
//     "pending" until the visible lists have refetched. A "Saved" state means
//     the board already shows the change.
//   - UI state (open panels, selected chips) is not touched here; components
//     handle that in their own mutate(..., { onSuccess }) callbacks.

import { useMutation, useQueryClient, type Query } from '@tanstack/react-query'

import {
  createScoutingEvent,
  updatePlayer,
  updateScoutingEvent,
  type CreateScoutingEventInput,
  type MutationResult,
  type UpdatePlayerPatch,
  type UpdateScoutingEventPatch,
} from './mutations'
import type { ScoutingEventRow } from './queries'
import { scoutingKeys } from './query-keys'

/** Thrown by mutationFn when a write returns an error. `message` is scout-safe. */
export class ScoutingMutationError extends Error {
  readonly code: string | undefined

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'ScoutingMutationError'
    this.code = code
  }
}

/** { data, error } → data, or throw so TanStack Query takes the onError path. */
function orThrow<T>(result: MutationResult<T>): T {
  if (result.error) throw new ScoutingMutationError(result.error.message, result.error.code)
  return result.data
}

/**
 * True if a cached event list/board (key: ['scouting','events', kind, filters])
 * could contain `row`, judged by its filters. Unset filter = matches anything.
 * `matchEventType` is false for updates: the event's OLD type is unknown, so a
 * list filtered by any type might need the row added or removed.
 */
function eventListMayContain(row: ScoutingEventRow, matchEventType: boolean) {
  return (query: Query): boolean => {
    const filters: unknown = query.queryKey[3]
    if (typeof filters !== 'object' || filters === null) return true // unknown shape → refresh, never miss
    const f: Record<string, unknown> = { ...filters }
    return (
      (f.playerId === undefined || f.playerId === row.player_id) &&
      (f.gameId === undefined || f.gameId === row.game_id) &&
      (!matchEventType || f.eventType === undefined || f.eventType === row.event_type)
    )
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Log an event (goal, shot, … or a 'note' about a player).
 * Refreshes: event lists + boards that could include it (same player/game/
 * type, or unfiltered) and every per-player summary. Leaves alone: roster,
 * player/game details, game list (no player or game row changed).
 */
export function useCreateScoutingEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateScoutingEventInput) => orThrow(await createScoutingEvent(input)),
    onSuccess: (saved) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: scoutingKeys.events(), predicate: eventListMayContain(saved, true) }),
        queryClient.invalidateQueries({ queryKey: scoutingKeys.aggregates() }),
      ]),
  })
}

export type UpdateScoutingEventVariables = { eventId: string; patch: UpdateScoutingEventPatch }

/**
 * Correct one event's type, period, or note.
 * Refreshes: event lists + boards for that event's player/game (any type
 * filter: the old type may have dropped out), and every summary (type counts
 * moved). Leaves alone: roster, details, game list.
 */
export function useUpdateScoutingEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ eventId, patch }: UpdateScoutingEventVariables) =>
      orThrow(await updateScoutingEvent(eventId, patch)),
    onSuccess: (saved) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: scoutingKeys.events(), predicate: eventListMayContain(saved, false) }),
        queryClient.invalidateQueries({ queryKey: scoutingKeys.aggregates() }),
      ]),
  })
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export type UpdatePlayerVariables = { playerId: string; patch: UpdatePlayerPatch }

/**
 * Ops: correct one player's name, position, team, or number.
 * Refreshes: that player's detail, all roster lists (a new team/position moves
 * them between filtered lists), event boards (rows show the player's name and
 * position), and summaries (show name/position/team; position filter).
 * Leaves alone: raw event lists (no player fields), games, other players' details.
 */
export function useUpdatePlayer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ playerId, patch }: UpdatePlayerVariables) => orThrow(await updatePlayer(playerId, patch)),
    onSuccess: (saved) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: scoutingKeys.playerDetail(saved.id) }),
        queryClient.invalidateQueries({ queryKey: scoutingKeys.playerLists() }),
        queryClient.invalidateQueries({ queryKey: scoutingKeys.eventBoards() }),
        queryClient.invalidateQueries({ queryKey: scoutingKeys.aggregates() }),
      ]),
  })
}
