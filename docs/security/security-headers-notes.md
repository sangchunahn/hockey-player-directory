# Security response headers

These notes explain the list in `src/server/securityHeaders.ts`. They do not
attach the headers. The live host is unchanged in this step.

Source of the threat list: `docs/security/attack-surface-map.md`.

## What this does not replace

These headers do not sign staff in, do not replace row-level security, and do
not stop CSRF or IDOR. `docs/security/attack-surface-map.md` already named
those holes against the login, scouting-write, and player-URL rows; the
checks that close them (session checks, Postgres RLS, CSRF and origin checks,
IDOR-safe lookups) are separate defenses built in later steps. This module
only reduces how much damage a script that slips past React's escaping can
do once it is already running in a staff member's browser.

## Header by header

### Content-Security-Policy

**Why:** Tells the browser which scripts, connections, and frames are
allowed, so a script injected through the scouting-notes XSS hole named in
`docs/security/attack-surface-map.md` is less able to run at all, and less
able to phone a result back out, even if it does run.

- `default-src 'self'` — anything not named by a more specific directive
  below may load only from this site.
- `script-src 'self'` — only scripts that belong to this site may run. No
  star, no `'unsafe-inline'`, no `'unsafe-eval'`.
- `style-src 'self' 'unsafe-inline'` — inline styles are allowed because
  this React and Tailwind app needs them; `'unsafe-inline'` stays off
  `script-src`.
- `img-src 'self' data: blob:` and `font-src 'self' data:` — images and
  fonts load from this site or an embedded `data:`/`blob:` source only.
- `connect-src 'self' https://*.supabase.co wss://*.supabase.co` — the
  browser may talk to this site and to Supabase over both plain HTTPS and
  the secure websocket Supabase Auth and realtime use.
- `frame-ancestors 'none'` and `object-src 'none'` — no other site may put
  this app in a frame, and no old plugin-style embeds load.
- `base-uri 'self'` and `form-action 'self'` — the page's own base address
  and its forms cannot be retargeted to another site.
- `upgrade-insecure-requests` — any accidental `http:` sub-request is
  upgraded to `https:`.

**Too loose:** `script-src *`, `script-src 'unsafe-inline'`, or
`script-src 'unsafe-eval'` stops this header from reducing XSS at all — the
exact hole the scouting-notes row in the attack-surface map describes.

**Too tight:** `connect-src 'self'` alone blocks Supabase's `https:` and
`wss:` hosts, so sign-in and live scouting data fail the moment this list is
attached to real responses. `script-src 'self'` can blank a page that
depended on an inline boot script; that blank page means the header worked,
and the fix is a one-time nonce on that script later, not opening
`script-src` to everyone. `img-src 'self'` alone would hide a photo hosted
elsewhere; add that host on purpose instead of widening the directive to
`*`. `'unsafe-inline'` stays on `style-src` only — it must never be copied
onto `script-src` just because it already appears on the style rule.

### X-Content-Type-Options

**Why:** `nosniff` stops the browser from guessing that a plain text file
is actually a script, which is a common way a stray upload or note becomes
executable.

**Wrong value:** anything other than `nosniff` gives none of this
protection.

### Referrer-Policy

**Why:** `strict-origin-when-cross-origin` keeps a full page path, such as
`/players/<id>`, from leaking to another site when a staff member follows a
link away from this app. Only the origin (scheme and host) goes along
cross-site; the full path stays on this site.

**Wrong value:** `unsafe-url` sends the whole address, including the player
id, to whatever site the staff member visits next.

### X-Frame-Options

**Why:** `DENY` matches the CSP's `frame-ancestors 'none'`. No other site
can frame this roster tool and overlay a fake button over the real one,
which is the clickjacking door this header closes.

**Wrong value:** allowing any frame reopens clickjacking. `DENY` would break
a future need to embed this app inside another site's frame, but this
roster tool has no such need, so `DENY` is the right call.

### Permissions-Policy

**Why:** `camera=(), microphone=(), geolocation=()` turns those browser
features off for everyone. An empty list means "off," not "on." The roster
tool never asks for a camera, microphone, or location.

**Wrong value:** something like `camera=*` would grant that feature broadly
to this page and anything it loads, with no reason to.

### Strict-Transport-Security

**Why:** tells the browser to keep using HTTPS for this host for the stated
`max-age` (180 days here), so a staff member's session cannot be
downgraded to a plain HTTP connection.

**Wrong value:** adding `preload` is hard to undo and can strand the site if
HTTPS is ever misconfigured, so this sprint leaves `preload` out and does
not add `includeSubDomains` for hosts this project does not control.

### Cross-Origin-Opener-Policy

**Why:** `same-origin` stops another site's window from reaching into this
app's window.

**Wrong value:** adding `Cross-Origin-Embedder-Policy` in this step can
break Supabase requests and third-party images, and there is no attack-
surface-map row that needs it yet, so it is left out.

## Out of scope

`vercel.json` and every route file are unchanged in this step. Attaching
this list to real responses is a later step. No API key, service-role key,
password, or other secret appears in this file or in
`src/server/securityHeaders.ts`.
