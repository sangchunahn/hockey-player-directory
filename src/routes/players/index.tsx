import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router'

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
  component: PlayersIndexPage,
})

// Placeholder roster until seed data is wired in a later step. `id` is the
// path-param value for the bookmarkable detail URL (/players/<id>); `pos` is
// filtered by the `position` search param.
const placeholderPlayers: ReadonlyArray<{
  id: string
  name: string
  pos: Exclude<PlayerPosition, 'all'>
}> = [
  { id: '12', name: 'Placeholder Forward', pos: 'F' },
  { id: '27', name: 'Placeholder Defense', pos: 'D' },
  { id: '31', name: 'Placeholder Goaltender', pos: 'G' },
  { id: '44', name: 'Placeholder Winger', pos: 'F' },
]

const POSITION_LABEL: Record<Exclude<PlayerPosition, 'all'>, string> = {
  F: 'Forward',
  D: 'Defense',
  G: 'Goaltender',
}

// Players index (route: `/players`). Static shell for the roster list with
// type-safe, bookmarkable filters written into the query string.
function PlayersIndexPage() {
  const { position, status } = Route.useSearch()

  const visible =
    position === 'all'
      ? placeholderPlayers
      : placeholderPlayers.filter((p) => p.pos === position)

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Players</h1>
      <p className="mt-2 text-slate-600">
        The roster directory hockey ops staff scan to find a player. Each player
        has its own shareable URL (<code>/players/&lt;id&gt;</code>). Filtered
        views are shareable too.
      </p>

      <p className="mt-3 text-sm text-slate-500">
        Active filters: position = <span className="font-mono">{position}</span>,
        status = <span className="font-mono">{status}</span>
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
        <Link to="/players" search={{ position, status: 'active' }} className="text-sky-700 underline">
          Active only
        </Link>
        <Link to="/players" search={{ position, status: 'all' }} className="text-sky-700 underline">
          Any status
        </Link>
        <span className="text-slate-300">|</span>
        <Link to="/players" search={{ position: 'all', status: 'active' }} className="text-sky-700 underline">
          Reset
        </Link>
      </nav>

      <ul className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
        {visible.map((player) => (
          <li key={player.id} className="px-4 py-3">
            <Link
              to="/players/$playerId"
              params={{ playerId: player.id }}
              className="font-medium text-sky-700 underline"
            >
              {player.name}
            </Link>
            <span className="ml-2 text-sm text-slate-500">
              #{player.id} · {POSITION_LABEL[player.pos]}
            </span>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-4 py-3 text-sm text-slate-500">
            No placeholder players match this filter.
          </li>
        )}
      </ul>

      <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        Placeholder: real player rows (seed data) replace these in a later step.
      </p>
    </section>
  )
}
