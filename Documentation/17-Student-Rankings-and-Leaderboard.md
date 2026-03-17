# Student Rankings and Leaderboard

TuteFlow includes a live rankings system that scores and ranks students within their grade based on their internal test performance. Rankings are computed entirely in the database — no manual updates, no caching.

---

## Design Principles

- **Grade-separated** — Grade 11 and Grade 12 are ranked independently. Comparing students across different syllabi and difficulty levels is meaningless.
- **Confidence-weighted scoring** — a student who scored 100% on one test is not ranked above someone with a consistent 80% across 30 tests. The Bayesian formula handles this automatically.
- **Always live** — rankings are a SQL view. Every time the leaderboard is loaded, it reflects the latest marks in the database.
- **Batch-agnostic** — batches are an operational grouping, not an academic one. Rankings pool all students within a grade regardless of which batch they attend.

---

## Scoring Formula (Bayesian Average)

Raw average percentage is a poor ranking signal when students have taken different numbers of tests. A single lucky 100% shouldn't outrank 30 consistent tests at 80%.

The solution is a **Bayesian average** that blends each student's average with the grade-level class mean, weighted by how many tests they've taken:

```
final_score = (tests_taken × avg_percentage + C × class_avg) / (tests_taken + C)
```

Where:
- `avg_percentage` = student's own average across all tests (marks_obtained / max_marks × 100)
- `class_avg` = mean `avg_percentage` of all students in the same grade who have taken at least one test
- `C = 3` (confidence constant — the score converges to actual avg after ~3 tests)

### What C = 3 means in practice

| Tests Taken | Weight on Student's Own Avg | Weight on Class Avg |
|-------------|----------------------------|---------------------|
| 1           | 25%                        | 75%                 |
| 3           | 50%                        | 50%                 |
| 10          | 77%                        | 23%                 |
| 30          | 91%                        | 9%                  |

After ~10 tests the class average has minimal influence. After 30 tests, `final_score ≈ avg_percentage`.

### Example (class avg = 72%)

| Student | Avg % | Tests | Calculation                        | Final Score | Rank |
|---------|-------|-------|------------------------------------|-------------|------|
| Sneha   | 80%   | 4     | (4×80 + 3×72) / 7 = 76.57%        | 76.57%      | 1st  |
| Riya    | 95%   | 1     | (1×95 + 3×72) / 4 = 77.75% → wait, class avg here is 72 so: (95+216)/4=77.75 | 77.75% | 2nd  |
| Arjun   | 70%   | 5     | (5×70 + 3×72) / 8 = 70.75%        | 70.75%      | 3rd  |

---

## Database Layer

### `student_rankings` view

No new tables needed for the core ranking logic. The view is defined in `supabase_schema.sql` and computed on every query.

```sql
CREATE VIEW student_rankings AS
WITH student_stats AS (
  -- Aggregate each student's marks across all tests
  SELECT p.id, p.name, p.grade,
    ROUND(SUM(m.marks_obtained::numeric) / NULLIF(SUM(t.max_marks), 0) * 100, 2) AS avg_percentage,
    COUNT(m.id) AS tests_taken
  FROM profiles p
  LEFT JOIN marks m ON m.student_id = p.id
  LEFT JOIN tests t ON t.id = m.test_id
  WHERE p.role = 'student'
  GROUP BY p.id, p.name, p.grade
),
class_avg_cte AS (
  -- One class average per grade, students with 0 tests excluded
  SELECT grade, ROUND(AVG(avg_percentage), 2) AS class_avg
  FROM student_stats WHERE tests_taken > 0
  GROUP BY grade
)
SELECT
  ss.student_id, ss.name, ss.grade,
  ss.avg_percentage, ss.tests_taken, ca.class_avg,
  CASE WHEN ss.tests_taken > 0
    THEN ROUND((ss.tests_taken * ss.avg_percentage + 3 * ca.class_avg) / (ss.tests_taken + 3), 2)
    ELSE NULL
  END AS final_score,
  RANK() OVER (
    PARTITION BY ss.grade                          -- separate ranking per grade
    ORDER BY ... final_score DESC NULLS LAST       -- students with 0 tests ranked last
  ) AS rank
FROM student_stats ss
LEFT JOIN class_avg_cte ca ON ca.grade = ss.grade;
```

**Columns exposed by the view:**

| Column           | Type    | Description                                              |
|------------------|---------|----------------------------------------------------------|
| `student_id`     | UUID    | References `profiles.id`                                 |
| `name`           | TEXT    | Student's display name                                   |
| `grade`          | TEXT    | `'11th'` or `'12th'`                                     |
| `avg_percentage` | NUMERIC | Raw average % across all tests                           |
| `tests_taken`    | BIGINT  | Number of tests with marks recorded                      |
| `class_avg`      | NUMERIC | Grade-level class mean (same value for all in the grade) |
| `final_score`    | NUMERIC | Bayesian score used for ranking; NULL if 0 tests         |
| `rank`           | BIGINT  | Competition rank within grade (1, 2, 2, 4…); ties share same rank |

### `rank_history` table

Stores weekly snapshots of each student's rank and score for WhatsApp movement tracking (↑↓). The edge function that writes to this table is a planned cron job.

```sql
CREATE TABLE rank_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rank          INTEGER,
  avg_percentage NUMERIC,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(student_id, snapshot_date)
);
```

---

## Where Rankings Appear

### Teacher Dashboard — Leaderboard tab

**Files:** `components/tabs/leaderboard.html`, `js/dashboard/leaderboard.js`

The tab renders two side-by-side tables — Grade 11 on the left, Grade 12 on the right. Each column has:
- A heading with the grade's class average and ranked student count
- A table with: Rank (with 🥇🥈🥉 for top 3), Student name, Score (final_score, bold), Avg % (dimmed, for context), Tests taken
- Unranked students (0 tests) shown at the bottom with `—` in the rank column

The leaderboard tab is loaded lazily via the router when the teacher clicks the 🏅 Leaderboard pill on the dashboard home screen.

### Student Dashboard — Rank card

**Files:** `student_dashboard.html`, `js/student_dashboard.js`

A 4th stat is added to the performance card alongside Tests Taken, Avg. Score, and Best Score:

```
#3
of 18 students
```

The count ("of 18 students") is scoped to the student's own grade. The stat is hidden until rank data loads — it only appears if the student has taken at least one test.

---

## Ranking Logic Notes

**Tie-breaking:** Students with identical `final_score` share the same rank (standard competition ranking: 1, 2, 2, 4…). The database `RANK()` window function handles this natively.

**Students with no tests:** Their `final_score` is NULL. `ORDER BY ... DESC NULLS LAST` places them at the bottom. Their rank column displays `—` in the UI.

**Class average excludes zero-test students:** The `class_avg_cte` filters `WHERE tests_taken > 0` to avoid diluting the mean with students who haven't yet been assessed.

**`marks_obtained` is stored as TEXT** in the `marks` table. The view casts it to `numeric` (`m.marks_obtained::numeric`) for arithmetic. Any non-numeric values would cause a cast error — marks entry validation should prevent this.

---

## Future: Weekly WhatsApp Rank Notifications

The `rank_history` table is ready for a Supabase Edge Function on a cron schedule (e.g., every Sunday evening) that:

1. Queries `student_rankings` for the current week's snapshot
2. Reads last week's entries from `rank_history` for each student
3. Computes movement: `↑2`, `↓1`, `—` (no change), or `New entry`
4. Sends each student a WhatsApp message via Interakt with their rank, score, and movement
5. Writes this week's snapshot to `rank_history`

Message format (planned):
```
📊 Weekly Rank Update

Riya Shah — Grade 12
Rank: #4 ↑2
Score: 78.31% (Avg: 78.47%)

Keep it up! 💪
```
