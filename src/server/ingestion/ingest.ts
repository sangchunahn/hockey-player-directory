// Ingest: validate first, then hand a valid event to the store.
// Not wired to the public routes yet: identity comes before saving (docs/handoff/sprint5-api-decisions.md).
import { validateGameEventRequest } from '#/server/validation/event-payload'
import type { ErrorDetail } from '#/server/validation/field-errors'
import { fieldError } from '#/server/validation/field-errors'
import type { EventStore, StoredEvent } from './event-store'

export type IngestResult =
  // created, replayed, and corrected all give back the stored event with status 201.
  // A replay returns exactly what the first accept returned: the original stored event, nothing added.
  | { outcome: 'saved' | 'replayed' | 'corrected'; reply: { status: 201; body: StoredEvent } }
  | { outcome: 'rejected'; details: ErrorDetail[] }
  | { outcome: 'not_saved'; reason: string }

export async function ingestEvent(store: EventStore, body: unknown): Promise<IngestResult> {
  const checked = validateGameEventRequest(body)
  if (!checked.ok) return { outcome: 'rejected', details: checked.details }

  // The storage rule needs the provider's own id. Without it a repeat cannot be recognized.
  const key = checked.value.provider_event_id
  if (key === undefined || key === '') {
    return {
      outcome: 'rejected',
      details: [fieldError('provider_event_id', 'REQUIRED', 'provider_event_id is required to store an event.')],
    }
  }

  const result = await store.save({
    provider_event_id: key,
    event_type: checked.value.event_type,
    period: checked.value.period,
  })

  if (result.kind === 'not_saved') return { outcome: 'not_saved', reason: result.reason }

  const outcome = result.kind === 'created' ? 'saved' : result.kind
  return { outcome, reply: { status: 201, body: result.event } }
}

// A batch: judge each event on its own. Saved neighbors stay saved when another fails.
export async function ingestBatch(store: EventStore, bodies: unknown[]): Promise<IngestResult[]> {
  const results: IngestResult[] = []
  for (const body of bodies) {
    results.push(await ingestEvent(store, body))
  }
  return results
}
