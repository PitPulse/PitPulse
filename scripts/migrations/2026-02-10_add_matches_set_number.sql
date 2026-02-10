-- Add set_number to matches and normalize playoff match numbering

ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS set_number integer;

-- Quals: set_number = 1
UPDATE public.matches
SET set_number = 1
WHERE comp_level = 'qm'
  AND set_number IS NULL;

-- Playoffs: decode legacy encoded match_number (set*100 + match)
UPDATE public.matches
SET set_number = (match_number / 100),
    match_number = (match_number % 100)
WHERE comp_level <> 'qm'
  AND match_number >= 100;

-- Any remaining playoff rows without set_number default to 1
UPDATE public.matches
SET set_number = 1
WHERE comp_level <> 'qm'
  AND set_number IS NULL;

-- Drop old unique constraint on (event_id, comp_level, match_number) if present
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.matches'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid='public.matches'::regclass AND attname='event_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid='public.matches'::regclass AND attname='comp_level'),
        (SELECT attnum FROM pg_attribute WHERE attrelid='public.matches'::regclass AND attname='match_number')
      ]
  LOOP
    EXECUTE format('ALTER TABLE public.matches DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- New unique index including set_number
CREATE UNIQUE INDEX IF NOT EXISTS matches_event_comp_set_match_idx
ON public.matches (event_id, comp_level, set_number, match_number);
