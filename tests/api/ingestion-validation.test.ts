// Contract tests for POST /api/events and POST /api/evaluations.
// Cases (given / when / then): docs/api/ingestion-test-cases.md
// Contract: openapi/hockey-ingestion.yaml
// Drives the real route handlers with real Request objects. No database, no auth.
import { describe, expect, it } from 'vitest'

import { Route as EventsRoute } from '#/routes/api/events'
import { Route as EvaluationsRoute } from '#/routes/api/evaluations'

type Handler = (ctx: { request: Request }) => Promise<Response>

function handlerFor(route: unknown): Handler {
  const handlers = (route as { options: { server: { handlers: { POST: Handler } } } }).options.server.handlers
  return handlers.POST
}

const postEvents = handlerFor(EventsRoute)
const postEvaluations = handlerFor(EvaluationsRoute)

function jsonRequest(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function call(handler: Handler, url: string, body: unknown) {
  const response = await handler({ request: jsonRequest(url, body) })
  return { status: response.status, json: (await response.json()) as Record<string, any> }
}

function expectDetail(json: Record<string, any>, field: string, code: string) {
  expect(json.error.code).toBe('VALIDATION_FAILED')
  expect(json.error.details).toContainEqual({ field, code, message: expect.any(String) })
}

describe('POST /api/events (provider game-event push)', () => {
  it('E1: complete event returns 201 with stored fields', async () => {
    const r = await call(postEvents, '/api/events', { event_type: 'goal', period: 2 })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ event_type: 'goal', period: 2, id: expect.any(String) })
  })

  it('E2: provider_event_id is echoed back', async () => {
    const r = await call(postEvents, '/api/events', { event_type: 'goal', period: 2, provider_event_id: 'pe-1' })
    expect(r.status).toBe(201)
    expect(r.json.provider_event_id).toBe('pe-1')
  })

  it('E3: missing event_type is REQUIRED', async () => {
    const r = await call(postEvents, '/api/events', { period: 2 })
    expect(r.status).toBe(422)
    expectDetail(r.json, 'event_type', 'REQUIRED')
  })

  it('E4: period 9 is OUT_OF_RANGE', async () => {
    const r = await call(postEvents, '/api/events', { event_type: 'goal', period: 9 })
    expect(r.status).toBe(422)
    expectDetail(r.json, 'period', 'OUT_OF_RANGE')
  })

  it('E5: event_type outside goal/penalty is INVALID', async () => {
    const r = await call(postEvents, '/api/events', { event_type: 'shot', period: 2 })
    expect(r.status).toBe(422)
    expectDetail(r.json, 'event_type', 'INVALID')
  })

  it('E6: period as text is INVALID', async () => {
    const r = await call(postEvents, '/api/events', { event_type: 'goal', period: '2' })
    expect(r.status).toBe(422)
    expectDetail(r.json, 'period', 'INVALID')
  })

  it('E7: period 2.5 is INVALID (not a whole number)', async () => {
    const r = await call(postEvents, '/api/events', { event_type: 'goal', period: 2.5 })
    expect(r.status).toBe(422)
    expectDetail(r.json, 'period', 'INVALID')
  })

  it('E8: every bad field is listed', async () => {
    const r = await call(postEvents, '/api/events', { event_type: 'shot', period: 9 })
    expect(r.status).toBe(422)
    expect(r.json.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['event_type', 'period'])
  })

  it('E9: an isValid flag cannot skip checks', async () => {
    const r = await call(postEvents, '/api/events', { isValid: true, event_type: 'goal', period: 9 })
    expect(r.status).toBe(422)
    expectDetail(r.json, 'period', 'OUT_OF_RANGE')
    expect(r.json.isValid).toBeUndefined()
  })

  it('E10: empty body is 400 with no details', async () => {
    const r = await call(postEvents, '/api/events', '')
    expect(r.status).toBe(400)
    expect(r.json.error.details).toBeUndefined()
  })

  it('E11: non-JSON body is 400 with no details', async () => {
    const r = await call(postEvents, '/api/events', '{bad')
    expect(r.status).toBe(400)
    expect(r.json.error.details).toBeUndefined()
  })

  it('E12: wrong content type is 400 with no details', async () => {
    const request = new Request('http://localhost/api/events', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ event_type: 'goal', period: 2 }),
    })
    const response = await postEvents({ request })
    expect(response.status).toBe(400)
    expect((await response.json()).error.details).toBeUndefined()
  })
})

describe('POST /api/evaluations (coach evaluation form)', () => {
  it('V1: complete form returns 201 with stored fields', async () => {
    const r = await call(postEvaluations, '/api/evaluations', { player_id: 'p-17', ratings: { skating: 4 } })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ player_id: 'p-17', ratings: { skating: 4 }, id: expect.any(String) })
  })

  it('V2: notes are echoed back', async () => {
    const r = await call(postEvaluations, '/api/evaluations', {
      player_id: 'p-17',
      ratings: { skating: 4 },
      notes: 'good pace',
    })
    expect(r.status).toBe(201)
    expect(r.json.notes).toBe('good pace')
  })

  it('V3: missing player_id is REQUIRED', async () => {
    const r = await call(postEvaluations, '/api/evaluations', { ratings: { skating: 4 } })
    expect(r.status).toBe(422)
    expectDetail(r.json, 'player_id', 'REQUIRED')
  })

  it('V4: missing ratings is REQUIRED', async () => {
    const r = await call(postEvaluations, '/api/evaluations', { player_id: 'p-17' })
    expect(r.status).toBe(422)
    expectDetail(r.json, 'ratings', 'REQUIRED')
  })

  it('V5: rating 6 is OUT_OF_RANGE at ratings.skating', async () => {
    const r = await call(postEvaluations, '/api/evaluations', { player_id: 'p-17', ratings: { skating: 6 } })
    expect(r.status).toBe(422)
    expectDetail(r.json, 'ratings.skating', 'OUT_OF_RANGE')
  })

  it('V6: rating as text is INVALID', async () => {
    const r = await call(postEvaluations, '/api/evaluations', { player_id: 'p-17', ratings: { skating: '4' } })
    expect(r.status).toBe(422)
    expectDetail(r.json, 'ratings.skating', 'INVALID')
  })

  it('V7: notes that are not text are INVALID', async () => {
    const r = await call(postEvaluations, '/api/evaluations', { player_id: 'p-17', ratings: { skating: 4 }, notes: 5 })
    expect(r.status).toBe(422)
    expectDetail(r.json, 'notes', 'INVALID')
  })

  it('V8: several bad fields are all listed', async () => {
    const r = await call(postEvaluations, '/api/evaluations', { ratings: { skating: 6 } })
    expect(r.status).toBe(422)
    expectDetail(r.json, 'player_id', 'REQUIRED')
    expectDetail(r.json, 'ratings.skating', 'OUT_OF_RANGE')
  })

  it('V9: empty body is 400 with no details', async () => {
    const r = await call(postEvaluations, '/api/evaluations', '')
    expect(r.status).toBe(400)
    expect(r.json.error.details).toBeUndefined()
  })

  it('V10: non-JSON body is 400 with no details', async () => {
    const r = await call(postEvaluations, '/api/evaluations', '{bad')
    expect(r.status).toBe(400)
    expect(r.json.error.details).toBeUndefined()
  })

  it('V11: wrong content type is 400 with no details', async () => {
    const request = new Request('http://localhost/api/evaluations', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ player_id: 'p-17', ratings: { skating: 4 } }),
    })
    const response = await postEvaluations({ request })
    expect(response.status).toBe(400)
    expect((await response.json()).error.details).toBeUndefined()
  })
})
