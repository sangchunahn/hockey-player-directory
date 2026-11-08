# Resource inventory: game event ingestion and coach evaluations

**Source:** `docs/scoping/client-story-brief.md`
**Scope:** two flows, provider event ingestion and coach evaluation forms. No URLs,
request types, or numeric status codes here; those come in later steps.

## Actors

| Actor | Kind | What it wants |
|---|---|---|
| Third-party hockey data provider | Outside system | Push live game events into the team app. Has no login today. |
| Coach | Person | Submit a player evaluation form after practice. |
| Head coach (if one reviews forms) | Person | Review submitted evaluations. **Not confirmed by the brief**; see Open questions. |

## Resource candidates

Named things the system stores, fetches, or rejects. Verbs are not resources.

| Resource | Created by | Notes |
|---|---|---|
| Game event | Provider | One thing that happened in a game, such as a goal or penalty. |
| Player evaluation form | Coach | Filled in after practice; tied to one player. |

## Inputs and outputs

| Flow | Inputs (what arrives) | Outputs (what we give back or store) |
|---|---|---|
| Game event | Event details from the provider, including the game it belongs to and what happened. Exact fields are not in the brief. | An accepted, stored event, or a list of field-level problems. |
| Evaluation form | The coach's answers for one player after practice. Exact fields are not in the brief. | A stored, complete evaluation tied to the right player, or a list of field-level problems. |

Example values from the scaffold (a period number, a player name, a 1–5 rating) are
examples of kinds of input only. The brief does not confirm them as fields.

## Workflow states

**Game event:**
- **Received:** it just arrived from the provider.
- **Accepted:** the server validated it and kept it.
- **Rejected:** the server refused it, with reasons.

**Player evaluation form:**
- **Draft:** the coach is still writing. **Not confirmed by the brief**; see Open questions.
- **Submitted:** the coach has sent the form.
- **Reviewed:** a person has looked at it. **Not confirmed by the brief**; see Open questions.

## Approval and review points

| Point | Who decides | Automated? |
|---|---|---|
| Whether an incoming event is valid | The server, from the defined fields | Yes |
| Whether a submitted evaluation is complete | The server, from the defined fields | Yes |
| Whether an evaluation is ready to share with a player | A person (coach or head coach) | **No** |
| Whether a provider is trusted | Not stated in the brief | **Open question** |
| Whether an event can be corrected after it is stored | Not stated in the brief | **Open question** |

## System boundaries

| Box | Owns in this inventory |
|---|---|
| Frontend | The screens where a coach types an evaluation form. |
| Backend API | The doorway that the provider and the coach screens call. It validates every request and may refuse. |
| Database | Long-term storage of accepted events and submitted evaluations. |
| Manual coaching process | Decisions a person makes, such as whether an evaluation is ready to share. Software may record that decision but must not make it. |

## What we will not automate

- Judging whether an evaluation is good or ready to share with a player. A person decides.
- Deciding playing time or any other coaching decision.
- Deciding whether a provider is trusted, until the brief says how.

## Open questions

1. **Provider identity.** How does the team know the provider is really the provider? A
   stranger who copies the address must not be able to push fake events. (From the brief.)
2. **Corrections.** Can a stored event be corrected later, or is it final? (From the brief.)
3. **Draft evaluations.** May a coach save a draft, or must the form be complete on first
   submit? The "Draft" state depends on this. (From the brief.)
4. **Head coach review.** Does a head coach review submitted evaluations? The brief does
   not say. If yes, the "Reviewed" state and the approval point belong here; if no, drop them.
5. **Exact fields.** Which fields does an event and an evaluation contain? The brief does
   not list them, so this inventory does not invent them.
