// Unit tests for the pure directory mappers.
//
// No Supabase client, no network, no env, no browser API — if any of those
// were ever needed here, it would mean the code under test had drifted back
// across the boundary described in `docs/server-function-contract.md`.
import { describe, expect, it } from 'vitest'

import {
  buildSearchPattern,
  mapRowToDirectoryEntry,
  normalizeDirectoryQuery,
  type DirectoryPersonRow,
} from './mappers'

/** A skater. Jersey number present. */
const playerRow: DirectoryPersonRow = {
  id: 'p-1',
  full_name: 'Alex Morgan',
  role: 'player',
  team: 'Ravens',
  position: 'Center',
  jersey_no: 19,
}

/** A coach. Staff have no jersey number. */
const staffRow: DirectoryPersonRow = {
  id: 's-9',
  full_name: 'Pat Chen',
  role: 'staff',
  team: 'Ravens',
  position: 'Head Coach',
  jersey_no: null,
}

describe('normalizeDirectoryQuery', () => {
  // A mistyped filter must fail loudly. Silently ignoring it would show ops the
  // full roster while they believe they are looking at staff only — the kind of
  // wrong answer nobody thinks to double-check.
  it('rejects a role it does not recognize instead of ignoring it', () => {
    const result = normalizeDirectoryQuery({ role: 'coach' })

    if (result.ok) throw new Error('expected an unknown role to be rejected')
    expect(result.error.code).toBe('VALIDATION')
    expect(result.error.field).toBe('role')
  })

  it('treats a missing role as "players and staff"', () => {
    const result = normalizeDirectoryQuery({})

    if (!result.ok) throw new Error('an empty query is valid')
    expect(result.query.role).toBeNull()
  })

  // Someone tapping the space bar in the search box should still see the
  // directory, not an empty page.
  it('treats a whitespace-only search as no search at all', () => {
    const result = normalizeDirectoryQuery({ search: '   ' })

    if (!result.ok) throw new Error('whitespace is a valid search')
    expect(result.query.search).toBeNull()
  })

  // The limit protects the database from a request for the entire table. It is
  // clamped rather than rejected, because an out-of-range number is a caller
  // mistake we can safely correct — unlike a role we would have to guess at.
  it('never returns a limit outside the supported range', () => {
    const tooSmall = normalizeDirectoryQuery({ limit: 0 })
    const tooLarge = normalizeDirectoryQuery({ limit: 9999 })

    if (!tooSmall.ok || !tooLarge.ok) throw new Error('limits clamp, they do not fail')
    expect(tooSmall.query.limit).toBe(1)
    expect(tooLarge.query.limit).toBe(200)
  })

  it('defaults the limit when the caller omits it', () => {
    const result = normalizeDirectoryQuery({})

    if (!result.ok) throw new Error('an empty query is valid')
    expect(result.query.limit).toBe(100)
  })
})

describe('buildSearchPattern', () => {
  // `%` and `_` are wildcards in a SQL ILIKE. Left unescaped, a staffer typing
  // a single "%" would match every person in the directory — and a search for
  // "a_b" would quietly match "axb". Ops should get literal matches.
  it('treats a percent sign as a literal character, not a match-everything wildcard', () => {
    expect(buildSearchPattern('50%')).toBe('%50\\%%')
  })

  it('treats an underscore as a literal character', () => {
    expect(buildSearchPattern('a_b')).toBe('%a\\_b%')
  })

  it('wraps ordinary text so a partial name still matches', () => {
    expect(buildSearchPattern('Chen')).toBe('%Chen%')
  })
})

describe('mapRowToDirectoryEntry', () => {
  // The UI renders whatever it is handed. Names, teams and numbers have to
  // arrive in the shape the directory page expects.
  it('presents a player with their jersey number', () => {
    expect(mapRowToDirectoryEntry(playerRow)).toEqual({
      id: 'p-1',
      displayName: 'Alex Morgan',
      role: 'player',
      teamName: 'Ravens',
      positionOrTitle: 'Center',
      jerseyNumber: 19,
    })
  })

  // Coaches do not wear numbers. Anything other than null here would put a
  // "#0" or "#undefined" beside a coach's name on the directory page.
  it('leaves a staff member without a jersey number', () => {
    expect(mapRowToDirectoryEntry(staffRow)?.jerseyNumber).toBeNull()
  })

  // This is the privacy guarantee, not a style preference. The mapper builds
  // the entry field by field, so a column added to the table later — salary,
  // medical notes, a home address — cannot reach the browser until somebody
  // edits this function and a reviewer sees it.
  it('passes through only the six fields the directory is allowed to show', () => {
    const rowWithExtraColumns = {
      ...playerRow,
      salary: 900_000,
      medical_notes: 'concussion protocol',
    } as DirectoryPersonRow

    const entry = mapRowToDirectoryEntry(rowWithExtraColumns)

    expect(Object.keys(entry ?? {}).sort()).toEqual([
      'displayName',
      'id',
      'jerseyNumber',
      'positionOrTitle',
      'role',
      'teamName',
    ])
  })

  // A row whose role is neither player nor staff means the data is wrong.
  // Omitting that person is safer than guessing a role for a real human being.
  it('drops a person whose role is not recognized rather than guessing', () => {
    const corruptRow = { ...playerRow, role: 'mascot' } as DirectoryPersonRow

    expect(mapRowToDirectoryEntry(corruptRow)).toBeNull()
  })
})
