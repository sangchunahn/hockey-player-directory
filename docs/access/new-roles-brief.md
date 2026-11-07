# New hockey staff roles brief

**Date:** 2026-11-07
**Status:** request only. No code, no database changes, and no new permissions in this
step.
**Builds on:** the first Sprint 4 tutorial (`docs/security/`), which stays as it is.

## Why this note exists

Mid-season, hockey operations hired an **assistant scout** and a **video analyst**. Both
need scouting and game information to do their jobs, but neither may see players'
health. This note is the request a teammate builds from, so nobody has to guess what
the two new jobs may see.

## Jobs already in the app (do not rebuild)

- **Coaching:** plans practices and games. Sees the shared player list and game
  schedule. Does not see scouting notes or health information.
- **Scouting:** records and reviews player evaluations. Sees and logs scouting notes
  and game observations. Does not see health information.
- **Medical:** looks after players' health and training. Sees health and
  sports-science records. Does not see scouting notes.

**Out of scope:** staff sign-in, the checks that prove who is signed in before the
server answers, and the existing coaching, scouting and medical access rules. They are
already built and stay as they are.

## New jobs

### Assistant scout

- **Who they are:** a junior scout who supports the scouting staff at games and in
  reviews.
- **Scouting information they need:**
  - read the scouting notes and game observations the scouting staff record (goals,
    assists, shots, hits, penalties, written notes);
  - add their own observations and notes from games they watch;
  - correct only the observations they added themselves.
- **Game information they need:** the game schedule (dates and the two teams) and the
  player list (name, position, team, sweater number), so they can find the right game
  and player.
- **What they must never see:** any health, injury, medical or sports-science
  information, on any page, including shared scouting and game pages.

### Video analyst

- **Who they are:** reviews game video and lines it up with what scouts recorded.
- **Scouting information they need:** **read only** the scouting notes and game
  observations, so they can match video moments to them. They do not add or change
  scouting notes.
- **Game information they need:** the game schedule (dates, teams) and the player list
  (name, position, team, sweater number).
- **What they must never see:** any health, injury, medical or sports-science
  information, on any page, including shared scouting and game pages.

## What stays sealed

"Sealed" means locked away from that job. It must stay locked even if someone opens the
page directly or asks the app's server for the data, not just hidden from a menu.

- **Medical data:** health records, injuries, treatment, and return-to-play notes.
  Sealed for both the assistant scout and the video analyst.
- **Sports-science data:** training load, fitness and body-performance measurements.
  Sealed for both new jobs, the same as medical data.
- **Medical flags on shared screens:** a medical flag is a small health label on a
  player, such as "injured" or "not cleared to play". A shared screen is any page more
  than one job can open, such as the player list, the game schedule, the scouting notes
  page, or the event board.
  - These shared screens must **never show a medical flag** to the assistant scout or
    the video analyst, even though the rest of the screen is allowed.
  - A scouting page that still says "injured" next to a player's name has leaked
    medical information.
  - Today these screens show no medical flags. If one is ever added, it must stay
    hidden from both new jobs.

## Out of scope

- Rebuilding staff sign-in or the login checks.
- Changing what coaching, scouting or medical may already see or do.
- Database changes, tests, or changes to the live website. Those come in later steps
  and must follow this note.
- Video storage or video tools. This request is only about which information the new
  jobs may see.

## Open questions for hockey operations

1. May the **assistant scout** add their own scouting observations? This note says
   **yes, their own only**. Confirm or change.
2. Should the **video analyst** stay **read-only**? This note says yes.
3. Should either new job see the **per-player scouting totals** (goals, shots and so
   on)? This note assumes yes, because those totals come from scouting observations
   they may already read. They contain no health information.

## What done means

- [ ] A teammate can tell what each new job may see and do without guessing: the
      assistant scout reads and adds their own scouting observations, the video analyst
      reads only, and both see the game schedule and player list.
- [ ] A teammate can tell that medical data, sports-science data, and medical flags on
      shared screens stay sealed for both new jobs.
- [ ] Nothing in this note asks to rebuild sign-in, the login checks, or the existing
      coaching, scouting and medical rules.
- [ ] No placeholder text is left.
