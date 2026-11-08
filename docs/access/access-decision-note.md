# Access decision: assistant scout and video analyst

**Date:** 2026-11-07
**For approval by:** hockey operations lead
**Prepared by:** sangchunahn

## The request

Mid-season, hockey operations hired an **assistant scout** and a **video analyst**. Both
need scouting and game information to do their jobs. Neither may see players' health.
This note records what each new job may see, what stays locked, and what we tested to
prove it.

## Who may see what

**Assistant scout**
- **May see:** scouting notes and game observations, the game schedule, and the player
  list (name, position, team, sweater number).
- **May do:** add their own scouting observations and correct only those. They can't
  change anyone else's notes.
- **Sealed (locked):** medical records, sports-science data (training load and body
  measurements), and any injury mark such as "injured reserve", including on shared
  screens like the player list.

**Video analyst**
- **May see:** scouting notes and game observations, the game schedule, and the player
  list.
- **May do:** nothing beyond looking. Their job is **read-only**: they can't add or
  change scouting notes.
- **Sealed:** the same as the assistant scout. No medical records, no sports-science
  data, and no injury marks on any shared screen.

**Existing staff are unchanged:**
- **Coaching:** schedule and player list only.
- **Scouting:** scouting notes plus the schedule and player list.
- **Medical:** medical and sports-science records plus the schedule and player list.

The only tightening for existing staff: **nobody except medical sees injury marks on
shared screens any more.** Signed-out visitors see nothing.

## Why these limits

Each job gets only what it needs:
- **The assistant scout** needs scouting notes and games to support the scouts at games
  and in reviews.
- **The video analyst** needs them to match video moments to what scouts recorded.
- **Neither job needs a player's health or training numbers.** Showing them would expose
  private health information to people who have no work reason to see it.
- **The video analyst only needs to read,** so they can't write.

## What the break-tests proved

We signed in as a test assistant scout, a test video analyst and a test medical user
against our own database, and tried 20 things (`docs/access/role-action-results.md`):
- **Blocked:** every attempt by either new job to **read, change, add, or delete** medical
  or sports-science records came back empty or was refused.
- **Allowed:** both new jobs **could** still read scouting notes and game data. The
  assistant scout could add and fix their own note.
- **Refused:** the video analyst's attempt to add a note.
- **Control:** medical staff **could** still read medical records, which proves the
  blocks are a working lock, not an outage.
- **Signed-out visitors** got nothing.
- **One test failed first.** The player list and player pages were showing "injured
  reserve" for 4 players to everyone, including the new jobs. We removed injury status
  from those shared screens and re-ran the tests. **Final result: 20 of 20 behaved as
  decided.**

## The master-key rule

The database has a master key that skips every row lock
(`docs/access/service-role-key-rule.md`):
- **No staff screen or staff request may ever use it.** That includes anything the new
  jobs open, checking who is signed in, loading scouting notes or games, and hiding an
  injury mark.
- **The list of jobs allowed to use it is empty.** Staff roles are assigned by an
  administrator in the database dashboard, not by the app.
- **The key itself lives only in server settings.** It never goes in this note, a chat,
  or our code history.

## Residual risk and later sprints

**Still open:**
- **The staff directory page still reads its data with the master key.** Its table is now
  locked to signed-in staff, but the page should switch to the staff person's own login.
- **Scouting notes are free text.** A scout could type an injury remark into a note that
  both new jobs can read. Staff should keep health remarks in medical records.
- **The test accounts exist in the live database,** and each test run adds one test
  scouting note.

**Rule for later sprints:** no later change may give the assistant scout, the video
analyst, coaching or scouting any access to medical records, sports-science data, or
injury marks on shared screens unless a new written decision replaces this one.

## Sources

- `docs/access/new-roles-brief.md`: what the two new jobs need and what stays sealed
- `docs/access/access-matrix-v2.md`: who may see what, cell by cell
- `docs/access/service-role-key-rule.md`: who may use the master key (no one)
- `docs/access/role-action-results.md`: what happened when we tried to break the gate
