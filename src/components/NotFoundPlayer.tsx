// Friendly "player not found" screen for the detail route.
//
// Shown when /players/<id> has a valid-shaped id that no seed player matches
// (e.g. an old bookmark). Renders at HTTP 200 inside the normal layout — not a
// blank page, not a raw error — with a type-safe way back to the roster.
import { Link } from '@tanstack/react-router'

import { defaultPlayersSearch } from '../lib/searchSchemas'

export function NotFoundPlayer({ playerId }: { playerId: string }) {
  return (
    <section className="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Player not found</h1>
      <p className="mt-2 text-slate-700">
        No roster entry matches id{' '}
        <code className="rounded bg-white px-1 font-mono">{playerId}</code>. The
        bookmark may be out of date, or the id was typed incorrectly.
      </p>
      <p className="mt-4">
        <Link
          to="/players"
          search={defaultPlayersSearch()}
          className="font-medium text-sky-700 underline underline-offset-2"
        >
          Back to players directory
        </Link>
      </p>
    </section>
  )
}
