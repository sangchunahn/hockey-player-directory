# Sprint 5 handoff: hockey event and coach evaluation APIs

**For:** coaches, the product owner, and the teammate who adds login and storage next.
**Sources:** the client story brief, the resource design, the OpenAPI contract (`openapi/hockey-ingestion.yaml`), and the acceptance criteria (`docs/api/acceptance-criteria.md`).

## What the app can do now

- The hockey data provider can send a game event to one address: `/api/events`.
- A coach can send one player's evaluation form to one address: `/api/evaluations`.
- If a request is missing a required field, has a wrong value, or is out of range, the server sends back a list that names each bad field and says what to fix.
- If the request is not readable at all (empty, not JSON, or the wrong type of content), the server says so and does not check the fields.
- The server checks every request itself. It does not trust the browser or the provider to have checked first.
- The tests in `tests/api/ingestion-validation.test.ts` confirm these behaviors.

## What does not work yet

- **Nobody is identified.** The server does not yet know whether a sender is really the hockey provider or a signed-in coach.
- **Nothing is saved.** A good request gets a reply with a made-up id, but the event or form is not kept. Tomorrow it is gone.
- **Duplicate events are not caught.** The provider could send the same event twice and both would be accepted once saving exists.
- **Some rules are guesses.** Which rating names exist, the 1 to 5 scale, and the period range are proposals that a stakeholder still needs to confirm.

## Who owns what

- **Frontend:** the coach's evaluation screen and any notes for the provider. The frontend can help people fill in the form, but it does not decide what gets accepted.
- **Backend:** the only place that accepts or rejects a request. Every rule is checked here.
- **Database:** does not exist in this sprint. Nothing is stored yet.
- **People:** some decisions stay human. A coach still reviews a player after practice, and nothing in this software makes that call.

## Next order

1. **Identity first.** Decide how the provider and each coach prove who they are, then have the server check it before any request is accepted.
2. **Saving second.** Once only known senders can get in, store the accepted events and forms.

We save second on purpose. If we saved requests before knowing who sent them, we would be storing data we cannot trace or trust, and that would undo the checks already in place.

## Open questions for stakeholders

- Does the provider send a game id with each event? If so, which field is it?
- Can a stored event be corrected later?
- Can a coach save a draft form before submitting?
- Does a head coach review submitted forms?
- What are the rating names and the 1 to 5 scale?
