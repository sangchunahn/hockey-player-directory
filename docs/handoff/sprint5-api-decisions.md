# Sprint 5 handoff: hockey event and coach evaluation APIs

**For:** coaches, the product owner, and the teammate who adds login and storage next.

## The original goal

The client story (`docs/scoping/client-story-brief.md`) asks for two things:

1. A third-party hockey data provider pushes live game events, such as goals and penalties, into the team app.
2. A coach submits a player evaluation form after practice, and the app refuses incomplete forms with clear field-level messages.

## What shipped, and the outcome each part gives

| Deliverable | Where it lives | Outcome for the people using it |
|---|---|---|
| Resource design | `docs/api/resource-design.md` | Two addresses, one per job: the provider sends events to `POST /api/events`, and a coach sends a form to `POST /api/evaluations`. Nothing else is offered yet. |
| OpenAPI contract | `openapi/hockey-ingestion.yaml` | One written agreement for both addresses: what each request must contain, and what each reply looks like. |
| Server-side field validation | `src/server/validation/` and `src/routes/api/` | The server checks every request itself. Good requests get `201 Created`. Requests that cannot be read get `400`. Requests with bad fields get `422`, with a list that names each bad field and what to fix. Every error reply uses one shape: an `error` with a `code` (such as `VALIDATION_FAILED`), a `message`, and `details` (one entry per bad field, with its `field`, `code`, and `message`). |
| Acceptance criteria | `docs/api/acceptance-criteria.md` | The plain list of what the app must do in each case, such as a missing period or a rating above 5. |
| Contract tests | `tests/api/ingestion-validation.test.ts` | 23 automatic checks that confirm the cases above. All pass. |

## Who owns what

- **Frontend:** the coach's evaluation screen and any instructions for the provider. The screen should show the field errors the server sent back. A check in the browser is never the final say; the server decides.
- **Backend:** the only place that accepts or rejects a request. Every rule is checked here.
- **Database:** does not exist in this sprint. Nothing is stored yet.
- **People:** some decisions stay human. A coach still reviews a player after practice, and nothing in this software makes that call.

## What still does not work

- **Nobody is identified.** The server does not yet know whether a sender is really the hockey provider or a signed-in coach.
- **Nothing is saved.** A good request gets a reply with a made-up id, but the event or form is not kept.
- **Duplicate events are not caught.** The provider could send the same event twice, and both would be accepted once saving exists.
- **Some rules are guesses.** The rating names, the 1 to 5 scale, and the period range are proposals that a stakeholder still needs to confirm.

## Next order

1. **Identity first.** Decide how the provider and each coach prove who they are, then have the server check it before any request is accepted.
2. **Saving second.** Once only known senders can get in, store the accepted events and forms.

Saving comes second on purpose. Storing requests before knowing who sent them would keep data we cannot trace or trust, and that would undo the checks already in place.

## Open questions for stakeholders

- Does the provider send a game id with each event? If so, which field is it?
- Can a stored event be corrected later?
- Can a coach save a draft form before submitting?
- Does a head coach review submitted forms?
- What are the rating names and the 1 to 5 scale?
