import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router'

import { defaultGamesSearch, validateGamesSearch } from '../../lib/searchSchemas'

export const Route = createFileRoute('/games/')({
  validateSearch: validateGamesSearch,
  // Drop params equal to the defaults ('' team / '' date) from the URL.
  search: { middlewares: [stripSearchParams(defaultGamesSearch())] },
  component: GamesIndexPage,
})

// Placeholder schedule until seed data is wired in a later step. Filtered by
// the `team` (opponent code) and `date` search params.
const placeholderGames: ReadonlyArray<{
  id: string
  opponent: string
  team: string
  date: string
  home: boolean
}> = [
  { id: 'g1', opponent: 'Toronto', team: 'TOR', date: '2026-03-20', home: true },
  { id: 'g2', opponent: 'Boston', team: 'BOS', date: '2026-03-22', home: false },
  { id: 'g3', opponent: 'Toronto', team: 'TOR', date: '2026-04-02', home: false },
]

// Games index (route: `/games`). Static shell for the schedule view with
// type-safe, bookmarkable team/date filters written into the query string.
function GamesIndexPage() {
  const { team, date } = Route.useSearch()

  const visible = placeholderGames.filter(
    (g) => (team === '' || g.team === team) && (date === '' || g.date === date),
  )

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
        <span className="font-mono">{date === '' ? '(any)' : date}</span>
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
        {visible.map((game) => (
          <li key={game.id} className="px-4 py-3 text-slate-700">
            <span className="font-medium text-slate-900">
              {game.home ? 'vs' : '@'} {game.opponent}
            </span>
            <span className="ml-2 text-sm text-slate-500">
              {game.team} · {game.date}
            </span>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-4 py-3 text-sm text-slate-500">
            No placeholder games match this filter.
          </li>
        )}
      </ul>

      <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        Placeholder: real schedule rows (seed data) replace these in a later
        step.
      </p>
    </section>
  )
}
