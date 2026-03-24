# Teacher Grade Access Control

## Overview

Teachers can be assigned to a specific grade (`11th` or `12th`). A grade-assigned teacher has their access scoped to that grade's data across the entire dashboard — students, batches, materials, AI tools, and WhatsApp messaging. Teachers with no grade assigned (or `All Grades`) retain full unrestricted access.

---

## Managing Teacher Grades

### Page: `manage_teachers.html`
A standalone admin page accessible at `/manage_teachers`. Teacher-only (redirects unauthenticated or student users to login).

**Features:**
- Lists all teacher profiles with their current assigned grade
- **Assign Grade** button opens a modal to set `11th only`, `12th only`, or `All Grades (unrestricted)`
- Changes are saved immediately to the `profiles` table

**Key files:**
| File | Purpose |
|---|---|
| `manage_teachers.html` | Standalone page — full UI + inline script |
| `js/dashboard/teachers.js` | Module version (available for future tab use) |

---

## Where Grade Restriction Is Enforced

### 1. Database Layer (RLS)

Two new policies on the `files` table enforce grade restriction server-side:

**INSERT policy — `"Teachers can insert files"`**
```sql
WITH CHECK (
  public.is_teacher() AND (
    public.teacher_grade() IS NULL OR
    public.teacher_grade() = '' OR
    public.teacher_grade() = 'All Grades' OR
    grade = public.teacher_grade() OR
    grade IS NULL OR grade = ''
  )
)
```

**DELETE policy — `"Teachers can delete files"`**
Same conditions as INSERT.

**Helper function:**
```sql
CREATE OR REPLACE FUNCTION public.teacher_grade()
RETURNS text AS $$
  SELECT grade FROM public.profiles
  WHERE id = auth.uid() AND role = 'teacher';
$$ LANGUAGE sql SECURITY DEFINER;
```

This means even a direct API call cannot bypass the grade restriction when uploading or deleting files.

---

### 2. Frontend — Grade Constants (Single Source of Truth)

Grade values are defined once in `js/utils.js` and used everywhere:

```js
window._Grade11 = '11th';
window._Grade12 = '12th';
```

These are the **only** place grade strings are defined. All JS modules and dropdowns derive their values from these constants.

---

### 3. Frontend — Grade Dropdown Utilities (`js/utils.js`)

Two shared utility functions handle all grade dropdown behaviour across every tab:

#### `window.populateGradeSelect(selectId, includeAll = true)`
Fills a `<select>` element with grade options derived from `_Grade11` / `_Grade12`. Called immediately after a form component is loaded into the DOM.

```js
window.populateGradeSelect('fileGrade');          // All Grades / 11th / 12th
window.populateGradeSelect('batchGrade', false);  // -- Select Grade -- / 11th / 12th
```

All HTML grade `<select>` elements ship with **no hardcoded `<option>` tags** — they are always populated at runtime from the constants.

#### `window.lockGradeSelect(...elementIds)`
For a grade-restricted teacher, replaces each named `<select>` with a green badge pill. The select is hidden (not removed), its value is set to the teacher's grade, and a `<span class="badge badge--green">11th</span>` pill is injected into the parent element.

```js
window.lockGradeSelect('fileGrade');                   // single select
window.lockGradeSelect('doubtGrade', 'testGrade');     // multiple selects
```

A `data-grade-locked="1"` attribute is set on the element as a guard — calling `lockGradeSelect` twice on the same element is safe and produces no duplicate pill.

#### Call pattern in every module

```js
// After form HTML is injected into DOM:
window.populateGradeSelect('batchGrade', false);  // populate options
window.lockGradeSelect('batchGrade');             // restrict if teacher has grade
```

---

### 4. Frontend — Per-Module Data Filtering

Each module calls `window.auth.getUser()?.grade` at execution time (not module load time) to get the freshest grade value from localStorage.

| Module | What is filtered |
|---|---|
| `js/dashboard/students.js` | `loadStudents()` — student list capped to teacher's grade |
| `js/dashboard/batches.js` | `loadStudentPicker()` — add-to-batch picker capped to teacher's grade |
| `js/dashboard/messages.js` | `loadStudentPicker()` — WhatsApp compose student dropdown capped to teacher's grade |
| `js/dashboard/upload.js` | `loadMaterials()` — materials list capped to teacher's grade |

#### Grade form field locking per module

| Module | Select ID(s) | `populateGradeSelect` call | `lockGradeSelect` call |
|---|---|---|---|
| `upload.js` | `#fileGrade` | `populateGradeSelect('fileGrade')` | `lockGradeSelect('fileGrade')` |
| `batches.js` | `#batchGrade` | `populateGradeSelect('batchGrade', false)` | `lockGradeSelect('batchGrade')` |
| `ai-tools.js` | `#doubtGrade`, `#testGrade` | `populateGradeSelect('doubtGrade')` + `populateGradeSelect('testGrade', false)` | `lockGradeSelect('doubtGrade', 'testGrade')` |
| `announcement.js` | `#noticeGrade` | `populateGradeSelect('noticeGrade')` | `lockGradeSelect('noticeGrade')` |
| `test.js` | `#testGrade` | `populateGradeSelect('testGrade', false)` | `lockGradeSelect('testGrade')` |
| `students.js` | `#studentGrade` | `populateGradeSelect('studentGrade', false)` | `lockGradeSelect('studentGrade')` |
| `students.js` | `#studentGradeFilter` | `populateGradeSelect('studentGradeFilter')` | hidden via `style.display='none'` (filter, not form field) |

---

### 3. Profile Refresh on Dashboard Load

Because the teacher profile (including grade) is cached in `localStorage` at login time, a grade assignment via `manage_teachers.html` would not take effect until the teacher logs out and back in — unless the cache is refreshed.

**Fix:** `teacher_dashboard.html` calls `window.auth.refreshProfile()` on every page load. This re-fetches the teacher's profile from Supabase and overwrites the localStorage cache before any tab module runs.

```javascript
// teacher_dashboard.html
const user = window.auth.requireRole("teacher");
window.auth.refreshProfile(); // keeps grade restriction always current
```

**`auth.refreshProfile()` in `js/app.js`:**
```javascript
async refreshProfile() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const { data: profile } = await supabaseClient
        .from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;
    localStorage.setItem('mitesh_tutions_user', JSON.stringify({
        id: profile.id, username: profile.username, name: profile.name,
        role: profile.role, grade: profile.grade, subjects: profile.subjects
    }));
}
```

Tab modules call `window.auth.getUser()` **inside** their filter functions (not at module-level) so they always read the post-refresh value.

---

## Grade Values

| Value | Meaning |
|---|---|
| `null` or `""` | No restriction — full access |
| `"All Grades"` | No restriction — full access |
| `window._Grade11` (`"11th"`) | Restricted to 11th grade data only |
| `window._Grade12` (`"12th"`) | Restricted to 12th grade data only |

> **Important:** Never hardcode `'11th'` or `'12th'` as string literals in JS. Always use `_Grade11` and `_Grade12` from `js/utils.js`. If the grade naming convention ever changes, update only those two constants and the entire system updates automatically.

---

## Creating a New Teacher Account

Teacher accounts are created directly in Supabase Auth. After creation, the profile trigger auto-inserts a row in `profiles`. Two fields must be correct:

| Field | Required value |
|---|---|
| `role` | `teacher` |
| `username` | Short name only — **not** the full email. Login uses `username + @msgt.internal` to construct the email. |

Use `manage_teachers.html` to assign the grade after account creation.
