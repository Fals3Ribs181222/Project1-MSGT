-- Per-test leaderboard view.
-- security_invoker = false so students can see all classmates' marks for a test
-- (same pattern as the student_rankings fix).
CREATE OR REPLACE VIEW public.test_leaderboard AS
SELECT
    m.test_id,
    m.student_id,
    p.name            AS student_name,
    m.marks_obtained,
    t.max_marks,
    t.title           AS test_title,
    t.subject,
    t.grade,
    CASE
        WHEN m.marks_obtained ~ '^[0-9]+(\.[0-9]+)?$' AND t.max_marks > 0
        THEN ROUND((m.marks_obtained::numeric / t.max_marks) * 100, 1)
        ELSE NULL
    END AS percentage,
    RANK() OVER (
        PARTITION BY m.test_id
        ORDER BY
            CASE
                WHEN m.marks_obtained ~ '^[0-9]+(\.[0-9]+)?$'
                THEN m.marks_obtained::numeric
            END DESC NULLS LAST
    ) AS rank
FROM marks m
JOIN profiles p ON p.id = m.student_id
JOIN tests  t ON t.id = m.test_id;

ALTER VIEW public.test_leaderboard SET (security_invoker = false);

GRANT SELECT ON public.test_leaderboard TO authenticated;
