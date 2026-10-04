-- supabase/migrations/001_scouting_schema.sql
--
-- Sprint 3 scouting schema: players, games, scouting_events.
--
-- Requirements: docs/scouting-data-requirements.md  (V1-V4, criteria 1-8)
-- Design notes: docs/scouting-schema-notes.md       (why each choice was made)
--
-- Applied in the next step. Once this file has been applied to any database,
-- do not edit it -- write a new numbered migration instead.

-- ---------------------------------------------------------------------------
-- Fixed value lists (brief section 2: position and event type are fixed lists)
--
-- Enums rather than free text so (a) the database rejects anything else and
-- (b) generated TypeScript types carry the exact allowed values.
-- ---------------------------------------------------------------------------

create type public.player_position as enum ('F', 'D', 'G');

create type public.scouting_event_type as enum (
  'goal',
  'assist',
  'shot',
  'hit',
  'penalty',
  'note'
);

-- ---------------------------------------------------------------------------
-- updated_at helper (players and events are updatable per the brief)
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- players -- one row per player Northline scouts (brief: Player)
-- ---------------------------------------------------------------------------

create table public.players (
  id             uuid primary key default gen_random_uuid(),
  display_name   text not null,
  position       public.player_position not null,
  team_label     text not null,
  sweater_number smallint,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint players_display_name_not_blank check (btrim(display_name) <> ''),
  constraint players_team_label_not_blank   check (btrim(team_label) <> ''),
  constraint players_sweater_number_range   check (sweater_number between 0 and 99)
);

comment on table public.players is
  'A skater or goalie Northline scouts. id is the only identifier; names and sweater numbers can change.';

-- ---------------------------------------------------------------------------
-- games -- one row per contest, between two sides on a date (brief: Game)
-- ---------------------------------------------------------------------------

create table public.games (
  id          uuid primary key default gen_random_uuid(),
  played_on   date not null,
  home_team   text not null,
  away_team   text not null,
  created_at  timestamptz not null default now(),

  constraint games_home_team_not_blank check (btrim(home_team) <> ''),
  constraint games_away_team_not_blank check (btrim(away_team) <> ''),
  constraint games_teams_differ
    check (lower(btrim(home_team)) <> lower(btrim(away_team)))
);

comment on table public.games is
  'A single contest on a date between two sides. Scouts watch games Northline is not in, so both sides are stored.';

-- One game per matchup per day, so events cannot be split across duplicate
-- game rows for the same contest.
create unique index games_unique_matchup_idx
  on public.games (played_on, lower(btrim(home_team)), lower(btrim(away_team)));

-- ---------------------------------------------------------------------------
-- scouting_events -- one observation of one player in one game (brief: Event)
-- ---------------------------------------------------------------------------

create table public.scouting_events (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete restrict,
  game_id     uuid not null references public.games (id)   on delete restrict,
  event_type  public.scouting_event_type not null,
  period      smallint,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint scouting_events_period_range check (period between 1 and 5),
  constraint scouting_events_note_not_blank check (note is null or btrim(note) <> ''),
  constraint scouting_events_note_required_for_note_type
    check (event_type <> 'note' or note is not null)
);

comment on table public.scouting_events is
  'One thing a scout observed one player do in one game. Must reference an existing player and an existing game.';

-- ---------------------------------------------------------------------------
-- Indexes for the brief's views (Postgres does NOT index foreign keys itself)
-- ---------------------------------------------------------------------------

-- V3 events for a player, and for a player in a game (leading column covers
-- player-only lookups). V4 per-player aggregate groups by player_id.
create index scouting_events_player_game_idx
  on public.scouting_events (player_id, game_id);

-- V3 events for a game. game_id is not the leading column above.
create index scouting_events_game_idx
  on public.scouting_events (game_id);

-- V2 games by date range, newest first; V3/V4 date filters join through here.
create index games_played_on_idx
  on public.games (played_on desc);

-- V1 players filtered by team label, ordered by name.
create index players_team_label_name_idx
  on public.players (team_label, display_name);

-- ---------------------------------------------------------------------------
-- Keep updated_at honest on the two updatable tables
-- ---------------------------------------------------------------------------

create trigger players_set_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

create trigger scouting_events_set_updated_at
  before update on public.scouting_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled, with NO policies (deny-by-default)
--
-- Supabase exposes tables in `public` through its auto-generated API, which is
-- reachable with the anon key that ships to the browser by design. With RLS on
-- and no policies, the anon and authenticated roles get zero rows and cannot
-- write. The server-only service-role client (Sprint 2) bypasses RLS, so the
-- server function remains the single way in. Real per-user policies arrive
-- with auth in a later step.
-- ---------------------------------------------------------------------------

alter table public.players         enable row level security;
alter table public.games           enable row level security;
alter table public.scouting_events enable row level security;
