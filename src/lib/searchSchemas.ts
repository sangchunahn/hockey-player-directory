// Shared, type-safe search (query) param rules for the list pages.
//
// Path params identify ONE resource (e.g. /players/$playerId). Search params
// only FILTER a list without inventing a new path. Both routes import the same
// rules from here so /players and /games never drift apart.
//
// Rule for this sprint: invalid or missing values NEVER throw — they fall back
// to the documented defaults so a pasted/broken link still renders the page.

export type PlayerPosition = 'F' | 'D' | 'G' | 'all'
export type RosterStatus = 'active' | 'ir' | 'all'

export type PlayersSearch = {
  position: PlayerPosition
  status: RosterStatus
}

export type GamesSearch = {
  team: string // '' (no filter) or a club code like 'TOR'
  date: string // '' (no filter) or 'YYYY-MM-DD'
  /**
   * '' or a player id. The seed games do not reference players, so this does
   * not filter the list — it only carries "I came from this player's page" so
   * the games view can show a context banner and a link back to that player.
   */
  playerId: string
}

const PLAYER_POSITIONS: ReadonlySet<string> = new Set(['F', 'D', 'G', 'all'])
const ROSTER_STATUSES: ReadonlySet<string> = new Set(['active', 'ir', 'all'])

/** Filter values used when the URL has no query string. */
export const defaultPlayersSearch = (): PlayersSearch => ({
  position: 'all',
  status: 'active',
})

export const defaultGamesSearch = (): GamesSearch => ({
  team: '',
  date: '',
  playerId: '',
})

/**
 * Coerce an unknown URL search object into a safe `PlayersSearch`.
 * Unknown keys are dropped; unrecognised values fall back to the default.
 */
export function validatePlayersSearch(
  raw: Record<string, unknown>,
): PlayersSearch {
  const defaults = defaultPlayersSearch()
  return {
    position:
      typeof raw.position === 'string' && PLAYER_POSITIONS.has(raw.position)
        ? (raw.position as PlayerPosition)
        : defaults.position,
    status:
      typeof raw.status === 'string' && ROSTER_STATUSES.has(raw.status)
        ? (raw.status as RosterStatus)
        : defaults.status,
  }
}

/**
 * Coerce an unknown URL search object into a safe `GamesSearch`.
 * `team` is upper-cased; `date` must look like YYYY-MM-DD or it is ignored.
 */
export function validateGamesSearch(raw: Record<string, unknown>): GamesSearch {
  const defaults = defaultGamesSearch()
  const team =
    typeof raw.team === 'string' ? raw.team.trim().toUpperCase() : defaults.team
  const dateRaw = typeof raw.date === 'string' ? raw.date.trim() : ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : defaults.date
  // The router's default search parser turns a bare numeric value (`?playerId=12`)
  // into a number, so accept string or number here.
  const playerId =
    typeof raw.playerId === 'string'
      ? raw.playerId.trim()
      : typeof raw.playerId === 'number'
        ? String(raw.playerId)
        : defaults.playerId
  return { team, date, playerId }
}
