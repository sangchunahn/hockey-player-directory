// Scouting smoke test: V3 event board + "log an event" (scout write).
//
// Thin route. Reads: useEventBoard (events joined to player + game), plus
// usePlayers / useGames to fill the pickers. Write: useCreateScoutingEvent,
// whose onSuccess invalidates matching event boards/lists and every summary
// (docs/scouting-cache-invalidation-map.md). So after "Log event" the board
// below refetches by itself, with no reload and no manual refetch here.
// No Supabase client in this file.
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { useEventBoard, useGames, usePlayers } from '../../lib/scouting/hooks'
import { useCreateScoutingEvent } from '../../lib/scouting/mutation-hooks'

export const Route = createFileRoute('/scouting/events')({
  component: ScoutingEventsPage,
})

type EventFilters = NonNullable<Parameters<typeof useEventBoard>[0]>
type EventType = NonNullable<EventFilters['eventType']>

const EVENT_TYPES = ['goal', 'assist', 'shot', 'hit', 'penalty', 'note'] as const satisfies readonly EventType[]
const toEventType = (value: string): EventType | '' => EVENT_TYPES.find((t) => t === value) ?? ''

function ScoutingEventsPage() {
  // V3 filters — UI state; passed into the hook so each combination is its own query.
  const [playerId, setPlayerId] = useState('')
  const [gameId, setGameId] = useState('')
  const [eventType, setEventType] = useState<EventType | ''>('')

  const board = useEventBoard({ playerId: playerId || null, gameId: gameId || null, eventType: eventType || null })
  const players = usePlayers()
  const games = useGames()

  return (
    <section className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Scouting · Events</h1>

      <LogEventForm players={players.data ?? []} games={games.data ?? []} defaultPlayerId={playerId} defaultGameId={gameId} />

      <h2 className="mt-8 text-lg font-semibold">Event board</h2>
      <form aria-label="Event filters" className="mt-2 flex flex-wrap gap-4 text-sm" onSubmit={(e) => e.preventDefault()}>
        <label className="flex items-center gap-2">
          Player
          <select className="rounded border border-slate-300 px-2 py-1" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">All</option>
            {players.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Game
          <select className="rounded border border-slate-300 px-2 py-1" value={gameId} onChange={(e) => setGameId(e.target.value)}>
            <option value="">All</option>
            {games.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.played_on} · {g.home_team} vs {g.away_team}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Type
          <select className="rounded border border-slate-300 px-2 py-1" value={eventType} onChange={(e) => setEventType(toEventType(e.target.value))}>
            <option value="">All</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </form>

      <div className="mt-3">
        {board.isPending ? (
          <p className="text-slate-500">Loading events…</p>
        ) : board.isError ? (
          <p role="alert" className="text-red-700">
            Could not load events: {board.error.message}
          </p>
        ) : board.data.length === 0 ? (
          <p className="text-slate-600">No events match these filters yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-300 text-slate-500">
              <tr>
                <th className="py-2">Game</th>
                <th>Per.</th>
                <th>Player</th>
                <th>Type</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {board.data.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="py-2">
                    {e.game.played_on} · {e.game.home_team} vs {e.game.away_team}
                  </td>
                  <td>{e.period ?? '—'}</td>
                  <td>
                    {e.player.display_name} ({e.player.position})
                  </td>
                  <td>{e.event_type}</td>
                  <td className="text-slate-600">{e.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {board.isFetching && !board.isPending && <p className="mt-2 text-xs text-slate-400">Refreshing…</p>}
      </div>
    </section>
  )
}

type PickerPlayer = { id: string; display_name: string; team_label: string }
type PickerGame = { id: string; played_on: string; home_team: string; away_team: string }

/** Minimal create form. Validation and DB errors come back as a readable message. */
function LogEventForm(props: { players: PickerPlayer[]; games: PickerGame[]; defaultPlayerId: string; defaultGameId: string }) {
  const createEvent = useCreateScoutingEvent()
  const [playerId, setPlayerId] = useState(props.defaultPlayerId)
  const [gameId, setGameId] = useState(props.defaultGameId)
  const [eventType, setEventType] = useState<EventType>('goal')
  const [period, setPeriod] = useState('')
  const [note, setNote] = useState('')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    createEvent.mutate(
      {
        player_id: playerId,
        game_id: gameId,
        event_type: eventType,
        period: period ? Number(period) : null,
        note: note.trim() || null,
      },
      // UI state is the component's job; the hook only refreshes server data.
      { onSuccess: () => setNote('') },
    )
  }

  return (
    <form aria-label="Log event" onSubmit={onSubmit} className="mt-4 grid gap-3 rounded border border-slate-200 p-4 text-sm sm:grid-cols-2">
      <label className="flex flex-col gap-1">
        Player
        <select required className="rounded border border-slate-300 px-2 py-1" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
          <option value="">Choose…</option>
          {props.players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name} · {p.team_label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Game
        <select required className="rounded border border-slate-300 px-2 py-1" value={gameId} onChange={(e) => setGameId(e.target.value)}>
          <option value="">Choose…</option>
          {props.games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.played_on} · {g.home_team} vs {g.away_team}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Type
        <select className="rounded border border-slate-300 px-2 py-1" value={eventType} onChange={(e) => setEventType(toEventType(e.target.value) || 'goal')}>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Period (optional)
        <select className="rounded border border-slate-300 px-2 py-1" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="">—</option>
          {['1', '2', '3', '4', '5'].map((n) => (
            <option key={n} value={n}>
              {n === '4' ? '4 (OT)' : n === '5' ? '5 (SO)' : n}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        Note {eventType === 'note' ? '(required)' : '(optional)'}
        <input className="rounded border border-slate-300 px-2 py-1" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={createEvent.isPending} className="rounded bg-sky-700 px-3 py-1.5 font-medium text-white disabled:opacity-50">
          {createEvent.isPending ? 'Saving…' : 'Log event'}
        </button>
        {createEvent.isError && (
          <p role="alert" className="text-red-700">
            {createEvent.error.message}
          </p>
        )}
        {createEvent.isSuccess && <p className="text-green-700">Saved. The board and summaries have refreshed.</p>}
      </div>
    </form>
  )
}
