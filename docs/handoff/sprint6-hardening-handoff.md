# Sprint 6 hardening handoff

Audience: hockey operations leads and the instructor. This note records
that the roster tool is closer to being able to hold confidential roster
decisions — it does not say the tool is finished or approved to store them.

## Client story

The tool is about to hold confidential roster decisions: who is injured,
who might be traded, and private scout write-ups. This sprint's work is
about making sure those facts cannot leak through the web app before any
of that confidential data is actually stored. Before any of that is
trusted to the tool, it has to survive a hostile review: someone actively
trying to break in, or to peek at another team's notes by editing a URL,
forging a request, or slipping bad input into a form.

## What we mapped

Source: `docs/security/attack-surface-map.md`.

An attack surface is every place a request, a URL, a form, or a package
can cause harm. The map found five doors on this tool: the player URL, the
scouting pages, the login page, and the two API routes that accept new
events and evaluations from outside. In everyday terms, the four kinds of
harm it names are:

- **Cross-site scripting (XSS):** a harmful script sneaks into a page,
  tied to the scouting pages, where a scout's own note text is shown to
  every later viewer.
- **Cross-site request forgery (CSRF):** a trick makes a signed-in staff
  member's browser send a change they did not mean to send, tied to the
  write that logs a scouting event.
- **Injection:** smuggled text changes a database query or a command,
  tied to the two API routes, whose fields are free-form today.
- **Insecure direct object reference (IDOR):** changing an id in the URL
  opens someone else's record, tied to the player URL, whose id comes
  straight from the address with no ownership check in that file.

## Defenses that landed

- **Security headers** (extra safety rules sent to the browser):
  `src/server/securityHeaders.ts` and `vercel.json`. Notes:
  `docs/security/security-headers-notes.md`. These headers are defined and
  attached to the existing Hobby host; they do not replace sign-in or
  row-level security.
- **CSRF and origin checks** on the routes that accept new scouting data:
  `src/server/csrf.ts`, used by `src/routes/api/events.ts` and
  `src/routes/api/evaluations.ts`. Notes: `docs/security/csrf-defense-notes.md`.
- **Authorization that blocks IDOR, plus safe identifier handling:**
  `src/server/authorizeResource.ts`, enforced in `src/server/scouting-notes.ts`.
  Notes: `docs/security/idor-defense-notes.md`. This note is explicit that
  the module currently denies every caller, because no server-side source
  for a signed-in person's staff role exists yet
  (`docs/security/role-access-matrix.md`, open question 1). That is a real,
  documented gap, not a hidden one.

## Dependency and supply-chain review

Source: `docs/security/dependency-risk-review.md`.

A dependency is code this project installs from someone else. The supply
chain is that chain of packages and their own updates. The review judged
every package in `package.json` against three questions (does it touch
sign-in, page HTML, or server requests) and ran `npm audit`, which reported
zero known vulnerabilities across the installed packages at review time.
No package was upgraded or removed in that review.

That result is not the final word on dependency risk. `npm audit` only
catches vulnerabilities already published to its database; a flaw
disclosed tomorrow in a package this app already uses would report the
same "zero known" result today and still be real risk. No package version
was pinned or upgraded in this review, so nothing here protects against a
future update silently introducing a problem, this review was a judgment
pass on the dependency list as it stood, not an ongoing guarantee.

## How a player read is layered now

Source: `docs/adr/0001-service-and-data-access-layers.md`.

An architecture decision record (ADR) is a short note of a structural
choice and why it was made. One player read is now split into three
layers:

- **Thin server boundary** — `src/server/getPlayerRoster.ts` — accepts
  the request and does not hold the business rules.
- **Service** — `src/services/playerRosterService.ts` — the business
  rules for a roster read: who may see this player, decided by calling
  the authorization check.
- **Data access** — `src/data/playerAccess.ts` — the only layer that
  reads player rows from Supabase, using a bound id parameter.

The player page `src/routes/players/$playerId.tsx` calls the thin server
boundary. It does not talk to the database itself.

## What the service test shows

Source: `src/services/playerRosterService.test.ts`.

This test checks the roster business rules without sending an HTTP
request. HTTP is the web's request-and-response conversation; by using
fakes for authorization and for the player row instead of a server or a
real database, the test proves the service's allow/deny decision on its
own, separate from the route and the data layer.

## Still manual

- Row-level security (RLS) from earlier sprints still decides, inside the
  database, which staff rows a query can return. This sprint did not turn
  it off or replace it; everything above is an additional layer on top.
- Hosting stays on the one existing Vercel Hobby project. This sprint did
  not create a second hosting project (`docs/vercel-hobby-setup.md`).
- A signed-in staff member is still not allowed to see every player.
  Sprint 4's role matrix (`docs/security/role-access-matrix.md`) and its
  Sprint 6 update (`docs/access/access-matrix-v2.md`) remain the rule.

## Verification we actually ran

- **Player roster service test:**
  `npx vitest run src/services/playerRosterService.test.ts` — observed:
  `Test Files 1 passed (1)`, `Tests 2 passed (2)`, run locally on
  2026-11-20.
- **Handoff file opened at** `docs/handoff/sprint6-hardening-handoff.md`
  — observed: the file exists at that exact path with the headings listed
  in this note.

Do not claim the Production URL was re-checked in this note. That check
is next.

## What to extend next

Immediate next check: open the existing Production URL in
`docs/vercel-hobby-setup.md` and confirm it returns HTTP 200 (the
"page is here" response) and renders the app. Do not create a new Vercel
project for that check.

Later work should extend the same defenses — security headers, CSRF or
origin checks, and authorization — to the routes and pages this sprint did
not touch, and should resolve the open role-assignment question
(`docs/security/role-access-matrix.md`, open question 1) so
`authorizeResource` can allow a real caller instead of always denying.

Do not extend this work by removing RLS or by opening a second Vercel
project.

## What this note does not claim

- The app is not fully secure.
- Confidential roster decisions are not approved to store yet. This note
  only says the tool is closer, with specific, named defenses and a
  specific, named gap still open.
- No secrets belong here: no service-role keys, passwords, or tokens.
