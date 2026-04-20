# Standalone Pages

Standalone pages live at the project root and operate outside the tab-based dashboard architecture. They have their own full HTML layout, inline or dedicated JS, and access Supabase directly via `window.api`.

---

## `manage_marks.html` — `/manage_marks`

**Purpose:** Enter and save student marks for a specific test. Linked from the Tests tab — a "Manage Marks" button passes `?testId=<id>` as a query parameter.

**Access:** Teacher-only. The page reads the session via `window.auth.requireRole('teacher')` and redirects unauthenticated or student users to login.

**Key behaviour:**
- Reads `?testId` from the URL on load and fetches the test record (title, subject, grade, max marks)
- Loads all students enrolled in that test's batch and renders one row per student
- Each row has a marks input; submitting saves to the `marks` table
- Existing marks are pre-filled if they already exist

**Key files:**
| File | Purpose |
|---|---|
| `manage_marks.html` | Full page — layout, form, inline JS |
| `js/manage_marks.js` | Marks load/save logic |

---

## `manage-board-results.html` — `/manage-board-results`

**Purpose:** Add or delete ISC board exam results that appear on the public `/results` page.

**Access:** No authentication required — access by direct URL only (not linked from any dashboard nav). Intended for teacher/admin use.

**Key behaviour:**
- Displays a form to add a result (student name, subject, marks obtained, max marks, passing year)
- Lists all existing results in a table with a Delete button per row
- Reads/writes the `board_results` table via `window.api`

**Key files:**
| File | Purpose |
|---|---|
| `manage-board-results.html` | Full page — layout, form, inline script |

---

## `manage-testimonials.html` — `/manage-testimonials`

**Purpose:** Add or delete student testimonials shown on the public landing page (`index.html`).

**Access:** No authentication required — access by direct URL only.

**Key behaviour:**
- Form accepts student name, quote, and optional photo (uploaded to Supabase Storage)
- Lists existing testimonials with a Delete button
- Reads/writes the `testimonials` table

**Key files:**
| File | Purpose |
|---|---|
| `manage-testimonials.html` | Full page — layout, form, inline script |

---

## `results.html` — `/results`

**Purpose:** Public page displaying ISC board exam results for past students.

**Access:** Fully public — no login required.

**Key behaviour:**
- Fetches all rows from `board_results` and renders them in a styled table grouped by year
- No write operations

**Key files:**
| File | Purpose |
|---|---|
| `results.html` | Public results page |
| `js/results.js` | Data fetch and render logic |

---

## `testimonials.html` — `/testimonials`

**Purpose:** Public page listing all student testimonials (overflow page from the landing page).

**Access:** Fully public — no login required.

**Key behaviour:**
- Fetches all rows from `testimonials` and renders them as cards
- No write operations

**Key files:**
| File | Purpose |
|---|---|
| `testimonials.html` | Public testimonials page |

---

---

## `manage_teachers.html` — `/manage_teachers`

**Purpose:** Assign grade restrictions to teacher accounts.

**Access:** Teacher-only. The page reads the session via `window.auth.requireRole('teacher')` and redirects unauthenticated or student users to login.

**Key behaviour:**
- Lists all teacher profiles with their current assigned grade
- **Assign Grade** button opens a modal to set `11th only`, `12th only`, or `All Grades (unrestricted)`
- Changes are saved immediately to the `profiles` table via `window.api.patch()`

**Key files:**
| File | Purpose |
|---|---|
| `manage_teachers.html` | Full page — layout, grade assignment modal, inline script |
| `js/dashboard/teachers.js` | Shared module — teacher list and grade assignment logic (also available as a dashboard tab) |

See [20-Teacher-Grade-Access-Control.md](./20-Teacher-Grade-Access-Control.md) for full grade restriction implementation details.

---

## Summary

| Page | Auth Required | Writes To | Linked From |
|---|---|---|---|
| `manage_marks` | Teacher | `marks` | Tests tab (Manage Marks button) |
| `manage-board-results` | None (URL-only) | `board_results` | Not linked |
| `manage-testimonials` | None (URL-only) | `testimonials` | Not linked |
| `manage_teachers` | Teacher | `profiles` | Not linked |
| `results` | None | — | Landing page, navbar |
| `testimonials` | None | — | Landing page |
