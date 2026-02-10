-- Prevent duplicate scouting entries per match/team/scout

CREATE UNIQUE INDEX IF NOT EXISTS scouting_entries_unique_idx
ON public.scouting_entries (match_id, team_number, scouted_by);
