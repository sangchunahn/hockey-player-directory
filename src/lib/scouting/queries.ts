// Typed, composable READ helpers for the scouting board — the one place screens
// get players, games, and events from Supabase.
//
// Maps to docs/scouting-data-requirements.md:
//   V1 player list ............ listPlayers({ position, teamLabel })
//   V2 game list .............. listGames({ playedFrom, playedTo })
//   V3 event list ............. listEvents({ playerId, gameId, eventType })
//   V3 board rows (joined) .... listEventsWithPlayer(same filters)
//   detail pages .............. getPlayerById(id), getGameById(id)
//   V4 summary ................ later step (single server-side RPC)
//
// Rules this module keeps:
//   - Table/column names come from src/types/database.ts. No SQL strings, no
//     `any`, no casts — a renamed column fails `tsc` right here.
//   - Joins go through the foreign keys (player_id → players, game_id → games),
//     never by matching team-name text.
//   - Filters are optional and AND together; an empty filter means "all".
//   - Supabase errors are thrown (wrapped), never turned into an empty list.
//   - Reads only. Writes, RPC aggregates, and TanStack Query hooks are later steps.

import type { PostgrestError } from '@supabase/supabase-js'

import { getSupabase } from '#/lib/supabase/client'
import type { Database } from '#/types/database'

// ---------------------------------------------------------------------------
// Types derived from the generated schema
// ---------------------------------------------------------------------------

type Tables = Database['public']['Tables']
type Enums = Database['public']['Enums']

export type PlayerRow = Tables['players']['Row']
export type GameRow = Tables['games']['Row']
export type ScoutingEventRow = Tables['scouting_events']['Row']
export type PlayerPosition = Enums['player_position']
export type ScoutingEventType = Enums['scouting_event_type']

/** V1 filters. */
export type PlayerListFilters = {
  position?: PlayerPosition | null
  teamLabel?: string | null
}

/** V2 filters. Dates are inclusive `YYYY-MM-DD` strings (column `played_on`). */
export type GameListFilters = {
  playedFrom?: string | null
  playedTo?: string | null
}

/** V3 filters. Any combination; both ids together means "this player in this game". */
export type EventListFilters = {
  playerId?: string | null
  gameId?: string | null
  eventType?: ScoutingEventType | null
}

/** One scout-board row: the event plus who did it and in which game. */
export type EventWithPlayer = ScoutingEventRow & {
  player: Pick<PlayerRow, 'id' | 'display_name' | 'position' | 'team_label' | 'sweater_number'>
  game: Pick<GameRow, 'id' | 'played_on' | 'home_team' | 'away_team'>
}

/**
 * Thrown when Supabase returns an error. The message is safe to show a scout;
 * the raw PostgrestError (codes, SQL detail) stays on `cause` for logs only.
 */
export class ScoutingQueryError extends Error {
  readonly cause: PostgrestError

  constructor(operation: string, cause: PostgrestError) {
    super(`Could not load scouting data (${operation}).`)
    this.name = 'ScoutingQueryError'
    this.cause = cause
  }
}

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

/**
 * The joined columns for a board row. Embeds follow the FK constraints in
 * database.ts `Relationships`, so supabase-js infers `player` and `game` as
 * single objects (each event has exactly one of each).
 */
const EVENT_WITH_PLAYER_SELECT =
  '*, player:players!scouting_events_player_id_fkey(id, display_name, position, team_label, sweater_number), game:games!scouting_events_game_id_fkey(id, played_on, home_team, away_team)' as const

/** Return rows or throw — never hand back `[]` on failure. */
function unwrapList<T>(operation: string, result: { data: T[] | null; error: PostgrestError | null }): T[] {
  if (result.error) throw new ScoutingQueryError(operation, result.error)
  return result.data ?? []
}

/** Return the row, `null` if it doesn't exist, or throw on failure. */
function unwrapMaybe<T>(operation: string, result: { data: T | null; error: PostgrestError | null }): T | null {
  if (result.error) throw new ScoutingQueryError(operation, result.error)
  return result.data
}

/**
 * supabase-js only half-checks column names: `.order()`, `.gte()`, `.lte()`
 * have an untyped `string` fallback, and the generic `EventFilterable` below
 * erases `.eq()`'s check. So every such column name carries
 * `satisfies keyof <Row>` — a renamed column then fails `tsc` on that line.
 */
type EventColumn = keyof ScoutingEventRow

/** Minimal shape of a scouting_events query that can be filtered by `eq`. */
type EventFilterable<Q> = {
  eq(column: EventColumn, value: string): Q
}

/**
 * Applies V3 filters to any scouting_events query — plain or joined — so both
 * event helpers filter identically. Unset filters are skipped ("all").
 */
function applyEventFilters<Q extends EventFilterable<Q>>(query: Q, filters: EventListFilters): Q {
  let q = query
  if (filters.playerId) q = q.eq('player_id' satisfies EventColumn, filters.playerId)
  if (filters.gameId) q = q.eq('game_id' satisfies EventColumn, filters.gameId)
  if (filters.eventType) q = q.eq('event_type' satisfies EventColumn, filters.eventType)
  return q
}

// ---------------------------------------------------------------------------
// Players (V1)
// ---------------------------------------------------------------------------

/** V1: players, optionally by position and/or team label; name A→Z. */
export async function listPlayers(filters: PlayerListFilters = {}): Promise<PlayerRow[]> {
  let query = getSupabase().from('players').select('*')
  if (filters.position) query = query.eq('position', filters.position)
  if (filters.teamLabel) query = query.eq('team_label', filters.teamLabel)

  return unwrapList('listPlayers', await query.order('display_name' satisfies keyof PlayerRow, { ascending: true }))
}

/** One player by id, or `null` if no such player. */
export async function getPlayerById(id: string): Promise<PlayerRow | null> {
  return unwrapMaybe('getPlayerById', await getSupabase().from('players').select('*').eq('id', id).maybeSingle())
}

// ---------------------------------------------------------------------------
// Games (V2)
// ---------------------------------------------------------------------------

/** V2: games, optionally within an inclusive date range; newest first. */
export async function listGames(filters: GameListFilters = {}): Promise<GameRow[]> {
  let query = getSupabase().from('games').select('*')
  if (filters.playedFrom) query = query.gte('played_on' satisfies keyof GameRow, filters.playedFrom)
  if (filters.playedTo) query = query.lte('played_on' satisfies keyof GameRow, filters.playedTo)

  return unwrapList('listGames', await query.order('played_on' satisfies keyof GameRow, { ascending: false }))
}

/** One game by id, or `null` if no such game. */
export async function getGameById(id: string): Promise<GameRow | null> {
  return unwrapMaybe('getGameById', await getSupabase().from('games').select('*').eq('id', id).maybeSingle())
}

// ---------------------------------------------------------------------------
// Events (V3)
// ---------------------------------------------------------------------------

/** V3 (raw rows): events by player / game / type; most recently recorded first. */
export async function listEvents(filters: EventListFilters = {}): Promise<ScoutingEventRow[]> {
  const query = applyEventFilters(getSupabase().from('scouting_events').select('*'), filters)

  return unwrapList('listEvents', await query.order('created_at' satisfies keyof ScoutingEventRow, { ascending: false }))
}

/**
 * V3 (board rows): events joined to their player and game through the FKs.
 * Sorted per the requirements — game date newest first, then period, then
 * recording order. (Sorting the parent rows by an embedded column is done here
 * rather than in PostgREST, whose `referencedTable` ordering only reorders the
 * embedded rows.)
 */
export async function listEventsWithPlayer(filters: EventListFilters = {}): Promise<EventWithPlayer[]> {
  const query = applyEventFilters(getSupabase().from('scouting_events').select(EVENT_WITH_PLAYER_SELECT), filters)
  const rows: EventWithPlayer[] = unwrapList('listEventsWithPlayer', await query)

  return rows.sort(
    (a, b) =>
      b.game.played_on.localeCompare(a.game.played_on) ||
      (a.period ?? 0) - (b.period ?? 0) ||
      a.created_at.localeCompare(b.created_at),
  )
}
