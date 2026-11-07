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
  type SeedGame,
  type SeedPlayer,
} from '../data/hockeySeed'

/**
 * A player as the SHARED screens (/, /players, /players/$playerId) may see it.
 *
 * `status` is deliberately absent: `ir` (injured reserve) is a medical flag, and
 * docs/access/access-matrix-v2.md seals medical flags in shared views from every
 * role except medical. These loaders serve every visitor alike, so the flag must
 * never leave the server here. Hiding it on the page would not be enough. There
 * is also no status filter, because an "injured only" filter is itself a list of
 * injured players.
 */
export type SharedPlayer = Omit<SeedPlayer, 'status'>

export type PlayersFilter = {
  /** 'all' (or omitted) means no position filter. */
  position?: PlayerPosition | 'all'
}

/** Copies only the shared fields, so the medical flag is never included. */
function toSharedPlayer(player: SeedPlayer): SharedPlayer {
  return { id: player.id, name: player.name, position: player.position, number: player.number, team: player.team }
}

export type GamesFilter = {
  /** '' (or omitted) means any opponent. Matched against opponentCode. */
  team?: string
  /** '' (or omitted) means any date. Exact YYYY-MM-DD match. */
  date?: string
}

/** All players (shared fields only), optionally filtered by position. */
export function listPlayers(filter: PlayersFilter = {}): SharedPlayer[] {
  return seedPlayers
    .filter((p) => !filter.position || filter.position === 'all' || p.position === filter.position)
    .map(toSharedPlayer)
}

/** One player by id (shared fields only), or `null` when no seed player has that id. */
export function getPlayerById(playerId: string): SharedPlayer | null {
  const player = seedPlayers.find((p) => p.id === playerId)
  return player ? toSharedPlayer(player) : null
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
