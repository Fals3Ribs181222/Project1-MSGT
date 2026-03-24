# Student Rankings and Leaderboard

TuteFlow includes a live rankings system that scores and ranks students within their grade **and subject** based on their internal test performance. Rankings are computed entirely in the database — no manual updates, no caching.

---

## Design Principles

- **Grade and subject separated** — Grade 11 Accounts, Grade 11 Commerce, Grade 12 Accounts, and Grade 12 Commerce are all ranked independently. Comparing across grades or subjects is meaningless.
- **Confidence-weighted scoring** — a student who scored 100% on one test is not ranked above someone with a consistent 80% across 30 tests. The Bayesian formula handles this automatically.
- **Always live** — rankings are a SQL view. Every time the leaderboard is loaded, it reflects the latest marks in the database.
- **Batch-agnostic** — batches are an operational grouping, not an academic one. Rankings pool all students within a grade+subject regardless of which batch they attend.
- **Subject-scoped marks** — a student's Accounts ranking is computed only from Accounts test marks, and Commerce ranking only from Commerce test marks.

---

## Subject Constants

Subject strings are defined as global constants in `js/utils.js` alongside the grade constants:

```js
window._Subject_Accounts = 'Accounts';
window._Subject_Commerce = 'Commerce';
```

These are used in `leaderboard.js` for grouping and rendering. The same string values (`'Accounts'`, `'Commerce'`) are used as checkbox values in `add_student.html` and `add_test.html`.

---

## Scoring Formula (Bayesian Average)

Raw average percentage is a poor ranking signal when students have taken different numbers of tests. A single lucky 100% shouldn't outrank 30 consistent tests at 80%.

The solution is a **Bayesian average** that blends each student's average with the grade+subject class mean, weighted by how many tests they've taken:

```
final_score = (tests_taken × avg_percentage + C × class_avg) / (tests_taken + C)
```

Where:
- `avg_percentage` = student's own average across all tests in that subject (marks_obtained / max_marks × 100)
- `class_avg` = mean `avg_percentage` of all students in the same grade+subject who have taken at least one test
- `C = 3` (confidence constant — the score converges to actual avg after ~3 tests)

### What C = 3 means in practice

| Tests Taken | Weight on Student's Own Avg | Weight on Class Avg |
|-------------|----------------------------|---------------------|
| 1           | 25%                        | 75%                 |
| 3           | 50%                        | 50%                 |
| 10          | 77%                        | 23%                 |
| 30          | 91%                        | 9%                  |

After ~10 tests the class average has minimal influence. After 30 tests, `final_score ≈ avg_percentage`.

---

## Database Layer

### `student_rankings` view

No new tables needed for the core ranking logic. The view is computed on every query.

```sql
CREATE VIEW student_rankings AS
WITH enrolled AS (
    -- One row per student per enrolled subject (unnests profiles.subjects)
    SELECT
        id, name, grade,
        TRIM(unnest(string_to_array(subjects, ','))) AS subject
    FROM profiles
    WHERE role = 'student'
      AND subjects IS NOT NULL AND subjects <> ''
),
student_stats AS (
    -- Aggregate marks per student per subject only
    SELECT
        e.id, e.name, e.grade, e.subject,
        ROUND(SUM(m.marks_obtained::numeric) / NULLIF(SUM(t.max_marks), 0) * 100, 2) AS avg_percentage,
        COUNT(m.id) AS tests_taken
    FROM enrolled e
    LEFT JOIN marks m ON m.student_id = e.id
    LEFT JOIN tests t ON t.id = m.test_id AND t.subject = e.subject
    WHERE m.id IS NULL OR t.id IS NOT NULL   -- discard cross-subject mark rows
    GROUP BY e.id, e.name, e.grade, e.subject
),
class_avg_cte AS (
    -- One class average per grade+subject (students with 0 tests excluded)
    SELECT grade, subject, ROUND(AVG(avg_percentage), 2) AS class_avg
    FROM student_stats WHERE tests_taken > 0
    GROUP BY grade, subject
)
SELECT
    ss.id AS student_id, ss.name, ss.grade, ss.subject,
    ss.avg_percentage, ss.tests_taken, ca.class_avg,
    CASE WHEN ss.tests_taken > 0
        THEN ROUND((ss.tests_taken * ss.avg_percentage + 3 * ca.class_avg) / (ss.tests_taken + 3), 2)
        ELSE NULL
    END AS final_score,
    RANK() OVER (
        PARTITION BY ss.grade, ss.subject          -- separate ranking per grade+subject
        ORDER BY final_score DESC NULLS LAST        -- students with 0 tests ranked last
    ) AS rank
FROM student_stats ss
LEFT JOIN class_avg_cte ca ON ca.grade = ss.grade AND ca.subject = ss.subject;
```

**Key JOIN note:** The `WHERE m.id IS NULL OR t.id IS NOT NULL` condition is critical. Without it, a student enrolled in both subjects would have all their marks summed into `marks_obtained` for each subject, but only the matching subject's `max_marks` counted — inflating the percentage above 100%.

**Columns exposed by the view:**

| Column           | Type    | Description                                              |
|------------------|---------|----------------------------------------------------------|
| `student_id`     | UUID    | References `profiles.id`                                 |
| `name`           | TEXT    | Student's display name                                   |
| `grade`          | TEXT    | `'11th'` or `'12th'`                                     |
| `subject`        | TEXT    | `'Accounts'` or `'Commerce'`                             |
| `avg_percentage` | NUMERIC | Raw average % across all tests in that subject           |
| `tests_taken`    | BIGINT  | Number of tests with marks recorded in that subject      |
| `class_avg`      | NUMERIC | Grade+subject class mean (same value for all in the group) |
| `final_score`    | NUMERIC | Bayesian score used for ranking; NULL if 0 tests         |
| `rank`           | BIGINT  | Competition rank within grade+subject (1, 2, 2, 4…)     |

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

The tab renders two side-by-side columns by grade. Each column has **two stacked subject sections** — Accounts then Commerce:

```
[ Grade 11 — Accounts ]    [ Grade 12 — Accounts ]
[ Grade 11 — Commerce ]    [ Grade 12 — Commerce ]
```

Grade-restricted teachers (e.g. only Grade 11) see only their grade's column; the other is hidden and the grid collapses to single-column.

`leaderboard.js` groups the view data by `grade || subject` key and calls `renderTable` four times using the global constants:

```js
renderTable(get(_Grade11, _Subject_Accounts), 'lb11A', 'avg11A');
renderTable(get(_Grade11, _Subject_Commerce), 'lb11C', 'avg11C');
renderTable(get(_Grade12, _Subject_Accounts), 'lb12A', 'avg12A');
renderTable(get(_Grade12, _Subject_Commerce), 'lb12C', 'avg12C');
```

Each section shows: Rank (with 🥇🥈🥉 for top 3), Student name, Score (`final_score`, bold), Avg % (dimmed), Tests taken. Students with 0 tests in that subject appear at the bottom with `—`.

The leaderboard tab is loaded lazily via the router when the teacher clicks the 🏅 Leaderboard pill.

### Student Dashboard — Rank card

**Files:** `student_dashboard.html`, `js/student_dashboard.js`

Currently shows a single rank card scoped to the student's grade (not yet split by subject). Planned for a future update.

---

## Ranking Logic Notes

**Tie-breaking:** Students with identical `final_score` share the same rank (standard competition ranking: 1, 2, 2, 4…). The database `RANK()` window function handles this natively.

**Students with no tests in a subject:** Their `final_score` is NULL. `ORDER BY ... DESC NULLS LAST` places them at the bottom. Their rank column displays `—` in the UI.

**Class average excludes zero-test students:** The `class_avg_cte` filters `WHERE tests_taken > 0` to avoid diluting the mean with unevaluated students.

**Subject enrollment via unnest:** `profiles.subjects` is a comma-separated string (e.g. `"Accounts, Commerce"`). The view unnests it with `TRIM(unnest(string_to_array(subjects, ',')))` to produce one row per student per subject. Students with only one subject appear in only one leaderboard.

**`marks_obtained` is stored as TEXT** in the `marks` table. The view casts it to `numeric` (`m.marks_obtained::numeric`) for arithmetic.

---

## Future: Weekly WhatsApp Rank Notifications

The `rank_history` table is ready for a Supabase Edge Function on a cron schedule (e.g., every Sunday evening) that:

1. Queries `student_rankings` for the current week's snapshot
2. Reads last week's entries from `rank_history` for each student
3. Computes movement: `↑2`, `↓1`, `—` (no change), or `New entry`
4. Sends each student a WhatsApp message with their rank, score, and movement (per subject)
5. Writes this week's snapshot to `rank_history`

Message format (planned):
```
📊 Weekly Rank Update

Riya Shah — Grade 12 · Accounts
Rank: #4 ↑2
Score: 78.31% (Avg: 78.47%)

Keep it up! 💪
```
