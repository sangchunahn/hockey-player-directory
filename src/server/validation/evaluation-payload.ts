// Checks an untrusted coach form against components/schemas/EvaluationRequest.
import { fieldError, type ErrorDetail } from './field-errors';
import type { ValidationResult } from './event-payload';

export interface EvaluationRequest {
  player_id: string; // proposed, needs confirmation
  ratings: Record<string, number>; // proposed names and 1-5 scale
  notes?: string; // proposed
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateEvaluationRequest(input: unknown): ValidationResult<EvaluationRequest> {
  if (!isRecord(input)) {
    return { ok: false, details: [fieldError('body', 'INVALID', 'Request body must be a JSON object.')] };
  }

  const details: ErrorDetail[] = [];

  if (input.player_id === undefined) {
    details.push(fieldError('player_id', 'REQUIRED', 'player_id is required.'));
  } else if (typeof input.player_id !== 'string') {
    details.push(fieldError('player_id', 'INVALID', 'player_id must be text.'));
  }

  if (input.notes !== undefined && typeof input.notes !== 'string') {
    details.push(fieldError('notes', 'INVALID', 'notes must be text.'));
  }

  if (input.ratings === undefined) {
    details.push(fieldError('ratings', 'REQUIRED', 'ratings is required.'));
  } else if (!isRecord(input.ratings)) {
    details.push(fieldError('ratings', 'INVALID', 'ratings must be an object of rating names to numbers.'));
  } else {
    for (const [name, value] of Object.entries(input.ratings)) {
      const path = `ratings.${name}`;
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        details.push(fieldError(path, 'INVALID', `${path} must be a whole number.`));
      } else if (value < 1 || value > 5) {
        details.push(fieldError(path, 'OUT_OF_RANGE', `${path} must be from 1 to 5.`));
      }
    }
  }

  if (details.length > 0) return { ok: false, details };

  return {
    ok: true,
    value: {
      player_id: input.player_id as string,
      ratings: input.ratings as Record<string, number>,
      notes: input.notes as string | undefined,
    },
  };
}
