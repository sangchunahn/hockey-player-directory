// Checks an untrusted push against components/schemas/GameEventRequest.
import { fieldError, type ErrorDetail } from './field-errors';

export type EventType = 'goal' | 'penalty';

export interface GameEventRequest {
  provider_event_id?: string; // proposed in the contract, needs confirmation
  event_type: EventType;
  period: number; // integer 1-5, 1-5 range proposed
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; details: ErrorDetail[] };

const EVENT_TYPES: readonly string[] = ['goal', 'penalty'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateGameEventRequest(input: unknown): ValidationResult<GameEventRequest> {
  if (!isRecord(input)) {
    return { ok: false, details: [fieldError('body', 'INVALID', 'Request body must be a JSON object.')] };
  }

  const details: ErrorDetail[] = [];

  if (input.provider_event_id !== undefined && typeof input.provider_event_id !== 'string') {
    details.push(fieldError('provider_event_id', 'INVALID', 'provider_event_id must be text.'));
  }

  if (input.event_type === undefined) {
    details.push(fieldError('event_type', 'REQUIRED', 'event_type is required. Use goal or penalty.'));
  } else if (typeof input.event_type !== 'string' || !EVENT_TYPES.includes(input.event_type)) {
    details.push(fieldError('event_type', 'INVALID', 'event_type must be goal or penalty.'));
  }

  if (input.period === undefined) {
    details.push(fieldError('period', 'REQUIRED', 'period is required. Use a whole number from 1 to 5.'));
  } else if (typeof input.period !== 'number' || !Number.isInteger(input.period)) {
    details.push(fieldError('period', 'INVALID', 'period must be a whole number.'));
  } else if (input.period < 1 || input.period > 5) {
    details.push(fieldError('period', 'OUT_OF_RANGE', 'period must be from 1 to 5.'));
  }

  if (details.length > 0) return { ok: false, details };

  return {
    ok: true,
    value: {
      provider_event_id: input.provider_event_id as string | undefined,
      event_type: input.event_type as EventType,
      period: input.period as number,
    },
  };
}
