// listScoutingNotes: the protected scouting data path.
//
// Order:
//   1. Identity + role gate (src/server/authorizeResource.ts), before any
//      table access. This endpoint returns a LIST, not one record, so there
//      is no single id to hand to authorizeResource the way a single-record
//      read or write would (authorizeResource always requires an id —
//      assertSafeIdentifier rejects a missing one). decideResourceAccess is
//      the same pure, id-free role check authorizeResource calls internally;
//      calling it directly here, before any database call, checks whether
//      this signed-in caller's role may read the 'scouting_note' kind at
//      all. A denial returns a forbidden result immediately — the query
//      below never runs, and no row is ever fetched just to be dropped.
//   2. requireSession() verifies the Supabase session on the server
//      (getUser) a second time, to get the request-bound client RLS needs.
//      getCurrentStaff (step 1) does not expose that client, only identity
//      and role, so this is a second, separate verification, not reused
//      from step 1.
//   3. The query uses that server client, bound to this user's session
//      cookies, so Postgres sees auth.uid() and role "authenticated".
//   4. Row-level security (supabase/migrations/20250321000000_hockey_staff_rls.sql,
//      policy "scouting_events: scouting reads all") independently decides
//      which rows come back: scouting staff get every note, coaching and
//      medical get none (docs/security/rls-policy-spec.md, scouting_events
//      SELECT). Step 1 already denied a role that cannot read this kind at
//      all; RLS is still the database backstop underneath it, not replaced
//      by it.
//
// This module does NOT filter by role itself beyond the step-1 kind check.
// It takes no input at all, so a role, user id, or "isLoggedIn" sent by the
// browser can't influence anything.
//
// Scouting notes live in public.scouting_events: the free-text `note` column
// (always set for `note`-type events, optional on others).
//
// Writes to scouting_events (create, update) are not in this file. They live
// in src/lib/scouting/mutations.ts (createScoutingEvent, updateScoutingEvent),
// a browser-side module using the anon-key client, not a server function —
// out of scope for this file's commit.

import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'

import { decideResourceAccess } from './authorizeResource'
import { getCurrentStaff } from './get-current-staff'
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

export type ScoutingNotesResult =
  | { status: 'ok'; viewerEmail: string | null; notes: ScoutingNoteRow[] }
  | { status: 'signed-out' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string }

const NOTE_COLUMNS =
  'id, note, event_type, period, created_at, player:players!scouting_events_player_id_fkey(id, display_name, position, team_label), game:games!scouting_events_game_id_fkey(id, played_on, home_team, away_team)' as const

export const listScoutingNotes = createServerFn({ method: 'GET' }).handler(async (): Promise<ScoutingNotesResult> => {
  // 1) Identity + role gate, before any table access.
  let staff: Awaited<ReturnType<typeof getCurrentStaff>>
  try {
    staff = await getCurrentStaff()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      setResponseStatus(error.status)
      return error.status === 401 ? { status: 'signed-out' } : { status: 'error', message: error.message }
    }
    throw error
  }

  if (decideResourceAccess(staff.role, 'scouting_note') !== 'allow') {
    setResponseStatus(403)
    return { status: 'forbidden' }
  }

  // 2) Identity gate again, to get the request-bound client; 3) query as the
  // verified user; 4) RLS filters the rows.
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

  const { data, error } = await session.supabase
    .from('scouting_events')
    .select(NOTE_COLUMNS)
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
