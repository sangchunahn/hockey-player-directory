// Pure directory logic — no Supabase, no env, no network, no clock.
//
// Everything here takes plain objects and returns plain objects, which is what
// makes it unit-testable without a database. See the "Pure logic vs I/O"
// section of `docs/server-function-contract.md`.
//
// This module is safe to import from anywhere, including tests. The I/O lives
// next door in `directory.ts`, which is the server-only half.

/** The two kinds of people in the directory. Mirrors the DB check constraint. */
export type DirectoryRole = 'player' | 'staff'

/** One row as the UI receives it. Exactly these six fields — see contract. */
export type DirectoryEntry = {
  id: string
  displayName: string
  role: DirectoryRole
  teamName: string | null
  positionOrTitle: string | null
  jerseyNumber: number | null
}

/** One row as `public.directory_people` returns it (snake_case). */
export type DirectoryPersonRow = {
  id: string
  full_name: string
  role: string
  team: string | null
  position: string | null
  jersey_no: number | null
}

/** Unvalidated input as it arrives from the browser. Every field is suspect. */
export type RawDirectoryQuery = {
  search?: unknown
  role?: unknown
  limit?: unknown
}

/** Input after validation — safe to build a query from. */
export type NormalizedDirectoryQuery = {
  search: string | null
  role: DirectoryRole | null
  limit: number
}

export type DirectoryErrorCode = 'VALIDATION' | 'UPSTREAM' | 'UNKNOWN'

export type DirectoryError = {
  code: DirectoryErrorCode
  message: string
  field?: 'search' | 'role' | 'limit'
}

export type GetDirectoryEntriesResult =
  | {
      ok: true
      entries: DirectoryEntry[]
      meta: {
        count: number
        appliedFilters: NormalizedDirectoryQuery
      }
    }
  | { ok: false; error: DirectoryError }

export const DEFAULT_LIMIT = 100
export const MIN_LIMIT = 1
export const MAX_LIMIT = 200

/** Type guard so a `string` column can narrow to the union. */
export function isDirectoryRole(value: unknown): value is DirectoryRole {
  return value === 'player' || value === 'staff'
}

/**
 * Validate and normalize whatever the browser sent.
 *
 * Returns a discriminated result rather than throwing, because the contract
 * says a bad input is an `ok: false` response the UI can render — not a crash.
 *
 * Rules (from the contract's input table):
 *  - `search`: trimmed; empty or whitespace-only becomes `null`.
 *  - `role`:   missing/empty means both; anything unrecognized is an error, NOT
 *              a silent fallback — a typo should be visible, not ignored.
 *  - `limit`:  defaults to 100 and CLAMPS to 1..200 (out of range is not an
 *              error), but a non-numeric value is an error.
 */
export function normalizeDirectoryQuery(
  raw: RawDirectoryQuery,
): { ok: true; query: NormalizedDirectoryQuery } | { ok: false; error: DirectoryError } {
  // search
  let search: string | null = null
  if (raw.search !== undefined && raw.search !== null) {
    if (typeof raw.search !== 'string') {
      return {
        ok: false,
        error: { code: 'VALIDATION', field: 'search', message: 'Search must be text.' },
      }
    }
    const trimmed = raw.search.trim()
    search = trimmed === '' ? null : trimmed
  }

  // role
  let role: DirectoryRole | null = null
  if (raw.role !== undefined && raw.role !== null && raw.role !== '') {
    if (!isDirectoryRole(raw.role)) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION',
          field: 'role',
          message: `Unknown role ${JSON.stringify(raw.role)}. Expected 'player' or 'staff'.`,
        },
      }
    }
    role = raw.role
  }

  // limit
  let limit = DEFAULT_LIMIT
  if (raw.limit !== undefined && raw.limit !== null && raw.limit !== '') {
    const parsed = typeof raw.limit === 'number' ? raw.limit : Number(raw.limit)
    // Number('') is 0 and Number(' ') is 0, which is why '' is filtered above.
    if (!Number.isFinite(parsed)) {
      return {
        ok: false,
        error: { code: 'VALIDATION', field: 'limit', message: 'Limit must be a number.' },
      }
    }
    limit = Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.floor(parsed)))
  }

  return { ok: true, query: { search, role, limit } }
}

/**
 * Turn user text into a safe `ilike` pattern.
 *
 * In SQL `LIKE`/`ILIKE`, `%` matches any run of characters and `_` matches any
 * single one — so a user typing `%` would otherwise match the whole table, and
 * `a_b` would match `axb`. Postgres treats backslash as the escape character by
 * default, so backslash must be escaped FIRST or it would double-escape the
 * markers added after it.
 */
export function buildSearchPattern(search: string): string {
  const escaped = search
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')

  return `%${escaped}%`
}

/**
 * Map one database row to the UI shape.
 *
 * Builds the object field by field — never spreads the row — so a column added
 * to the table later cannot ride along into the browser without someone editing
 * this function.
 *
 * Returns `null` for a row whose `role` is neither 'player' nor 'staff'. The DB
 * check constraint should prevent that, so it means the data is wrong; dropping
 * the row is safer than guessing a role for a real person. The caller logs it.
 */
export function mapRowToDirectoryEntry(row: DirectoryPersonRow): DirectoryEntry | null {
  if (!isDirectoryRole(row.role)) return null

  return {
    id: row.id,
    displayName: row.full_name,
    role: row.role,
    teamName: row.team ?? null,
    positionOrTitle: row.position ?? null,
    // Coerce undefined to null so the UI only ever branches on one empty value.
    jerseyNumber: typeof row.jersey_no === 'number' ? row.jersey_no : null,
  }
}
