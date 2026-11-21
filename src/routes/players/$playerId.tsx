// Dynamic player detail route.
//
// The `$playerId` in the filename is the path param: one file serves every
// `/players/<id>` URL. `params.parse` runs the shared validation helper, so an
// invalid id (e.g. whitespace-only) fails to match this route and redirects to
// `/players` instead of rendering a fake sheet.
//
// The loader reads the player through the thin server boundary
// (src/server/getPlayerRoster.ts), never a Supabase client or the service
// directly — see docs/architecture/layer-map.md. A missing player, an invalid
// id, and "not allowed" all render the same <NotFoundPlayer> screen with
// HTTP 200, so this page never confirms which case it was.
import { createFileRoute, Link } from '@tanstack/react-router'

import { NotFoundPlayer } from '../../components/NotFoundPlayer'
import { parsePlayerIdParam } from '../../lib/playerParams'
import { defaultPlayersSearch } from '../../lib/searchSchemas'
import { getPlayerRoster } from '../../server/getPlayerRoster'

export const Route = createFileRoute('/players/$playerId')({
  params: {
    parse: (raw): { playerId: string } | false => {
      const playerId = parsePlayerIdParam(raw.playerId)
      return playerId === null ? false : { playerId }
    },
    stringify: ({ playerId }) => ({ playerId }),
  },
  loader: async ({ params }) => ({ result: await getPlayerRoster({ data: params.playerId }) }),
  component: PlayerDetailPage,
})

function PlayerDetailPage() {
  const { playerId } = Route.useParams()
  const { result } = Route.useLoaderData()

  if (!result.ok) {
    return <NotFoundPlayer playerId={playerId} />
  }

  const player = result.player

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

      <h1 className="text-2xl font-bold text-slate-900">
        #{player.sweaterNumber} {player.displayName}
      </h1>
      <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-1 text-sm text-slate-700">
        <dt className="text-slate-500">Player id</dt>
        <dd className="font-mono">{player.playerId}</dd>
        <dt className="text-slate-500">Position</dt>
        <dd>{player.position}</dd>
        <dt className="text-slate-500">Sweater</dt>
        <dd>#{player.sweaterNumber}</dd>
        <dt className="text-slate-500">Team</dt>
        <dd>{player.teamName}</dd>
      </dl>

      <p className="mt-4 text-sm">
        <Link
          to="/games"
          search={{ team: '', date: '', playerId: player.playerId }}
          className="font-medium text-sky-700 underline"
        >
          View schedule context for #{player.sweaterNumber} {player.displayName} →
        </Link>
      </p>

      <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        This URL is bookmarkable and survives a refresh.
      </p>
    </section>
  )
}
