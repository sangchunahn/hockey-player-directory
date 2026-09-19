// Server-only directory reads.
//
// âš ï¸ SERVER ONLY. âš ï¸ This module imports `app/lib/supabase.server.ts`, which
// reads the service-role key. It must never be imported from a route component
// or anything under `src/components/`. The route calls the exported server
// function instead â€” TanStack Start turns that call into a network request, so
// only the RESULT crosses to the browser, never this code or its credentials.
//
// Implements the contract in `docs/server-function-contract.md`. Field names,
// input rules and error codes come from there; change the contract first if you
// need to change them here.
//
// The pure half (validation, escaping, row mapping) lives in
// `../lib/directory/mappers.ts` so it can be unit-tested without Supabase.

import { createServerFn } from '@tanstack/react-start'

import { getSupabaseServerClient } from '#app/lib/supabase.server'

import {
  buildSearchPattern,
  mapRowToDirectoryEntry,
  normalizeDirectoryQuery,
  type DirectoryEntry,
  type DirectoryPersonRow,
  type GetDirectoryEntriesResult,
  type RawDirectoryQuery,
} from '../lib/directory/mappers'

/** Table and columns from the contract's "Data source" section. */
const TABLE = 'directory_people'
const COLUMNS = 'id, full_name, role, team, position, jersey_no'

/**
 * Load directory rows (players and staff) for the UI.
 *
 * Inputs are all optional: `{ search?, role?, limit? }`. Returns the
 * discriminated result from the contract â€” `{ ok: true, entries, meta }` or
 * `{ ok: false, error }`. It does not throw for expected failures, so the UI
 * always has something safe to render.
 */
export const getDirectoryEntries = createServerFn({ method: 'GET' })
  // Accept the raw shape without throwing. Real validation happens in the
  // handler via `normalizeDirectoryQuery`, so a bad value comes back as the
  // contract's VALIDATION result instead of a rejected request the UI cannot
  // branch on.
  .validator((input: unknown): RawDirectoryQuery => {
    if (typeof input !== 'object' || input === null) return {}
    return input as RawDirectoryQuery
  })
  .handler(async ({ data }): Promise<GetDirectoryEntriesResult> => {
    const normalized = normalizeDirectoryQuery(data)

    // Bad input: return before touching the database at all.
    if (!normalized.ok) {
      return { ok: false, error: normalized.error }
    }

    const { search, role, limit } = normalized.query

    try {
      const supabase = getSupabaseServerClient()

      // Filters are applied to the QUERY, before `.limit()`. Filtering an
      // already-limited array in memory would search only the first N rows.
      let query = supabase.from(TABLE).select(COLUMNS).order('full_name', { ascending: true })

      if (role) {
        query = query.eq('role', role)
      }

      if (search) {
        query = query.ilike('full_name', buildSearchPattern(search))
      }

      const { data: rows, error } = await query.limit(limit)

      if (error) {
        // Log the real error where only we can see it; return a flat code.
        // Never return or stringify `error` itself â€” it can carry request
        // configuration.
        console.error('[directory] Supabase read failed', error)
        return {
          ok: false,
          error: { code: 'UPSTREAM', message: 'Directory temporarily unavailable. Try again.' },
        }
      }

      const entries: DirectoryEntry[] = []
      let skipped = 0

      for (const row of (rows ?? []) as DirectoryPersonRow[]) {
        const entry = mapRowToDirectoryEntry(row)
        if (entry) entries.push(entry)
        else skipped += 1
      }

      if (skipped > 0) {
        // A row the DB check constraint should have prevented. Worth knowing
        // about, but not worth failing the whole directory over.
        console.warn(`[directory] skipped ${skipped} row(s) with an unrecognized role`)
      }

      // No rows is success, not an error â€” the UI renders an empty state.
      return {
        ok: true,
        entries,
        meta: { count: entries.length, appliedFilters: { search, role, limit } },
      }
    } catch (cause) {
      console.error('[directory] Unexpected failure', cause)
      return {
        ok: false,
        error: { code: 'UNKNOWN', message: 'Something went wrong loading the directory.' },
      }
    }
  })
