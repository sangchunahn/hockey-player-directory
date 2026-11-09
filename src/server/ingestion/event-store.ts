// Event store: one provider event id maps to one stored event.
// Rulebook: docs/ingestion/storage-rule.md (and the decision table, key decision, replay delta).
// This is an in-memory store. A draft database table lives in supabase/drafts/ and is NOT applied.
import type { EventType } from '#/server/validation/event-payload'

export interface StoredEvent {
  id: string
  provider_event_id: string // the idempotency key: the provider's own id, never arrival time
  event_type: EventType
  period: number
}

export interface SaveInput {
  provider_event_id: string
  event_type: EventType
  period: number
}

export type SaveResult =
  | { kind: 'created'; event: StoredEvent } // new key: stored once
  | { kind: 'replayed'; event: StoredEvent } // same key, same facts: nothing inserted
  | { kind: 'corrected'; event: StoredEvent } // same key, new facts: still one event
  | { kind: 'not_saved'; reason: string } // the write failed: never report success

export interface EventStore {
  save(input: SaveInput): Promise<SaveResult>
  list(): StoredEvent[]
  // Stats come from what is stored, never from the order deliveries arrived.
  countGoals(): number
}

export interface MemoryStoreOptions {
  // Lets a test simulate a provider outage or a failed write.
  writeFails?: () => boolean
}

export function createMemoryEventStore(options: MemoryStoreOptions = {}): EventStore {
  const byKey = new Map<string, StoredEvent>()

  return {
    async save(input) {
      if (options.writeFails?.()) {
        return { kind: 'not_saved', reason: 'The write failed, so nothing was stored.' }
      }

      const existing = byKey.get(input.provider_event_id)

      if (!existing) {
        const event: StoredEvent = { id: crypto.randomUUID(), ...input }
        byKey.set(input.provider_event_id, event)
        return { kind: 'created', event }
      }

      const sameFacts = existing.event_type === input.event_type && existing.period === input.period
      if (sameFacts) {
        return { kind: 'replayed', event: existing }
      }

      // Late correction: the same key comes back with different facts. Still one event.
      const corrected: StoredEvent = { ...existing, event_type: input.event_type, period: input.period }
      byKey.set(input.provider_event_id, corrected)
      return { kind: 'corrected', event: corrected }
    },

    list() {
      return [...byKey.values()]
    },

    countGoals() {
      return [...byKey.values()].filter((e) => e.event_type === 'goal').length
    },
  }
}
