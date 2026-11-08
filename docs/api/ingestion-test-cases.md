# Ingestion test cases (given / when / then)

Each case names its contract source in `openapi/hockey-ingestion.yaml`.
Routes: `POST /api/events` (provider) and `POST /api/evaluations` (coach).

## Provider: game event push (`/game-events`)

| # | Given | When (body) | Then | Contract |
|---|---|---|---|---|
| E1 | The provider has a complete event | `{"event_type":"goal","period":2}` | 201, body has `id`, `event_type`, `period` | 201 GameEvent |
| E2 | The provider has an event with its own id | adds `"provider_event_id":"pe-1"` | 201, body echoes `provider_event_id` | GameEventRequest (proposed field) |
| E3 | The event type is missing | `{"period":2}` | 422, `VALIDATION_FAILED`, detail `event_type` / `REQUIRED` | 422 ErrorResponse, ErrorDetail |
| E4 | The period is out of range | `{"event_type":"goal","period":9}` | 422, detail `period` / `OUT_OF_RANGE` | 422, `period` maximum 5 (proposed) |
| E5 | The event type is not allowed | `{"event_type":"shot","period":2}` | 422, detail `event_type` / `INVALID` | enum goal, penalty |
| E6 | The period is text | `{"event_type":"goal","period":"2"}` | 422, detail `period` / `INVALID` | period integer |
| E7 | The period is not whole | `{"event_type":"goal","period":2.5}` | 422, detail `period` / `INVALID` | period integer |
| E8 | Both fields are bad | `{"event_type":"shot","period":9}` | 422, two details, one per field | 422 lists every bad field |
| E9 | A flag tries to skip checks | `{"isValid":true,"event_type":"goal","period":9}` | 422, detail `period` / `OUT_OF_RANGE`; flag has no effect | 422 |
| E10 | The body is empty | empty string | 400, no `details` | 400 |
| E11 | The body is not JSON | `{bad` | 400, no `details` | 400 |
| E12 | The content type is wrong | `text/plain` | 400, no `details` | 400 |

## Coach: evaluation form (`/evaluations`)

| # | Given | When (body) | Then | Contract |
|---|---|---|---|---|
| V1 | The coach has a complete form | `{"player_id":"p-17","ratings":{"skating":4}}` | 201, body has `id`, `player_id`, `ratings` | 201 Evaluation |
| V2 | The form has notes | adds `"notes":"good pace"` | 201, body echoes `notes` | EvaluationRequest (proposed) |
| V3 | The player is missing | `{"ratings":{"skating":4}}` | 422, detail `player_id` / `REQUIRED` | 422 ErrorDetail |
| V4 | The ratings are missing | `{"player_id":"p-17"}` | 422, detail `ratings` / `REQUIRED` | 422 |
| V5 | A rating is above 5 | `{"player_id":"p-17","ratings":{"skating":6}}` | 422, detail `ratings.skating` / `OUT_OF_RANGE` | additionalProperties maximum 5 (proposed) |
| V6 | A rating is text | `{"player_id":"p-17","ratings":{"skating":"4"}}` | 422, detail `ratings.skating` / `INVALID` | integer |
| V7 | Notes are not text | `{"player_id":"p-17","ratings":{"skating":4},"notes":5}` | 422, detail `notes` / `INVALID` | notes string |
| V8 | Several fields are bad | `{"ratings":{"skating":6}}` | 422, one detail per bad field (`player_id` REQUIRED, `ratings.skating` OUT_OF_RANGE) | 422 lists every bad field |
| V9 | The body is empty | empty string | 400, no `details` | 400 |
| V10 | The body is not JSON | `{bad` | 400, no `details` | 400 |
| V11 | The content type is wrong | `text/plain` | 400, no `details` | 400 |

## Rules these cases enforce

- Success is always 201 with the stored body. Never 200 for a create.
- Unreadable requests are 400 with no details. A parsed body that breaks a field rule is 422.
- Every 422 lists every bad field in `error.details`, not just the first.
- Client flags such as `isValid` never change the outcome.
