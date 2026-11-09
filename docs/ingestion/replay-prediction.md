# Replay prediction (sealed before any replay)

## Seal
- Written at: 2026-11-08 17:18 MST, before this list was run
- Written before any replay was run: yes. The Step 7 tests ran similar cases, but none of the deliveries below has been sent or simulated.
- I did not send these deliveries, and no second agent or simulation was used to fill in the outcomes: yes
- Who wrote this: an AI assistant (Claude) working for the student, from the student's earlier docs. I am not claiming the student typed it, and I am not claiming no agent was involved.

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
| D1 | Sam scores a goal | pe-14-031 | 5:10 | 1 | first save |
| D2 | The same Sam goal, sent again | pe-14-031 | 5:10 | 2 | duplicate |
| D3 | Riley scores a goal late in the game | pe-14-044 | 15:30 | 3 | first save (the later moment arrives first) |
| D4 | Jordan scores a goal earlier in the game | pe-14-038 | 11:45 | 4 | out of order |

## Expected results (mine, from the rules, not from a run)
| Label | Expected stored stat after this delivery | Expected response | Decision-table case | Storage-rule phrase |
| --- | --- | --- | --- | --- |
| D1 | Sam's goal is stored once and coaches see 1 goal. | Status 201 with the new stored event. | first save | one key maps to one stored event |
| D2 | Nothing changes. No second row is added and coaches still see 1 goal, Sam's. | Status 201 with the original stored event from D1, same id, nothing added. | duplicate | does not insert again |
| D3 | Riley's goal is stored as a new event and coaches see 2 goals. | Status 201 with the new stored event. | first save | one key maps to one stored event |
| D4 | Jordan's earlier goal is saved and counted anyway, nothing already stored is deleted, and coaches see 3 goals. | Status 201 with the new stored event. | out of order | keep it, do not drop it only because it arrived late |

## Snapshot after the whole list
- Goals stored: 3. Sam's goal arrived twice and is counted once, plus Riley's goal and Jordan's goal.
- Other events stored: none.
- How the out-of-order events are stored: Jordan's 11:45 goal arrived after Riley's 15:30 goal, but it has a new key, so it is stored as its own event and counted. The stats come from what is stored, not from the order the deliveries arrived, so game time 5:10, 11:45, 15:30 are all there.
- What coaches see: 3 goals, each once. Nothing was dropped for being late and nothing was counted twice.
