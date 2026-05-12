-- Support multiple dates per test (for multi-day test sessions).
-- The existing `date` column keeps the earliest date for backward compatibility.
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS dates text[];
