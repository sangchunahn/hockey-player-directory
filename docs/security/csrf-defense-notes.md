# CSRF and origin checks

## The scout story

A scout is already signed in, so their browser holds a sign-in cookie. Another
website can get that scout's browser to send a change-making request to our
app — the browser may attach the sign-in cookie to that request automatically,
even though the scout never meant to send it. That trick is cross-site request
forgery, CSRF for short. `src/server/csrf.ts` refuses that write. It does not
log the scout in, does not check who they are, and does not replace Supabase
auth. A matching origin only proves the request started from our app; it is
not permission to see or change every player's data — Sprint 4's sign-in and
row-level security still decide that.

## What the server refuses

Writes (`POST`, `PUT`, `PATCH`, `DELETE`) are rejected with **403** when:

- `Sec-Fetch-Site` is `cross-site`,
- the `Origin` header is missing,
- `Origin` is present but is not on the `APP_ORIGIN` allowlist, or
- the allowlist itself is empty (fail closed: an empty list never means
  "allow every site").

`GET`, `HEAD`, and `OPTIONS` are never rejected here — they only read data,
and blocking them would break ordinary page loads such as opening a player
page.

## What this is not

- Not a login check. `src/server/csrf.ts` imports no Supabase client, signs
  no one in, and reads no session.
- Not a role check. A matching origin says nothing about whether the caller
  is coaching, scouting, or medical — `docs/security/role-access-matrix.md`
  still decides that.
- Not a substitute for the security headers in `src/server/securityHeaders.ts`
  — those stop a browser from running or loading things; this module stops a
  forged write regardless of what the browser was allowed to load.
- Not protection against a non-browser caller who can invent any header it
  wants. This gate stops the *browser* trick, where the browser attaches
  headers and cookies on its own. A script calling the API directly with a
  copied token is a different problem that authentication, not this file,
  has to answer.

## Where it is used

Wired in. `src/routes/api/events.ts` and `src/routes/api/evaluations.ts` —
the two ingestion routes named in `docs/security/attack-surface-map.md` —
both call `csrfBlockResponse(request)` as the first line of their `POST`
handler, before any field validation or persistence.

## Allowlist

`APP_ORIGIN` is a comma-separated list of trusted **origins** (scheme, host,
and port — for example `https://hockey-player-directory-wine.vercel.app`),
never a path like `/players`. Set it to the Production origin recorded in
`docs/vercel-hobby-setup.md`, plus the local address used while developing
(for example `http://localhost:3000`). `APP_ORIGIN` is a public web address,
not a secret, but it still lives in the Vercel dashboard's environment
variables and the local `.env` file, not committed in this repo. An empty or
unset allowlist fails closed: every write is rejected until `APP_ORIGIN` is
set.
