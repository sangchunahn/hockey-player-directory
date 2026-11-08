// Field-level error objects. Mirrors components/schemas/ErrorDetail in
// openapi/hockey-ingestion.yaml. No HTTP status or response wrapper lives here;
// the route layer (a later step) turns these into a 422 response.

// REQUIRED, OUT_OF_RANGE, DUPLICATE come from the YAML enum.
// INVALID covers a wrong JSON type (for example period as text).
export type ErrorCode = 'REQUIRED' | 'OUT_OF_RANGE' | 'DUPLICATE' | 'INVALID';

export interface ErrorDetail {
  field: string;
  code: ErrorCode;
  message: string;
}

export function fieldError(field: string, code: ErrorCode, message: string): ErrorDetail {
  return { field, code, message };
}
