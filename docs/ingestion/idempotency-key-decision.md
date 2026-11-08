# What makes two deliveries the same hockey event

## The question

When the provider sends something again, which facts must match before we treat the two deliveries as one hockey event?

## Chosen identity (the idempotency key)

Two deliveries are the same hockey event when they carry the same provider event id, which is the provider's own id for that one happening in the game. The id comes from the provider, it is assigned when the event happens, and it stays the same on every retry and on every correction. The project's contract already proposes this field as `provider_event_id`. It is still a proposal, so the stakeholders need to confirm that the provider really sends it. If the provider has no single id, the fallback is the game plus the provider's own sequence number, meaning the number assigned when the event happened and not when we received the message.

This key is the event's own identity, like an event id, so a resend with the same key counts as the same event. I chose that on purpose instead of a request-fingerprint key, where reusing a key with a different body would be rejected. A resend with the same key and different details is a correction of the same event, not an error.

## My hockey check

If the provider sends "Sam scored in game 14" with provider event id pe-14-031 and the try times out, the second delivery carries the same id pe-14-031, so the app counts Sam's goal once.

## Why an exact replay stays one event

The same goal sent again with the same details carries the same provider event id, so it matches this identity and does not become a second stat.

## Why a correction can still be recognized

A fixed detail, such as an assist changed from unknown to Riley, does not change the provider event id, so the corrected version keeps the same identity as the first one. The full set of event details is not the key, which is what lets the app see the fix as the same event.

## Rejected: arrival time alone

A retry arrives later than the first try, so the time we received it is different. The second delivery would look like a new event, and one goal would be stored as two stats that coaches would not trust.

## Rejected: a brand-new id on each delivery

A fresh id on every try makes the retry look like a different event. One goal would become two stats.

## Another option I rejected

Using every detail in the message as the key. A corrected assist changes one detail, so the fixed version would look like a brand-new goal and the correction would double-count the goal. Using only the word goal was also rejected, because two real goals in game 14 would be mashed into one stat.

## What this note does not decide

- The contract: what reply a replay or a correction gets is decided in the next step.
- How storage works, including any database changes or SQL.
- Any code.
- What the provider may safely retry, and how often.
