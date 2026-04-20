# Security Improvements

This document outlines security hardening measures implemented in TuteFlow to prevent common web vulnerabilities.

## XSS (Cross-Site Scripting) Prevention

### Overview
All user-controlled data interpolated into `innerHTML` is now sanitized. This prevents stored XSS attacks where malicious code in student names, test titles, or testimonial text could execute in other users' browsers.

### The Vulnerability
Before sanitization, code like this was vulnerable:

```javascript
// UNSAFE — if student.name contains <img src=x onerror="alert('hacked')">
tbody.innerHTML = `<td>${student.name}</td>`;
```

If an attacker set a student's name to `<img src=x onerror="alert('xss')">`, the HTML would render and execute the JavaScript.

### The Fix

#### 1. `window.esc()` Helper
For plain-text fields (names, titles, grades, usernames), use `window.esc()`:

```javascript
// SAFE — < > & " are converted to &lt; &gt; &amp; &quot;
tbody.innerHTML = `<td>${window.esc(student.name)}</td>`;
```

**What it does:**
- Creates a temporary `<div>`, sets `textContent` to the user string (auto-escaping dangerous chars)
- Returns `innerHTML`, which is the HTML-safe version
- Example: `<img src=x...>` becomes `&lt;img src=x...&gt;`

**Use when:**
- Displaying names, usernames, grades, subjects
- Displaying test titles, announcement titles
- Displaying any scalar text field from the database

#### 2. `window.safeUrl()` Helper
For URL attributes (href, src), use `window.safeUrl()`:

```javascript
// SAFE — blocks javascript: and data:text/html URIs
<a href="${window.safeUrl(file.file_url)}">Download</a>
```

**What it does:**
- Returns `'#'` if the URL starts with `javascript:` or `data:text/html`
- Otherwise returns the original URL
- Prevents `javascript:void(0)` and data URI attacks

**Use when:**
- Building href attributes for `<a>` tags
- Building src attributes for `<img>`, `<script>`, `<iframe>`

#### 3. `DOMPurify.sanitize()` for Rich Content
For formatted text (testimonials, WhatsApp message previews, admin flag descriptions), use `DOMPurify.sanitize()`:

```javascript
// SAFE — strips dangerous HTML tags like <script>, <onerror>, etc.
<div>${DOMPurify.sanitize(t.testimonial_text)}</div>
```

**What it does:**
- Removes HTML tags that could contain scripts: `<script>`, `<iframe>`, `<object>`
- Removes dangerous attributes: `onerror`, `onload`, `onclick`, etc.
- Allows safe formatting: `<b>`, `<i>`, `<p>`, `<a href="...">` (after URL validation)
- Returns safe HTML that can be inserted into `innerHTML`

**Use when:**
- Displaying user-authored long-form text that may contain markdown or basic HTML
- Message previews, testimonials, admin descriptions

### Coverage

All 12+ dashboard modules have been updated:

| Module | Fields Escaped |
|--------|----------------|
| `announcement.js` | title, posted_by |
| `test.js` | title, teacher name |
| `material.js` | title, uploaded_by, file_url (safeUrl) |
| `attendance.js` | class title, batch name, student names (4 places) |
| `batches.js` | batch name, member names & profiles |
| `students.js` | student names, test titles, marks data, WhatsApp preview (DOMPurify) |
| `messages.js` | recipient name, recipient type, message preview (DOMPurify) |
| `testimonials.js` | student name, testimonial text (DOMPurify), media URL (safeUrl) |
| `leaderboard.js` | student name |
| `board_results.js` | student name |
| `teachers.js` | name, username, grade, subjects |
| `schedule.js` | batch info, student names in modals |
| `admin-users.js` | all profile fields (name, username, role, grade) |
| `admin-flags.js` | flag label, flag description (DOMPurify) |

### Testing XSS Prevention

To verify XSS is blocked:

1. **Direct Database Injection** (requires DB access):
   - Set a student name to `<img src=x onerror="alert('xss')">`
   - Load the students list — no alert should fire
   - Check browser console for no errors

2. **Verify in Code**:
   - Grep for unescaped user data in `innerHTML`:
     ```bash
     grep -n "innerHTML.*\${" js/dashboard/*.js | grep -v "window.esc\|safeUrl\|DOMPurify"
     ```
   - Should return only hardcoded UI structure (no user data interpolation)

3. **Manual Testing**:
   - Create a student with name containing `<script>alert(1)</script>`
   - No console errors or alerts
   - Name displays as literal text in the table

---

## Session Management & Auth Security

### Session Validation
`auth.requireRole(role)` now verifies the session is still valid **server-side** before allowing access. This prevents "ghost user" scenarios where localStorage is stale.

See [02-Authentication-and-Roles.md](./02-Authentication-and-Roles.md) for details.

### Auth State Subscription
On app init, the system subscribes to Supabase session events. If the session expires or the user signs out remotely, the app automatically redirects to login without showing stale content.

---

## .gitignore Updates

Added `.tmp.driveupload/` to prevent temporary file uploads from being committed to version control.

---

## RLS Gap Fix — `classes`, `batch_transfers`, `whatsapp_incoming`

Three tables were found to have Row-Level Security disabled in production despite being declared as RLS-enabled in the schema:

| Table | Issue | Fix |
|---|---|---|
| `classes` | RLS was not enabled — any authenticated user could insert/update/delete class schedules | `ALTER TABLE classes ENABLE ROW LEVEL SECURITY` applied |
| `batch_transfers` | RLS was not enabled — any authenticated user could insert/update/delete transfer records | `ALTER TABLE batch_transfers ENABLE ROW LEVEL SECURITY` applied |
| `whatsapp_incoming` | Table existed (via migration) with no RLS and no policies — inbound message data was world-readable | RLS enabled + teacher-only SELECT + service-role INSERT policies added |

These were corrected via migration `enable_rls_classes_batch_transfers_whatsapp_incoming` applied directly to the production database. The schema file (`supabase_schema.sql`) already declared the correct policies — the gap was that the `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements were missing for `classes` and `batch_transfers` in certain execution paths, and `whatsapp_incoming` lacked any policies entirely.

---

## Defense-in-Depth

Security is implemented at multiple layers:

1. **Database Layer**: Row-Level Security (RLS) policies restrict access based on user roles.
2. **Frontend Layer**: XSS sanitization prevents script injection.
3. **API Layer**: Edge functions validate the caller's role server-side.
4. **Transport Layer**: HTTPS (via Vercel) prevents man-in-the-middle attacks.

Even if one layer is bypassed, others remain effective.

---

## Grade-Scoped RLS

### The Problem
All SELECT policies previously used `USING (true)`, meaning any authenticated user (or even unauthenticated caller) could read all rows from all tables. Grade filtering only existed at the UI/query level — a direct Supabase API call without a grade filter would return all data regardless of the teacher's assigned grade.

### The Fix — Migration `grade_scoped_rls`
Applied via `supabase/migrations/20260418000000_grade_scoped_rls.sql`.

Two new `SECURITY DEFINER` helper functions were added (both `STABLE` for per-query caching):
- `public.get_my_grade()` — returns the calling user's grade from `profiles`
- `public.get_my_role()` — returns the calling user's role from `profiles`

The following tables had their permissive SELECT policies replaced with grade-scoped policies:

| Table | Policy name |
|-------|-------------|
| `batches` | "Grade-scoped batch visibility" |
| `tests` | "Grade-scoped test visibility" |
| `files` | "Grade-scoped file visibility" |
| `announcements` | "Grade-scoped announcement visibility" |
| `profiles` | "Grade-scoped profile visibility" |
| `batch_students` | "Grade-scoped batch_students visibility" |
| `classes` | "Grade-scoped class visibility" |
| `attendance` | "Grade-scoped attendance visibility" |

Access rules:
- **Teacher with specific grade** → rows matching their grade only
- **Teacher with `NULL` grade or `'All Grades'`** → all rows (bypass)
- **Student** → rows matching their grade; attendance further restricted to `student_id = auth.uid()`
- **Unauthenticated** → blocked entirely
- `files`/`announcements` with `NULL` grade → visible to all authenticated users (general/broadcast)

### Critical: profiles FOR ALL Split
The old `"Teachers can manage all profiles" FOR ALL USING (is_teacher())` created an implicit SELECT policy that `OR`-ed with any other SELECT policy in PostgreSQL's permissive model — meaning it would let any teacher bypass grade-scoped reads. It was dropped and replaced with three explicit `FOR INSERT / FOR UPDATE / FOR DELETE` policies, leaving the new `FOR SELECT` as the sole read gate.

### student_rankings View
`ALTER VIEW public.student_rankings SET (security_invoker = true)` was applied so the view runs under the calling user's permissions rather than the definer's, automatically inheriting RLS from the underlying `profiles` and `tests` tables.

### Known Remaining Gaps (future hardening)
- `marks` — still `USING (true)`, students can read all marks via direct API
- `batch_transfers`, `rank_history` — still open
- Subject-based scoping not yet implemented at DB level

---

## Future Improvements

- [ ] Implement Content Security Policy (CSP) headers to block inline scripts
- [ ] Add server-side request validation & rate limiting on edge functions
- [ ] Audit file upload validation (media_url in testimonials, file_url in materials)
- [ ] Review and harden admin-api edge function permissions
- [ ] Grade-scope `marks`, `batch_transfers`, `rank_history` tables
