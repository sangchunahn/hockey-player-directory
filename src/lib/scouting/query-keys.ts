// TanStack Query key factory for scouting data — the ONLY place cache keys are
// built. Hooks (./hooks.ts) and, next step, mutation invalidation both use it;
// never write a scouting key as a literal array anywhere else.
//
// Hierarchy (prefix = what an invalidation can target):
//
//   ['scouting']                                          everything
//   ['scouting', 'players']                               all player data
//   ['scouting', 'players', 'list', filters]              listPlayers
//   ['scouting', 'players', 'detail', id]                 getPlayerById
//   ['scouting', 'games']                                 all game data
//   ['scouting', 'games', 'list', filters]                listGames
//   ['scouting', 'games', 'detail', id]                   getGameById
//   ['scouting', 'events']                                all event data
//   ['scouting', 'events', 'list', filters]               listEvents
//   ['scouting', 'events', 'board', filters]              listEventsWithPlayer
//   ['scouting', 'aggregates']                            all server-side totals
//   ['scouting', 'aggregates', 'player-event-summary', f] getPlayerEventSummary
//
// Filters are part of the key, so "Northline forwards" and "all players" are
// separate cache entries. They are normalized first: unset values (undefined,
// null, '') are dropped, so {} and { position: null } share one entry instead
// of fetching the same rows twice.

import type { EventListFilters, GameListFilters, PlayerListFilters } from './queries'
import type { PlayerEventSummaryFilters } from './rpc'

/**
 * Drops unset filter values so equivalent filters produce identical keys.
 * Every scouting filter value is a string (ids, enum codes, YYYY-MM-DD dates).
 */
function normalizeFilters(filters: Record<string, string | null | undefined>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value) result[key] = value // skips undefined, null, ''
  }
  return result
}

export const scoutingKeys = {
  all: ['scouting'] as const,

  players: () => [...scoutingKeys.all, 'players'] as const,
  playerLists: () => [...scoutingKeys.players(), 'list'] as const,
  playerList: (filters: PlayerListFilters = {}) =>
    [...scoutingKeys.playerLists(), normalizeFilters(filters)] as const,
  playerDetail: (playerId: string) => [...scoutingKeys.players(), 'detail', playerId] as const,

  games: () => [...scoutingKeys.all, 'games'] as const,
  gameLists: () => [...scoutingKeys.games(), 'list'] as const,
  gameList: (filters: GameListFilters = {}) => [...scoutingKeys.gameLists(), normalizeFilters(filters)] as const,
  gameDetail: (gameId: string) => [...scoutingKeys.games(), 'detail', gameId] as const,

  events: () => [...scoutingKeys.all, 'events'] as const,
  eventLists: () => [...scoutingKeys.events(), 'list'] as const,
  eventList: (filters: EventListFilters = {}) => [...scoutingKeys.eventLists(), normalizeFilters(filters)] as const,
  eventBoards: () => [...scoutingKeys.events(), 'board'] as const,
  eventBoard: (filters: EventListFilters = {}) =>
    [...scoutingKeys.eventBoards(), normalizeFilters(filters)] as const,

  aggregates: () => [...scoutingKeys.all, 'aggregates'] as const,
  playerEventSummary: (filters: PlayerEventSummaryFilters = {}) =>
    [...scoutingKeys.aggregates(), 'player-event-summary', normalizeFilters(filters)] as const,
}
