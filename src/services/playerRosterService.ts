// Business-rule layer for one player read. No Request, no Response, no
// cookies, no HTTP status code — see docs/architecture/layer-map.md.
//
// Identity is ordinary data here: readPlayerRosterForStaff takes a
// StaffActor (staffId, role) as a plain argument instead of reading a
// session itself. The caller (src/server/getPlayerRoster.ts) resolves that
// actor from the signed-in session before calling this service, so this
// file can be exercised with a fake actor and no session, no HTTP, and no
// mocked identity call (src/services/playerRosterService.test.ts).
//
// Two authorization checks run, both through authorizeResourceForActor
// (src/server/authorizeResource.ts), both keyed by this SAME real player
// id — never a placeholder:
//   1. kind: 'player' — may this actor open the player's shared facts at
//      all (name, position, sweater number, team)?
//   2. kind: 'scouting_note' — may this actor also learn confidential,
//      scouting-tier facts about this player? Checked again, separately,
//      because the shared-facts answer and the confidential-facts answer
//      can differ by role (docs/security/role-access-matrix.md): coaching
//      and medical may open the player but not scouting_note; scouting,
//      assistant_scout, and video_analyst may do both.
//
// Of the three confidential fact kinds this step names — injury, trade,
// scout — only scouting notes have a real table in this schema today
// (public.scouting_events, read through
// src/data/confidentialPlayerFacts.ts). There is no injury table (no
// sports-science migration has been typed — docs/typegen-notes.md) and no
// trade/transactions table anywhere in this project. injuryStatus and
// tradeStatus are kept as named fields, copied only when the confidential
// check allows it, exactly like scoutNoteCount — but their value is always
// null, because inventing data for a column that does not exist would be
// fabrication, not a roster fact.

import { countScoutingNotesForPlayer } from '../data/confidentialPlayerFacts'
import { findPlayerById, type PlayerRow } from '../data/playerAccess'
import { authorizeResourceForActor, type StaffActor } from '../server/authorizeResource'

export type { StaffActor }

/** Confidential, scouting-tier facts. Present only when that check allows it. */
export type ConfidentialPlayerFacts = {
  /** No sports-science table is typed in this schema yet; always null. */
  injuryStatus: string | null
  /** No trade/transactions table exists in this schema; always null. */
  tradeStatus: string | null
  /** Real count from public.scouting_events, read when this check allows it. */
  scoutNoteCount: number
}

/** Safe, shared facts, plus confidential facts when the actor's role allows them. */
export type PlayerRosterView = {
  playerId: string
  displayName: string
  position: string
  sweaterNumber: number | null
  teamName: string
  /** null when the actor's role may open the player but not confidential facts. */
  confidential: ConfidentialPlayerFacts | null
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

function viewFromRecord(record: PlayerRow): Omit<PlayerRosterView, 'confidential'> {
  return {
    playerId: record.id,
    displayName: record.display_name,
    position: record.position,
    sweaterNumber: record.sweater_number,
    teamName: record.team_label,
  }
}

/**
 * Decide what the given staff actor may learn about one player.
 * authorizeResourceForActor (above) is the access check for both tiers;
 * playerAccess and confidentialPlayerFacts are the only data reads. A blank
 * id is refused before either check runs.
 */
export async function readPlayerRosterForStaff(actor: StaffActor, playerId: string): Promise<RosterReadResult> {
  if (blankId(playerId)) {
    return { outcome: 'missing_id' }
  }

  try {
    await authorizeResourceForActor(actor, { kind: 'player', id: playerId })
  } catch {
    // Denied, or not a safe id — same outcome either way (idor-defense-notes.md).
    return { outcome: 'not_allowed', playerId }
  }

  const record = await findPlayerById(playerId)
  if (!record) {
    return { outcome: 'not_found', playerId }
  }

  // Second, separate check — same real player id, confidential-tier kind.
  // Denial here withholds confidential facts only; the player itself is
  // still returned, since the first check already allowed that.
  let confidential: ConfidentialPlayerFacts | null = null
  try {
    await authorizeResourceForActor(actor, { kind: 'scouting_note', id: playerId })
    confidential = {
      injuryStatus: null,
      tradeStatus: null,
      scoutNoteCount: await countScoutingNotesForPlayer(playerId),
    }
  } catch {
    confidential = null
  }

  return { outcome: 'allowed', view: { ...viewFromRecord(record), confidential } }
}
