# Dashboards and User Interface

The application features role-specific dashboards to provide relevant tools and information to teachers, students, and the admin.

## Teacher Dashboard (`teacher_dashboard.html`)
The teacher dashboard serves as the administrative control center for day-to-day teaching operations.

### Navigation and Structure
-   Uses a **left sidebar** (`aside.dash-sidebar`) for persistent navigation on desktop. Each sidebar item calls `window.loadTab(targetId)` and the active item is highlighted with `.dash-sidebar__item--active`, synced by `router.js` on every tab change. The sidebar also contains the logout button and the teacher's profile avatar/name.
-   On **mobile (≤768px)** the sidebar slides in from the left via a hamburger button (`.dash-menu-toggle`). A backdrop overlay closes it on tap. The sidebar closes automatically after navigating to a tab.
-   The top navbar is minimal: brand logo (`logo.png`, 52px) with "Mitesh Sir's Study Circle" text flush-left (`.navbar__logo` uses `display:flex; align-items:center; gap:0.6rem`), plain nav links (Home, Testimonials, Results, Dashboard) flush-right with no pill container. Logout is handled by the sidebar only.
-   The sidebar top (`dash-sidebar__top`) displays the same `logo.png` at 56px instead of the previous "📚 TuteFlow" text brand.
-   `logo.png` is also set as the browser tab favicon (`<link rel="icon">`) on all pages.
-   **Modular Architecture & Dynamic Routing:** The dashboard uses `js/dashboard/router.js` to dynamically load HTML components from `components/tabs/` and their corresponding ES6 JavaScript modules from `js/dashboard/`.
-   **Standardized UI Implementation:** All modules utilize unified global helpers (`window.tableLoading`, `window.showStatus`, `window.loadComponent`) to ensure a consistent user experience during data operations and component transitions.
-   **Feature Flag Gating:** On load, `window.loadFeatureFlags()` fetches the `feature_flags` table and hides any disabled sidebar items. This allows the admin to control which panels are accessible without redeploying.
-   **Back to Overview button** is only shown on mobile (≤768px) when inside a sub-tab. On desktop the sidebar provides navigation back to home.

### Home Panel — Live Dashboard Widgets
The landing panel (`#panel-home`) displays four live-data widgets. Layout: Today's Classes spans full width (top row); Tests, Quick Announcement, and Leaderboard sit in a 3-column bottom row (`grid-template-columns: 1fr 1fr 0.6fr`).

| Widget | Data Source |
|--------|-------------|
| **Today's Classes** | `classes` table joined with `batches` — filtered by `class_date = today` or `day_of_week = today` |
| **Tests** | `tests` table — 1 most recent past + 2 upcoming, ordered by date |
| **Quick Announcement** | Inline form that posts directly to `announcements` table |
| **Mini Leaderboard** | `student_rankings` top 3, filtered by teacher's grade |

Widget data is loaded by `loadDashboardWidgets()` (inline script) on `DOMContentLoaded`. The home panel uses `display: flex` only when it has `.tabs__panel--active` to avoid conflicting with the router's `display: none` hide mechanism.

### Key Functional Panels
-   **Students:** View/search students, add new students (pill toggle: View Students / + Add Student), and open individual student detail views.
-   **Batch Management:** Creating and organizing instructional batches.
-   **Class Scheduling:** Setting up regular weekly schedules or one-off extra classes.
-   **Attendance:** Marking attendance for regular classes and managing guest students (cross-batch).
-   **Tests:** Scheduling tests and entering marks.
-   **Materials:** Uploading and sharing course files.
-   **Announcements:** Posting notices to students.
-   **Messages:** WhatsApp broadcast messaging.
-   **AI Tools:** RAG-powered doubt solver and ISC test generator.
-   **Leaderboard:** Student rankings by test performance.

### Subject Selector UI
All forms that include a subject field (Add Student, Upload Material, Schedule Test, Create Batch) use a **pill-based subject selector** instead of checkboxes. Pills are styled to match the `pill-toggle` component — same container shape and sizing — and fill with `--secondary` (theme green) when selected. When all subjects are selected, the container background also turns green using a CSS `:has()` selector.

## Student Dashboard (`student_dashboard.html`)
The student dashboard focuses on consumption of information relevant to the enrolled student.

### Key Features
-   **Profile Information:** Displays the student's personal details, assigned batches, and subjects.
-   **Schedule View:** Shows upcoming classes mapped to their enrolled batches.
-   **Announcements:** A feed of notices from teachers.
-   **Materials Access:** A section to download files uploaded for their grade or subject.
-   **Academic Progress:** View test marks and personal attendance records.
-   **Portal Lock:** If the `student_portal_enabled` feature flag is disabled by the admin, the entire dashboard is replaced with an "unavailable" message — no data is loaded.
-   The interface is designed to be streamlined, presenting only the data the student is authorized to view based on RLS policies.

## Admin Dashboard (`admin_dashboard.html`)
The admin dashboard is the developer control panel. It is accessible only to accounts with `role = 'admin'` and is not linked from any navigation element — accessed directly by URL.

### Key Panels
-   **Overview (📊):** System-wide stats — total students by grade, tests created, attendance rate, WhatsApp messages sent.
-   **Feature Flags (🔧):** Toggle any feature on/off. Changes persist in the `feature_flags` table and take effect on the next teacher/student dashboard load.
-   **Users (👥):** View all profiles, change any user's role (teacher/student/admin) with confirmation.
-   **Bulk Ops (🗑️):** Destructive operations — delete all attendance for a batch, clear marks for a test, delete a student account (cascades all data), wipe all seed/test data.
-   **Table Browser (🗄️):** Browse rows from any whitelisted table (15 tables), paginate, and delete individual rows.

### Security
All admin operations call the `admin-api` Supabase edge function with the user's session token. The function re-validates that the caller is `admin` on every request before using the service role client to execute operations. The service role key is never exposed to the browser.
