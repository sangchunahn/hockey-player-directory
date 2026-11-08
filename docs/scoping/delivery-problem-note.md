# Delivery problem: when the provider sends an event twice

**Scope:** names the problem only. It does not choose a fix, store anything, or change the contract in `openapi/hockey-ingestion.yaml`.

## The problem

The provider sends a game event, such as a goal, to `POST /api/events` and waits for an answer. Sometimes no answer comes back in time. The network may have dropped the reply, or our app may have been slow. A timeout does not prove the save failed. It only means the provider does not know.

A careful provider sends the event again. That second send is a retry. Retries are normal and do not mean the provider is careless.

On our side, a retry means the same event can arrive twice. If the app counts every arrival, one real goal becomes two.

## The harm

Coaches trust the stats: the score, and how many goals each player has. A goal counted twice can make the wrong player look like the scorer. A coach might praise the wrong player or plan a lineup from a wrong number. The app looks official, so the mistake gets believed until someone notices. The cost is a coach who stops trusting the app.

## The five cases

1. **Exact duplicate:** the same event arrives again with nothing changed.
2. **Out of order:** a later event arrives before an earlier one, usually because one message was delayed. For example, minute 12 arrives before minute 8.
3. **Batch or partial batch:** a group of events is sent together, and only some of that group arrive.
4. **Late correction:** a fixed version arrives after the first version was already stored. For example, a message says the goal was player 9, not player 7.
5. **Provider outage:** the provider stops sending, comes back, and may resend events from the gap.

## Out of scope for this note

- Choosing how to store events
- Changing the status codes or the contract
- Writing any code
