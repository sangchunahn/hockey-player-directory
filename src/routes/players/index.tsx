import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/players/')({ component: PlayersIndexPage })

// Placeholder roster until seed data is wired in a later step. Ids are the
// path-param values used for the bookmarkable detail URL (/players/<id>).
const placeholderPlayers: ReadonlyArray<{ id: string; name: string; pos: string }> = [
  { id: '12', name: 'Placeholder Forward', pos: 'Forward' },
  { id: '27', name: 'Placeholder Defense', pos: 'Defense' },
  { id: '31', name: 'Placeholder Goaltender', pos: 'Goaltender' },
]

// Players index (route: `/players`). Static shell for the roster list. Each row
// links to the dynamic detail route with a type-safe path param.
function PlayersIndexPage() {
  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Players</h1>
      <p className="mt-2 text-slate-600">
        The roster directory hockey ops staff scan to find a player. Each player
        has its own shareable URL (<code>/players/&lt;id&gt;</code>).
      </p>

      <ul className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
        {placeholderPlayers.map((player) => (
          <li key={player.id} className="px-4 py-3">
            <Link
              to="/players/$playerId"
              params={{ playerId: player.id }}
              className="font-medium text-sky-700 underline"
            >
              {player.name}
            </Link>
            <span className="ml-2 text-sm text-slate-500">
              #{player.id} · {player.pos}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        Placeholder: real player rows (seed data) replace these in a later step.
      </p>
    </section>
  )
}
