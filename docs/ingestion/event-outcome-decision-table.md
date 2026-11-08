# Event outcome decision table

Checked against: docs/ingestion/duplicate-delivery-impact.md

## Rules this table must not break

1. A second delivery of the same goal must not raise the goal count.
2. An event that arrives late must not be dropped forever.

## Outcomes

| Case | What arrived | Stored-stat outcome | What we tell the sender |
| --- | --- | --- | --- |
| Exact duplicate | Same event, same facts, again | The score and the player's goal total stay exactly as they were after the first save, so the goal is counted once. | The event was already saved and nothing changed, so there is no failure and no new event was created. |
| Out-of-order arrival | An earlier game moment arrives after a later one | If the minute-8 goal is new, it is saved and counted even though the minute-12 goal arrived first, and nothing already stored is deleted. | The event was saved, if it was new; if the same facts were already saved, the sender gets the exact-duplicate answer instead. |
| Partial batch | A group arrives and only some events are saved | Each new valid event in the group is saved once, the events that did save stay saved even if a neighbor failed, and the events that did not save are not in the stats. | The sender is told which events saved and which did not, so a retry covers only the ones that failed and a retry of the whole group never adds a second copy of a goal that already saved. |
| Late correction | Same event, different facts | It is still one event, the stats now match the corrected facts (for example, the goal moves from player 7 to player 9), and the goal count does not go up. | The correction was applied, so it was not ignored as a duplicate and it was not created as a new event. |
| Provider outage | Nothing could be delivered, or a save did not succeed | The app does not invent missing goals, an event that did not save is absent from the stats, and when the provider resends it after the outage it is saved once. | The sender is told it was not saved if the save failed, and is never told it was saved unless it was stored. |

## Learner critique

I kept the late correction row because it has to avoid both mistakes at once. If the app ignores a corrected minute-10 goal as a duplicate, the coach keeps seeing the wrong scorer. If the app adds the correction as a new event, the coach sees two minute-10 goals, which breaks the no-double-goal rule. So the row says it is still one event, the goal count does not go up, and the sender is told the correction was applied.

## Left for later steps

- Which fields make two deliveries the same event
- The words and status codes in the existing contract
- How storage is implemented
- What the provider may safely retry, and how often
