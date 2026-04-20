-- =============================================================================
-- Migration: grade_scoped_rls
-- Purpose: Replace permissive "qual: true" SELECT policies with grade-scoped RLS.
--          Unauthenticated users are blocked. Teachers see own grade (or all if
--          grade is NULL / 'All Grades'). Students see own grade only.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Helper functions (SECURITY DEFINER — avoids RLS recursion on profiles)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_grade()
RETURNS text AS $$
  SELECT grade FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: batches
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public batches are viewable by everyone" ON batches;

CREATE POLICY "Grade-scoped batch visibility" ON batches
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades' AND batches.grade = public.get_my_grade())
      OR (public.get_my_role() = 'student' AND batches.grade = public.get_my_grade())
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: tests
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public tests are viewable by everyone" ON tests;

CREATE POLICY "Grade-scoped test visibility" ON tests
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades' AND tests.grade = public.get_my_grade())
      OR (public.get_my_role() = 'student' AND tests.grade = public.get_my_grade())
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: files
-- Rows with NULL or empty grade are "general" — visible to all authenticated.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public files are viewable by everyone" ON files;

CREATE POLICY "Grade-scoped file visibility" ON files
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (files.grade IS NULL OR files.grade = '')
      OR (public.get_my_role() = 'teacher' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades' AND files.grade = public.get_my_grade())
      OR (public.get_my_role() = 'student' AND files.grade = public.get_my_grade())
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: announcements
-- Rows with NULL grade are broadcast — visible to all authenticated.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public announcements are viewable by everyone" ON announcements;

CREATE POLICY "Grade-scoped announcement visibility" ON announcements
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      announcements.grade IS NULL
      OR (public.get_my_role() = 'teacher' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades' AND announcements.grade = public.get_my_grade())
      OR (public.get_my_role() = 'student' AND announcements.grade = public.get_my_grade())
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: profiles
-- Critical: "Teachers can manage all profiles" is FOR ALL — it creates an
-- implicit SELECT policy that would bypass our new scoped SELECT via OR.
-- We drop it and replace with explicit INSERT/UPDATE/DELETE policies.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Teachers can manage all profiles" ON profiles;

CREATE POLICY "Grade-scoped profile visibility" ON profiles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      profiles.id = auth.uid()
      OR profiles.role = 'teacher'
      OR (public.get_my_role() = 'teacher' AND profiles.role = 'student' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND profiles.role = 'student' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades' AND profiles.grade = public.get_my_grade())
    )
  );

CREATE POLICY "Teachers can insert profiles" ON profiles
  FOR INSERT WITH CHECK (public.is_teacher());

CREATE POLICY "Teachers can update profiles" ON profiles
  FOR UPDATE USING (public.is_teacher());

CREATE POLICY "Teachers can delete profiles" ON profiles
  FOR DELETE USING (public.is_teacher());


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: batch_students (no grade column — join through batches)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public batch students are viewable by everyone" ON batch_students;

CREATE POLICY "Grade-scoped batch_students visibility" ON batch_students
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades'
          AND batch_students.batch_id IN (SELECT id FROM public.batches WHERE grade = public.get_my_grade()))
      OR (public.get_my_role() = 'student'
          AND batch_students.batch_id IN (SELECT id FROM public.batches WHERE grade = public.get_my_grade()))
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8: classes (no grade column — join through batches)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public classes are viewable by everyone" ON classes;

CREATE POLICY "Grade-scoped class visibility" ON classes
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades'
          AND classes.batch_id IN (SELECT id FROM public.batches WHERE grade = public.get_my_grade()))
      OR (public.get_my_role() = 'student'
          AND classes.batch_id IN (SELECT id FROM public.batches WHERE grade = public.get_my_grade()))
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 9: attendance (has batch_id — join through batches; students own records only)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public attendance is viewable by everyone" ON attendance;

CREATE POLICY "Grade-scoped attendance visibility" ON attendance
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades'
          AND attendance.batch_id IN (SELECT id FROM public.batches WHERE grade = public.get_my_grade()))
      OR (public.get_my_role() = 'student' AND attendance.student_id = auth.uid())
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 10: student_rankings VIEW — security_invoker so it inherits caller's RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER VIEW public.student_rankings SET (security_invoker = true);
