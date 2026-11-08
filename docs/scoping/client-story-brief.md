# Client story brief: game event ingestion and coach evaluations

**Status:** draft for review. Built only from the Sprint 5 client story. Facts not in the
story are listed under Open questions, not decided here.

## The request

A third-party hockey data provider is ready to push live game events into the team's
app. Separately, coaches need a reliable way to submit player evaluation forms after
practice. This brief covers both, but they are two separate jobs with different people,
triggers, and definitions of success.

## Job A: the data provider pushes game events

**Who:** an outside hockey data company. It is not a teammate and has no login to the
team's app today.

**What it sends:** game events, one thing that happened in a game, such as a goal or a
penalty.

**Trigger:** the provider pushes events while the game is live.

**Done means:** each valid event is stored once and can be read back by the team app.
Each invalid event is refused with a field-level error that says what was wrong, so the
provider can fix and resend it. Nothing is stored silently when it is invalid.

**Not decided here:** how the provider proves its identity; whether a pushed event can
be corrected; how the team handles a resend of an event it already stored.

## Job B: a coach submits a player evaluation after practice

**Who:** a coach.

**What it sends:** a player evaluation form, filled in after a practice.

**Trigger:** the coach finishes practice and submits the form.

**Done means:** a complete evaluation is stored and tied to the right player. An
incomplete form is refused with field-level errors that tell the coach which field to
fix.

**Not decided here:** whether a coach may save a partial draft before submitting.

## Shared requirements

- The server validates every request. It never trusts the client to have checked the
  data first.
- Every rejected request returns clear, field-level error objects that a coach or the
  provider can act on.
- Both jobs are described in a shared API contract that both sides agree to before
  build.

## Out of scope for this brief

- Screens and web addresses (decided in later steps).
- Storage choices and database tables (decided in later steps).
- Scouting notes and medical data (covered in Sprint 4 and not part of this ingestion).

## Open questions

1. **Provider identity.** How does the team know the provider is really the provider?
   A stranger who copies the address must not be able to push fake events.
2. **Corrections.** Can a pushed event be corrected later, or is it final once stored?
3. **Draft evaluations.** May a coach save a draft evaluation, or must the form be
   complete on the first submit?
