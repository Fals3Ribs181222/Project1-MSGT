# Admin Dashboard

## Overview
The admin dashboard (`admin_dashboard.html`) is the developer control panel for TuteFlow. It is only accessible to accounts with `role = 'admin'` in the `profiles` table. It is not linked from any navigation element — access is by direct URL only (`/admin_dashboard`).

On login, the `redirect()` function in `js/app.js` detects the `admin` role and routes to `admin_dashboard.html` automatically.

---

## Architecture

The admin dashboard follows the same tab-based SPA pattern as `teacher_dashboard.html`:
- Pill buttons on the home panel call `loadTab(targetId)` via `js/dashboard/router.js`
- HTML components are lazily fetched from `components/tabs/admin-*.html`
- Corresponding ES6 modules are dynamically imported from `js/dashboard/admin-*.js`

All data operations go through the `admin-api` Supabase edge function (see below). No sensitive operations use the anon key.

---

## Panels

| Panel | Pill | File | Module |
|-------|------|------|--------|
| Overview | 📊 Overview | `components/tabs/admin-overview.html` | `js/dashboard/admin-overview.js` |
| Feature Flags | 🔧 Feature Flags | `components/tabs/admin-flags.html` | `js/dashboard/admin-flags.js` |
| Users | 👥 Users | `components/tabs/admin-users.html` | `js/dashboard/admin-users.js` |
| Bulk Ops | 🗑️ Bulk Ops | `components/tabs/admin-bulk.html` | `js/dashboard/admin-bulk.js` |
| Table Browser | 🗄️ Table Browser | `components/tabs/admin-browse.html` | `js/dashboard/admin-browse.js` |

### Overview
Displays system-wide stats fetched via `get_stats`:
- Total students, Grade 11 count, Grade 12 count
- Total tests created
- Overall attendance rate (present / total records)
- WhatsApp messages sent (count from `whatsapp_log`)

### Feature Flags
Reads all rows from the `feature_flags` table via `get_flags`. Each flag is displayed as a toggle row (label, description, Enabled/Disabled button). Clicking the toggle calls `update_flag` to persist the change. Changes take effect on the next teacher or student dashboard load.

**Available flags:**

| Key | Controls |
|-----|---------|
| `students_enabled` | Students panel pill on teacher dashboard |
| `attendance_enabled` | Attendance panel pill |
| `materials_enabled` | Materials panel pill |
| `tests_enabled` | Tests panel pill |
| `announcements_enabled` | Announcements panel pill |
| `batches_enabled` | Batches panel pill |
| `schedule_enabled` | Schedule panel pill |
| `messages_enabled` | Messages panel pill |
| `ai_tools_enabled` | AI Tools panel pill |
| `leaderboard_enabled` | Leaderboard panel pill |
| `student_portal_enabled` | Whether students can access their dashboard at all |

### Users
Lists all profiles via `get_all_users`. Each row shows Name, Username, Role, Grade, and a role selector. Changing a role and clicking Save triggers a `showConfirmModal` confirmation, then calls `update_user_role`.

### Bulk Ops
Four destructive operations, each requiring confirmation via `showConfirmModal`:

1. **Delete attendance for a batch** — selects a batch from a dropdown, calls `bulk_delete_attendance { batch_id }`
2. **Clear marks for a test** — selects a test from a dropdown, calls `bulk_delete_marks { test_id }`
3. **Delete a student account** — selects a student, calls `delete_user { user_id }` which cascades to `auth.users` and all related data
4. **Wipe all seed data** — no input, calls `wipe_seed_data`; requires two separate click confirmations with a 5-second cooldown between them

### Table Browser
Dropdown of 15 whitelisted tables. "Load" fetches 50 rows at a time via `browse_table { table, limit, offset }`. Columns are derived dynamically from the first row's keys. Each row has a Delete button that calls `delete_row { table, id }` with confirmation. Previous/Next buttons handle pagination via offset.

**Whitelisted tables:** `profiles`, `tests`, `marks`, `attendance`, `classes`, `batches`, `batch_students`, `announcements`, `files`, `whatsapp_log`, `board_results`, `testimonials`, `material_chunks`, `rank_history`, `feature_flags`

---

## Edge Function: `admin-api`

**Location:** `supabase/functions/admin-api/index.ts`

**Auth pattern:** The browser sends `Authorization: Bearer <session.access_token>` plus `apikey: <anon_key>`. The function extracts the Bearer token and calls `adminClient.auth.getUser(token)` (service-role client) to verify the JWT and resolve the caller's user ID. It then looks up `profiles.role` for that user and rejects (403) if the role is not `admin` (or not `teacher`/`admin` for teacher-accessible actions). All subsequent DB operations use the same service-role client, bypassing RLS. The function must be deployed with `--no-verify-jwt` since it handles JWT verification internally.

**Supported actions:**

| Action | Payload | Description |
|--------|---------|-------------|
| `get_stats` | — | Aggregated system counts |
| `get_all_users` | — | All profiles ordered by `created_at DESC` |
| `update_user_role` | `{ user_id, new_role }` | Updates `profiles.role` |
| `get_flags` | — | All rows from `feature_flags` |
| `update_flag` | `{ key, enabled }` | Sets `feature_flags.enabled` for a key |
| `bulk_delete_attendance` | `{ batch_id }` | Deletes all attendance rows for a batch |
| `bulk_delete_marks` | `{ test_id }` | Deletes all marks rows for a test |
| `delete_user` | `{ user_id }` | Calls `auth.admin.deleteUser()` — cascades to profiles and all data |
| `delete_student` | `{ user_id }` | Teacher- or admin-callable. Verifies target is a student, then calls `auth.admin.deleteUser()`. Used by the teacher dashboard student delete flow. |
| `wipe_seed_data` | — | Deletes all student profiles (and their data) via `auth.admin.deleteUser()` |
| `browse_table` | `{ table, limit, offset }` | Returns paginated rows from a whitelisted table |
| `delete_row` | `{ table, id }` | Deletes a single row by id from a whitelisted table |

---

## Database: `feature_flags` Table

```sql
CREATE TABLE feature_flags (
  key         TEXT PRIMARY KEY,
  enabled     BOOLEAN DEFAULT true NOT NULL,
  label       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS:** Any authenticated user can `SELECT` (used by `loadFeatureFlags()` on teacher/student dashboards). All mutations go through the `admin-api` edge function using the service role key.

---

## `loadFeatureFlags()` — `js/app.js`

```js
async function loadFeatureFlags() {
    const { data, error } = await supabaseClient.from('feature_flags').select('key, enabled');
    if (error || !data) return {};
    return Object.fromEntries(data.map(f => [f.key, f.enabled]));
}
window.loadFeatureFlags = loadFeatureFlags;
```

Called at page load in `teacher_dashboard.html` and `student_dashboard.html`. Returns a plain object mapping flag keys to booleans. The teacher dashboard uses it to hide disabled panel pills; the student dashboard uses it to show the portal lock message.

---

## Setting Up the Admin Account

1. In Supabase Studio → Table Editor → `profiles` table
2. Find the developer's row
3. Set `role` to `admin`
4. Log out and log back in — you will be redirected to `/admin_dashboard`
