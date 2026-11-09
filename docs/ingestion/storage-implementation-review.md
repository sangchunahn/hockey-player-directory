# Storage implementation review

Checked against:
- docs/ingestion/storage-rule.md
- docs/ingestion/event-outcome-decision-table.md
- docs/ingestion/idempotency-key-decision.md
- docs/ingestion/contract-replay-delta.md

I directed a coding agent. I did not write the storage code or SQL myself.

## What the agent changed

- Files touched (names only): src/server/ingestion/event-store.ts, src/server/ingestion/ingest.ts, supabase/drafts/hockey_events_draft.sql, tests/ingestion/event-store.test.ts
- In one or two sentences, what those changes do: The store keeps one stored event per provider event id and handles a new key, a same-key replay, a same-key correction, and a failed write. The ingest step validates first, requires the provider id, and judges each event in a batch on its own. The SQL file is only a draft table and is not applied.

## Prompt and refine log

- First instruction I gave (one or two sentences): Build storage so one provider event id maps to one stored event, using the four rulebook notes and not changing them. Because the public endpoints have no identity check yet, I chose an in-memory store with a draft table that is not applied and not wired to the routes.
- What failed, if anything: none. All traces passed on the first run, so there was no refine loop.
- Refine instruction I gave: not needed

## Key check

- Idempotency key the storage uses: the provider event id (provider_event_id).
- Key I already chose: the provider event id, from docs/ingestion/idempotency-key-decision.md.
- Match: pass
- Required fix if fail: none

## Replay return check

- What a replayed request must return (from the contract note): status 201 with the original stored event as the body, the same id and fields the first accept returned, with nothing added.
- What the implementation returns on a replay: status 201 with the original stored event, the same id and the same fields as the first accept.
- Match: pass
- Required fix if fail: none

## Exact duplicate

- Expected outcome (from the decision table): the stats stay as they were after the first save, so the goal is counted once, and the sender hears it was already saved and nothing changed.
- What the implementation does: a second delivery with the same provider event id and the same facts finds the stored event and inserts nothing.
- Evidence (quote one sentence from the agent's explanation or from a stored result it showed you): "a second delivery inserts no second event and does not raise the goal count": the store held 1 event and the goal count was 1.
- Does a second delivery insert a second stat: no
- Result: pass
- Required fix if fail: none
- Re-check after fix: not needed

## Out-of-order arrival

- Expected outcome (from the decision table): a new earlier event that arrives late is saved and counted, and nothing already stored is deleted.
- What the implementation does: the minute-12 style event arrived first and the earlier event arrived second with a new key; both are stored, and the goal count comes from the stored events, not from arrival order.
- Evidence (quote one sentence from the agent's explanation or from a stored result it showed you): "a new late event is kept and counted": the store held 2 events and the goal count was 2.
- Result: pass
- Required fix if fail: none
- Re-check after fix: not needed

## Partial batch

- Expected outcome (from the decision table): each new valid event is saved once, saved neighbors stay saved, events that did not save are not in the stats, and a retry of the whole group adds no second copy of a goal that already saved.
- What the implementation does: each event in a batch is judged on its own. In a batch of three where the middle event had period 9, the first and third were saved and the middle was rejected; retrying the whole batch replayed the two saved events and rejected the bad one again.
- Evidence (quote one sentence from the agent's explanation or from a stored result it showed you): the outcomes were saved, rejected, saved, and the retry gave replayed, rejected, replayed, with the goal count staying 2.
- Result: pass
- Required fix if fail: none
- Re-check after fix: not needed

## Late correction

- Expected outcome (from the decision table): it is still one event, the stats match the corrected facts, and the goal count does not go up.
- What the implementation does: the same key with different facts updates the one stored event and keeps its id; no second event is added.
- Evidence (quote one sentence from the agent's explanation or from a stored result it showed you): after a correction the store still held 1 event, the event type showed the corrected value, and the id matched the first save.
- Result: pass
- Required fix if fail: none
- Re-check after fix: not needed

## Provider outage

- Expected outcome (from the decision table): an event that did not save is absent from the stats, the sender is told it was not saved, and a later resend is saved once.
- What the implementation does: a failed write returns not saved with no success reply and stores nothing. After the outage ended, the resend was saved once, and a further resend was a replay.
- Evidence (quote one sentence from the agent's explanation or from a stored result it showed you): "a failed write is reported as not saved, never as success": the store held 0 events and the goal count was 0; after recovery the goal count was 1.
- Result: pass
- Required fix if fail: none
- Re-check after fix: not needed

## Limits this review does not hide

- The store is in memory, so nothing survives a restart. The draft table in supabase/drafts/ is not applied.
- The store is not wired to the public routes. Identity comes first, as in docs/handoff/sprint5-api-decisions.md, so nothing coaches see has changed yet.
- The contract marks provider_event_id as optional and proposed, but the storage refuses an event without it, because a repeat could not be recognized. That needs stakeholder confirmation.
- The correction reply reuses the 201 success, because the contract does not yet describe a separate correction reply.
- The old proposed 409 in the contract still conflicts with the replay promise and is left for a later step.

## Final verdict

On the rules, this storage is safe for coaches because the key, the replay return, and all five cases are pass. It is not live yet, for the reasons in the limits above.
