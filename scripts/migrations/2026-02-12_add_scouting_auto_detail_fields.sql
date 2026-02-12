ALTER TABLE public.scouting_entries
  ADD COLUMN IF NOT EXISTS auto_notes text,
  ADD COLUMN IF NOT EXISTS shooting_range text,
  ADD COLUMN IF NOT EXISTS shooting_reliability smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scouting_entries_shooting_range_check'
  ) THEN
    ALTER TABLE public.scouting_entries
      ADD CONSTRAINT scouting_entries_shooting_range_check
      CHECK (
        shooting_range IS NULL OR
        shooting_range IN ('close', 'mid', 'long')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scouting_entries_shooting_reliability_check'
  ) THEN
    ALTER TABLE public.scouting_entries
      ADD CONSTRAINT scouting_entries_shooting_reliability_check
      CHECK (
        shooting_reliability IS NULL OR
        (shooting_reliability >= 1 AND shooting_reliability <= 5)
      );
  END IF;
END $$;
