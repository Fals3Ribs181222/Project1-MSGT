-- Add school scoping to support students from different schools with different
-- teaching orders (Jamnabai Narsee School vs CNMS).
--
-- profiles.school  — which school the student attends
-- tests.schools    — which schools the test is assigned to (empty = no restriction)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school TEXT DEFAULT NULL;
ALTER TABLE public.tests    ADD COLUMN IF NOT EXISTS schools TEXT[] DEFAULT '{}';

-- Rebuild student_rankings with school-aware filtering.
-- A test only counts toward a student's ranking if:
--   (a) the test has no school restriction (schools = '{}' or NULL), OR
--   (b) the student's school is in the test's schools array.
-- The same filter applies to class_avg so the denominator is consistent.
CREATE OR REPLACE VIEW public.student_rankings AS
WITH enrolled AS (
    SELECT
        id, name, grade, school,
        TRIM(unnest(string_to_array(subjects, ','))) AS subject
    FROM profiles
    WHERE role = 'student'
      AND subjects IS NOT NULL AND subjects <> ''
),
student_stats AS (
    SELECT
        e.id, e.name, e.grade, e.subject,
        ROUND(SUM(m.marks_obtained::numeric) / NULLIF(SUM(t.max_marks), 0) * 100, 2) AS avg_percentage,
        COUNT(m.id) AS tests_taken
    FROM enrolled e
    LEFT JOIN marks m ON m.student_id = e.id
    LEFT JOIN tests t ON t.id = m.test_id
                     AND t.subject = e.subject
                     AND (t.schools = '{}' OR t.schools IS NULL OR e.school = ANY(t.schools))
    -- Keep all enrolled students. When a mark exists but its test is excluded by the
    -- school/subject filter, t.id is NULL — that mark row should be ignored (not cause
    -- the student to vanish). SUM/COUNT on NULLs handles this naturally.
    WHERE t.id IS NOT NULL OR m.id IS NULL
    GROUP BY e.id, e.name, e.grade, e.subject
),
class_avg_cte AS (
    SELECT grade, subject, ROUND(AVG(avg_percentage), 2) AS class_avg
    FROM student_stats WHERE tests_taken > 0
    GROUP BY grade, subject
),
scored AS (
    SELECT
        ss.id AS student_id, ss.name, ss.grade, ss.subject,
        ss.avg_percentage, ss.tests_taken, ca.class_avg,
        CASE WHEN ss.tests_taken > 0
            THEN ROUND((ss.tests_taken * ss.avg_percentage + 3 * ca.class_avg) / (ss.tests_taken + 3), 2)
            ELSE NULL
        END AS final_score
    FROM student_stats ss
    LEFT JOIN class_avg_cte ca ON ca.grade = ss.grade AND ca.subject = ss.subject
)
SELECT
    student_id, name, grade, subject,
    avg_percentage, tests_taken, class_avg, final_score,
    RANK() OVER (
        PARTITION BY grade, subject
        ORDER BY final_score DESC NULLS LAST
    ) AS rank
FROM scored;

-- Preserve the security fix from 20260424000000_fix_student_rankings_security.sql
ALTER VIEW public.student_rankings SET (security_invoker = false);
