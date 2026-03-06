# Dashboards and User Interface

The application features role-specific dashboards to provide relevant tools and information to teachers and students.

## Teacher Dashboard (`teacher_dashboard.html`)
The teacher dashboard serves as the administrative control center.

### Navigation and Structure
-   It uses a tabbed navigation system to organize various management modules.
-   A main landing area displays a welcome message. As teachers navigate into specific management tabs, a "← Back to Home" button allows them to return to the main overview.
-   **Modular Architecture & Dynamic Routing:** The dashboard uses `js/dashboard/router.js` to dynamically load HTML components from `components/tabs/` and their corresponding ES6 JavaScript modules from `js/dashboard/`. This lazy-loading approach keeps the main HTML file clean and improves maintainability.

### Key Functional Panels
-   **Dashboard Home:** Overview of system status.
-   **Student Panel:** For adding new students, assigning them to batches, and viewing student profiles.
-   **Batch Management:** Creating and organizing instructional batches.
-   **Class Scheduling:** Setting up regular weekly schedules or one-off extra classes.
-   **Attendance:** Marking attendance for regular classes and managing guest students (cross-batch).
-   **Academics:** Overseeing tests and entering marks.
-   **Materials:** Uploading and sharing course files.
-   **Communication:** Posting announcements.

## Student Dashboard (`student_dashboard.html`)
The student dashboard focuses on consumption of information relevant to the enrolled student.

### Key Features
-   **Profile Information:** Displays the student's personal details, assigned batches, and subjects.
-   **Schedule View:** Shows upcoming classes mapped to their enrolled batches.
-   **Announcements:** A feed of notices from teachers.
-   **Materials Access:** A section to download files uploaded for their grade or subject.
-   **Academic Progress:** View test marks and personal attendance records.
-   The interface is designed to be streamlined, presenting only the data the student is authorized to view based on RLS policies.
