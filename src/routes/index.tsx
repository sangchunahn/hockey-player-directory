import { createFileRoute, Link } from '@tanstack/react-router'

import { directorySummary, listPlayers } from '../server/directoryLoader'
import { defaultGamesSearch, defaultPlayersSearch } from '../lib/searchSchemas'

export const Route = createFileRoute('/')({
  // Runs on the server for first paint — the summary numbers and featured
  // player names are in the initial HTML, not fetched later on the client.
  loader: () => ({
    summary: directorySummary(),
    featured: listPlayers({ status: 'active' }).slice(0, 3),
  }),
  component: HomePage,
})

// Home / directory landing (route: `/`).
function HomePage() {
  const { summary, featured } = Route.useLoaderData()

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">
        Hockey Ops Player Directory
      </h1>
      <p className="mt-2 text-slate-600">
        The staff landing page for the roster and the schedule. Open{' '}
        <Link
          to="/players"
          search={defaultPlayersSearch()}
          className="text-sky-700 underline"
        >
          Players
        </Link>{' '}
        for the directory list, or{' '}
        <Link
          to="/games"
          search={defaultGamesSearch()}
          className="text-sky-700 underline"
        >
          Games
        </Link>{' '}
        for recent and upcoming matchups.
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md border border-slate-200 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Players</dt>
          <dd className="text-xl font-bold text-slate-900">{summary.playerCount}</dd>
        </div>
        <div className="rounded-md border border-slate-200 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Games</dt>
          <dd className="text-xl font-bold text-slate-900">{summary.gameCount}</dd>
        </div>
        <div className="rounded-md border border-slate-200 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Upcoming</dt>
          <dd className="text-xl font-bold text-slate-900">{summary.upcomingCount}</dd>
        </div>
      </dl>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Featured players
      </h2>
      <ul className="mt-2 divide-y divide-slate-200 rounded-md border border-slate-200">
        {featured.map((player) => (
          <li key={player.id} className="px-4 py-3">
            <Link
              to="/players/$playerId"
              params={{ playerId: player.id }}
              className="font-medium text-sky-700 underline"
            >
              #{player.number} {player.name}
            </Link>
            <span className="ml-2 text-sm text-slate-500">{player.position}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
