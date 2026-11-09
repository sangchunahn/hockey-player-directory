# Contract replay delta

## Replay promise

When the provider sends the same event again, using the idempotency key named below, the endpoint must:

- Return the original success: the same successful answer the contract already uses for a first accepted event. In this contract that is status 201 with the original stored event as the body, the same id and the same fields the first accept returned, with nothing added. No new status code and no new field is invented.
- Not perform a second write: do not save the event again, so one goal is counted once.
- Not return an error just because the event was already accepted. A conflict code is not the right choice, because the provider did nothing wrong.

Idempotency key name (copied from docs/ingestion/idempotency-key-decision.md, not a new name): the provider event id, which the contract already proposes as provider_event_id.

Decision-table row this promise must match: the exact-duplicate outcome in docs/ingestion/event-outcome-decision-table.md. In my words, that row says: when the same goal with the same facts arrives again, the stats stay exactly as they were, so the goal is counted once, and the sender hears that it was already saved and nothing changed.

This note does not decide late corrections, out-of-order storage, partial batches, or outages. Those stay in the decision table.

## Do not change

- Do not add, remove, or rename endpoints.
- Do not change HTTP status codes or the error model from the first Sprint 5 tutorial, except the one exception named in the review below.
- Do not rewrite validation rules.
- Do not create a second contract file.
- Do not write storage code, SQL, or migrations in this step.
- Do not pick a different idempotency key.

## Smallest contract changes

Existing contract file path (the file already in the repo): openapi/hockey-ingestion.yaml

Add only these ideas to that file, as plain descriptions on the existing ingest request and its success response:

1. The request includes the idempotency key named above.
2. If that key was already accepted, the response is the original success again.
3. A replay does not create another stored event.

## Review of the agent's edit

I read the diff myself, not only a summary.

- Contract file the agent edited: openapi/hockey-ingestion.yaml
- What changed, in one or two sentences: The 201 description for the game event push now says a replay returns the same success with the original event and stores nothing new, and the provider_event_id description now names it the idempotency key. No new field was added to the response. I left the contract's old proposed 409 response for a repeated provider_event_id in place, because this step may not change status codes. That 409 still describes a replay as a refused duplicate, which conflicts with this promise. The promise here wins for what a replay returns (the original 201), and removing or rewording the 409 is left for a later step.
- Did the edit add a second contract file? no
- Did the edit rewrite endpoints, status codes, or validation? no. All status codes, including the proposed 409, are unchanged, and the evaluations endpoint is untouched.
- Does the new wording match the key decision and the decision table? yes
