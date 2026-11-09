# Storage rule for hockey events

This file is a plain-language instruction for a later coding-agent step.
It is not SQL, not a migration, and not application code.

## Sources this rule must match

- Decision table: docs/ingestion/event-outcome-decision-table.md
- Idempotency key: docs/ingestion/idempotency-key-decision.md
- Replay promise: docs/ingestion/contract-replay-delta.md

If a sentence here disagrees with those files, this file is wrong.

## The key

- Chosen idempotency key (copied from the key decision, not invented): the provider event id, which the contract proposes as provider_event_id.
- Rule: one value of that key maps to one stored event. A second delivery with the same key is not a new event.

## Exact replay

- When that same key arrives again and the event is the same: do not insert again. Do not add the goal or the stat again.
- What the replayed request returns (copied from the contract delta): status 201 with the original stored event as the body, the same id and fields the first accept returned, with nothing added.
- That return is not a second save. The event is already stored, so the provider can stop retrying that one delivery.

## Out of order

- If an event arrives late and its key is new: keep it. Do not drop it only because it arrived after a later event.
- Stats come from stored events, not from the order deliveries arrived.
- Outcome copied from the decision table: a new minute-8 goal that arrives after the minute-12 goal is saved and counted, nothing already stored is deleted, and the sender is told it was saved. If the same facts were already saved, it follows the exact-duplicate rule instead.

## Partial batch and outage

- Partial batch outcome copied from the decision table: each new valid event in the group is saved once, the ones that saved stay saved even if a neighbor failed, and the ones that did not save are not in the stats. The reply says which saved and which did not, so the whole batch is never called a success when some events were not stored, and a retry of the whole group never adds a second copy of a goal that already saved.
- Failed write or provider outage: do not report success. Outcome copied from the decision table: an event that did not save is absent from the stats, the sender is told it was not saved, and a later resend of that event is saved once.
- How this differs from an exact replay: a replay is already stored, so it can return the original success and the provider can stop retrying. A failed write is not stored, so it must never return that success, or the provider may stop trying and the goal is lost.

## Late correction (one sentence only)

- The decision table in docs/ingestion/event-outcome-decision-table.md says a correction is still one event, the stats match the corrected facts, and the goal count does not go up.

## What a later implementation must not do

- Do not invent a different idempotency key.
- Do not invent a different replay response.
- Do not insert a second copy of an event that is already stored under the same key.
- Do not tell the provider a save worked when it did not.
- Do not drop a new late event only because it arrived late.

## Source disagreement to resolve later

The contract file openapi/hockey-ingestion.yaml still has a proposed 409 response that says a repeated provider_event_id is refused as a duplicate. That disagrees with the replay promise above, which returns the original 201. This rule follows the replay promise. Removing or rewording that 409 is left for a later step.
