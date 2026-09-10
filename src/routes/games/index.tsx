import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router'

import { getPlayerById, listGames } from '../../server/directoryLoader'
import {
  defaultGamesSearch,
  defaultPlayersSearch,
  validateGamesSearch,
} from '../../lib/searchSchemas'

export const Route = createFileRoute('/games/')({
  validateSearch: validateGamesSearch,
  // Drop params equal to the defaults ('' team / '' date / '' playerId).
  search: { middlewares: [stripSearchParams(defaultGamesSearch())] },
  loaderDeps: ({ search }) => ({
    team: search.team,
    date: search.date,
    playerId: search.playerId,
  }),
  loader: ({ deps }) => ({
    games: listGames(deps),
    // When the visitor arrived from a player's page, resolve that player on the
    // server so the context banner + back-link render on first paint.
    contextPlayer: deps.playerId ? getPlayerById(deps.playerId) : null,
  }),
  component: GamesIndexPage,
})

// Games index (route: `/games`). Server-rendered schedule view with type-safe,
// bookmarkable team/date filters. `?playerId=` carries "came from this player".
function GamesIndexPage() {
  const { team, date, playerId } = Route.useSearch()
  const { games, contextPlayer } = Route.useLoaderData()

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Games</h1>
      <p className="mt-2 text-slate-600">
        The schedule view for hockey ops staff: recent results and upcoming
        matchups, each showing the opponent. Filtered views are shareable URLs.
      </p>

      {playerId && (
        <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-slate-700">
          {contextPlayer ? (
            <>
              Schedule context for{' '}
              <span className="font-medium text-slate-900">
                #{contextPlayer.number} {contextPlayer.name}
              </span>
              .{' '}
              <Link
                to="/players/$playerId"
                params={{ playerId: contextPlayer.id }}
                className="text-sky-700 underline"
              >
                Back to player
              </Link>
            </>
          ) : (
            <>
              Came from player id{' '}
              <span className="font-mono">{playerId}</span>, which is not in the
              directory.{' '}
              <Link
                to="/players"
                search={defaultPlayersSearch()}
                className="text-sky-700 underline"
              >
                Browse players
              </Link>
            </>
          )}
        </p>
      )}

      <p className="mt-3 text-sm text-slate-500">
        Active filters: team ={' '}
        <span className="font-mono">{team === '' ? '(any)' : team}</span>, date ={' '}
        <span className="font-mono">{date === '' ? '(any)' : date}</span> —{' '}
        {games.length} {games.length === 1 ? 'game' : 'games'}
      </p>

      <nav aria-label="Game filters" className="mt-2 flex flex-wrap gap-3 text-sm">
        <Link to="/games" search={{ team: 'TOR', date, playerId }} className="text-sky-700 underline">
          vs TOR
        </Link>
        <Link to="/games" search={{ team: 'BOS', date, playerId }} className="text-sky-700 underline">
          vs BOS
        </Link>
        <Link to="/games" search={{ team, date: '2026-03-20', playerId }} className="text-sky-700 underline">
          On 2026-03-20
        </Link>
        <span className="text-slate-300">|</span>
        <Link to="/games" search={{ team: '', date: '', playerId }} className="text-sky-700 underline">
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
          <li className="px-4 py-6 text-center text-sm text-slate-500">
            No games match this filter.{' '}
            <Link
              to="/games"
              search={{ team: '', date: '', playerId }}
              className="text-sky-700 underline"
            >
              Clear filters
            </Link>{' '}
            to see the full schedule.
          </li>
        )}
      </ul>
    </section>
  )
}
