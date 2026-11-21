# Layer map: one player read

This map is only for reading one player in the hockey roster tool. It does
not change the database.

## Route layer (routing boundary)

**May:** receive the web request, read the player id from the URL, call the
service, and turn the result into a response.

**Must not:** query Supabase, build SQL, or hide roster rules inside a React
page.

**File this step:** none. A later step adds the thin server function. Not
created now.

## Service layer

**May:** apply roster rules for this read, including whether this staff
member may see this player, then call data access.

**Must not:** build an HTTP response, render React, or paste the player id
into a SQL string.

**File this step:** none. The next step creates the service.

## Data-access layer

**May:** load one player row from the existing Supabase `players` table
through the existing server client, passing the player id as a parameter.

**Must not:** decide who is allowed to see the player, set security headers,
or import React.

**File this step:** `src/data/playerAccess.ts`

## Call direction

Route calls service. Service calls data access. Data access calls Supabase.
A lower layer must not call upward into HTTP.

## Tied to the attack-surface map

Injection on this read is closed in the data-access layer: the player id is
a bound `.eq()` parameter, never glued into SQL text (see
`docs/security/attack-surface-map.md`, player URL row).

IDOR is **not** closed here. Who may see the row stays the service layer's
job, using the authorization check already in the repo
(`src/server/authorizeResource.ts`, `docs/security/idor-defense-notes.md`).
This step only extracts the read itself.
