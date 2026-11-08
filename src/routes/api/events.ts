// POST /api/events: the receptionist for the provider's game-event push.
// Contract: openapi/hockey-ingestion.yaml, path /game-events (the /api prefix is the route address).
// Flow: read JSON -> validate (no persistence yet) -> 201 stub or 400/422 error envelope.

import { createFileRoute } from '@tanstack/react-router'
import { validateGameEventRequest } from '#/server/validation/event-payload'
import type { ErrorDetail } from '#/server/validation/field-errors'

function errorResponse(status: number, code: string, message: string, details?: ErrorDetail[]) {
  return Response.json({ error: { code, message, ...(details ? { details } : {}) } }, { status })
}

export const Route = createFileRoute('/api/events')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 400: wrong content type or empty / non-JSON body. Field checks never start.
        const contentType = request.headers.get('content-type') ?? ''
        if (!contentType.includes('application/json')) {
          return errorResponse(400, 'BAD_REQUEST', 'Content-Type must be application/json.')
        }

        const raw = await request.text()
        if (raw.trim() === '') {
          return errorResponse(400, 'BAD_REQUEST', 'Request body is empty.')
        }

        let body: unknown
        try {
          body = JSON.parse(raw)
        } catch {
          return errorResponse(400, 'BAD_REQUEST', 'Request body is not valid JSON.')
        }

        // 422: JSON parsed, but a field is missing, the wrong type, or out of range.
        const result = validateGameEventRequest(body)
        if (!result.ok) {
          return errorResponse(422, 'VALIDATION_FAILED', `${result.details.length} field(s) need fixing.`, result.details)
        }

        // 201 stub: no database yet (persistence is a later step). Id is invented for now.
        return Response.json({ id: crypto.randomUUID(), ...result.value }, { status: 201 })
      },
    },
  },
})
