// TanStack Query hooks for scouting READS — one hook per public read/RPC in
// docs/scouting-data-access-api.md. Components use these hooks for scouting
// lists and never import the Supabase client.
//
// Rules this module keeps:
//   - queryFn only calls the typed helpers in ./queries.ts and ./rpc.ts. No
//     Supabase client, .from(), or .rpc() here: schema safety stays in one place.
//   - Every queryKey comes from scoutingKeys (./query-keys.ts), so next step's
//     mutations can invalidate by prefix.
//   - Data types are inferred from the helpers' return types (no `any`).
//   - Hooks that need an id don't fetch until there is one: `enabled` is
//     false and queryFn is `skipToken`, so no request goes out with an
//     undefined or empty id.
//   - Reads only. Mutation hooks and cache invalidation are the next step.
//
// Requires a <QueryClientProvider> above any component that uses these hooks.

import { skipToken, useQuery } from '@tanstack/react-query'

import {
  getGameById,
  getPlayerById,
  listEvents,
  listEventsWithPlayer,
  listGames,
  listPlayers,
  type EventListFilters,
  type GameListFilters,
  type PlayerListFilters,
} from './queries'
import { scoutingKeys } from './query-keys'
import { getPlayerEventSummary, type PlayerEventSummaryFilters } from './rpc'

/** Treats undefined, null, and whitespace-only ids as "not ready yet". */
function readyId(id: string | null | undefined): string | null {
  const trimmed = id?.trim()
  return trimmed ? trimmed : null
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

/** V1 roster: players by position and/or team, name A→Z. */
export function usePlayers(filters: PlayerListFilters = {}) {
  return useQuery({
    queryKey: scoutingKeys.playerList(filters),
    queryFn: () => listPlayers(filters),
  })
}

/** One player for a detail page. Waits until `playerId` is set; data is `null` if not found. */
export function usePlayer(playerId: string | null | undefined) {
  const id = readyId(playerId)
  return useQuery({
    queryKey: scoutingKeys.playerDetail(id ?? ''),
    queryFn: id ? () => getPlayerById(id) : skipToken,
    enabled: id !== null,
  })
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

/** V2 game list: optional date range, newest first. */
export function useGames(filters: GameListFilters = {}) {
  return useQuery({
    queryKey: scoutingKeys.gameList(filters),
    queryFn: () => listGames(filters),
  })
}

/** One game for a detail page. Waits until `gameId` is set; data is `null` if not found. */
export function useGame(gameId: string | null | undefined) {
  const id = readyId(gameId)
  return useQuery({
    queryKey: scoutingKeys.gameDetail(id ?? ''),
    queryFn: id ? () => getGameById(id) : skipToken,
    enabled: id !== null,
  })
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** V3 raw event rows by player, game, and/or event type. */
export function useEvents(filters: EventListFilters = {}) {
  return useQuery({
    queryKey: scoutingKeys.eventList(filters),
    queryFn: () => listEvents(filters),
  })
}

/**
 * V3 board rows: events with player and game joined (e.g. tonight's game board
 * with player names). Same filters as useEvents.
 */
export function useEventBoard(filters: EventListFilters = {}) {
  return useQuery({
    queryKey: scoutingKeys.eventBoard(filters),
    queryFn: () => listEventsWithPlayer(filters),
  })
}

// ---------------------------------------------------------------------------
// Aggregates (RPC)
// ---------------------------------------------------------------------------

/**
 * V4 per-player summary: goals, assists, shots, hits, penalties, notes, total
 * events, and distinct games, counted in Postgres by one RPC call.
 */
export function usePlayerEventSummary(filters: PlayerEventSummaryFilters = {}) {
  return useQuery({
    queryKey: scoutingKeys.playerEventSummary(filters),
    queryFn: () => getPlayerEventSummary(filters),
  })
}
