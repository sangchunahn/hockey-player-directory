// Bottom layer only. No HTTP, no React, no "who may see this" decision —
// same rules as src/data/playerAccess.ts, docs/architecture/layer-map.md.
//
// This file is the confidential-tier counterpart to playerAccess.ts: facts
// about a player that only a role cleared for the 'scouting_note' kind may
// learn (src/server/authorizeResource.ts). It reads from a different table
// (public.scouting_events) than playerAccess.ts (public.players), so it is
// kept separate rather than widening that file's documented single-table
// scope.
//
// Only one of the three confidential fact kinds named in this step has a
// real backing table in this schema today: scouting notes
// (public.scouting_events). There is no injury table (no sports_science
// migration has been applied and typed — docs/typegen-notes.md) and no
// trade/transactions table anywhere in this project. Those two kinds are
// not faked here with invented columns; src/services/playerRosterService.ts
// keeps them explicitly null and says so.

import { createSupabaseServerClient } from '../lib/supabase/server'

/** How many scouting notes exist for this player, or 0 on any error. */
export async function countScoutingNotesForPlayer(playerId: string): Promise<number> {
  const supabase = createSupabaseServerClient()
  const { count, error } = await supabase
    .from('scouting_events')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', playerId)
    .not('note', 'is', null)

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}
