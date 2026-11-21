// Business-rule layer for one player read. No Request, no Response, no
// cookies, no HTTP status code — see docs/architecture/layer-map.md.
//
// This calls the two existing helpers rather than re-implementing them:
// authorizeResource (src/server/authorizeResource.ts) identifies the
// signed-in staff member itself from the verified session, so this file
// does not take or forward a staff id or role. playerAccess
// (src/data/playerAccess.ts) is the only place that talks to Supabase.
//
// The real `players` table carries no confidential column today — injury,
// trade, and scouting facts live in separate tables and files
// (docs/access/access-matrix-v2.md). So there is no second, narrower view
// to gate here yet; once access is allowed, every field on this view is
// already a shared fact every staff role may see
// (docs/security/role-access-matrix.md).

import { findPlayerById, type PlayerRow } from '../data/playerAccess'
import { authorizeResource } from '../server/authorizeResource'

/** Safe, shared facts only. Never the raw data-access row. */
export type PlayerRosterView = {
  playerId: string
  displayName: string
  position: string
  sweaterNumber: number | null
  teamName: string
}

/** Plain answers. These words are not HTTP status numbers. */
export type RosterReadResult =
  | { outcome: 'missing_id' }
  | { outcome: 'not_allowed'; playerId: string }
  | { outcome: 'not_found'; playerId: string }
  | { outcome: 'allowed'; view: PlayerRosterView }

function blankId(playerId: string): boolean {
  return playerId.trim() === ''
}

function viewFromRecord(record: PlayerRow): PlayerRosterView {
  return {
    playerId: record.id,
    displayName: record.display_name,
    position: record.position,
    sweaterNumber: record.sweater_number,
    teamName: record.team_label,
  }
}

/**
 * Decide what the signed-in staff member may learn about one player.
 * authorizeResource (above) is the identity and access check; playerAccess
 * is the only data read. A blank id is refused before either is called.
 */
export async function readPlayerRosterForStaff(playerId: string): Promise<RosterReadResult> {
  if (blankId(playerId)) {
    return { outcome: 'missing_id' }
  }

  try {
    await authorizeResource({ kind: 'player', id: playerId })
  } catch {
    // Denied, or not a safe id — same outcome either way (idor-defense-notes.md).
    return { outcome: 'not_allowed', playerId }
  }

  const record = await findPlayerById(playerId)
  if (!record) {
    return { outcome: 'not_found', playerId }
  }

  return { outcome: 'allowed', view: viewFromRecord(record) }
}
