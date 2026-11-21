// listScoutingNotes: the protected scouting data path.
//
// Order:
//   1. authorizeResource (src/server/authorizeResource.ts) runs FIRST,
//      before any Supabase table query at all — including the id-only
//      query below. This endpoint lists every note the caller's role may
//      see, rather than one record, so there is no real note id yet to
//      check at this point. LIST_ACCESS_PROBE_ID is a fixed placeholder,
//      never a real row's id and never sent to any query: authorizeResource
//      validates its shape then calls decideResourceAccess(role, kind),
//      whose answer depends only on the caller's role and the resource
//      kind, never on which id was passed. So this call still runs the
//      real checker's real role decision, before the database is touched,
//      and a denial here returns a forbidden result — not an empty list.
//   2. requireSession() verifies the Supabase session a second time, to get
//      the request-bound client the queries below need (authorizeResource's
//      own identity check in step 1 does not expose that client).
//   3. A minimal, content-free query gets candidate ids only (no note text,
//      no player or game fields).
//   4. authorizeResource re-checks EACH real id, one at a time, before the
//      content-bearing query runs for any of them. A denied id is dropped
//      from the allow-list here; it never reaches the next query. (In this
//      single-team app decideResourceAccess only varies by role and kind,
//      so after step 1 allows, every id here will too — this loop is kept
//      anyway as a second, per-id check, not a shortcut around it.)
//   5. The content query runs only against the SAME ids authorizeResource
//      already approved in step 4 (`.in('id', allowedIds)`) — the note
//      text, player, and game fields for a denied id are never fetched at
//      all, not fetched-then-discarded.
//   6. Row-level security (supabase/migrations/20250321000000_hockey_staff_rls.sql,
//      policy "scouting_events: scouting reads all") still independently
//      filters both queries by role: scouting staff get every row, coaching
//      and medical get none (docs/security/rls-policy-spec.md,
//      scouting_events SELECT). authorizeResource is a second, app-level
//      gate layered on top of RLS, not a replacement for it.
//
// This module takes no input at all, so a role, user id, or "isLoggedIn"
// sent by the browser can't influence anything, and there is no flag of any
// kind that skips the authorizeResource call.
//
// Scouting notes live in public.scouting_events: the free-text `note` column
// (always set for `note`-type events, optional on others).
//
// Writes to scouting_events (create, update) are not in this file. They live
// in src/lib/scouting/mutations.ts (createScoutingEvent, updateScoutingEvent),
// a browser-side module using the anon-key client, not a server function —
// out of scope for this file's commit. If a write server function is added
// here later, it must call authorizeResource with the record's own id first
// and return the same 403 shape on denial, before its insert/update/delete.

import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'

import { authorizeResource } from './authorizeResource'
import { requireSession, UnauthorizedError } from '#/lib/auth/require-session'

// Shape-only placeholder for the step-1 role gate. Never a real
// scouting_events.id, never used in any .eq/.in filter below.
const LIST_ACCESS_PROBE_ID = '00000000-0000-0000-0000-000000000000'

export type ScoutingNoteRow = {
  id: string
  note: string
  event_type: string
  period: number | null
  created_at: string
  player: { id: string; display_name: string; position: string; team_label: string }
  game: { id: string; played_on: string; home_team: string; away_team: string }
}

export type ScoutingNotesResult =
  | { status: 'ok'; viewerEmail: string | null; notes: ScoutingNoteRow[] }
  | { status: 'signed-out' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string }

const NOTE_COLUMNS =
  'id, note, event_type, period, created_at, player:players!scouting_events_player_id_fkey(id, display_name, position, team_label), game:games!scouting_events_game_id_fkey(id, played_on, home_team, away_team)' as const

export const listScoutingNotes = createServerFn({ method: 'GET' }).handler(async (): Promise<ScoutingNotesResult> => {
  // 1) authorizeResource gate, before any Supabase table query at all.
  try {
    await authorizeResource({ kind: 'scouting_note', id: LIST_ACCESS_PROBE_ID })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      setResponseStatus(error.status)
      return error.status === 401 ? { status: 'signed-out' } : { status: 'error', message: error.message }
    }
    // Denied: authorizeResource's role check failed. Forbidden, not an
    // empty list — no scouting_events query has run at all yet.
    setResponseStatus(403)
    return { status: 'forbidden' }
  }

  // 2) Identity gate again, to get the request-bound client the queries
  // below need. authorizeResource's own identity check in step 1 does not
  // expose that client.
  let session: Awaited<ReturnType<typeof requireSession>>
  try {
    session = await requireSession()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      setResponseStatus(error.status)
      return error.status === 401
        ? { status: 'signed-out' }
        : { status: 'error', message: error.message }
    }
    throw error
  }

  // 3) Id-only query: no note text, no player, no game fields yet. Only
  // enough to hand each real id to authorizeResource before any content loads.
  const { data: idRows, error: idError } = await session.supabase
    .from('scouting_events')
    .select('id')
    .not('note', 'is', null)
    .order('created_at', { ascending: false })

  if (idError) {
    setResponseStatus(500)
    console.error('listScoutingNotes id query failed', idError.code)
    return { status: 'error', message: 'Could not load scouting notes. Try again.' }
  }

  // 4) authorizeResource checks each real id by itself, before the content
  // query below ever runs for that id.
  const allowedIds: string[] = []
  for (const row of idRows) {
    try {
      await authorizeResource({ kind: 'scouting_note', id: row.id })
      allowedIds.push(row.id)
    } catch {
      continue // denied, or not a safe id: never fetch this row's content
    }
  }

  if (allowedIds.length === 0) {
    return { status: 'ok', viewerEmail: session.user.email, notes: [] }
  }

  // 5) Content query: the SAME ids authorizeResource already approved, and
  // no others.
  const { data, error } = await session.supabase
    .from('scouting_events')
    .select(NOTE_COLUMNS)
    .in('id', allowedIds)
    .not('note', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    setResponseStatus(500)
    // Raw Postgres text stays on the server.
    console.error('listScoutingNotes failed', error.code)
    return { status: 'error', message: 'Could not load scouting notes. Try again.' }
  }

  const notes: ScoutingNoteRow[] = data
    .filter((row): row is typeof row & { note: string } => row.note !== null)
    .map((row) => ({ ...row, note: row.note }))

  return { status: 'ok', viewerEmail: session.user.email, notes }
})
