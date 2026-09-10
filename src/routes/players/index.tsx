import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/players/')({ component: PlayersIndexPage })

// Players index (route: `/players`). Static shell for the roster list. Seed data
// and per-player bookmarkable detail pages (`/players/$playerId`) come in a
// later step.
function PlayersIndexPage() {
  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Players</h1>
      <p className="mt-2 text-slate-600">
        The roster directory hockey ops staff scan to find a player. Each player
        will get its own shareable URL (<code>/players/&lt;id&gt;</code>) in a
        later step.
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-slate-700">
        <li>Placeholder row — forward</li>
        <li>Placeholder row — defense</li>
        <li>Placeholder row — goaltender</li>
      </ul>
      <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        Placeholder: real player rows (seed data) load in a later step.
      </p>
    </section>
  )
}
