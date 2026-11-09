# What the provider can safely retry

Who this is for: the data provider that sends us hockey events, and our internal operations team who answer the provider's questions.

Key to reuse on every retry: `provider_event_id`, the provider's own id for that one happening, chosen in docs/ingestion/idempotency-key-decision.md. Do not create a new id for a goal you already sent. (The contract still lists this field as a proposal, so the stakeholders must confirm that the provider sends it.)

## Safe (same key and same body only)

- Timeout: if you waited and got no answer, resend the event with the same key and the same body, and it will not add a second goal.
- Exact duplicate: the same key and the same body arriving again does not add a second goal, and the stored event stays as it was.
- Outage: if our app or the network was down and your send failed, resend with the same key and the same body, and it is saved once; this is safe only with that same key and body.

What a safe replay returns: the promise in docs/ingestion/contract-replay-delta.md. A resend of an event we already stored gets a normal success (status 201) with the original stored event, nothing added, and it is not an error.

## Not safe

- New id for the same goal: a new id is a different key, so our app cannot tell it is a retry and stores a second event, which is a double-counted goal (one real goal shown as two).
- Old body after a correction: resending the old details after a fix can put the wrong version back, because the latest arrival wins and we have no version number yet; send a fix only the way docs/ingestion/late-correction-handling.md describes (same key, changed details), never by resending the old body.

## Replay check

docs/ingestion/replay-comparison.md ran a duplicate and an out-of-order set, and every row matched the decision table, with no open mismatch, so an exact duplicate is safe (and a timeout retry is the same case, since it is the same key and body). The outage retry was not part of that run; it passed in the storage trace tests (docs/ingestion/storage-implementation-review.md), so it is safe on the rules, but those used an in-memory store and the public endpoint is not storing events yet, so nothing here has been run against the live app.
