// Scouting smoke test: V4 per-player summary (counts computed in Postgres by
// the player_event_summary RPC through usePlayerEventSummary).
//
// Thin route. No Supabase client and no counting in the browser; the table
// shows exactly the rows the RPC returns. Filters are the V4 names: optional
// position and game-date range. Logging an event elsewhere invalidates these
// keys, so the counts are fresh when you come back.
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { usePlayerEventSummary } from '../../lib/scouting/hooks'

export const Route = createFileRoute('/scouting/aggregates')({
  component: ScoutingAggregatesPage,
})

type SummaryFilters = NonNullable<Parameters<typeof usePlayerEventSummary>[0]>
type Position = NonNullable<SummaryFilters['position']>

const POSITIONS = ['F', 'D', 'G'] as const satisfies readonly Position[]
const COUNT_COLUMNS = [
  ['goal_count', 'G'],
  ['assist_count', 'A'],
  ['shot_count', 'Shots'],
  ['hit_count', 'Hits'],
  ['penalty_count', 'Pen'],
  ['note_count', 'Notes'],
  ['event_count', 'Events'],
  ['games_count', 'Games'],
] as const

function ScoutingAggregatesPage() {
  const [position, setPosition] = useState<Position | ''>('')
  const [playedFrom, setPlayedFrom] = useState('')
  const [playedTo, setPlayedTo] = useState('')
  const summary = usePlayerEventSummary({
    position: position || null,
    playedFrom: playedFrom || null,
    playedTo: playedTo || null,
  })

  return (
    <section className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Scouting · Player summary</h1>
      <p className="mt-1 text-sm text-slate-600">Counted in the database in one call, one row per player with events.</p>

      <form aria-label="Summary filters" className="mt-4 flex flex-wrap gap-4 text-sm" onSubmit={(e) => e.preventDefault()}>
        <label className="flex items-center gap-2">
          Position
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={position}
            onChange={(e) => setPosition(POSITIONS.find((p) => p === e.target.value) ?? '')}
          >
            <option value="">All</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          From
          <input type="date" className="rounded border border-slate-300 px-2 py-1" value={playedFrom} onChange={(e) => setPlayedFrom(e.target.value)} />
        </label>
        <label className="flex items-center gap-2">
          To
          <input type="date" className="rounded border border-slate-300 px-2 py-1" value={playedTo} onChange={(e) => setPlayedTo(e.target.value)} />
        </label>
      </form>

      <div className="mt-4">
        {summary.isPending ? (
          <p className="text-slate-500">Loading summary…</p>
        ) : summary.isError ? (
          <p role="alert" className="text-red-700">
            Could not load the summary: {summary.error.message}
          </p>
        ) : summary.data.length === 0 ? (
          <p className="text-slate-600">No events logged for these filters yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-300 text-slate-500">
              <tr>
                <th className="py-2">Player</th>
                <th>Pos</th>
                <th>Team</th>
                {COUNT_COLUMNS.map(([key, label]) => (
                  <th key={key} className="text-right">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.data.map((row) => (
                <tr key={row.player_id} className="border-b border-slate-100">
                  <td className="py-2">{row.display_name}</td>
                  <td>{row.position}</td>
                  <td>{row.team_label}</td>
                  {COUNT_COLUMNS.map(([key]) => (
                    <td key={key} className="text-right tabular-nums">
                      {row[key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {summary.isFetching && !summary.isPending && <p className="mt-2 text-xs text-slate-400">Refreshing…</p>}
      </div>
    </section>
  )
}
