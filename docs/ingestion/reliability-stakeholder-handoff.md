# Reliability stakeholder handoff

## Who this is for

The product lead, the coach liaison, and the data provider's contact. They do not write code. They need one record they can trust about how the app handles events that arrive twice, late, or corrected.

## The coach-trust problem

The provider retries when a request times out, so one real goal can arrive more than once. If the app counted every arrival, the score and a player's goal total would be too high, and coaches would stop trusting the stats (docs/ingestion/duplicate-delivery-impact.md). The sentence a coach liaison can repeat: one real goal stays one stat, and a second delivery of the same goal does not raise it.

## Decisions already made

Each line summarizes one earlier note. Nothing here is a new decision.

- Harm note (docs/ingestion/duplicate-delivery-impact.md): the provider cannot tell whether a timed-out send was saved, so it retries on purpose, and counting every arrival inflates goals.
- Decision table (docs/ingestion/event-outcome-decision-table.md): decides what is stored in each of the five cases below. It wins on stored outcomes.
- Idempotency key (docs/ingestion/idempotency-key-decision.md): two deliveries are the same event when they carry the same provider event id, `provider_event_id`. It is never the arrival time and never a new id per try. It wins on what makes two deliveries the same event.
- Replay promise (docs/ingestion/contract-replay-delta.md): a resend of a key already saved gets status 201 with the original stored event, same id and fields, nothing added, and it is not an error.
- Storage rule (docs/ingestion/storage-rule.md): one key maps to one stored event, a repeat is not inserted again, a new late event is kept, and a failed write is never reported as success.
- Storage review (docs/ingestion/storage-implementation-review.md): the storage built so far matched the table in all five cases, as an in-memory store that is not connected to the public endpoint.
- Replay comparison (docs/ingestion/replay-comparison.md): a duplicate and an out-of-order set was run, and every row matched the decision table and the prediction. No mismatch.
- Late correction (docs/ingestion/late-correction-handling.md): a correction is the same key with changed details; the stored event is replaced, the goal count does not go up, and the answer shows the new details.
- Provider retry note (docs/ingestion/provider-retry-note.md): a timeout retry, an exact duplicate, and an outage retry are safe only with the same key and the same body; a new id, or resending an old body after a correction, is not safe.

### Outcome for each of the five cases

- Exact duplicate (the same event arriving again): the stats stay as they were, so the goal is counted once, and the sender gets the original success back.
- Out-of-order arrival (a later event shows up before an earlier one): a new earlier event is saved and counted, nothing already stored is deleted, and stats come from what is stored, not the order of arrival.
- Partial batch (only some events of a group arrive or save): each new valid event is saved once, saved ones stay saved, unsaved ones are not in the stats, and retrying the whole group adds no second copy of a goal.
- Late correction (a new version of an event already stored): still one event, the stats show the corrected facts, and the goal count does not go up.
- Provider outage (the sender is down or a save fails): an event that did not save is absent from the stats, the sender is never told it saved when it did not, and a resend after the outage is saved once.

## Consistency pass

I read the notes in this order: decision table, key decision, replay promise, then the storage rule, correction note, retry note, and the two pieces of evidence. The decision table, key decision, replay promise, storage rule, correction note and retry note agree on the rules: one key is one event, a repeat adds nothing, a correction replaces and counts once, and a late new event is kept. The storage review and the replay comparison are evidence, and neither reported a mismatch.

Clashes found, with the winner named:

- The proposed 409 in openapi/hockey-ingestion.yaml (and docs/api/error-and-status-model.md) says a repeated `provider_event_id` is refused as a duplicate. The replay promise says it returns the original 201. The replay promise and the decision table win. The 409 is the losing statement, and I did not edit it here (see open question 1).
- The decision table says the sender "hears it was already saved." The replay promise returns the same 201 with the original event and adds no new field. These do not contradict each other, but the 201 answer carries that message only by handing back the original event, not by an explicit flag. Recorded as open question 4.
- The decision table says a partial batch reply tells the sender which events saved. The ingestion code judges each event in a batch on its own, but the public contract describes a single event per request. Recorded as open question 5.

## Open questions

1. The leftover proposed 409 for a repeated `provider_event_id` still conflicts with the replay promise. It needs to be removed or reworded in the contract and in the error model, and the stakeholders should confirm.
2. The contract lists `provider_event_id` as optional and proposed, but storage refuses an event without it. The stakeholders must confirm that the provider really sends it.
3. With no version or sequence number from the provider, the latest arrival wins, so an old delayed copy can overwrite a newer correction (I saw this in a run). This needs a provider version number or another decision.
4. The correction answer reuses the normal 201 and shows the new details. The contract has no separate correction reply, and no new field was allowed. Decide whether that is enough.
5. A batch reply that says which events saved is not described in the public contract yet.
6. The public endpoint is not connected to storage. It still makes a new id on each call, so nothing here has been run against the live app. Identity (who may send events) comes first, then storage, as in docs/handoff/sprint5-api-decisions.md. The draft database table is not applied.

## What the next topic must reuse and must not redo

Reuse these decisions as they are: the idempotency key, the replay promise, the storage rule, the correction rule, and the provider retry note.

Do not redo: the ingestion endpoint, the HTTP status codes and error model, the OpenAPI contract, and server-side validation from the first Sprint 5 tutorial. Do not re-decide the key, the replay promise, the storage rule, the correction rule, or the retry note. Do not create a new repository or a new hosting project.

## Closing line

This file adds no new rule; it only records decisions already made in the nine notes above.
