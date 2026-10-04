// Caller for the V4 per-player scouting summary RPC — one round trip, counted in
// Postgres by public.player_event_summary (supabase/migrations/
// 002_scouting_aggregates_rpc.sql). Never rebuild this by fetching events and
// counting in JavaScript, and never loop a query per player (N+1).
//
// Function and parameter names below must match the SQL exactly:
//   player_event_summary(p_position, p_played_from, p_played_to, p_game_id)
//
// Until the next step regenerates src/types/database.ts, the generated
// `Database` has no `Functions` entry for this RPC, so the typed client would
// reject the call. Instead of casting, this module (1) widens the shared client
// to the untyped SupabaseClient shape for this one call and (2) checks every
// returned row against the local PlayerEventSummaryRow type at runtime. After
// regen, drop both and let the generated Functions type drive it.

import type { SupabaseClient } from '@supabase/supabase-js'

import { getSupabase } from '#/lib/supabase/client'

import { ScoutingQueryError, type PlayerPosition } from './queries'

/** Exact name of the SQL function. */
const RPC_NAME = 'player_event_summary'

/** V4 filters. All optional; omitted means "all". Dates are inclusive YYYY-MM-DD. */
export type PlayerEventSummaryFilters = {
  position?: PlayerPosition | null
  playedFrom?: string | null
  playedTo?: string | null
  gameId?: string | null
}

/** One row of player_event_summary — mirrors its RETURNS TABLE columns. */
export type PlayerEventSummaryRow = {
  player_id: string
  display_name: string
  position: PlayerPosition
  team_label: string
  /** Distinct games with at least one matching event. */
  games_count: number
  /** All matching events; equals the sum of the six type counts. */
  event_count: number
  goal_count: number
  assist_count: number
  shot_count: number
  hit_count: number
  penalty_count: number
  note_count: number
}

const COUNT_COLUMNS = [
  'games_count',
  'event_count',
  'goal_count',
  'assist_count',
  'shot_count',
  'hit_count',
  'penalty_count',
  'note_count',
] as const


/** Runtime check that one RPC row has the shape the SQL promises. */
function toSummaryRow(raw: unknown): PlayerEventSummaryRow {
  if (typeof raw !== 'object' || raw === null) throw new Error('row is not an object')
  const r: Record<string, unknown> = { ...raw }

  const text = (key: string): string => {
    const value = r[key]
    if (typeof value !== 'string') throw new Error(`${key} is not text`)
    return value
  }
  const count = (key: (typeof COUNT_COLUMNS)[number]): number => {
    const value = r[key]
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(`${key} is not a count`)
    return value
  }
  const position = r.position
  if (position !== 'F' && position !== 'D' && position !== 'G') throw new Error('position is not F/D/G')

  return {
    player_id: text('player_id'),
    display_name: text('display_name'),
    position,
    team_label: text('team_label'),
    games_count: count('games_count'),
    event_count: count('event_count'),
    goal_count: count('goal_count'),
    assist_count: count('assist_count'),
    shot_count: count('shot_count'),
    hit_count: count('hit_count'),
    penalty_count: count('penalty_count'),
    note_count: count('note_count'),
  }
}

/**
 * V4: per-player event counts by type plus distinct games, computed in one
 * set-based Postgres call. Sorted by display name A→Z (the SQL's ORDER BY).
 * Players with no matching events are not returned.
 *
 * Throws ScoutingQueryError (safe message; raw error on `cause`) if Supabase
 * returns an error, and a plain Error if a row doesn't match the SQL's shape —
 * never an empty list in place of a failure.
 */
export async function getPlayerEventSummary(
  filters: PlayerEventSummaryFilters = {},
): Promise<PlayerEventSummaryRow[]> {
  // Temporary widening until typegen includes this RPC (see header).
  const client: SupabaseClient = getSupabase()

  const { data, error } = await client.rpc(RPC_NAME, {
    p_position: filters.position ?? null,
    p_played_from: filters.playedFrom ?? null,
    p_played_to: filters.playedTo ?? null,
    p_game_id: filters.gameId ?? null,
  })

  if (error) throw new ScoutingQueryError('getPlayerEventSummary', error)
  if (!Array.isArray(data)) throw new Error(`${RPC_NAME} returned ${data === null ? 'null' : typeof data}, expected rows.`)

  return data.map((row, index) => {
    try {
      return toSummaryRow(row)
    } catch (cause) {
      throw new Error(`${RPC_NAME} row ${index} has an unexpected shape: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
  })
}
