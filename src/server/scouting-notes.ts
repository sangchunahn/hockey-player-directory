// Scouting notes: single-record reads and writes, each gated by
// authorizeResource (src/server/authorizeResource.ts) on that EXACT record's
// own real id, called before any Supabase table query, insert, update, or
// delete touches that id. A denial returns a forbidden result; the database
// is never touched for a denied id.
//
// getScoutingNote(id), createScoutingNote(input), updateScoutingNote(id, patch),
// and deleteScoutingNote(id) all follow the same order:
//   1. authorizeResource({ kind: 'scouting_note', id }) — for create, `id` is
//      minted here (crypto.randomUUID()) before the insert, so the SAME id
//      is what gets checked and what gets written; for get/update/delete,
//      `id` is the caller's own input, checked before it is ever used in a
//      query. A denial (or an unsafe-shaped id — authorizeResource itself
//      calls assertSafeIdentifier) returns { status: 'forbidden' } with 403,
//      before requireSession or any `.from('scouting_events')` call runs.
//   2. requireSession() verifies the Supabase session, to get the
//      request-bound client RLS needs (authorizeResource's own identity
//      check does not expose that client).
//   3. The query/write runs with that client, using the same id authorized
//      in step 1 (`.eq('id', id)`, or that literal id on insert).
//   4. Row-level security (supabase/migrations/20250321000000_hockey_staff_rls.sql)
//      still independently governs the actual read/insert/update/delete:
//      scouting and assistant_scout may insert and update their own rows,
//      no role may delete, coaching and medical get no rows at all. The
//      MAY_READ map authorizeResource checks is a coarse "may this role
//      touch scouting_note resources at all" gate, not a replacement for
//      RLS's per-operation rules — RLS stays the backstop underneath it.
//
// There is no bulk "list every note" function here on purpose: listing
// requires discovering which ids exist, which requires reading
// scouting_events before any id could be authorized — the opposite of this
// file's "authorize the id, then read" contract. See the note near the
// bottom of this file for where a bulk, RLS-only view already lives
// instead.
//
// Scouting notes live in public.scouting_events: the free-text `note` column
// (always set for `note`-type events, optional on others).

import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'

import { authorizeResource } from './authorizeResource'
import { requireSession, UnauthorizedError } from '#/lib/auth/require-session'

export type ScoutingNoteRow = {
  id: string
  note: string
  event_type: string
  period: number | null
  created_at: string
  player: { id: string; display_name: string; position: string; team_label: string }
  game: { id: string; played_on: string; home_team: string; away_team: string }
}

export type ScoutingNoteResult =
  | { status: 'ok'; note: ScoutingNoteRow }
  | { status: 'signed-out' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }

export type ScoutingNoteWriteResult =
  | { status: 'ok'; id: string }
  | { status: 'signed-out' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string }

const NOTE_COLUMNS =
  'id, note, event_type, period, created_at, player:players!scouting_events_player_id_fkey(id, display_name, position, team_label), game:games!scouting_events_game_id_fkey(id, played_on, home_team, away_team)' as const

/** Shared by every single-record function below: maps a denial/error to a result. */
function denialResult<T extends { status: string }>(error: unknown): T {
  if (error instanceof UnauthorizedError) {
    setResponseStatus(error.status)
    return (error.status === 401 ? { status: 'signed-out' } : { status: 'error', message: error.message }) as T
  }
  // assertSafeIdentifier's "not a safe id" and decideResourceAccess's "deny"
  // both surface as authorizeResource throwing a plain Error here. Same
  // outcome either way: forbidden, no row content, no query ran.
  setResponseStatus(403)
  return { status: 'forbidden' } as T
}

// ---------------------------------------------------------------------------
// Read one note
// ---------------------------------------------------------------------------

export const getScoutingNote = createServerFn({ method: 'GET' })
  .validator((input: unknown) => input)
  .handler(async ({ data: rawNoteId }): Promise<ScoutingNoteResult> => {
    const noteId = typeof rawNoteId === 'string' ? rawNoteId : ''

    // 1) authorizeResource on this exact id, before any Supabase call.
    try {
      await authorizeResource({ kind: 'scouting_note', id: noteId })
    } catch (error) {
      return denialResult(error)
    }

    // 2) Identity gate again, for the request-bound client.
    let session: Awaited<ReturnType<typeof requireSession>>
    try {
      session = await requireSession()
    } catch (error) {
      return denialResult(error)
    }

    // 3) The SAME id authorized above is what this query reads.
    const { data, error } = await session.supabase
      .from('scouting_events')
      .select(NOTE_COLUMNS)
      .eq('id', noteId)
      .not('note', 'is', null)
      .maybeSingle()

    if (error) {
      setResponseStatus(500)
      console.error('getScoutingNote failed', error.code)
      return { status: 'error', message: 'Could not load this note. Try again.' }
    }
    if (!data || data.note === null) {
      return { status: 'not-found' }
    }

    return { status: 'ok', note: { ...data, note: data.note } }
  })

// ---------------------------------------------------------------------------
// Create one note
// ---------------------------------------------------------------------------

export type CreateScoutingNoteInput = {
  playerId: string
  gameId: string
  period?: number | null
  note: string
}

export const createScoutingNote = createServerFn({ method: 'POST' })
  .validator((input: unknown) => input as CreateScoutingNoteInput)
  .handler(async ({ data: input }): Promise<ScoutingNoteWriteResult> => {
    // The new row's id is minted HERE, before authorizeResource runs, so the
    // same id is both what gets checked and what gets written below — never
    // an id read back from the database first.
    const noteId = crypto.randomUUID()

    // 1) authorizeResource on that exact id, before any Supabase call.
    try {
      await authorizeResource({ kind: 'scouting_note', id: noteId })
    } catch (error) {
      return denialResult(error)
    }

    // 2) Identity gate again, for the request-bound client.
    let session: Awaited<ReturnType<typeof requireSession>>
    try {
      session = await requireSession()
    } catch (error) {
      return denialResult(error)
    }

    if (!input.note || input.note.trim() === '') {
      return { status: 'error', message: 'A note needs text.' }
    }

    // 3) Insert with the SAME id authorized above.
    const { error } = await session.supabase.from('scouting_events').insert({
      id: noteId,
      player_id: input.playerId,
      game_id: input.gameId,
      event_type: 'note',
      period: input.period ?? null,
      note: input.note.trim(),
    })

    if (error) {
      setResponseStatus(500)
      console.error('createScoutingNote failed', error.code)
      return { status: 'error', message: 'Could not save this note. Try again.' }
    }

    return { status: 'ok', id: noteId }
  })

// ---------------------------------------------------------------------------
// Update one note
// ---------------------------------------------------------------------------

export type UpdateScoutingNotePatch = { period?: number | null; note?: string }

export const updateScoutingNote = createServerFn({ method: 'POST' })
  .validator((input: unknown) => input as { noteId: string; patch: UpdateScoutingNotePatch })
  .handler(async ({ data: { noteId, patch } }): Promise<ScoutingNoteWriteResult> => {
    // 1) authorizeResource on this exact id, before any Supabase call.
    try {
      await authorizeResource({ kind: 'scouting_note', id: noteId })
    } catch (error) {
      return denialResult(error)
    }

    // 2) Identity gate again, for the request-bound client.
    let session: Awaited<ReturnType<typeof requireSession>>
    try {
      session = await requireSession()
    } catch (error) {
      return denialResult(error)
    }

    const changes: { period?: number | null; note?: string } = {}
    if (patch.period !== undefined) changes.period = patch.period
    if (patch.note !== undefined) changes.note = patch.note.trim()

    // 3) Update filtered by the SAME id authorized above.
    const { error } = await session.supabase.from('scouting_events').update(changes).eq('id', noteId)

    if (error) {
      setResponseStatus(500)
      console.error('updateScoutingNote failed', error.code)
      return { status: 'error', message: 'Could not update this note. Try again.' }
    }

    return { status: 'ok', id: noteId }
  })

// ---------------------------------------------------------------------------
// Delete one note
// ---------------------------------------------------------------------------

export const deleteScoutingNote = createServerFn({ method: 'POST' })
  .validator((input: unknown) => input as string)
  .handler(async ({ data: noteId }): Promise<ScoutingNoteWriteResult> => {
    // 1) authorizeResource on this exact id, before any Supabase call.
    try {
      await authorizeResource({ kind: 'scouting_note', id: noteId })
    } catch (error) {
      return denialResult(error)
    }

    // 2) Identity gate again, for the request-bound client.
    let session: Awaited<ReturnType<typeof requireSession>>
    try {
      session = await requireSession()
    } catch (error) {
      return denialResult(error)
    }

    // 3) Delete filtered by the SAME id authorized above. RLS has no DELETE
    // policy for any role (see the migration's comment above the policies),
    // so this always fails at the database layer today — authorizeResource
    // passing is not permission to delete; RLS still decides that.
    const { error } = await session.supabase.from('scouting_events').delete().eq('id', noteId)

    if (error) {
      setResponseStatus(500)
      console.error('deleteScoutingNote failed', error.code)
      return { status: 'error', message: 'Could not delete this note. Try again.' }
    }

    return { status: 'ok', id: noteId }
  })

// There is deliberately no bulk "list every note" function in this file.
// That would need to read scouting_events to discover which ids exist
// before any id could be checked, which is exactly the "database read not
// already tied to an authorized id" shape this file must not contain. A
// bulk, RLS-only view of scouting_events already exists at the board level
// (src/lib/scouting/hooks.ts -> useEventBoard, used by
// src/routes/scouting/events.tsx) — a client-side read gated by RLS alone,
// not by this file's id-first authorizeResource contract. The two are
// different authorization models for two different operations; this file
// only implements the id-first one, for one record at a time.
