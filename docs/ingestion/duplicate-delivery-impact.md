# Why a second delivery corrupts coach stats

**Scope:** explains the harm only. It does not choose a fix or a storage design.

## What happens

The provider sends a goal to `POST /api/events`. The provider times out waiting for an answer, so it sends the same goal again. Both sends reach the app. If the app counts every arrival, one real goal is now counted twice.

## What coaches see

- The score or goal total is one too high.
- A player's goal count is inflated. Two goals appear where there was one.
- A player can look like the top scorer when they are not.

## Why this does real damage

- A coach may praise the wrong player based on the wrong number.
- A coach may plan a lineup from a number that is not true.
- The app looks official, so the wrong number is believed until someone notices.
- Once a coach sees one wrong number, they may stop trusting every number in the app.

## Why the app cannot tell it is a duplicate yet

Nothing is saved or identified yet, so the app has no record of which goals it already counted. Duplicate detection needs a way to recognize the same event when it returns.

## Out of scope for this document

- Choosing how events are stored or identified
- Changing the status codes or the contract in `openapi/hockey-ingestion.yaml`
- Writing any code
