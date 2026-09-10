// Dynamic player detail route.
//
// The `$playerId` in the filename is the path param: one file serves every
// `/players/<id>` URL. `params.parse` runs the shared validation helper, so an
// invalid id (e.g. whitespace-only) fails to match this route and redirects to
// `/players` instead of rendering a fake sheet.
//
// The loader reads the player on the SERVER via getPlayerById, so the first
// HTML already contains the player's name/number/position. An unknown-but-valid
// id (e.g. /players/9999) renders a clear not-found state with HTTP 200 — never
// a 404 or a thrown error (see docs/requirements-brief.md, Locked decisions).
import { createFileRoute, Link } from '@tanstack/react-router'

import { parsePlayerIdParam } from '../../lib/playerParams'
import { defaultPlayersSearch } from '../../lib/searchSchemas'
import { getPlayerById } from '../../server/directoryLoader'

export const Route = createFileRoute('/players/$playerId')({
  params: {
    parse: (raw): { playerId: string } | false => {
      const playerId = parsePlayerIdParam(raw.playerId)
      return playerId === null ? false : { playerId }
    },
    stringify: ({ playerId }) => ({ playerId }),
  },
  loader: ({ params }) => ({ player: getPlayerById(params.playerId) }),
  component: PlayerDetailPage,
})

function PlayerDetailPage() {
  const { playerId } = Route.useParams()
  const { player } = Route.useLoaderData()

  return (
    <section className="mx-auto max-w-3xl">
      <p className="mb-4 text-sm">
        <Link
          to="/players"
          search={defaultPlayersSearch()}
          className="text-sky-700 underline"
        >
          ← Back to players
        </Link>
      </p>

      {player ? (
        <>
          <h1 className="text-2xl font-bold text-slate-900">
            #{player.number} {player.name}
          </h1>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-1 text-sm text-slate-700">
            <dt className="text-slate-500">Player id</dt>
            <dd className="font-mono">{player.id}</dd>
            <dt className="text-slate-500">Position</dt>
            <dd>{player.position}</dd>
            <dt className="text-slate-500">Sweater</dt>
            <dd>#{player.number}</dd>
            <dt className="text-slate-500">Team</dt>
            <dd>{player.team}</dd>
            <dt className="text-slate-500">Roster status</dt>
            <dd>{player.status === 'ir' ? 'Injured reserve' : 'Active'}</dd>
          </dl>
          <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
            Seed data. Stats and game logs load from a real data source in a
            later sprint. This URL is bookmarkable and survives a refresh.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-slate-900">Player not found</h1>
          <p className="mt-2 text-slate-600">
            No player has id{' '}
            <span className="font-mono font-medium text-slate-900">
              {playerId}
            </span>{' '}
            in the current directory.
          </p>
          <p className="mt-4 text-sm">
            <Link
              to="/players"
              search={defaultPlayersSearch()}
              className="text-sky-700 underline"
            >
              Browse all players
            </Link>
          </p>
        </>
      )}
    </section>
  )
}
