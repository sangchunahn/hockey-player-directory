// Traces for the storage rule: docs/ingestion/storage-rule.md
// Rows: docs/ingestion/event-outcome-decision-table.md
// Key: docs/ingestion/idempotency-key-decision.md  Replay: docs/ingestion/contract-replay-delta.md
import { describe, expect, it } from 'vitest'

import { createMemoryEventStore } from '#/server/ingestion/event-store'
import { ingestBatch, ingestEvent } from '#/server/ingestion/ingest'

const goal = (id: string, period = 2) => ({ provider_event_id: id, event_type: 'goal', period })

describe('key check: the provider event id is the identity', () => {
  it('stores the provider id as the key, not arrival time or a fresh id per try', async () => {
    const store = createMemoryEventStore()
    const first = await ingestEvent(store, goal('pe-14-031'))
    const second = await ingestEvent(store, goal('pe-14-031'))
    expect(first.outcome).toBe('saved')
    expect(second.outcome).toBe('replayed')
    expect(store.list()).toHaveLength(1)
    expect(store.list()[0].provider_event_id).toBe('pe-14-031')
  })

  it('refuses to store an event with no provider id, since a repeat could not be recognized', async () => {
    const store = createMemoryEventStore()
    const result = await ingestEvent(store, { event_type: 'goal', period: 2 })
    expect(result.outcome).toBe('rejected')
    expect(store.list()).toHaveLength(0)
  })
})

describe('exact duplicate', () => {
  it('a second delivery inserts no second event and does not raise the goal count', async () => {
    const store = createMemoryEventStore()
    await ingestEvent(store, goal('pe-1'))
    await ingestEvent(store, goal('pe-1'))
    expect(store.list()).toHaveLength(1)
    expect(store.countGoals()).toBe(1)
  })

  it('replay return: status 201 with the original stored event, same id, nothing added', async () => {
    const store = createMemoryEventStore()
    const first = await ingestEvent(store, goal('pe-1'))
    const replay = await ingestEvent(store, goal('pe-1'))
    if (first.outcome === 'rejected' || first.outcome === 'not_saved') throw new Error('first save failed')
    if (replay.outcome === 'rejected' || replay.outcome === 'not_saved') throw new Error('replay failed')
    expect(replay.reply.status).toBe(201)
    expect(replay.reply.body).toEqual(first.reply.body)
    expect(Object.keys(replay.reply.body).sort()).toEqual(Object.keys(first.reply.body).sort())
  })
})

describe('out-of-order arrival', () => {
  it('a new late event is kept and counted, and stats come from what is stored', async () => {
    const store = createMemoryEventStore()
    await ingestEvent(store, goal('pe-late-12', 3)) // later moment arrives first
    const late = await ingestEvent(store, goal('pe-early-8', 1)) // earlier moment arrives late
    expect(late.outcome).toBe('saved')
    expect(store.list()).toHaveLength(2)
    expect(store.countGoals()).toBe(2)
  })
})

describe('partial batch', () => {
  it('each new valid event is saved once, neighbors stay saved, bad ones are reported and not stored', async () => {
    const store = createMemoryEventStore()
    const results = await ingestBatch(store, [goal('pe-a'), { event_type: 'goal', period: 9, provider_event_id: 'pe-b' }, goal('pe-c')])
    expect(results.map((r) => r.outcome)).toEqual(['saved', 'rejected', 'saved'])
    expect(store.list().map((e) => e.provider_event_id).sort()).toEqual(['pe-a', 'pe-c'])
  })

  it('retrying the whole batch does not add a second copy of a goal that already saved', async () => {
    const store = createMemoryEventStore()
    const batch = [goal('pe-a'), { event_type: 'goal', period: 9, provider_event_id: 'pe-b' }, goal('pe-c')]
    await ingestBatch(store, batch)
    const retry = await ingestBatch(store, batch)
    expect(retry.map((r) => r.outcome)).toEqual(['replayed', 'rejected', 'replayed'])
    expect(store.countGoals()).toBe(2)
  })
})

describe('late correction', () => {
  it('same key with new facts is still one event, facts match the correction, count does not rise', async () => {
    const store = createMemoryEventStore()
    const first = await ingestEvent(store, goal('pe-10', 2))
    const fix = await ingestEvent(store, { provider_event_id: 'pe-10', event_type: 'penalty', period: 2 })
    expect(fix.outcome).toBe('corrected')
    expect(store.list()).toHaveLength(1)
    expect(store.list()[0].event_type).toBe('penalty')
    if (first.outcome !== 'saved' || fix.outcome !== 'corrected') throw new Error('unexpected outcome')
    expect(fix.reply.body.id).toBe(first.reply.body.id)
  })
})

describe('provider outage / failed write', () => {
  it('a failed write is reported as not saved, never as success, and stats stay without it', async () => {
    const store = createMemoryEventStore({ writeFails: () => true })
    const result = await ingestEvent(store, goal('pe-out'))
    expect(result.outcome).toBe('not_saved')
    expect('reply' in result).toBe(false)
    expect(store.list()).toHaveLength(0)
    expect(store.countGoals()).toBe(0)
  })

  it('after the outage, the resend is saved once, and a further resend is a duplicate', async () => {
    let down = true
    const store = createMemoryEventStore({ writeFails: () => down })
    expect((await ingestEvent(store, goal('pe-out'))).outcome).toBe('not_saved')
    down = false
    expect((await ingestEvent(store, goal('pe-out'))).outcome).toBe('saved')
    expect((await ingestEvent(store, goal('pe-out'))).outcome).toBe('replayed')
    expect(store.countGoals()).toBe(1)
  })
})
