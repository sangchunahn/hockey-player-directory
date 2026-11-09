# Replay prediction (sealed before any replay)

## Seal
- Written at: 2026-11-08 23:43 MST, before this list was run
- Written before any replay was run: yes. None of the deliveries below has been sent or simulated.
- I did not send these deliveries, and I did not ask an agent to fill in the outcomes: yes. The stored goal counts and what happens to each delivery are my own answers (D1 is 1 goal, D2 changes nothing, D3 is 2 goals, D4 is kept and makes 3 goals). An assistant only put my answers into this table and copied the response wording from docs/ingestion/contract-replay-delta.md and the storage-rule phrases from docs/ingestion/storage-rule.md.

## Rules I am applying (copied from my earlier docs, not new rules)
- Source docs: docs/ingestion/event-outcome-decision-table.md, docs/ingestion/storage-rule.md, docs/ingestion/idempotency-key-decision.md, docs/ingestion/contract-replay-delta.md, docs/ingestion/storage-implementation-review.md
- Idempotency key: the provider's own event id for that happening (provider_event_id). Two deliveries are the same event when they carry the same id. It is never the arrival time and never an id made new on each try.
- Replay response promise: a first save returns status 201 with the stored event. A replay of the same key returns status 201 with that same original stored event, same id and same fields, with nothing added.
- Implementation review: it matches the decision table. The key, the replay return, and all five cases were pass.
- If there is a gap, the expected results below still follow the decision table and the storage rule. Gap to watch later: the old proposed 409 in the contract still says a repeated id is refused, which disagrees with the replay promise, and the store is not wired to the public endpoint yet. This file does not change the app.

## Example deliveries
Game 14. The same key on an exact duplicate. Different keys when arrival order does not match game time. No corrected event.

| Label | What happened in the game | Idempotency key value | Game time | Arrival order | Case |
| --- | --- | --- | --- | --- | --- |
| D1 | Sam scores a goal | pe-14-031 | 5:10 | 1 | first save | one key maps to one stored event |
| D2 | The same Sam goal, sent again | pe-14-031 | 5:10 | 2 | duplicate | same key is not stored again |
| D3 | Riley scores a goal late in the game | pe-14-044 | 15:30 | 3 | first save (the later moment arrives first) |
| D4 | Jordan scores a goal earlier in the game | pe-14-038 | 11:45 | 4 | out of order | a new key is stored even if its game time is earlier than a delivery that already arrived |

## Expected results (mine, from the rules, not from a run)
| Label | Expected stored stat after this delivery | Expected response | Decision-table case | Storage-rule phrase |
| --- | --- | --- | --- | --- |
| D1 | Sam's goal is saved. 1 goal. | Status 201 with the new stored event. | first save | one key maps to one stored event |
| D2 | It does not change anything, because it has the same key (pe-14-031) as D1. Still 1 goal. | Status 201 with the original stored event from D1, same id, nothing added. | duplicate | same key is not stored again |
| D3 | Riley's goal is saved. 2 goals. | Status 201 with the new stored event. | first save | one key maps to one stored event |
| D4 | Jordan's goal is kept even though it arrived late. 3 goals. | Status 201 with the new stored event. | out of order | a new key is stored even if its game time is earlier than a delivery that already arrived |

## Snapshot after the whole list
- Goals stored: 3. Sam's goal arrived twice and is counted once, plus Riley's goal and Jordan's goal.
- Other events stored: none.
- How the out-of-order events are stored: Jordan's 11:45 goal arrived after Riley's 15:30 goal, but it has a new key, so it is stored as its own event and counted. The stats come from what is stored, not from the order the deliveries arrived, so game time 5:10, 11:45, 15:30 are all there.
- What coaches see: 3 goals, each once. Nothing was dropped for being late and nothing was counted twice.
