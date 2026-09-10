// Shared primary navigation for hockey ops staff.
//
// Uses the router's type-safe <Link> — NOT plain <a href> — so the `to` values
// are checked against the generated route tree and in-app navigation keeps the
// root layout mounted. Each link highlights when its section is active
// (TanStack Router sets the active state from the current pathname):
//   * Home is exact-match only.
//   * Players stays active on /players AND /players/$playerId.
//   * Games stays active on /games.
import { Link } from '@tanstack/react-router'

import { defaultGamesSearch, defaultPlayersSearch } from '../lib/searchSchemas'

const base =
  'border-b-2 border-transparent pb-1 text-slate-600 hover:text-slate-900'
const activeProps = {
  className: 'border-sky-600 font-semibold text-slate-900',
}

export function AppNav() {
  return (
    <nav
      aria-label="Primary"
      className="flex flex-wrap gap-5 border-b border-slate-200 bg-slate-50 px-6 py-3 text-sm"
    >
      <Link
        to="/"
        className={base}
        activeOptions={{ exact: true }}
        activeProps={activeProps}
      >
        Home
      </Link>
      <Link
        to="/players"
        search={defaultPlayersSearch()}
        className={base}
        activeProps={activeProps}
      >
        Players
      </Link>
      <Link
        to="/games"
        search={defaultGamesSearch()}
        className={base}
        activeProps={activeProps}
      >
        Games
      </Link>
    </nav>
  )
}
