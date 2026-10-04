// Scouting smoke test: V1 player list (docs/scouting-data-requirements.md).
//
// Thin route. Data comes only from the public hooks API
// (docs/scouting-data-access-api.md): no Supabase client here. Filters are the
// two V1 names (position, team label); they are passed into usePlayers, so a
// filter change is a new query key and a real fetch, not a client-side hide.
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { usePlayers } from '../../lib/scouting/hooks'

export const Route = createFileRoute('/scouting/players')({
  component: ScoutingPlayersPage,
})

type PlayerFilters = NonNullable<Parameters<typeof usePlayers>[0]>
type Position = NonNullable<PlayerFilters['position']>

const POSITIONS = [
  { value: 'F', label: 'Forward' },
  { value: 'D', label: 'Defense' },
  { value: 'G', label: 'Goalie' },
] as const satisfies ReadonlyArray<{ value: Position; label: string }>

function ScoutingPlayersPage() {
  const [position, setPosition] = useState<Position | ''>('')
  const [teamLabel, setTeamLabel] = useState('')
  const players = usePlayers({ position: position || null, teamLabel: teamLabel.trim() || null })

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Scouting · Players</h1>

      <form aria-label="Player filters" className="mt-4 flex flex-wrap gap-4 text-sm" onSubmit={(e) => e.preventDefault()}>
        <label className="flex items-center gap-2">
          Position
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={position}
            onChange={(e) => setPosition(POSITIONS.find((p) => p.value === e.target.value)?.value ?? '')}
          >
            <option value="">All</option>
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Team
          <input
            className="rounded border border-slate-300 px-2 py-1"
            placeholder="e.g. Northline"
            value={teamLabel}
            onChange={(e) => setTeamLabel(e.target.value)}
          />
        </label>
      </form>

      <div className="mt-4">
        {players.isPending ? (
          <p className="text-slate-500">Loading players…</p>
        ) : players.isError ? (
          <p role="alert" className="text-red-700">
            Could not load players: {players.error.message}
          </p>
        ) : players.data.length === 0 ? (
          <p className="text-slate-600">No players match these filters.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-300 text-slate-500">
              <tr>
                <th className="py-2">Player</th>
                <th>Pos</th>
                <th>Team</th>
                <th>#</th>
              </tr>
            </thead>
            <tbody>
              {players.data.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-2">{p.display_name}</td>
                  <td>{p.position}</td>
                  <td>{p.team_label}</td>
                  <td>{p.sweater_number ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {players.isFetching && !players.isPending && <p className="mt-2 text-xs text-slate-400">Refreshing…</p>}
      </div>
    </section>
  )
}
