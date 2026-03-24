# System Overview

## Introduction
The Mitesh Sir's Group Tuitions project is a web-based educational management system tailored for group tuitions. It provides a comprehensive platform for both teachers and students to interact, manage schedules, share materials, track attendance, and monitor academic progress.

## Technology Stack
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla JS)
- **Backend/Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage (for Materials and Testimonials)

## Architecture
The application uses a serverless architecture where the frontend interacts directly with the Supabase backend via the Supabase JavaScript Client. It relies heavily on Row Level Security (RLS) in PostgreSQL to securely manage data access based on user roles (teacher, student, admin). Privileged developer operations bypass RLS via a server-side edge function (`admin-api`) that holds the service role key.

### Key Files and Directories
- `index.html`: The main landing page showcasing the tuition classes, testimonials, and features.
- `login.html`: The authentication portal for users to sign up or log in.
- `teacher_dashboard.html`: The primary interface for teachers to manage the entire system.
- `student_dashboard.html`: The interface for students to view their schedules, materials, marks, and attendance.
- `admin_dashboard.html`: Developer-only control panel for feature flags, user management, bulk data ops, and table browsing.
- `manage-testimonials.html`: Standalone (no-login) page for adding/deleting testimonials. Access by direct URL only.
- `manage-board-results.html`: Standalone (no-login) page for adding/deleting ISC board results. Access by direct URL only.
- `supabase_schema.sql`: Contains the complete database structure, tables, functions, triggers, and security policies.
- `js/app.js`: Contains core initialization logic for Supabase, database configuration, unified API wrappers, global UI helpers, and `loadFeatureFlags()`.
- `js/utils.js`: Contains shared utility functions and constants used across all dashboard modules: `formatTime`, `showConfirmModal`, grade constants (`_Grade11`, `_Grade12`), `populateGradeSelect()`, and `lockGradeSelect()`.
- `components/`: Contains modular HTML segments and tab views loaded dynamically to construct the UI.
- `supabase/functions/admin-api/`: Edge function handling all privileged admin operations using the service role key.

## Core Entities
The system revolves around several core entities defined in the database:
- **Profiles:** Extended user information linked to authentication (roles: `teacher`, `student`, `admin`).
- **Batches:** Groups of students assigned to specific subjects and schedules.
- **Classes:** Individual scheduled sessions (regular or extra).
- **Attendance:** Records of student presence for classes.
- **Tests & Marks:** Academic assessment tracking.
- **Files:** Shared study materials.
- **Announcements:** System wide or batch specific notices.
- **Feature Flags:** Key-value toggles stored in the `feature_flags` table that control which teacher dashboard panels are visible and whether the student portal is accessible.
