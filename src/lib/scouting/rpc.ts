// Caller for the V4 per-player scouting summary RPC — one round trip, counted in
// Postgres by public.player_event_summary (supabase/migrations/
// 002_scouting_aggregates_rpc.sql). Never rebuild this by fetching events and
// counting in JavaScript, and never loop a query per player (N+1).
//
// This is the ONLY module that may call `.rpc(...)` (docs/scouting-data-access-api.md).
//
// Typed end to end by the generated Database['public']['Functions'] entry: a
// wrong function name, a misspelled or mistyped argument, or a field the
// function doesn't return fails `tsc`. After changing the SQL, apply it and run
// `npm run gen:types` — the script refuses to write types missing this RPC.

import { getSupabase } from '#/lib/supabase/client'
import type { Database } from '#/types/database'

import { ScoutingQueryError, type PlayerPosition } from './queries'

type PlayerEventSummaryFn = Database['public']['Functions']['player_event_summary']

/** V4 filters. All optional; omitted means "all". Dates are inclusive YYYY-MM-DD. */
export type PlayerEventSummaryFilters = {
  position?: PlayerPosition | null
  playedFrom?: string | null
  playedTo?: string | null
  gameId?: string | null
}

/**
 * One row of player_event_summary, straight from the generated RETURNS TABLE
 * shape: player_id, display_name, position, team_label, games_count (distinct
 * games), event_count (= sum of the six type counts), goal/assist/shot/hit/
 * penalty/note_count. Postgres bigint counts arrive as JSON numbers.
 */
export type PlayerEventSummaryRow = PlayerEventSummaryFn['Returns'][number]

/**
 * V4: per-player event counts by type plus distinct games, computed in one
 * set-based Postgres call. Sorted by display name A→Z (the SQL's ORDER BY).
 * Players with no matching events are not returned.
 *
 * Throws ScoutingQueryError (safe message; raw error on `cause`) if Supabase
 * returns an error — never an empty list in place of a failure.
 */
export async function getPlayerEventSummary(
  filters: PlayerEventSummaryFilters = {},
): Promise<PlayerEventSummaryRow[]> {
  // Generated Args are optional, not nullable: leave a filter out (undefined is
  // dropped from the JSON body) and the SQL default `null` = "all" applies.
  const args: PlayerEventSummaryFn['Args'] = {
    p_position: filters.position ?? undefined,
    p_played_from: filters.playedFrom ?? undefined,
    p_played_to: filters.playedTo ?? undefined,
    p_game_id: filters.gameId ?? undefined,
  }

  const { data, error } = await getSupabase().rpc('player_event_summary', args)

  if (error) throw new ScoutingQueryError('getPlayerEventSummary', error)
  return data ?? []
}
