# Late correction handling

## What a late correction is

A late correction is a second delivery that uses the same idempotency key as an event the app already stored, but changes at least one goal detail, such as who scored. It is not an exact retry, because the details are different. It is not an out-of-order event (a different event arriving early) and not an outage (nothing was stored).

Idempotency key already chosen in docs/ingestion/idempotency-key-decision.md:

`provider_event_id`, the provider's own id for that one happening. A correction keeps the same id. A new key would look like a new goal and double-count it.

## Hockey example

First delivery (wrong details): key pe-14-050 says Player A scored at 12:01. The app stores it. Player A has 1 goal and the team has 1 goal.

Correction (same key, what changed): the provider sends key pe-14-050 again and says Player B scored at 12:01. Only the scorer changed.

Who has the goal after the correction: Player B.

Who no longer has that goal: Player A.

Team goal total after the correction (must stay one): 1.

## Storage rule

For a repeated key, the app compares the new details with the stored ones. If they are the same, it keeps the stored event and adds nothing. If they differ, it replaces the stored details of that one event, keeps its original id, and does not insert a second goal.

Forbidden outcome 1, freezing the mistake: the app sees the same key, treats it as a duplicate, and keeps Player A on the goal, so coaches keep seeing the wrong scorer.

Forbidden outcome 2, counting the goal twice: the app treats the correction as a new event, so Player A keeps the goal, Player B also gets it, and the team shows 2 goals.

## Answer the provider gets

The endpoint answers with the same success style it already uses (status 201), and the body is the stored event as it now stands, so it shows the corrected details and the original event id. A reader can tell the correction was applied because the answer shows the new details, not the old ones. I did not add a new field or status for this, because the contract only allows the key, the original success on replay, and no second stored event.

Exact-retry answer already promised for unchanged details: status 201 with the original stored event, same id and same details, with nothing added.

How the correction answer is different: it is the same kind of success, but the stored event in the body now carries the changed details instead of the old ones, so it cannot be mistaken for "we ignored your new details."

Which copy is newest: the contract has no version or sequence number from the provider, so the latest arrival wins. That means an old copy that arrives late could overwrite a newer correction. I checked this by sending the period-3 correction and then an older period-2 copy: the older copy replaced the newer one. This is a known limit until the provider sends a version or sequence number (needs stakeholder confirmation).

## Check against the decision table

Late-correction row, in your own words, from docs/ingestion/event-outcome-decision-table.md: it is still one event, the stats now show the corrected facts (the goal moves from one player to another), the goal count does not go up, and the sender is told the correction was applied, not ignored as a duplicate and not created as a new event.

Does this note match that row? Yes. No clash, so no replace-once override was needed.

## Check against the contract replay delta

What docs/ingestion/contract-replay-delta.md promises for an unchanged resend: status 201 with the original stored event, nothing added, no error.

This promise stays only when the goal details are unchanged. When details changed, the app replaces them and the answer shows the new details.

## Agent instruction and review

What you asked the coding agent to do: first, to describe in plain language what the app does today when the same key arrives with a different detail, with no file changes; then, if needed, to make the smallest change so changed details replace the stored stat, the goal stays one, and an unchanged resend keeps the replay promise, with no new key, endpoint, or database script.

What the agent reported for the corrected player, the original player, and the team total: today the store compares the details of a repeated key. The app has no scorer field yet (it stores event type and period), so the agent used a changed period as the stand-in for "a different detail". Run: a goal in period 2 was stored (1 event, 1 goal); the same key with a goal in period 3 gave status 201, the same event id, period 3, still 1 event and 1 goal; an exact resend of the period-3 version changed nothing; an old period-2 copy sent afterward overwrote it, still 1 event and 1 goal. For the Player A and Player B example, the same replace step would apply once a scorer field exists: Player B has the goal, Player A does not, and the team total is 1.

Review result (matches, or the mismatch and the refined instruction): matches. The corrected details replaced the old ones, the original event id was kept, and the goal count never went up. No code change was needed, because the store already replaces details for the same key (src/server/ingestion/event-store.ts) and an unchanged resend already follows the replay promise. Limits: no scorer field exists yet, and a delayed old copy can overwrite a newer correction because there is no version number.

Sentence that confirms a bad stat can be replaced without counting the goal twice: when the same key came back with changed details, the stored event was updated in place, so the wrong detail was replaced and the team goal total stayed at 1.
