# Student Detail View Redesign

The student detail view — opened when a teacher clicks **Manage** on any student in the Student List — was redesigned to surface richer information without requiring additional navigation. Six new sections were added alongside a visual overhaul of the existing profile, attendance, batches, marks, and AI report areas.

## What Changed

### Before
The original detail view was a flat, vertically stacked layout with plain tables for batches and marks, five raw attendance stat numbers, and the AI report card at the bottom. There was no contact information, no visual trend, no calendar, and no way to keep private notes or track message history.

### After
The redesigned view is organised into clearly labelled cards with a two-column layout on wider screens. Every section loads independently, so the page feels responsive even as data fetches happen in parallel.

---

## New Sections

### 1. Contact Information
Phone numbers for both the student and their parent are now stored on the `profiles` table and surfaced directly in the profile card. Clicking either phone button opens a WhatsApp chat (`wa.me/91XXXXXXXXXX`) in a new tab. An inline edit form lets the teacher update either number without leaving the page.

**Fields added to `profiles`:**

| Column | Type | Notes |
|---|---|---|
| `father_phone` | `TEXT` | Father's phone number |
| `mother_phone` | `TEXT` | Mother's phone number |

**UI behaviour:**
- Phone buttons are shown by default as read-only pills.
- Clicking **Edit contact** reveals two inputs (student phone, parent phone) and a Save button.
- On save, the `profiles` row is updated via `supabaseClient.from('profiles').update(...)` and `window.currentStudent` is patched in memory so the display updates immediately without a re-fetch.
- On cancel, the edit form hides and the read-only pills reappear.

---

### 2. Performance Trend Chart
A small inline SVG bar chart renders above the marks table, plotting each test as a bar with percentage labels. Bars are colour-coded: green (≥ 75%), amber (≥ 50%), red (< 50%). A dashed horizontal line marks the student's overall average.

**How it works:**
- Drawn purely with inline SVG — no external chart library required.
- Called by `renderTrendChart(marks)` after the marks data loads.
- Marks are sorted by date before rendering so the chart always reads left-to-right chronologically.
- The container `trendChartContainer` sits above `studentMarksTable` inside the marks card.

---

### 3. Attendance Calendar
A two-month calendar grid (current month + previous month) shows each class day colour-coded by attendance status: green (present), red (absent), yellow (late), grey (no record).

**How it works:**
- Called by `renderAttendanceCalendar(attendanceData)` after the attendance fetch.
- Requires the attendance query to include the `date` column: `.select('status, date')` — previously only `status` was selected.
- The function builds a `dateString → status` lookup map, then iterates each day of each month, outputting a 7-column CSS grid.
- Days with no attendance record are rendered in a neutral grey to distinguish them from days where the student was absent.

---

### 4. Teacher Notes
A private text area where the teacher can record observations about a student (e.g. "struggles with journal entries", "parents asked about extra classes"). Notes are never shown on the student-facing dashboard.

**Table: `student_notes`**

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary key |
| `student_id` | `UUID` | References `profiles(id)`, `UNIQUE` — one note per student |
| `note` | `TEXT` | The note content |
| `updated_by` | `UUID` | References `profiles(id)` — the teacher who last saved |
| `updated_at` | `TIMESTAMPTZ` | Auto-set on save |

**RLS:** Teachers only (`is_teacher()`). Students cannot read this table.

**UI behaviour:**
- Notes load automatically when the student detail view opens (`loadTeacherNotes(studentId)`).
- Saving uses `upsert` with `onConflict: 'student_id'` so the first save inserts and all subsequent saves update.
- A status indicator briefly shows **Saved ✓** after a successful save, then clears.

---

### 5. WhatsApp History
A reverse-chronological log of every progress report sent to this student's parent from the teacher dashboard. Shows the message type, a preview of the first ~120 characters, and the date/time of sending.

**Table: `whatsapp_log`**

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary key |
| `student_id` | `UUID` | References `profiles(id)` |
| `message_type` | `TEXT` | `'report'` (extendable to `'attendance'` etc.) |
| `preview` | `TEXT` | First ~120 characters of the sent message |
| `sent_by` | `UUID` | References `profiles(id)` — the teacher |
| `sent_at` | `TIMESTAMPTZ` | Timestamp of the send event |

**RLS:** Teachers only (`is_teacher()`).

**How logging works:**
- When the teacher clicks **WhatsApp** on the AI report output, `logWhatsAppSend(studentId, reportText)` is called alongside the existing `wa.me` link.
- The function inserts a row into `whatsapp_log` with the report preview, then immediately calls `loadWhatsAppLog(studentId)` to refresh the log panel.
- The log panel loads automatically when the detail view opens, showing up to 10 most recent entries.

---

### 6. Rank in Batch
The marks table now includes a **Rank** column showing where this student placed within their batch for each test (e.g. `3/10`).

**How it works:**
- After fetching the student's own marks, a second query fetches all marks for the same test IDs: `.from('marks').select('test_id, marks_obtained').in('test_id', testIds)`.
- For each test, scores are sorted descending. The student's rank is the position of their score in that sorted array (1-indexed).
- This is computed entirely client-side — no stored rank column or database function is needed.
- Rank is shown as `rank/total` in muted text next to the score.

---

## Key Files

| File | Change |
|---|---|
| `components/tabs/students.html` | Full replacement — new card-based layout with all six new sections |
| `js/dashboard/students.js` | Extended — 9 new/modified functions; no existing logic removed |
| `supabase_schema.sql` | Two new tables (`student_notes`, `whatsapp_log`), two new columns (`father_phone`, `mother_phone`) |

---

## Database Migration

Run the following in **Supabase Dashboard → SQL Editor** before deploying the updated frontend:

```sql
-- Add parent phones to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS father_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mother_phone TEXT;

-- Teacher notes (private, one per student)
CREATE TABLE IF NOT EXISTS student_notes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  note       TEXT DEFAULT '',
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage student notes" ON student_notes
  FOR ALL USING (public.is_teacher());

-- WhatsApp send log
CREATE TABLE IF NOT EXISTS whatsapp_log (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message_type TEXT DEFAULT 'report',
  preview      TEXT,
  sent_by      UUID REFERENCES profiles(id),
  sent_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE whatsapp_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage whatsapp log" ON whatsapp_log
  FOR ALL USING (public.is_teacher());
```

> [!IMPORTANT]
> This migration must be run **before** deploying the updated `students.html` and `students.js`. The new sections call these tables on load — if the tables don't exist, the detail view will throw errors.

---

## New JS Functions Reference

| Function | Purpose |
|---|---|
| `getInitials(name)` | Returns 2-letter initials for the avatar circle |
| `renderAttendanceCalendar(attendanceData)` | Draws the two-month calendar grid from attendance records |
| `renderTrendChart(marks)` | Draws the SVG bar chart from marks data |
| `loadTeacherNotes(studentId)` | Fetches and populates the notes textarea |
| `saveTeacherNotes(studentId)` | Upserts the note to `student_notes` |
| `loadWhatsAppLog(studentId)` | Fetches and renders the last 10 log entries |
| `logWhatsAppSend(studentId, preview)` | Inserts a row into `whatsapp_log` and refreshes the log panel |

---

## UI Layout Overview

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to students                        Delete student   │
├─────────────────────────────────────────────────────────────┤
│  [Avatar]  Name · Grade badge · Subject badge · username    │
│            📱 Student phone    👨‍👩‍👦 Parent phone  Edit contact │
├───────┬───────┬───────┬───────┬─────────────────────────────┤
│ Total │Present│Absent │  Late │ Attendance %                │
├───────────────────────┬─────────────────────────────────────┤
│  Batch memberships    │  Test scores                        │
│  (table)              │  [Trend chart]                      │
│                       │  (table with Rank column)           │
├───────────────────────┴─────────────────────────────────────┤
│  Attendance calendar (two-month grid)                       │
├─────────────────────────────────────────────────────────────┤
│  Teacher notes (private textarea + Save)                    │
├─────────────────────────────────────────────────────────────┤
│  WhatsApp history (reverse-chronological log)               │
├─────────────────────────────────────────────────────────────┤
│  AI Progress Report (✨ Generate + Copy + WhatsApp)         │
└─────────────────────────────────────────────────────────────┘
```
