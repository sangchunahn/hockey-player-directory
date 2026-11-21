// Scouting notes page (route: /scouting/).
//
// Loads notes ONLY through the protected server function listScoutingNotes
// (src/server/scouting-notes.ts). It verifies the session and queries as the
// signed-in user so Postgres RLS filters rows by staff role. This file creates
// no Supabase client, queries no table, and filters nothing by role: it shows
// exactly what the server returned.
import { createFileRoute, Link } from '@tanstack/react-router'

import { listScoutingNotes } from '#/server/scouting-notes'

export const Route = createFileRoute('/scouting/')({
  loader: () => listScoutingNotes(),
  component: ScoutingNotesPage,
})

function ScoutingNotesPage() {
  const result = Route.useLoaderData()

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Scouting notes</h1>
      <p className="mt-1 text-sm text-slate-600">
        Rows are filtered by your staff role in the database (row-level security), not by hiding them on this page.
      </p>

      <div className="mt-6">
        {result.status === 'signed-out' ? (
          <p role="alert" className="text-slate-700">
            Sign in to see scouting notes.{' '}
            <Link to="/login" className="text-sky-700 underline">
              Go to staff sign-in
            </Link>
          </p>
        ) : result.status === 'error' ? (
          <p role="alert" className="text-red-700">
            {result.message}
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              Signed in as <span className="font-medium text-slate-700">{result.viewerEmail ?? 'staff member'}</span> ·{' '}
              {result.notes.length} {result.notes.length === 1 ? 'note' : 'notes'} visible to your role
            </p>
            {result.notes.length === 0 ? (
              <p className="mt-4 text-slate-600">No scouting notes are visible for your account.</p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {result.notes.map((n) => (
                  <li key={n.id} className="rounded border border-slate-200 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-slate-900">
                        {n.player.display_name} ({n.player.position}) · {n.player.team_label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {n.game.played_on} · {n.game.home_team} vs {n.game.away_team}
                        {n.period ? ` · P${n.period}` : ''}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{n.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  )
}
