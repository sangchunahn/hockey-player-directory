// Shared error shape. Mirrors components/schemas/ErrorDetail and ErrorResponse
// in openapi/hockey-ingestion.yaml. Both payloads must fail through this file.

// REQUIRED, OUT_OF_RANGE, DUPLICATE come from the YAML enum.
// INVALID covers a wrong JSON type (for example period as text); the YAML does not list it yet.
export type ErrorCode = 'REQUIRED' | 'OUT_OF_RANGE' | 'DUPLICATE' | 'INVALID';

export interface ErrorDetail {
  field: string;
  code: ErrorCode;
  message: string;
}

export interface ErrorResponse {
  error: {
    code: 'VALIDATION_FAILED' | 'CONFLICT';
    message: string;
    details?: ErrorDetail[];
  };
}

export function fieldError(field: string, code: ErrorCode, message: string): ErrorDetail {
  return { field, code, message };
}

export function validationFailed(details: ErrorDetail[]): { status: 422; body: ErrorResponse } {
  return {
    status: 422,
    body: {
      error: {
        code: 'VALIDATION_FAILED',
        message: `${details.length} field(s) need fixing.`,
        details,
      },
    },
  };
}
