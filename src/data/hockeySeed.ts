// Seed (mock) hockey data for Sprint 1.
//
// Fake but realistic. This is what the server loaders read so the directory
// pages have real content on first paint — no database yet. A later sprint
// swaps these arrays for a real data source without changing the route code.

export type PlayerPosition = 'F' | 'D' | 'G'
export type RosterStatus = 'active' | 'ir'

export type SeedPlayer = {
  /** Stable id used in the bookmarkable URL `/players/<id>`. */
  id: string
  name: string
  position: PlayerPosition
  number: number
  team: string
  status: RosterStatus
}

export type SeedGame = {
  id: string
  /** Opponent display name. */
  opponent: string
  /** Opponent short code, used by the `team` search filter (e.g. "TOR"). */
  opponentCode: string
  /** ISO date, YYYY-MM-DD. */
  date: string
  venue: 'home' | 'away'
  status: 'scheduled' | 'final'
}

export const HOME_TEAM = 'Valley Glaciers'

export const seedPlayers: readonly SeedPlayer[] = [
  { id: '9', name: 'Riley Chen', position: 'F', number: 9, team: HOME_TEAM, status: 'active' },
  { id: '11', name: 'Marcus Boivin', position: 'F', number: 11, team: HOME_TEAM, status: 'active' },
  { id: '12', name: 'Alex Mercer', position: 'F', number: 12, team: HOME_TEAM, status: 'active' },
  { id: '17', name: 'Devon Pratt', position: 'F', number: 17, team: HOME_TEAM, status: 'ir' },
  { id: '19', name: 'Sasha Petrov', position: 'F', number: 19, team: HOME_TEAM, status: 'active' },
  { id: '22', name: 'Cole Whitfield', position: 'F', number: 22, team: HOME_TEAM, status: 'active' },
  { id: '4', name: 'Jordan Lee', position: 'D', number: 4, team: HOME_TEAM, status: 'active' },
  { id: '6', name: 'Nils Andersson', position: 'D', number: 6, team: HOME_TEAM, status: 'active' },
  { id: '27', name: 'Tomas Varga', position: 'D', number: 27, team: HOME_TEAM, status: 'ir' },
  { id: '44', name: 'Beau Lantz', position: 'D', number: 44, team: HOME_TEAM, status: 'active' },
  { id: '30', name: 'Sam Ortiz', position: 'G', number: 30, team: HOME_TEAM, status: 'active' },
  { id: '35', name: 'Henrik Aalto', position: 'G', number: 35, team: HOME_TEAM, status: 'active' },
]

export const seedGames: readonly SeedGame[] = [
  { id: 'g1', opponent: 'Toronto', opponentCode: 'TOR', date: '2026-03-14', venue: 'home', status: 'final' },
  { id: 'g2', opponent: 'Boston', opponentCode: 'BOS', date: '2026-03-18', venue: 'away', status: 'final' },
  { id: 'g3', opponent: 'Lakeside', opponentCode: 'LKS', date: '2026-03-20', venue: 'home', status: 'scheduled' },
  { id: 'g4', opponent: 'River City', opponentCode: 'RVC', date: '2026-03-24', venue: 'away', status: 'scheduled' },
  { id: 'g5', opponent: 'Toronto', opponentCode: 'TOR', date: '2026-04-02', venue: 'away', status: 'scheduled' },
  { id: 'g6', opponent: 'North Bay', opponentCode: 'NBY', date: '2026-04-05', venue: 'home', status: 'scheduled' },
]
