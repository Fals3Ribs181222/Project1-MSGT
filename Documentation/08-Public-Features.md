# Public Features

The application includes features designed for public visibility, primarily serving marketing and general information purposes on the landing page (`index.html`).

## Testimonials
The testimonials feature allows the tuition center to showcase positive feedback from past or present students.

1.  **Management:** Managed via `manage-testimonials.html` — a standalone page with no login required. It is not linked from any navigation; access is by direct URL only. The owner can add (with optional media upload) or delete testimonials from this page. RLS policies allow anonymous INSERT and DELETE on the `testimonials` table and the `testimonials` storage bucket.
2.  **Storage Integration:** The system uses a dedicated Supabase Storage bucket named `testimonials` to host any associated media files. Files are uploaded directly from `manage-testimonials.html` using the anon key.
3.  **Public Display:** Testimonials are explicitly meant to be public facing. The `testimonials` table has a policy allowing public read access, and the corresponding storage bucket is also configured for public access. This allows the landing page to seamlessly fetch and display these testimonials without requiring users to be authenticated.

## Board Results
ISC board results (marks achieved by past students) are displayed on the public Results page.

1.  **Management:** Managed via `manage-board-results.html` — a standalone page with no login required. Access is by direct URL only. Results can be added (student name, subject, marks, max marks, passing year) or deleted. Filterable by subject and year. RLS allows anonymous INSERT and DELETE.
2.  **Public Display:** The `board_results` table is read publicly. The Results page (`results.html`) fetches and displays these achievements to prospective students and parents.

## Landing Page Integrations
The `index.html` file serves as the public face of the application. It dynamically fetches and displays information from the public-facing tables to engage prospective students and parents:

-   **Board Results Showcase:** The landing page presents the top achievements stored in the `board_results` table, demonstrating the academic success of the tuition center's students.
-   **Testimonials Display:** It highlights the feedback and experiences shared by students, stored in the `testimonials` table, to build trust.
-   **Public Information:** While core features like schedules or materials require login, the landing page acts as the entry point, providing general tuition information and links to the `login.html` portal.
