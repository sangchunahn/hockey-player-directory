// Dynamic player detail route.
//
// The `$playerId` in the filename is the path param: one file serves every
// `/players/<id>` URL. `params.parse` runs the shared validation helper, so an
// invalid id (e.g. whitespace-only) fails to match this route and falls through
// to the not-found shell instead of rendering a fake "success" player sheet.
//
// This step only proves the param + bookmarkable URL work. Real roster fields
// and server-loaded stats come in a later step.
import { createFileRoute, Link } from '@tanstack/react-router'

import { parsePlayerIdParam } from '../../lib/playerParams'

export const Route = createFileRoute('/players/$playerId')({
  params: {
    parse: (raw): { playerId: string } | false => {
      const playerId = parsePlayerIdParam(raw.playerId)
      return playerId === null ? false : { playerId }
    },
    stringify: ({ playerId }) => ({ playerId }),
  },
  component: PlayerDetailPage,
})

function PlayerDetailPage() {
  const { playerId } = Route.useParams()

  return (
    <section className="mx-auto max-w-3xl">
      <p className="mb-4 text-sm">
        <Link to="/players" className="text-sky-700 underline">
          ← Back to players
        </Link>
      </p>

      <h1 className="text-2xl font-bold text-slate-900">Player detail</h1>
      <p className="mt-2 text-slate-600">
        Bookmarkable sheet for player{' '}
        <span className="font-mono font-medium text-slate-900">{playerId}</span>.
      </p>
      <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        Placeholder: this player's name, team, and stats load from seed data in a
        later step. This shell proves the <code>playerId</code> path param works
        and the URL survives a refresh.
      </p>
    </section>
  )
}
