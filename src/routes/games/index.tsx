import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router'

import { listGames } from '../../server/directoryLoader'
import { defaultGamesSearch, validateGamesSearch } from '../../lib/searchSchemas'

export const Route = createFileRoute('/games/')({
  validateSearch: validateGamesSearch,
  // Drop params equal to the defaults ('' team / '' date) from the URL.
  search: { middlewares: [stripSearchParams(defaultGamesSearch())] },
  loaderDeps: ({ search }) => ({ team: search.team, date: search.date }),
  loader: ({ deps }) => ({ games: listGames(deps) }),
  component: GamesIndexPage,
})

// Games index (route: `/games`). Server-rendered schedule view with type-safe,
// bookmarkable team/date filters written into the query string.
function GamesIndexPage() {
  const { team, date } = Route.useSearch()
  const { games } = Route.useLoaderData()

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Games</h1>
      <p className="mt-2 text-slate-600">
        The schedule view for hockey ops staff: recent results and upcoming
        matchups, each showing the opponent. Filtered views are shareable URLs.
      </p>

      <p className="mt-3 text-sm text-slate-500">
        Active filters: team ={' '}
        <span className="font-mono">{team === '' ? '(any)' : team}</span>, date ={' '}
        <span className="font-mono">{date === '' ? '(any)' : date}</span> —{' '}
        {games.length} {games.length === 1 ? 'game' : 'games'}
      </p>

      <nav aria-label="Game filters" className="mt-2 flex flex-wrap gap-3 text-sm">
        <Link to="/games" search={{ team: 'TOR', date }} className="text-sky-700 underline">
          vs TOR
        </Link>
        <Link to="/games" search={{ team: 'BOS', date }} className="text-sky-700 underline">
          vs BOS
        </Link>
        <Link to="/games" search={{ team, date: '2026-03-20' }} className="text-sky-700 underline">
          On 2026-03-20
        </Link>
        <span className="text-slate-300">|</span>
        <Link to="/games" search={{ team: '', date: '' }} className="text-sky-700 underline">
          Clear filters
        </Link>
      </nav>

      <ul className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
        {games.map((game) => (
          <li key={game.id} className="px-4 py-3 text-slate-700">
            <span className="font-medium text-slate-900">
              {game.venue === 'home' ? 'vs' : '@'} {game.opponent}
            </span>
            <span className="ml-2 text-sm text-slate-500">
              {game.opponentCode} · {game.date} ·{' '}
              {game.status === 'final' ? 'Final' : 'Scheduled'}
            </span>
          </li>
        ))}
        {games.length === 0 && (
          <li className="px-4 py-3 text-sm text-slate-500">
            No games match this filter.
          </li>
        )}
      </ul>
    </section>
  )
}
