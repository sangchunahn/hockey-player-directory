// Scouting notes page (route: /scouting/).
//
// Looks up ONE note by id, through the protected server function
// getScoutingNote (src/server/scouting-notes.ts). That function calls
// authorizeResource on this exact id before any Supabase call, so a denial
// never reaches the database. There is deliberately no "list every note"
// feed on this page: see the comment in scouting-notes.ts for why a bulk
// read can't share that same id-first guarantee. A bulk, RLS-only event
// board already exists at /scouting/events.
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'

import { getScoutingNote, type ScoutingNoteResult } from '#/server/scouting-notes'

export const Route = createFileRoute('/scouting/')({
  component: ScoutingNotesPage,
})

function ScoutingNotesPage() {
  const [noteId, setNoteId] = useState('')
  const [result, setResult] = useState<ScoutingNoteResult | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsPending(true)
    try {
      setResult(await getScoutingNote({ data: noteId.trim() }))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Scouting notes</h1>
      <p className="mt-1 text-sm text-slate-600">
        Look up one note by id. Your staff role and row-level security both decide whether you may see it — not this page.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Browsing every note is on the{' '}
        <Link to="/scouting/events" className="text-sky-700 underline">
          event board
        </Link>{' '}
        instead.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-wrap items-end gap-3" aria-label="Look up a scouting note">
        <label className="flex flex-col gap-1 text-sm">
          Note id
          <input
            required
            className="w-80 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
            value={noteId}
            onChange={(e) => setNoteId(e.target.value)}
            placeholder="11111111-2222-4333-8444-555555555555"
          />
        </label>
        <button type="submit" disabled={isPending} className="rounded bg-sky-700 px-3 py-1.5 font-medium text-white disabled:opacity-50">
          {isPending ? 'Checking…' : 'Look up'}
        </button>
      </form>

      <div className="mt-6">
        {result === null ? null : result.status === 'signed-out' ? (
          <p role="alert" className="text-slate-700">
            Sign in to look up scouting notes.{' '}
            <Link to="/login" className="text-sky-700 underline">
              Go to staff sign-in
            </Link>
          </p>
        ) : result.status === 'forbidden' ? (
          <p role="alert" className="text-slate-700">
            Your staff role does not include scouting notes.
          </p>
        ) : result.status === 'not-found' ? (
          <p role="alert" className="text-slate-700">
            No note was found for that id.
          </p>
        ) : result.status === 'error' ? (
          <p role="alert" className="text-red-700">
            {result.message}
          </p>
        ) : (
          <div className="rounded border border-slate-200 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-slate-900">
                {result.note.player.display_name} ({result.note.player.position}) · {result.note.player.team_label}
              </span>
              <span className="text-xs text-slate-500">
                {result.note.game.played_on} · {result.note.game.home_team} vs {result.note.game.away_team}
                {result.note.period ? ` · P${result.note.period}` : ''}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-700">{result.note.note}</p>
          </div>
        )}
      </div>
    </section>
  )
}
