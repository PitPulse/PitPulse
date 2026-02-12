ALTER TABLE public.scouting_entries
  ADD COLUMN IF NOT EXISTS cycle_time_rating smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scouting_entries_cycle_time_rating_check'
  ) THEN
    ALTER TABLE public.scouting_entries
      ADD CONSTRAINT scouting_entries_cycle_time_rating_check
      CHECK (
        cycle_time_rating IS NULL OR
        (cycle_time_rating >= 1 AND cycle_time_rating <= 5)
      );
  END IF;
END $$;
