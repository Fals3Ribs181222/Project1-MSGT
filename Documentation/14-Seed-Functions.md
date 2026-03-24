# Data Seeding Tools

During development and testing of features like the AI Report Card Generator, it's essential to have realistic mock data populated in the Supabase database.

We have created three separate, lightweight HTML utility files that interact directly with the Supabase JavaScript API to clear out old dummy data and safely generate fresh, standardized test data while respecting rate limits.

Each seeder that creates grade-specific data exposes a **Grade selector** (`11th` / `12th`) at the top of the page. All three grade-aware seeders must be run with the **same grade selected** so that students, tests, and marks stay consistent with each other.

## Overview of Seed Files

| File | Purpose | Order of Execution |
|---|---|---|
| `seed-students.html` | Generates 15 dummy students | **1st** |
| `seed-tests.html` | Generates 15 dummy test records scheduled by the logged-in teacher | **2nd** |
| `seed-marks.html` | Assigns randomized marks to the dummy students for the dummy tests | **3rd** |
| `seed-phone.html` | Assigns a specific phone number (e.g. 9769767219) to all students for WhatsApp testing | **Optional / 4th** |

---

## 1. `seed-students.html`

**Purpose**: Sets up the foundational student profiles required for marks and reports.

**Grade selector**: Choose `11th` or `12th` before clicking the button. Defaults to `12th`.

**Logic**:
1. Reads the selected grade from the dropdown.
2. Fetches and deletes only existing students whose `grade` matches the selection (students of other grades are untouched).
3. Generates 15 new trial students with realistic names (e.g., `Aarav Mehta`, `Priya Sharma`).
4. Assigns them to the **selected grade** with **Accounts, Commerce** as their subjects.
5. Usernames include a grade suffix to prevent auth conflicts when both grades are seeded (e.g., `aarav.mehta.12` for 12th, `aarav.mehta.11` for 11th).
6. Injects a slight delay (`setTimeout`) between Supabase insertions to avoid tripping API rate limits.

---

## 2. `seed-tests.html`

**Purpose**: Creates academic assessments to which marks can be attached.

**Grade selector**: Choose `11th` or `12th` before clicking the button. Defaults to `12th`.

**Logic**:
1. Reads the selected grade from the dropdown.
2. Finds and deletes existing tests with titles matching `Test %` **and** the selected grade (tests of other grades are untouched).
3. Creates **15 new tests** (`Test 1` – `Test 15`), alternating subjects between `Accounts` and `Commerce`.
4. Sets the `grade` to the **selected grade**.
5. Randomizes recent dates and enforces a `max_marks` of **50** for each test.
6. Attaches the active teacher's `user.id` to `scheduled_by` so the tests appear correctly in the teacher's academic dashboard.

---

## 3. `seed-marks.html`

**Purpose**: Bridges the gap between students and tests, synthesizing realistic academic performance data.

**Grade selector**: Choose `11th` or `12th` before clicking the button. Defaults to `12th`. Must match the grade used in the student and test seeders.

**Logic**:
1. Reads the selected grade from the dropdown.
2. Fetches only tests with titles matching `Test %` **and** the selected grade.
3. Fetches only students whose `grade` matches the selection.
4. Clears existing marks for the fetched tests to allow clean re-runs.
5. Iterates through every test and generates a mark for every matching student.
6. Generates a randomized `marks_obtained` value between **50% and 100%** of `max_marks` (e.g., 25–50 out of 50).

---

## How to Run the Seed Scripts

Because these scripts rely heavily on the Teacher's active Supabase session (specifically capturing the `teacherSession.user.id` and enforcing RLS policies), **they must be run in a browser where a Teacher is actively logged into the application.**

### Execution Steps
1. Run your local server (e.g., `npx serve -l 8080`).
2. Open `http://localhost:8080/login.html` and log in as a Teacher.
3. Once logged in (you should be on `teacher_dashboard.html`), open a new tab in the **same browser**.
4. Navigate sequentially to the seed files, **selecting the same grade in each**:
   - Go to `http://localhost:8080/seed-students.html`. Select the desired grade, click **Create 15 Students**, and wait for completion.
   - Go to `http://localhost:8080/seed-tests.html`. Select the **same grade**, click **Create 15 Tests**, and wait for completion.
   - Go to `http://localhost:8080/seed-marks.html`. Select the **same grade**, click **Assign Marks**, and let it finish.
5. Once all three scripts complete successfully, navigate back to your `teacher_dashboard.html` tab.
6. Refresh the page to see your newly generated dummy data populated across your Student lists and Academic tests.

> **Tip — seeding both grades**: You can seed 11th and 12th independently. Run all three seeders for `11th`, then run all three again for `12th`. Because deletion is grade-scoped and usernames carry a grade suffix, the two sets of data will not interfere with each other.
