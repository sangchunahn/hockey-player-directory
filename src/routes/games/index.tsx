import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/games/')({ component: GamesIndexPage })

// Games index (route: `/games`). Static shell for the schedule view. Seed game
// rows (each with an opponent) and filters (validated search params) come in
// later steps.
function GamesIndexPage() {
  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Games</h1>
      <p className="mt-2 text-slate-600">
        The schedule view for hockey ops staff: recent results and upcoming
        matchups, each showing the opponent. Filters arrive when search params
        are validated in a later step.
      </p>
      <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        Placeholder: no game rows loaded yet — schedule data loads in a later
        step.
      </p>
    </section>
  )
}
