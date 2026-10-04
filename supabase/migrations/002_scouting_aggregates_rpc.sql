-- 002_scouting_aggregates_rpc.sql
--
-- Scout question (V4, docs/scouting-data-requirements.md):
--   "For each player, how many goals, assists, shots, hits, penalties, and notes
--    have we logged — and in how many distinct games?"
--   Optionally narrowed to one position, a game-date range, and/or one game.
--
-- Called from the app as a Supabase RPC:
--   getSupabase().rpc('player_event_summary', { p_position, p_played_from, p_played_to, p_game_id })
-- via src/lib/scouting/rpc.ts. Parameter names here and there must stay identical.
--
-- Why in the database: one set-based query (JOIN + GROUP BY + COUNT ... FILTER)
-- returns one small row per player. The browser never downloads raw events to
-- count them, and there is no per-player query loop (N+1).
--
-- Rows: one per player who has at least one event matching the filters; players
-- with no matching events are omitted. Sorted by display name A→Z (V4), id as a
-- tie-breaker so ties are stable.

create function public.player_event_summary(
  p_position    public.player_position default null,  -- null = all positions
  p_played_from date                   default null,  -- inclusive; null = no lower bound
  p_played_to   date                   default null,  -- inclusive; null = no upper bound
  p_game_id     uuid                   default null   -- null = all games
)
returns table (
  player_id     uuid,
  display_name  text,
  "position"    public.player_position,
  team_label    text,
  games_count   bigint,  -- distinct games with at least one matching event
  event_count   bigint,  -- all matching events (sum of the six type counts)
  goal_count    bigint,
  assist_count  bigint,
  shot_count    bigint,
  hit_count     bigint,
  penalty_count bigint,
  note_count    bigint
)
language sql
stable
-- Runs with the CALLER's privileges, so Row Level Security on players, games,
-- and scouting_events still decides which rows are counted. It cannot be used
-- to read around RLS.
security invoker
-- Empty search_path: every name below is schema-qualified, so a caller cannot
-- shadow public.players etc. with objects of their own.
set search_path = ''
as $$
  select
    p.id                                                      as player_id,
    p.display_name,
    p.position,
    p.team_label,
    count(distinct e.game_id)                                 as games_count,
    count(*)                                                  as event_count,
    count(*) filter (where e.event_type = 'goal')             as goal_count,
    count(*) filter (where e.event_type = 'assist')           as assist_count,
    count(*) filter (where e.event_type = 'shot')             as shot_count,
    count(*) filter (where e.event_type = 'hit')              as hit_count,
    count(*) filter (where e.event_type = 'penalty')          as penalty_count,
    count(*) filter (where e.event_type = 'note')             as note_count
  from public.scouting_events e
  join public.players p on p.id = e.player_id   -- FK scouting_events_player_id_fkey
  join public.games   g on g.id = e.game_id     -- FK scouting_events_game_id_fkey
  where (p_position    is null or p.position  = p_position)
    and (p_played_from is null or g.played_on >= p_played_from)
    and (p_played_to   is null or g.played_on <= p_played_to)
    and (p_game_id     is null or e.game_id   = p_game_id)
  group by p.id   -- p.id is the primary key, so p's other columns may be selected
  order by p.display_name, p.id;
$$;

comment on function public.player_event_summary(public.player_position, date, date, uuid) is
  'V4 per-player scouting summary: event counts by type and distinct games, optionally filtered by position, game-date range, and game.';

-- Grants. Postgres gives EXECUTE on new functions to PUBLIC by default; replace
-- that with an explicit list of the roles this app actually uses:
--   anon          — the shared app client (src/lib/supabase/client.ts). The app
--                   has no login yet (out of scope), so this is the role it calls as.
--   authenticated — signed-in users once Auth lands.
--   service_role  — trusted server code.
-- Safe for anon because of SECURITY INVOKER above: the function sees only what
-- RLS lets the caller see. Until read policies exist, anon gets zero rows
-- (RLS deny-by-default from 001), not an error.
revoke execute on function public.player_event_summary(public.player_position, date, date, uuid) from public;
grant  execute on function public.player_event_summary(public.player_position, date, date, uuid) to anon, authenticated, service_role;
