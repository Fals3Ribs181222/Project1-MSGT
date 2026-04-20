# Authentication and Roles

The application utilizes Supabase Authentication for secure user management.

## User Lifecycle
1.  **Sign Up:** Users can sign up via `login.html`.
2.  **Profile Creation:** A PostgreSQL database trigger (`on_auth_user_created`) automatically intercepts new user creation on `auth.users` and creates a corresponding record in the `public.profiles` table. This populates necessary initial data like name, username (derived from email if not provided), and sets a default role.

## Roles
The system operates on a Role-Based Access Control (RBAC) model with three roles:

### 1. Student (Default)
This is the default role assigned to any new user upon signup.
-   **Capabilities:**
    -   View their profile.
    -   View public announcements, files, tests, and marks.
    -   View schedules for batches they are enrolled in.
    -   View their own attendance.
-   **Access Level:** Primarily read-only access to system data, restricted to their specific context.
-   **Portal lock:** If the `student_portal_enabled` feature flag is `false`, students see an "unavailable" message on login instead of their dashboard.

### 2. Teacher
This role must be designated explicitly (manually in the database or via the admin dashboard).
-   **Capabilities:**
    -   Full management access over `profiles`.
    -   Create and manage `announcements`, `files`, `tests`, and `marks`.
    -   Manage `batches`, enroll students into batches (`batch_students`).
    -   Schedule regular and extra `classes`.
    -   Record and manage `attendance`.
    -   Manage `batch_transfers` (cross-batch attendance).
    -   Upload to storage buckets (`materials`).
-   **Access Level:** Administrative over teaching operations, optionally scoped to a specific grade (see below).
-   **Feature flag gating:** Each panel on the teacher dashboard can be hidden by the admin by toggling the corresponding flag in `feature_flags`. Flags are read at page load via `window.loadFeatureFlags()`.

### 3. Admin (Developer)
This role is assigned manually to the developer/owner account directly in the database.
-   **Capabilities:**
    -   Redirected to `admin_dashboard.html` on login.
    -   Toggle any feature flag on/off (stored in `feature_flags` table).
    -   Promote or demote any user's role.
    -   Delete attendance records, marks, or student accounts in bulk.
    -   Browse and delete individual rows from any whitelisted table.
-   **Access Level:** Full system control via the `admin-api` edge function (service role key, bypasses RLS).
-   **Security:** All privileged operations are routed through the `admin-api` Supabase edge function, which validates the caller's `admin` role server-side before executing. The service role key never reaches the browser.

### Teacher Grade Assignment
Teachers can be assigned to a specific grade (`11th` or `12th`) via the **Manage Teachers** page (`/manage_teachers`). A grade-assigned teacher's access is automatically scoped across students, batches, materials, AI tools, and messaging — they cannot see or modify data belonging to other grades.

Teachers with no grade or `All Grades` retain full unrestricted access.

See [19-Teacher-Grade-Access-Control.md](./19-Teacher-Grade-Access-Control.md) for full implementation details.

## Security Implementation (RLS)
The database structure heavily relies on PostgreSQL Row Level Security (RLS). Policies restrict access based on `auth.uid()` and the user's role in the `profiles` table. Helper functions used in policies (all `SECURITY DEFINER` to avoid recursive RLS on `profiles`):

- **`public.is_teacher()`** — returns `true` if the current user has role `teacher`. Used in all teacher-only write policies.
- **`public.get_my_grade()`** — returns the current user's `grade` value from `profiles`. Marked `STABLE` so PostgreSQL caches the result once per query. Used in all grade-scoped SELECT policies.
- **`public.get_my_role()`** — returns the current user's `role` value from `profiles`. Marked `STABLE`. Used in grade-scoped SELECT policies.

Grade-scoped SELECT policies are enforced at the database level across all major tables — see [21-Security-Improvements.md](./21-Security-Improvements.md#grade-scoped-rls) for full details.

### Other RLS Notes
Foreign keys on attribution columns (`posted_by`, `uploaded_by`, `scheduled_by`, `created_by`, `marked_by`) use `ON DELETE SET NULL` so that deleting a user account does not orphan or block related rows.

The `auth.refreshProfile()` frontend method re-syncs the localStorage user cache from the database on every dashboard load, ensuring grade restrictions take effect without requiring a re-login.

See [21-Security-Improvements.md](./21-Security-Improvements.md) for full details on the RLS hardening history.
