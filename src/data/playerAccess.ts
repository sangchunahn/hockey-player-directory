// Bottom layer only. No HTTP. No React. No "who may see this" decision.
// Reads one row from the existing `players` table (supabase/migrations/001_scouting_schema.sql)
// through the existing server client. See docs/architecture/layer-map.md.

import { createSupabaseServerClient } from '../lib/supabase/server'

export type PlayerRow = {
  id: string
  display_name: string
  position: string
  sweater_number: number | null
  team_label: string
}

export async function findPlayerById(playerId: string): Promise<PlayerRow | null> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('players')
    .select('id, display_name, position, sweater_number, team_label')
    .eq('id', playerId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}
