-- Fix student_rankings view returning only 1 row for students.
-- security_invoker = true caused the view to run under the student's RLS context,
-- which blocks them from seeing other students in profiles. Reverting to the default
-- (security_definer / view-owner context) so the view bypasses RLS while still
-- filtering by grade in the JS query.
ALTER VIEW public.student_rankings SET (security_invoker = false);
