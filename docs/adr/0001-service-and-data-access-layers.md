# ADR 0001: Service and data-access layers for player roster reads

## Status

Accepted. This is already built and committed, not a future proposal.

## Context

Confidential roster decisions — injury status, trade consideration, and
scout notes — were at risk of being trapped inside HTTP handling. Before
this change, the player page's route file called a data loader directly,
which made it easy for a future edit to also tuck a "who may see this" rule
or a database query into that same route file. A rule and a query stuck
inside a route cannot be checked without starting an HTTP server, and it
makes a confidential field one careless edit away from showing up on every
visitor's screen, not just the staff who are allowed to see it.

## Decision

Use the three layers already built for one player roster read, recorded in
`docs/architecture/layer-map.md`:

- `src/server/getPlayerRoster.ts` — the thin server boundary. It parses the
  player id from the request, decides this call is a read (so it skips the
  CSRF check), calls the service, and maps the outcome to a plain
  `{ ok, ... }` shape. It holds no business rule and no database call.
- `src/services/playerRosterService.ts` — the service layer. It holds the
  roster business rule for this read: call `authorizeResource`, then call
  data access, then decide which fields the caller may learn. It knows
  nothing about HTTP requests, responses, or status codes.
- `src/data/playerAccess.ts` — the data-access layer. It is the only file
  that queries the existing Supabase `players` table, through the existing
  server client, with the player id as a bound parameter. It does not
  decide who is allowed to see the row.

Each layer calls only the layer below it (route → service → data access →
Supabase), and a lower layer never calls back up into HTTP.

## Options considered

- **Rejected: leave the rules inside the HTTP route handler.** This is the
  prior shape of `src/routes/players/$playerId.tsx`. It keeps business
  rules and data access coupled to the web request, so neither can be
  tested without a running server, and a future route touching the same
  file can accidentally drop the authorization check with no separate
  layer to catch the mistake.
- **Rejected: keep the authorization rule only inside the React page.**
  Hiding a confidential field on the screen is not the same as refusing to
  send it. `docs/security/role-access-matrix.md` and the attack-surface map
  already established that UI-only hiding is not protection; the rule has
  to live on the server, which is why it sits in the service layer instead
  of the component.

No microservice or new framework was considered. This decision is only
about where code lives inside the existing single TanStack Start app.

## Consequences

- **Positive:** business-rule tests (`src/services/playerRosterService.test.ts`)
  can call the service directly with fake authorization and fake data, and
  run without HTTP, a route, or a real database.
- **Positive:** future roster routes should call the service, not reach
  past it straight into `src/data/playerAccess.ts` or a Supabase client, so
  the authorization rule is never bypassed by a shortcut.
- **Cost:** one player read is now four files instead of one. Each new
  file must stay in agreement with `docs/architecture/layer-map.md`, or the
  map and the code will drift apart.
