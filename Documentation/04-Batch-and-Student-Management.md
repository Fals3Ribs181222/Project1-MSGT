# Batch and Student Management

The system organizes students into instructional groups called "Batches".

## Batches Management
Batches help teachers structure their curriculum and schedules for specific groups of students.

1.  **Creation:** Teachers can create new batches, specifying the name, subject, and grade level.
2.  **Enrollment:** Students are enrolled into batches. This relationship is managed in the `batch_students` junction table, linking `auth.profiles` to `batches`.
3.  **Cross-Batch Transfers:** The system supports a "Cross-Batch Attendance" feature (`batch_transfers`). This allows teachers to mark students present for classes outside their regularly assigned batch, facilitating guest attendance or make-up classes. This includes tracking the temporary transfer with optional end dates and reasons.

## Student Management
Teachers have administrative capabilities over student records:
1.  **Profile Oversight:** Viewing comprehensive details of student profiles via the `profiles` table, scoped to the teacher's assigned grade.
2.  **Assignment:** Managing individual student assignments to relevant batches or initiating cross-batch transfers.

### Deleting Students
Teachers can delete a student from the student detail view. The delete button calls the `admin-api` edge function with `action: delete_student`, which:
1. Verifies the target user has `role = 'student'` (refuses to delete teachers/admins)
2. Calls `auth.admin.deleteUser()` using the service role key — this removes the Supabase Auth user and cascades to the `profiles` row and all related data

> **Why not a direct table delete?** RLS prevents teachers from deleting rows in `profiles` directly. A direct `DELETE` returns "success" but removes nothing, so the delete is routed through the edge function which uses the service role key to bypass RLS.

### Grade-Scoped Access
If a teacher has been assigned a specific grade (`11th` or `12th`) via the Manage Teachers page:
- The **batch list** (`batches.js`) queries only batches matching the teacher's grade — the grade filter is passed as a server-side query parameter, not filtered client-side.
- The **batch list** displays batches sorted **alphabetically by name**.
- The **student list** (`students.js`) is filtered to show only students of that grade.
- The **add-to-batch student picker** (`batches.js`) only shows students of that grade.
- The **batch creation form** has the grade dropdown locked to the teacher's assigned grade.

This grade scoping is also enforced at the **database level via RLS** — even a direct API call without a grade filter will only return batches for the teacher's assigned grade. See [21-Security-Improvements.md](./21-Security-Improvements.md#grade-scoped-rls).

Teachers with no grade or `All Grades` see all students and batches regardless of grade. See [20-Teacher-Grade-Access-Control.md](./20-Teacher-Grade-Access-Control.md).
