# Service-role key rule

**Date:** 2026-11-07
**Built from:** `docs/access/new-roles-brief.md` (what the assistant scout and video
analyst may see) and `docs/access/overgrant-audit.md` (access that is broader than the
job today).

## What the key is

The **service-role key** is the database's master key. Anything that uses it skips
every row rule, so it can read every row: medical, sports-science and scouting alike.
It is the opposite of least privilege. This file decides **who may hold it**.

## The rule

- **Default deny.** Any server job that is not on the allowed list below must not use
  the service-role key.
- **If a job is not listed, the answer is no.** If we are unsure whether a job needs
  the key, the answer is also no.
- **"The server" or "the API" is not an allowed job.** That would be everyone, because
  every page talks to the server.

## Allowed

**None.**

No job in this app needs the master key. Every server job here is started by a staff
person opening a page or clicking a button. Each one can run under that person's own
limited login, so the database applies their role's rules. The one task that does need
full access, **assigning a staff member's role**, is done by an administrator in the
Supabase dashboard, outside the app. It is not app code.

If a real server-only job is ever needed (for example, a scheduled cleanup that no
staff login could do), it must be:
- added here by name, with the reason;
- reviewed before it is built.

Until then the list stays empty.

## Never allowed

These must never use the service-role key:

- **Anything that answers the assistant scout.**
- **Anything that answers the video analyst.**
- **Everyday staff screens and their server functions,** for any role (coaching,
  scouting, medical):
  - checking who is signed in;
  - loading scouting notes and observations;
  - loading game data, the schedule, or the player list;
  - **hiding a medical flag on a shared screen.** Reading a sealed flag with the master
    key and then hiding it is still a leak, because a bug can forget to hide it.
- **Anything that runs in the browser.** The key must never be in a `VITE_` setting,
  the browser bundle, or any file a page can load.
- **Anything a staff person starts by opening a page or clicking a button.**
- **The staff directory (`/directory`).** The audit found `getDirectoryEntries` in
  `app/server/directory.ts` reading through the service-role key. That breaks this
  rule. It is recorded as an over-grant in `docs/access/overgrant-audit.md`, and a
  later step must switch it to the staff person's own login. This file does not change
  the code.

## Medical and sports-science data stay sealed

- Because no everyday request holds the master key, **the database itself refuses**
  medical and sports-science rows to anyone whose role does not allow them. That
  includes the assistant scout and the video analyst.
- **A buggy screen fails closed.** If a page forgets to hide something, the medical rows
  were never sent to it, because the request ran as the staff person and not with the
  master key. The safety does not depend on the screen remembering to hide anything.

## Where the real key lives

- **Only in server settings,** never in the project's files. Locally that means
  `.env.local`, which is not committed. In production it means the Vercel project's
  server-only environment settings.
- **It is never written in Git, a doc, a chat, a ticket, or a screenshot.** This file
  names the key; it never contains it.
- **If it is ever exposed, it is rotated** (replaced with a new key) in the Supabase
  dashboard. Deleting the message or file is not enough.

## How a reviewer checks this rule

- **Search the code** for the service-role client. The only use found today is
  `app/server/directory.ts`, which this rule marks as a violation to fix.
- **Search the browser bundle and every `VITE_` setting.** The key must not appear.
- **Any new use** needs its job name added to **Allowed** above first. Without that, it
  is rejected.
