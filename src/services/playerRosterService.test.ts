// Business-rule tests for src/services/playerRosterService.ts — no HTTP, no
// route, no Supabase, and no session: the actor is a plain fake object
// passed as an ordinary argument, exactly as getPlayerRoster.ts passes a
// real one. authorizeResourceForActor and the two data-access reads are
// replaced with fakes (Vitest module mocks) so the allow/deny decision is
// controlled here, not read from a real session or a real database row.
import { describe, expect, it, vi } from 'vitest'

const rosterFacts = {
  id: 'player-17',
  display_name: 'Alex Chen',
  position: 'F',
  sweater_number: 17,
  team_label: 'Northline',
}

const scoutingActor = { staffId: 'staff-scout-1', role: 'scouting' }
const coachingActor = { staffId: 'staff-coach-1', role: 'coaching' }

const { authorizeResourceForActor } = vi.hoisted(() => ({ authorizeResourceForActor: vi.fn() }))
vi.mock('../server/authorizeResource', () => ({ authorizeResourceForActor }))

const { findPlayerById } = vi.hoisted(() => ({ findPlayerById: vi.fn() }))
vi.mock('../data/playerAccess', () => ({ findPlayerById }))

const { countScoutingNotesForPlayer } = vi.hoisted(() => ({ countScoutingNotesForPlayer: vi.fn() }))
vi.mock('../data/confidentialPlayerFacts', () => ({ countScoutingNotesForPlayer }))

const { readPlayerRosterForStaff } = await import('./playerRosterService')

describe('roster business rules without HTTP', () => {
  it('returns roster facts when authorization allows the staff member', async () => {
    authorizeResourceForActor.mockResolvedValueOnce({ staffId: scoutingActor.staffId, resourceId: rosterFacts.id })
    findPlayerById.mockResolvedValueOnce(rosterFacts)
    authorizeResourceForActor.mockResolvedValueOnce({ staffId: scoutingActor.staffId, resourceId: rosterFacts.id })
    countScoutingNotesForPlayer.mockResolvedValueOnce(3)

    const result = await readPlayerRosterForStaff(scoutingActor, rosterFacts.id)

    expect(result).toMatchObject({
      outcome: 'allowed',
      view: { displayName: 'Alex Chen', teamName: 'Northline' },
    })
  })

  it('does not return roster facts when authorization denies that id', async () => {
    authorizeResourceForActor.mockRejectedValueOnce(new Error('Record not found'))
    // Same roster facts as the allow case: a denial must withhold them, not
    // just happen to be tested against missing data.
    findPlayerById.mockResolvedValueOnce(rosterFacts)

    const result = await readPlayerRosterForStaff(coachingActor, rosterFacts.id)

    expect(result).toMatchObject({ outcome: 'not_allowed', playerId: rosterFacts.id })
    expect(JSON.stringify(result)).not.toContain('Alex Chen')
    expect(JSON.stringify(result)).not.toContain('Northline')
  })

  it('withholds confidential facts when the shared-facts check allows but the confidential check denies', async () => {
    // First call: 'player' kind, allowed. Second call: 'scouting_note' kind, denied.
    authorizeResourceForActor.mockResolvedValueOnce({ staffId: coachingActor.staffId, resourceId: rosterFacts.id })
    findPlayerById.mockResolvedValueOnce(rosterFacts)
    authorizeResourceForActor.mockRejectedValueOnce(new Error('Record not found'))

    const result = await readPlayerRosterForStaff(coachingActor, rosterFacts.id)

    expect(result).toMatchObject({ outcome: 'allowed', view: { displayName: 'Alex Chen', confidential: null } })
    expect(countScoutingNotesForPlayer).not.toHaveBeenCalled()
  })
})
