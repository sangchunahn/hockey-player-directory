# Why a second delivery corrupts coach stats

**Scope:** explains the harm only. This note does not redo server-side validation, status codes, or the OpenAPI contract, and it does not choose a fix or a storage design.

## Why a retry happens

The provider sends a goal to `POST /api/events` and waits for an answer. A timeout means the provider waited and got no answer. It cannot tell whether our app saved the event, because the reply may have been lost on the network or the app may have been slow. That uncertainty is why a careful provider sends the same goal again. The second send is a normal retry, not a sign of carelessness.

## What happens to the stats

If the app counts every arrival, one real goal is now counted twice.

- The score or goal total is one too high.
- A player's goal count is inflated. Two goals appear where there was one.
- A player can look like the top scorer when they are not.

## Out-of-order arrival

Messages can also arrive in the wrong order. For example, a goal at minute 12 can reach the app before a goal at minute 8, because the minute-8 message was delayed. Both goals are real, but they did not arrive in game order.

## Why this does real damage

- A coach may praise the wrong player based on the wrong number.
- A coach may plan a lineup from a number that is not true.
- The app looks official, so the wrong number is believed until someone notices.
- Once a coach sees one wrong number, they may stop trusting every number in the app.

## The five cases later steps will rule on

1. **Exact duplicate:** the same event arrives again with nothing changed.
2. **Out-of-order:** a later event arrives before an earlier one.
3. **Partial batch:** a group of events is sent together, and only some of them arrive.
4. **Late correction:** a fixed version arrives after the first version was already stored.
5. **Provider outage:** the provider stops sending, then resends events from the gap.

## Why the app cannot tell a duplicate yet

Nothing is saved or identified yet, so the app has no record of which goals it already counted. Duplicate detection needs a way to recognize the same event when it returns.
