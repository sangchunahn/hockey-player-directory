// Shared primary navigation for hockey ops staff.
//
// Uses the router's type-safe <Link> — NOT plain <a href> — so the `to` values
// are checked against the generated route tree and in-app navigation keeps the
// root layout mounted (no full-page reload).
import { Link } from '@tanstack/react-router'

const linkClass = 'text-slate-700 hover:text-slate-900'
const activeProps = { className: 'text-sky-700 underline' }

export function AppNav() {
  return (
    <nav
      aria-label="Primary"
      className="flex flex-wrap gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 text-sm font-medium"
    >
      <Link to="/" className={linkClass} activeOptions={{ exact: true }} activeProps={activeProps}>
        Home
      </Link>
      <Link to="/players" className={linkClass} activeProps={activeProps}>
        Players
      </Link>
      <Link to="/games" className={linkClass} activeProps={activeProps}>
        Games
      </Link>
    </nav>
  )
}
