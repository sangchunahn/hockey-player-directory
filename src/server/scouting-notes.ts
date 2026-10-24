// listScoutingNotes: the protected scouting data path.
//
// Order (docs/security/auth-session-plan.md, steps 3–4):
//   1. requireSession() verifies the Supabase session on the server
//      (getUser). No session means "signed-out" and NO query runs.
//   2. The query uses the server client that requireSession returns. That is
//      createSupabaseServerClient() from src/lib/supabase/server.ts, bound to
//      this user's session cookies, so Postgres sees auth.uid() and
//      role "authenticated".
//   3. Row-level security (supabase/migrations/20250321000000_hockey_staff_rls.sql,
//      policy "scouting_events: scouting reads all") decides which rows come
//      back: scouting staff get every note, coaching and medical get none
//      (docs/security/rls-policy-spec.md, scouting_events SELECT).
//
// This module does NOT filter by role. It takes no input at all, so a role,
// user id or "isLoggedIn" sent by the browser can't influence anything. If
// coaching gets an empty list, that's RLS working, not app code hiding rows.
//
// Scouting notes live in public.scouting_events: the free-text `note` column
// (always set for `note`-type events, optional on others).

import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'

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
  | { status: 'error'; message: string }

const NOTE_COLUMNS =
  'id, note, event_type, period, created_at, player:players!scouting_events_player_id_fkey(id, display_name, position, team_label), game:games!scouting_events_game_id_fkey(id, played_on, home_team, away_team)' as const

export const listScoutingNotes = createServerFn({ method: 'GET' }).handler(async (): Promise<ScoutingNotesResult> => {
  // 1) Identity gate, before any table access.
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

  // 2) Query as the verified user; 3) RLS filters the rows.
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

  const notes: ScoutingNoteRow[] = []
  for (const row of data) {
    if (row.note !== null) notes.push({ ...row, note: row.note })
  }

  return { status: 'ok', viewerEmail: session.user.email, notes }
})
