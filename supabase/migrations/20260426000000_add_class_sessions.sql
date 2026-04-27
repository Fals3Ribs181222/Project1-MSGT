-- Add class_sessions table so each calendar day a class runs gets its own UUID.
-- Regular classes share a class_id across weeks; session_id uniquely identifies
-- one occurrence (class_id + session_date).

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.class_sessions (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_id     UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, session_date)
);

ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage class sessions" ON public.class_sessions
    FOR ALL
    USING (public.is_teacher())
    WITH CHECK (public.is_teacher());

CREATE POLICY "Students can view class sessions" ON public.class_sessions
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- 2. Backfill sessions from every (class_id, date) pair that ever had attendance
INSERT INTO public.class_sessions (class_id, session_date)
SELECT DISTINCT class_id, date
FROM public.attendance
WHERE class_id IS NOT NULL
ON CONFLICT (class_id, session_date) DO NOTHING;

-- 3. Add session_id to attendance
ALTER TABLE public.attendance
    ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.class_sessions(id) ON DELETE SET NULL;

-- 4. Backfill session_id on attendance rows
UPDATE public.attendance a
SET session_id = cs.id
FROM public.class_sessions cs
WHERE a.class_id = cs.class_id
  AND a.date = cs.session_date;

-- 5. Swap unique constraint to (session_id, student_id)
ALTER TABLE public.attendance
    DROP CONSTRAINT IF EXISTS attendance_class_id_student_id_date_key;

ALTER TABLE public.attendance
    ADD CONSTRAINT attendance_session_id_student_id_key UNIQUE (session_id, student_id);

-- 6. Add session_id to whatsapp_log
ALTER TABLE public.whatsapp_log
    ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.class_sessions(id) ON DELETE SET NULL;

-- 7. Backfill whatsapp_log.session_id (match class_id + IST date of sent_at)
UPDATE public.whatsapp_log wl
SET session_id = cs.id
FROM public.class_sessions cs
WHERE wl.class_id = cs.class_id
  AND wl.class_id IS NOT NULL
  AND (wl.sent_at AT TIME ZONE 'Asia/Kolkata')::date = cs.session_date;
