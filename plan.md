# Phase 1: Foundation (Database & Authentication Setup)
- [ ] Task 1.1: Initialize the Supabase Project and get API Keys.
      - *Verification*: Validate that `SUPABASE_URL` and `SUPABASE_KEY` are successfully generated and accessible.
- [ ] Task 1.2: Set up Authentication (Email/Password) for Students and Teachers.
      - *Verification*: Successfully create a test teacher and test student account from the Supabase dashboard.

# Phase 2: Schema Migration & Storage Setup
- [ ] Task 2.1: Create SQL Tables matching the existing Google Sheets structure (Teachers, Students, Files, Announcements, Tests, Marks, Results, Testimonials).
      - *Dependencies*: Task 1.1
      - *Verification*: Verify tables exist in the Supabase Table Editor.
- [ ] Task 2.2: Setup Supabase Storage bucket for `uploadFile` (replacing Google Drive).
      - *Dependencies*: Task 1.1
      - *Verification*: Successfully manually upload and view a test file in the Storage UI.

# Phase 3: Frontend Integration (Core App)
- [ ] Task 3.1: Include Supabase JS Client in `index.html` and other HTML files.
      - *Verification*: `window.supabase` is available in the browser console.
- [ ] Task 3.2: Update `js/config.js` to store the Supabase URL and Anon Key.
      - *Dependencies*: Task 1.1, Task 3.1
      - *Verification*: `CONFIG.SUPABASE_URL` is accessible.
- [ ] Task 3.3: Rewrite `js/app.js` `api` methods and `auth` to use the Supabase client instead of the Google Apps Script fetch calls.
      - *Dependencies*: Task 1.2, Task 3.2
      - *Verification*: User can log in/out successfully using the new Supabase Auth flow.

# Phase 4: Data Fetching and Updating Views
- [ ] Task 4.1: Update `student_dashboard.html` / `js` to fetch files, announcements, and marks directly from Supabase.
      - *Dependencies*: Task 2.1, Task 3.3
      - *Verification*: Ensure dashboard populates data without errors.
- [ ] Task 4.2: Update `teacher_dashboard.html` to insert new tests, marks, announcements, and upload files to Supabase Storage.
      - *Dependencies*: Task 2.2, Task 3.3, Task 4.1
      - *Verification*: Teacher can upload a file and create an announcement.
