# Replay comparison

Written in two passes. The expected columns were filled first, copied from docs/ingestion/replay-prediction.md (sealed 2026-11-08 23:43 MST), before the run. The actual columns are filled only from the run report.

## Set
- Set name: duplicate and out-of-order deliveries, game 14 (from docs/ingestion/replay-prediction.md)
- Order sent: D1, D2, D3, D4. Nothing else was sent.
- Rule used to judge: docs/ingestion/event-outcome-decision-table.md
- Replay promise (docs/ingestion/contract-replay-delta.md, in my words): a repeat of a key already saved gets status 201 with the original stored event, same id, and nothing is added.

## Comparison
| Label | Delivery | Expected stored stat | Expected response | Actual stored stat | Actual response | Matches decision table? | Matches my prediction? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | Sam goal, key pe-14-031, 5:10, arrives 1st | Saved once, 1 goal | 201 with the new stored event | 1 event stored, 1 goal | 201, saved, new event (id ff717c14) | Yes | Yes |
| D2 | Same Sam goal again, key pe-14-031, arrives 2nd | No change, still 1 goal | 201 with the original stored event from D1, same id | No change, still 1 event and 1 goal | 201, replayed, same original event (same id ff717c14) | Yes | Yes |
| D3 | Riley goal, key pe-14-044, 15:30, arrives 3rd | Saved, 2 goals | 201 with the new stored event | 2 events stored, 2 goals | 201, saved, new event (id 73c73f7a) | Yes | Yes |
| D4 | Jordan goal, key pe-14-038, 11:45, arrives 4th (out of order) | Kept and counted, 3 goals | 201 with the new stored event | 3 events stored, 3 goals | 201, saved, new event (id 6f345201) | Yes | Yes |

## How the run was done
A coding agent replayed only D1 to D4, in that order, through the real ingest code and an in-memory store (the public routes are not wired to storage yet). The deliveries were sent by the agent, after the expected columns above were written. Nothing else was sent: no correction, no partial batch, no outage. The final keys stored were pe-14-031, pe-14-044 and pe-14-038, one event each.

## Plain sentence for a coach
The same goal arrived twice (D1 and D2, key pe-14-031), and the stored count did not go up the second time: row D2 shows still 1 goal, and the app handed back the same original event.

## Out-of-order rule and final result
- What the decision table requires: a new earlier event that arrives late is saved and counted, and nothing already stored is deleted.
- Final actual stored stat: Jordan's 11:45 goal (D4) arrived after Riley's 15:30 goal, was saved as its own event, and the total is 3 goals (row D4).

## Mismatches
None. Every row matches the decision table and my prediction, so the prediction was right and the app needed no fix. The expected columns were not changed after the run.

## Verdict
The app does what the decision table says for a duplicate and for an out-of-order arrival. Limit: this run used the in-memory store, not the public endpoint or a database, because storage is not wired until identity exists.
