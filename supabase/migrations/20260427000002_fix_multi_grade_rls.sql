-- =============================================================================
-- Migration: fix_multi_grade_rls
-- Purpose: Support teachers whose grade field is a comma-separated list
--          (e.g. "12th, 11th"). The previous policies used exact string
--          equality, so multi-grade teachers saw nothing.
--          Solution: add a helper that checks if a row's grade is in the
--          teacher's comma-separated grade list, then rebuild all policies.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: returns true when the caller (teacher) is allowed to see the given grade.
-- Handles NULL / 'All Grades' (unrestricted) AND comma-separated lists.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.teacher_can_access_grade(row_grade text)
RETURNS boolean AS $$
  SELECT
    public.get_my_grade() IS NULL
    OR public.get_my_grade() = 'All Grades'
    OR row_grade = ANY(
        string_to_array(
            regexp_replace(public.get_my_grade(), '\s*,\s*', ',', 'g'),
            ','
        )
    )
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Grade-scoped profile visibility" ON profiles;

CREATE POLICY "Grade-scoped profile visibility" ON profiles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      profiles.id = auth.uid()
      OR profiles.role = 'teacher'
      OR (public.get_my_role() = 'teacher' AND profiles.role = 'student'
          AND public.teacher_can_access_grade(profiles.grade))
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- batches
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Grade-scoped batch visibility" ON batches;

CREATE POLICY "Grade-scoped batch visibility" ON batches
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher' AND public.teacher_can_access_grade(batches.grade))
      OR (public.get_my_role() = 'student' AND batches.grade = public.get_my_grade())
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- tests
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Grade-scoped test visibility" ON tests;

CREATE POLICY "Grade-scoped test visibility" ON tests
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher' AND public.teacher_can_access_grade(tests.grade))
      OR (public.get_my_role() = 'student' AND tests.grade = public.get_my_grade())
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- files
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Grade-scoped file visibility" ON files;

CREATE POLICY "Grade-scoped file visibility" ON files
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (files.grade IS NULL OR files.grade = '')
      OR (public.get_my_role() = 'teacher' AND public.teacher_can_access_grade(files.grade))
      OR (public.get_my_role() = 'student' AND files.grade = public.get_my_grade())
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- announcements
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Grade-scoped announcement visibility" ON announcements;

CREATE POLICY "Grade-scoped announcement visibility" ON announcements
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      announcements.grade IS NULL
      OR (public.get_my_role() = 'teacher' AND public.teacher_can_access_grade(announcements.grade))
      OR (public.get_my_role() = 'student' AND announcements.grade = public.get_my_grade())
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- batch_students (no grade column — join through batches)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Grade-scoped batch_students visibility" ON batch_students;

CREATE POLICY "Grade-scoped batch_students visibility" ON batch_students
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher'
          AND batch_students.batch_id IN (
              SELECT id FROM public.batches
              WHERE public.teacher_can_access_grade(grade)
          ))
      OR (public.get_my_role() = 'student'
          AND batch_students.batch_id IN (
              SELECT id FROM public.batches WHERE grade = public.get_my_grade()
          ))
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- classes (no grade column — join through batches)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Grade-scoped class visibility" ON classes;

CREATE POLICY "Grade-scoped class visibility" ON classes
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher'
          AND classes.batch_id IN (
              SELECT id FROM public.batches
              WHERE public.teacher_can_access_grade(grade)
          ))
      OR (public.get_my_role() = 'student'
          AND classes.batch_id IN (
              SELECT id FROM public.batches WHERE grade = public.get_my_grade()
          ))
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- attendance (join through batches for teacher; own records for student)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Grade-scoped attendance visibility" ON attendance;

CREATE POLICY "Grade-scoped attendance visibility" ON attendance
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher'
          AND attendance.batch_id IN (
              SELECT id FROM public.batches
              WHERE public.teacher_can_access_grade(grade)
          ))
      OR (public.get_my_role() = 'student' AND attendance.student_id = auth.uid())
    )
  );
