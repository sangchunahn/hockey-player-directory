import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router'

import { listPlayers } from '../../server/directoryLoader'
import {
  defaultPlayersSearch,
  validatePlayersSearch,
  type PlayerPosition,
} from '../../lib/searchSchemas'

export const Route = createFileRoute('/players/')({
  validateSearch: validatePlayersSearch,
  // Keep bookmark URLs clean: params equal to the defaults are dropped from
  // the query string (so plain `/players` and `/players?position=F` both work).
  search: { middlewares: [stripSearchParams(defaultPlayersSearch())] },
  // Pass the validated search into the loader so filtering happens on the
  // server and the filtered rows are in the first HTML.
  // Roster status is not a filter here: injured reserve is a medical flag, sealed
  // on shared screens (docs/access/access-matrix-v2.md).
  loaderDeps: ({ search }) => ({
    position: search.position,
  }),
  loader: ({ deps }) => ({ players: listPlayers(deps) }),
  component: PlayersIndexPage,
})

const POSITION_LABEL: Record<Exclude<PlayerPosition, 'all'>, string> = {
  F: 'Forward',
  D: 'Defense',
  G: 'Goaltender',
}

// Players index (route: `/players`). Server-rendered roster list with type-safe,
// bookmarkable filters written into the query string.
function PlayersIndexPage() {
  const { position, status } = Route.useSearch()
  const { players } = Route.useLoaderData()

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Players</h1>
      <p className="mt-2 text-slate-600">
        The roster directory hockey ops staff scan to find a player. Each player
        has its own shareable URL (<code>/players/&lt;id&gt;</code>). Filtered
        views are shareable too.
      </p>

      <p className="mt-3 text-sm text-slate-500">
        Active filter: position = <span className="font-mono">{position}</span> — {players.length}{' '}
        {players.length === 1 ? 'player' : 'players'}
      </p>

      <nav
        aria-label="Player filters"
        className="mt-2 flex flex-wrap gap-3 text-sm"
      >
        <Link to="/players" search={{ position: 'all', status }} className="text-sky-700 underline">
          All positions
        </Link>
        <Link to="/players" search={{ position: 'F', status }} className="text-sky-700 underline">
          Forwards
        </Link>
        <Link to="/players" search={{ position: 'D', status }} className="text-sky-700 underline">
          Defense
        </Link>
        <Link to="/players" search={{ position: 'G', status }} className="text-sky-700 underline">
          Goaltenders
        </Link>
        <span className="text-slate-300">|</span>
        <Link to="/players" search={{ position: 'all', status: 'active' }} className="text-sky-700 underline">
          Reset
        </Link>
      </nav>

      <ul className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
        {players.map((player) => (
          <li key={player.id} className="px-4 py-3">
            <Link
              to="/players/$playerId"
              params={{ playerId: player.id }}
              className="font-medium text-sky-700 underline"
            >
              #{player.number} {player.name}
            </Link>
            <span className="ml-2 text-sm text-slate-500">
              {POSITION_LABEL[player.position]}
            </span>
          </li>
        ))}
        {players.length === 0 && (
          <li className="px-4 py-3 text-sm text-slate-500">
            No players match this filter.
          </li>
        )}
      </ul>
    </section>
  )
}
