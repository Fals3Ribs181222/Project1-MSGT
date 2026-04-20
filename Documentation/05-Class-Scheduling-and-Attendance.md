# Class Scheduling and Attendance

This module manages the timing of sessions and tracks student participation.

## Class Scheduling
Teachers organize instructional time by scheduling classes linked to specific batches.

1.  **Regular Classes:** These constitute the typical weekly schedule for a batch. They are defined by the `day_of_week` (0-6) and specific start/end times. Multiple days can be selected at once — each selected day creates a separate `classes` row sharing a common `class_group_id`.
2.  **Extra Classes:** These are one-off sessions scheduled for a specific date (`class_date`), separate from the regular weekly rhythm.

**Title auto-generation:** The class title is automatically constructed from the batch's grade, name, and subject (e.g. `12th – Batch A – Accountancy`). Extra classes append `(Extra)`.

**Grouped delete:** When deleting from the calendar modal, if the class has a `class_group_id`, all linked days are deleted together via `api.deleteMany('classes', { class_group_id })`.

## Schedule Tab UI

The Schedule tab shows a **2-week rolling calendar** starting from the Monday of the current week. Navigation moves forward or backward in 14-day increments. Calendar pills are colour-coded by grade (see below) and clicking any pill **navigates directly to the Attendance tab** and opens that class's attendance roster — it calls `window.loadTab('panel-attendance')` then `window.openAttendanceGrid()` with the class details pre-filled.

## Attendance Tracking
The system facilitates detailed recording of student attendance for all scheduled classes.

1.  **Recording:** Teachers mark attendance status (`present`, `absent`, or `late`) for each student. Students load with **no status pre-selected** — the teacher must explicitly mark each one. Records are upserted to the `attendance` table on conflict `(class_id, student_id, date)`. The **"Mark All Present"** button checks all `present` radios in one click.
2.  **Cross-Batch Transfer:** The **"+ Add Student"** button opens a "Cross-Batch Transfer" panel. The teacher picks a source batch and student; a `batch_transfers` row is inserted with `reason: "classId:<id>"` and the student is appended to the roster with Guest/source-batch tags and a remove (✕) button.
3.  **Viewing:** Both teachers and students can view attendance records, restricted by their respective RLS policies.

### WhatsApp Notification Flow (Attendance)

After marking statuses, the teacher uses the **"Send WhatsApp (N)"** button to notify students. The count updates automatically as statuses are marked.

- The button targets all students who have a status selected **and have not yet been notified in this session**.
- Clicking send saves each student's record and sends their WhatsApp message individually (sequentially).
- **Sent state:** Once notified, the row turns green with a left border, displays a "Sent" badge, status radios lock, and the row moves to the bottom of the table. This visually separates notified and pending students.
- The "← Switch Class" button navigates to `teacher_dashboard#schedule` (the Schedule tab) rather than returning to a class-selection screen.

### Calendar Grade Colors

Calendar pills on the Schedule tab are colour-coded by grade using CSS variables:
- **Grade 11** — `var(--grade-11)` `#FF4433` (Red Orange)
- **Grade 12** — `var(--grade-12)` `#00A36C` (Jade)
- Classes with no matching grade fall back to type-based colour (`--primary` for regular, `--amber` for extra).
