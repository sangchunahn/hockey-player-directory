import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: HomePage })

// Home / directory landing (route: `/`). Static shell — real directory counts
// server-render in a later step.
function HomePage() {
  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">
        Hockey Ops Player Directory
      </h1>
      <p className="mt-2 text-slate-600">
        The staff landing page for the roster and the schedule. Open{' '}
        <Link to="/players" className="text-sky-700 underline">
          Players
        </Link>{' '}
        for the directory list, or{' '}
        <Link to="/games" className="text-sky-700 underline">
          Games
        </Link>{' '}
        for recent and upcoming matchups.
      </p>
      <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        Placeholder: live player and game counts will be server-rendered into
        this page in a later step.
      </p>
    </section>
  )
}
