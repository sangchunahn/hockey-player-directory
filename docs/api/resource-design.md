# Resource Design: Hockey Event Ingestion and Coach Evaluations

## Purpose

Turn `docs/scoping/resource-inventory.md` into concrete HTTP operations.
Later steps will check the OpenAPI contract against this file.
This file contains no status-code table and invents no resources the inventory does not name.

## Source of truth

Inventory file: `docs/scoping/resource-inventory.md`

- **In-scope actors:** third-party hockey data provider; coach.
  (Head coach is named in the inventory as a possible reviewer but is **not confirmed**;
  it gets no operation here.)
- **In-scope resources:** hockey event (game event); evaluation form.

## Path and method conventions

- Paths name resources (nouns), never actions (verbs).
- Collection path: `/game-events` for events, `/evaluations` for evaluation forms.
- Item path: `/game-events/{id}`, `/evaluations/{id}`, where `{id}` is a placeholder for one record.
- Each operation names exactly one caller.
- Out-of-scope operations are listed, not silently omitted.

## Operations

### Resource: Hockey event

| Operation name | Method | Path | Caller | What it does | In scope? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Push a game event | POST | `/game-events` | Third-party hockey data provider | Sends one live event (for example a goal or penalty) to be stored. | **Yes** | Inventory: provider pushes events. Each push creates one event. |

### Resource: Evaluation form

| Operation name | Method | Path | Caller | What it does | In scope? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Submit an evaluation form | POST | `/evaluations` | Coach | Sends one completed evaluation form for one player after practice. | **Yes** | Inventory: coach submits. Incomplete forms are refused with field-level errors (see client story). |

## Explicitly out of scope

| Refused operation | Method + path not offered | Who might want it | Why it is out of scope |
| --- | --- | --- | --- |
| List all game events | GET `/game-events` | Team app, provider | Not authorized by the inventory. Team read-back is an open question. |
| Read one game event | GET `/game-events/{id}` | Team app, provider | Not authorized by the inventory. The brief says the team app can read stored events; how is open. |
| Correct a stored game event | PATCH `/game-events/{id}` | Provider | Corrections are an open question in the brief. Not offered until decided. |
| Delete a game event | DELETE `/game-events/{id}` | Provider | Not in the inventory. A delete would silently remove a stored fact. |
| Save a draft evaluation | POST `/evaluations` with a draft flag, or a separate draft route | Coach | Whether drafts exist is an open question in the brief. Not offered until decided. |
| Read one evaluation | GET `/evaluations/{id}` | Coach, head coach | Not authorized by the inventory. Head-coach review is unconfirmed. |
| Overwrite an evaluation | PUT `/evaluations/{id}` | Coach | Not in the inventory. Would replace a submitted record that a person may already have reviewed. |
| Delete an evaluation | DELETE `/evaluations/{id}` | Coach | Not in the inventory. Would silently remove a coaching record. |

## Caller matrix

| Actor | May call (method + path) | Must not call |
| --- | --- | --- |
| Third-party hockey data provider | POST `/game-events` | Any GET, PATCH, PUT or DELETE on `/game-events`; anything on `/evaluations` |
| Coach | POST `/evaluations` | Any GET, PATCH, PUT or DELETE on `/evaluations`; anything on `/game-events` |

## Review log

### Cycle 1 — resource versus action

- **Reviewer:** sangchunahn (Claude Haiku 5.5 as drafting agent)
- **Paths that looked like actions (verbs) and how I fixed them:**
  - A proposed `POST /createGameEvent` became `POST /game-events`: the verb `create` is
    carried by the method, not the path.
  - A proposed `POST /submitEvaluation` became `POST /evaluations`, for the same reason.
  - A proposed `PUT /submitEvaluation` was rejected: `PUT` replaces a known record, and
    submitting a new form creates one.
- **Remaining questions:** none on verbs. Whether draft evaluations exist remains open.

### Cycle 2 — missing reads and unsafe updates

- **Reviewer:** sangchunahn (Claude Haiku 5.5 as drafting agent)
- **Read operations (GET) I almost added but the inventory did not authorize:**
  - `GET /game-events` (list all events)
  - `GET /game-events/{id}` (read one event)
  - `GET /evaluations/{id}` (read one evaluation)
- **Write operations (PUT / PATCH / DELETE) I almost added but the inventory did not authorize:**
  - `PATCH /game-events/{id}` (correct an event)
  - `DELETE /game-events/{id}` (delete an event)
  - `PUT /evaluations/{id}` (overwrite an evaluation)
  - `DELETE /evaluations/{id}` (delete an evaluation)
- **Remaining questions:** correction of events, reading back events, head-coach review,
  and draft evaluations. Each one is listed in the out-of-scope table, not offered.

## Open decisions

Later steps must not guess these:
- Whether a stored game event can be corrected, and by whom.
- Whether the team app reads events back, and through which operation.
- Whether coaches can save draft evaluations.
- Whether a head coach reviews submitted evaluations, and how that is recorded.
- How the provider proves its identity before any push is accepted.
