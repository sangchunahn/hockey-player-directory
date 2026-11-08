# Error and status model: hockey events and coach evaluations

**Built from:** `docs/api/resource-design.md` (the operations) and
`docs/scoping/resource-inventory.md` (the actors and states).
**Scope:** happy-path codes and failure codes for the two in-scope operations, one shared
error shape, and identity codes reserved for later. No server-crash codes are designed here.

## Operations covered

| Operation | Method | Path | Caller |
|---|---|---|---|
| Push a game event | POST | `/game-events` | Third-party hockey data provider |
| Submit an evaluation form | POST | `/evaluations` | Coach |

## Happy path

| Operation | Success code | Why | Response body |
|---|---|---|---|
| Push a game event | **201 Created** | A new game event now exists. | The stored event, including its id. |
| Submit an evaluation form | **201 Created** | A new evaluation now exists. | The stored evaluation, including its id. |

Both are creates, so **200 OK is not used** for either. A 200 would hide that a new record
was stored.

## Failure codes

| Code | Meaning | Game event example | Evaluation example |
|---|---|---|---|
| **400 Bad Request** | The request is not usable at all: empty body, not JSON, or wrong content type. Field checks never start. | Provider sends an empty body. | Coach's app sends a form with no body. |
| **422 Unprocessable Content** | The JSON parsed, but a field is missing, the wrong type, or breaks a rule. | A period of 9, or a missing event type. | A rating left blank, or a required field missing. |
| **401 Unauthorized** | No valid identity was sent. Reserved for later login work; this sprint does not implement login. | A push with no provider credential. | A form submitted with no staff sign-in. |
| **403 Forbidden** | A valid identity is not allowed to call this operation. Reserved. | A coach's identity posting to `/game-events`. | A provider's identity posting to `/evaluations`. |
| **404 Not Found** | The address names a record the API has never stored. None of the in-scope operations fetch by id, so this does not apply to them today. | Not applicable today. | Not applicable today. |
| **409 Conflict** | The request is valid, but accepting it would create a duplicate of a stored record. | **Proposed, needs confirmation:** the provider sends its own event id. A resend of an id the team already stored is refused with 409 `CONFLICT`. The story does not state this; see Open decisions. | Not applicable today. |

**400 vs 422, decided:**
- **400 Bad Request** is only for a request the server cannot read as a request at all: an empty body, bytes that are not JSON, or the wrong content type. The server never starts checking fields.
- **422 Unprocessable Content** is for JSON that parsed correctly but fails a field rule (missing, wrong type, out of range).
- **A failed create never returns 200 with `{ "success": false }`.** Every failure uses a 4xx status and the error shape below.

**Duplicate example (409, proposed):** the provider resends goal `pe-20261104-0042`, which the team already stored from the first push. The body is well formed and passes every field rule, so it is not 422. Accepting it would store the same goal twice, so the server refuses it with 409 and `error.code` = `CONFLICT`, naming the event id in `error.message`.

## One error shape for both operations

Every failure, from either operation, returns the same shape:

```
error.code      a stable, machine-readable token, such as VALIDATION_FAILED or CONFLICT
error.message   a short summary of the whole failure
error.details   zero or more field problems, one object per bad field:
                  field    the field path, such as period or ratings.skating
                  code     REQUIRED, OUT_OF_RANGE, or DUPLICATE
                  message  what to fix, in plain words
```

Validation failures list **every** bad field in `error.details`. None are hidden in the
summary, so a coach or the provider can fix them all in one pass.

## Stories this model answers

- **Provider sends a goal with no period.** 422, `error.code` = `VALIDATION_FAILED`,
  `details` names `period` with code `REQUIRED`.
- **Coach submits a half-filled evaluation.** 422, one detail per missing or invalid field,
  so the coach can fill in each one.
- **Provider sends something that is not JSON.** 400, with no field details, because
  field checks never started.

## Out of scope for this model

- **Server crashes (5xx).** These are bugs to log, not a contract for providers or coaches.
- **Token issuance and storage.** How a caller gets or keeps an identity is not designed here. Only the reserved 401 and 403 codes are listed.
- **Database tables.** Storage shape is decided in a later step.
- **A second client error format.** Every 4xx in this model uses the one error shape above.

## Open decisions

1. **Duplicate events (409), needs stakeholder confirmation.** This model assumes each game
   event carries an id from the provider (`provider_event_id`). The client story does not say
   this. If the lead rejects it, the 409 row must be removed and duplicate handling redesigned.
2. **Identity codes (401, 403).** Both are reserved. Which identity each caller presents
   is open, because provider identity is an open question in the brief.
3. **Draft evaluations.** Not in scope here. If drafts exist, they need their own
   success codes and states, decided before they are designed.
