# Batch and Student Management

The system organizes students into instructional groups called "Batches".

## Batches Management
Batches help teachers structure their curriculum and schedules for specific groups of students.

1.  **Creation:** Teachers can create new batches, specifying the name, subject, and grade level.
2.  **Enrollment:** Students are enrolled into batches. This relationship is managed in the `batch_students` junction table, linking `auth.profiles` to `batches`.
3.  **Cross-Batch Transfers:** The system supports a "Cross-Batch Attendance" feature (`batch_transfers`). This allows teachers to mark students present for classes outside their regularly assigned batch, facilitating guest attendance or make-up classes. This includes tracking the temporary transfer with optional end dates and reasons.

## Student Management
Teachers have administrative capabilities over student records:
1.  **Profile Oversight:** Viewing comprehensive details of all student profiles securely via the `profiles` table. This overrides standard RLS visibility limits using the `is_teacher()` function.
2.  **Assignment:** Managing individual student assignments to relevant batches or initiating cross-batch transfers.

### Grade-Scoped Access
If a teacher has been assigned a specific grade (`11th` or `12th`) via the Manage Teachers page:
- The **student list** (`students.js`) is filtered to show only students of that grade.
- The **add-to-batch student picker** (`batches.js`) only shows students of that grade.
- The **batch creation form** has the grade dropdown locked to the teacher's assigned grade.

Teachers with no grade or `All Grades` see all students and batches regardless of grade. See [19-Teacher-Grade-Access-Control.md](./19-Teacher-Grade-Access-Control.md).
