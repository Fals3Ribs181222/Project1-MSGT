# System Overview

## Introduction
The Mitesh Sir's Group Tuitions project is a web-based educational management system tailored for group tuitions. It provides a comprehensive platform for both teachers and students to interact, manage schedules, share materials, track attendance, and monitor academic progress.

## Technology Stack
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla JS)
- **Backend/Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage (for Materials and Testimonials)

## Architecture
The application uses a serverless architecture where the frontend interacts directly with the Supabase backend via the Supabase JavaScript Client. It relies heavily on Row Level Security (RLS) in PostgreSQL to securely manage data access based on user roles (teacher vs. student).

### Key Files and Directories
- `index.html`: The main landing page showcasing the tuition classes, testimonials, and features.
- `login.html`: The authentication portal for users to sign up or log in.
- `teacher_dashboard.html`: The primary interface for teachers to manage the entire system.
- `student_dashboard.html`: The interface for students to view their schedules, materials, marks, and attendance.
- `supabase_schema.sql`: Contains the complete database structure, tables, functions, triggers, and security policies.
- `js/app.js`: Contains core initialization logic for Supabase, database configuration, unified API wrappers, and global UI helpers.
- `js/utils.js`: Contains shared utility functions like `formatTime` and `showConfirmModal` used across multiple modules.
- `components/`: Contains modular HTML segments and tab views loaded dynamically to construct the UI.

## Core Entities
The system revolves around several core entities defined in the database:
- **Profiles:** Extended user information linked to authentication.
- **Batches:** Groups of students assigned to specific subjects and schedules.
- **Classes:** Individual scheduled sessions (regular or extra).
- **Attendance:** Records of student presence for classes.
- **Tests & Marks:** Academic assessment tracking.
- **Files:** Shared study materials.
- **Announcements:** System wide or batch specific notices.
