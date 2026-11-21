# Attack surface map — hockey operations roster tool

## Purpose

This map lists doors a hostile review can use before any new defense code is
written.

Confidential data in scope: roster decisions, injuries, trade thoughts, and
scout notes.

## Actors

| Actor | What they are | Evidence path |
| --- | --- | --- |
| Coaching | Signed-in staff role. Plans practices and games; reads only shared roster/schedule facts. | `docs/security/role-access-matrix.md` |
| Scouting | Signed-in staff role. Records and reviews player evaluations; the only role allowed to read or write scouting notes and scouting events. | `docs/security/role-access-matrix.md` |
| Medical | Signed-in staff role. Tracks sports-science and medical data within care scope. Does not reach any door in this map today (no medical UI route exists yet). | `docs/security/role-access-matrix.md` |
| Third-party hockey data provider | Outside sender, not a staff login. Posts live game events to the ingestion API. | `openapi/hockey-ingestion.yaml` |
| Coach submitting an evaluation | Named in the ingestion contract as the caller of `/evaluations` ("Called by a coach after practice"). Not yet a role defined in the role matrix — an open gap. | `openapi/hockey-ingestion.yaml` |

Staff access context: per `docs/security/hockey-staff-access-brief.md` §5, hiding
a page or a menu link only changes what a friendly screen shows — anyone can
replay a captured request or call the API directly with a copied token. Every
door below has to be judged by what the server and database actually allow,
not by what the screen displays.

## Entry points

| Entry point | File path or URL shape | Actor who can reach it | Reads or changes | Hole to review | Because |
| --- | --- | --- | --- | --- | --- |
| Player URL | `src/routes/players/$playerId.tsx` — address shape `/players/{id}` | Any visitor, signed in or not (no session check in this file) | Reads only | IDOR | The loader takes `playerId` straight from the URL and hands it to `getPlayerById` with no ownership or role check, so changing the id in the address is the only thing separating one player's sheet from another's. Today the returned fields (name, number, position, team) are the shared, non-sensitive facts in `docs/security/role-access-matrix.md`, but the same id-swap mechanism is the door that has to stay closed before any sensitive field is ever added to this loader. |
| Scouting pages | `src/routes/scouting/index.tsx`, `src/routes/scouting/events.tsx` | Scouting role for `index.tsx` (goes through `listScoutingNotes` → `requireSession` → RLS). `events.tsx`'s "Log event" form calls `createScoutingEvent` (`src/lib/scouting/mutations.ts`), which writes through the browser Supabase client with no `requireSession` call visible in that file. | Reads (both files) and changes (`events.tsx` write) | XSS | `index.tsx` and `events.tsx` both render a scout-written note string (`n.note`, `e.note`) to every later viewer of that note. React escapes this by default, but the hole is real the moment that text is ever rendered through `dangerouslySetInnerHTML` or a future rich-text view — it would become a stored script that runs in another staff member's signed-in session. |
| Scouting pages (write) | `src/routes/scouting/events.tsx` → `src/lib/scouting/mutations.ts` (`createScoutingEvent`) | Any signed-in staff session whose browser calls this mutation | Changes | CSRF | The write goes straight from the browser's Supabase client to the database using the signed-in session's cookies, and `src/lib/scouting/mutations.ts` shows no per-request origin or CSRF-token check — only field validation. A page that can make a signed-in scout's browser send this same request without their intent would log an event as them. |
| Login | `src/routes/login.tsx` | Any visitor | Changes — starts or ends a session (`src/lib/auth/sign-in.ts`, `src/lib/auth/sign-out.ts`) | None named here | Signing in only creates a new session for whatever credentials were submitted; it does not change data belonging to an already signed-in victim, so CSRF does not fit this door the way it fits a write. `src/lib/auth/sign-in.ts` notes that what a session may see is decided later, by the server and RLS — those checks are a later step's door, not this one's. |
| Events ingestion | `src/routes/api/events.ts`, contract `openapi/hockey-ingestion.yaml` path `/game-events` | Third-party hockey data provider | Changes, once the contract's persistence step lands (today's handler is a validate-and-stub, per the file's own header comment) | Injection | `provider_event_id` is a free-form string the contract (`openapi/hockey-ingestion.yaml`) marks "proposed" with no format rule, and it is meant to be looked up on every later delivery to decide if the delivery is a replay. Once that lookup and the eventual insert are written, an unparameterized query built from that string would let the provider's payload change what the query does, not just what it stores. |
| Evaluations ingestion | `src/routes/api/evaluations.ts`, contract `openapi/hockey-ingestion.yaml` path `/evaluations` | Coach submitting an evaluation | Changes, once persistence lands (today's handler validates and stubs an id, same as events) | Injection | The contract's `EvaluationRequest` schema takes `ratings` as an open object (`additionalProperties`) and an optional free-text `notes` field, both marked "proposed." Neither has a fixed field list, so whatever eventually stores or queries them has to treat every key and the note text as data, never as part of a query string. |

## How a hole was chosen

- **IDOR** is attached to the Player URL entry point. `src/routes/players/$playerId.tsx` reads the `$playerId` path parameter with no check against who is signed in, which is the generic IDOR mechanism named in the Concept Coach session.
- **XSS** is attached to the Scouting pages entry point. Both `src/routes/scouting/index.tsx` and `src/routes/scouting/events.tsx` display a note string one scout wrote to every other viewer of that page, which is the stored-script mechanism the Concept Coach covered.
- **CSRF** is attached to the Scouting pages (write) entry point. `src/lib/scouting/mutations.ts`'s `createScoutingEvent` changes data using only the signed-in session's cookies, with no origin or token check in that file, which is the forged-request mechanism from the Concept Coach.
- **Injection** is attached to both ingestion entry points. `openapi/hockey-ingestion.yaml` defines `provider_event_id`, `ratings`, and `notes` as free-form fields with no fixed shape, which is exactly the "outside text treated as more than plain data" mechanism the Concept Coach named.

## Evidence log

- `docs/security/hockey-staff-access-brief.md` — used for: the §5 rule that hiding a screen is not protection, and for naming scouting notes as sensitive, competitive data.
- `docs/security/role-access-matrix.md` — used for: the three staff actor names (coaching, scouting, medical) and which role may read or write scouting notes and scouting events.
- `docs/security/rls-policy-spec.md` — used for: confirming that only the scouting role gets rows back from `scouting_events` under row-level security, and that coaching and medical get zero rows.
- `openapi/hockey-ingestion.yaml` — used for: the field lists on `/game-events` and `/evaluations`, which fields are marked "proposed," and the actor descriptions for the provider and the submitting coach.

## Out of scope for this map

- No security-header values.
- No CSRF or IDOR implementation code.
- No dependency or package review.
- No new routing, service, or data-access layers.

Those decisions come in later steps. This file is the inventory only.
