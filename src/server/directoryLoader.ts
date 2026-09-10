// Server-side directory helpers.
//
// Routes call these from their `loader` so the data is read on the server and
// baked into the first HTML response (server-render / first paint). No
// client-only `useEffect` fetching for the main directory content this sprint.
//
// Today these read the in-memory seed arrays. A later sprint replaces the
// bodies with real data-source calls (e.g. Supabase); the signatures and the
// route code stay the same.
import {
  seedGames,
  seedPlayers,
  type PlayerPosition,
  type RosterStatus,
  type SeedGame,
  type SeedPlayer,
} from '../data/hockeySeed'

export type PlayersFilter = {
  /** 'all' (or omitted) means no position filter. */
  position?: PlayerPosition | 'all'
  /** 'all' (or omitted) means no status filter. */
  status?: RosterStatus | 'all'
}

export type GamesFilter = {
  /** '' (or omitted) means any opponent. Matched against opponentCode. */
  team?: string
  /** '' (or omitted) means any date. Exact YYYY-MM-DD match. */
  date?: string
}

/** All players, optionally filtered by already-validated search values. */
export function listPlayers(filter: PlayersFilter = {}): SeedPlayer[] {
  return seedPlayers.filter((p) => {
    if (filter.position && filter.position !== 'all' && p.position !== filter.position) {
      return false
    }
    if (filter.status && filter.status !== 'all' && p.status !== filter.status) {
      return false
    }
    return true
  })
}

/** One player by id, or `null` when no seed player has that id. */
export function getPlayerById(playerId: string): SeedPlayer | null {
  return seedPlayers.find((p) => p.id === playerId) ?? null
}

/** All games, optionally filtered by already-validated search values. */
export function listGames(filter: GamesFilter = {}): SeedGame[] {
  return seedGames.filter((g) => {
    if (filter.team && g.opponentCode !== filter.team) return false
    if (filter.date && g.date !== filter.date) return false
    return true
  })
}

/** Small summary used by the home page. */
export function directorySummary(): {
  playerCount: number
  gameCount: number
  upcomingCount: number
} {
  return {
    playerCount: seedPlayers.length,
    gameCount: seedGames.length,
    upcomingCount: seedGames.filter((g) => g.status === 'scheduled').length,
  }
}
