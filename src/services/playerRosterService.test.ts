// Business-rule tests for src/services/playerRosterService.ts — no HTTP, no
// route, no Supabase. authorizeResource and playerAccess are replaced with
// fakes (Vitest module mocks) so the allow/deny decision is controlled here,
// not read from a real session or a real database row.
import { describe, expect, it, vi } from 'vitest'

const rosterFacts = {
  id: 'player-17',
  display_name: 'Alex Chen',
  position: 'F',
  sweater_number: 17,
  team_label: 'Northline',
}

const { authorizeResource } = vi.hoisted(() => ({ authorizeResource: vi.fn() }))
vi.mock('../server/authorizeResource', () => ({ authorizeResource }))

const { findPlayerById } = vi.hoisted(() => ({ findPlayerById: vi.fn() }))
vi.mock('../data/playerAccess', () => ({ findPlayerById }))

const { readPlayerRosterForStaff } = await import('./playerRosterService')

describe('roster business rules without HTTP', () => {
  it('returns roster facts when authorization allows the staff member', async () => {
    authorizeResource.mockResolvedValueOnce({ staffId: 'staff-scout-1', resourceId: rosterFacts.id })
    findPlayerById.mockResolvedValueOnce(rosterFacts)

    const result = await readPlayerRosterForStaff(rosterFacts.id)

    expect(result).toMatchObject({
      outcome: 'allowed',
      view: { displayName: 'Alex Chen', teamName: 'Northline' },
    })
  })

  it('does not return roster facts when authorization denies that id', async () => {
    authorizeResource.mockRejectedValueOnce(new Error('Record not found'))
    // Same roster facts as the allow case: a denial must withhold them, not
    // just happen to be tested against missing data.
    findPlayerById.mockResolvedValueOnce(rosterFacts)

    const result = await readPlayerRosterForStaff(rosterFacts.id)

    expect(result).toMatchObject({ outcome: 'not_allowed', playerId: rosterFacts.id })
    expect(JSON.stringify(result)).not.toContain('Alex Chen')
    expect(JSON.stringify(result)).not.toContain('Northline')
  })
})
