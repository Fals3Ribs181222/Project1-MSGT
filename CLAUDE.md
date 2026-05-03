# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TuteFlow** — an educational management system for Mitesh Sir's Study Circle (ISC Accountancy coaching, Mumbai). Multi-role web app with teacher and student portals, AI-powered tools, and WhatsApp integration.

## Development Commands

No build system or package manager. This is a vanilla JavaScript project served directly.

```bash
# Local development (serve with clean URLs)
npx serve .                        # or use VS Code Live Server

# Supabase local dev
supabase start
supabase stop

# Deploy edge functions
npx supabase functions deploy index-material --no-verify-jwt
npx supabase functions deploy rag-query --no-verify-jwt
npx supabase functions deploy send-whatsapp
npx supabase functions deploy generate-report

# View edge function logs
npx supabase functions logs <function-name>

# Deploy frontend
vercel --prod
```

## Architecture

### Tech Stack
- **Frontend:** Vanilla HTML/CSS/JavaScript (no framework, no build step)
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Edge Functions:** Deno + TypeScript (hosted on Supabase)
- **AI:** Voyage AI (embeddings: `voyage-3-lite`) + Claude API (generation)
- **Messaging:** Meta Cloud API (WhatsApp Business)
- **Hosting:** Vercel (`cleanUrls: true` — `.html` extension omitted in URLs)

### Frontend Architecture

The dashboards are **tab-based SPAs** using a custom router ([js/dashboard/router.js](js/dashboard/router.js)):
- Pill button clicks call `loadTab(targetId)`
- HTML is lazily fetched from `components/tabs/<name>.html`
- The corresponding JS module `js/dashboard/<name>.js` is dynamically imported
- Each module exports `init()` (first load) and optionally `refresh()` (revisit)

Global API wrapper in [js/app.js](js/app.js) exposes `window.api` (Supabase CRUD abstraction) and `window.auth` (session management). Shared utilities in [js/utils.js](js/utils.js).

### Key Modules

All tab modules live in `js/dashboard/` with paired HTML in `components/tabs/`. There are 30 JS files total: 13 teacher tabs, 8 student tabs, 5 admin tabs, and support modules (home, student-detail, student-import, router).

**Teacher dashboard tabs:**

| Area | HTML Component | JS Module |
|------|---------------|-----------|
| Students | `components/tabs/students.html` | `js/dashboard/students.js` |
| Attendance | `components/tabs/attendance.html` | `js/dashboard/attendance.js` |
| Batches | `components/tabs/batches.html` | `js/dashboard/batches.js` |
| Schedule | `components/tabs/schedule.html` | `js/dashboard/schedule.js` |
| Tests | `components/tabs/test.html` | `js/dashboard/test.js` |
| Material Upload | `components/tabs/material.html` | `js/dashboard/material.js` |
| Announcements | `components/tabs/announcement.html` | `js/dashboard/announcement.js` |
| AI Tools | `components/tabs/ai-tools.html` | `js/dashboard/ai-tools.js` |
| WhatsApp | `components/tabs/messages.html` | `js/dashboard/messages.js` |
| Leaderboard | `components/tabs/leaderboard.html` | `js/dashboard/leaderboard.js` |
| Board Results | `components/tabs/board_results.html` | `js/dashboard/board_results.js` |
| Testimonials | `components/tabs/testimonials.html` | `js/dashboard/testimonials.js` |
| Teachers | `components/tabs/teachers.html` | `js/dashboard/teachers.js` |

**Admin dashboard tabs:**

| Area | JS Module |
|------|-----------|
| Overview | `js/dashboard/admin-overview.js` |
| Feature Flags | `js/dashboard/admin-flags.js` |
| Users | `js/dashboard/admin-users.js` |
| Bulk Operations | `js/dashboard/admin-bulk.js` |
| Table Browser | `js/dashboard/admin-browse.js` |

### RAG / AI Pipeline

```
Teacher uploads file
  → material.js stores file in Supabase Storage
  → triggers index-material edge function:
      chunks text (400 words, 50-word overlap)
      → Voyage AI embeds each chunk
      → stores in material_chunks table (pgvector)

Teacher asks question / requests test via ai-tools.html
  → ai-tools.js calls rag-query edge function:
      embeds query via Voyage AI
      → similarity search on material_chunks (filtered by subject/grade)
      → top 5 chunks as context → Claude API prompt
      → returns AI answer or generated test
```

Edge functions:
- [supabase/functions/index-material/index.ts](supabase/functions/index-material/index.ts) — chunking + embedding
- [supabase/functions/rag-query/index.ts](supabase/functions/rag-query/index.ts) — RAG doubt solver + test generator
- [supabase/functions/send-whatsapp/index.ts](supabase/functions/send-whatsapp/) — Meta Cloud API delivery (free-form + approved templates)
- [supabase/functions/whatsapp-webhook/index.ts](supabase/functions/whatsapp-webhook/) — receives inbound Meta messages and delivery status updates
- [supabase/functions/generate-report/index.ts](supabase/functions/generate-report/) — AI report card generation (Claude Haiku)
- [supabase/functions/admin-api/index.ts](supabase/functions/admin-api/) — privileged admin operations (bypasses RLS via service role key)

### Authentication & Roles

Supabase Auth with JWT. Three roles: **teacher**, **student**, and **admin**. Role-based UI rendered on dashboards (`teacher_dashboard.html`, `student_dashboard.html`, `admin_dashboard.html`). Row-Level Security (RLS) enforced at the database level.

### Styling

Single stylesheet [css/styles.css](css/styles.css) using CSS custom properties for theming. No CSS framework.

Before generating any HTML or CSS, read [DESIGN.md](DESIGN.md) for the full design system: color variables, component patterns, spacing rules, and do's/don'ts.

## Documentation

Detailed documentation in [Documentation/](Documentation/) (25 markdown files):
- `01-System-Overview.md` — full tech stack & architecture
- `02-Authentication-and-Roles.md` — auth flow, roles, RLS
- `03-Dashboards-and-UI.md` — dashboard structure and UI patterns
- `04-Batch-and-Student-Management.md` — batch and student CRUD
- `05-Class-Scheduling-and-Attendance.md` — scheduling and attendance
- `06-Academic-Management.md` — tests and marks
- `07-Communication-and-Materials.md` — announcements and file sharing
- `08-Public-Features.md` — public landing page, testimonials, board results
- `09-Dashboard-Modularization.md` — router & module loading patterns
- `10-NBLM-Implementation-Plan.md` — NBLM planning notes (failed/historical)
- `11-WhatsApp-Notifications.md` — WhatsApp integration (Meta Cloud API)
- `12-URL-Routing.md` — Vercel clean URL routing
- `13-AI-Report-Card-Generator.md` — AI report card feature
- `14-Seed-Functions.md` — seed data pages
- `15-RAG-Pipeline-and-AI-Tools.md` — AI/RAG implementation details
- `16-Student-Detail-Redesign.md` — student detail UI redesign
- `17-Student-Rankings-and-Leaderboard.md` — leaderboard feature
- `18-Mobile-Responsiveness.md` — responsive design changes
- `19-Admin-Dashboard.md` — admin control panel
- `20-Teacher-Grade-Access-Control.md` — per-teacher grade scoping
- `21-Security-Improvements.md` — XSS prevention, security hardening
- `22-Standalone-Pages.md` — manage_marks, manage-board-results, manage-testimonials, manage_teachers, results, testimonials
- `23-WhatsApp-Production-Setup.md` — step-by-step Meta WhatsApp production setup tracker
- `24-WhatsApp-Templates.md` — approved Meta message templates and parameter mapping
- `00-CSS-Data.md` — design system & CSS variables

## Database Schema

Supabase project ID: `tksruuqtzxflgglnljef`

> All users (students, teachers, admins) are in `profiles`. There is no `students` table.

### profiles
`id` (uuid PK), `name`, `username`, `role` (teacher/student/admin), `grade`, `subjects`, `phone`, `email`, `father_name`, `father_phone`, `mother_name`, `mother_phone`, `teacher_notes`, `created_at`

### batches
`id` (uuid PK), `name`, `description`, `subject`, `grade`, `schedule`, `created_by` (→ profiles), `created_at`

### batch_students
`id` (uuid PK), `batch_id` (→ batches), `student_id` (→ profiles), `added_at`

### batch_transfers
`id` (uuid PK), `student_id`, `from_batch_id`, `to_batch_id`, `transfer_date`, `end_date`, `reason`, `created_by`, `created_at`

### classes
`id` (uuid PK), `batch_id`, `title`, `type`, `day_of_week` (int), `class_date`, `start_time`, `end_time`, `notes`, `class_group_id`, `created_by`, `created_at`

### attendance
`id` (uuid PK), `batch_id`, `class_id`, `student_id`, `date`, `status`, `marked_by`, `created_at`

### tests
`id` (uuid PK), `title`, `grade`, `subject`, `date`, `max_marks` (int), `scheduled_by`, `created_at`

### marks
`id` (uuid PK), `test_id` (→ tests), `student_id` (→ profiles), `marks_obtained` (text), `created_at`

### announcements
`id` (uuid PK), `title`, `grade`, `message`, `posted_by` (→ profiles), `created_at`

### files
`id` (uuid PK), `title`, `grade`, `subject`, `file_url`, `upload_type`, `uploaded_by`, `created_at`

### material_chunks
`id` (uuid PK), `file_id` (→ files), `chunk_index` (int), `content`, `embedding` (vector), `subject`, `grade`, `teacher_id`, `created_at`

### question_bank
`id` (uuid PK), `year` (int), `subject`, `grade`, `section`, `marks` (int), `question_type`, `cog_level`, `topic_tags` (array), `question_text`, `answer_text`, `embedding` (vector), `uploaded_by`, `created_at`

### student_rankings *(view)*
`student_id`, `name`, `grade`, `subject`, `avg_percentage`, `tests_taken`, `class_avg`, `final_score`, `rank`

### rank_history
`id` (uuid PK), `student_id`, `rank` (int), `avg_percentage`, `snapshot_date`, `created_at`

### board_results
`id` (uuid PK), `student_name`, `subject`, `marks_obtained` (int), `max_marks` (int), `passing_year` (int), `created_by`, `created_at`

### testimonials
`id` (uuid PK), `student_name`, `testimonial_text`, `subject`, `year`, `media_url`, `media_type`, `youtube_video_id`, `created_at`

### whatsapp_log
`id` (uuid PK), `student_id`, `message_type`, `preview`, `sent_by`, `sent_at`, `recipient_phone`, `recipient_name`, `recipient_type`, `class_id`, `test_id`

### whatsapp_incoming
`id` (uuid PK), `event_type`, `from_number`, `message_text`, `raw_payload` (jsonb), `created_at`

### feature_flags
`key` (PK), `enabled` (bool), `label`, `description`, `updated_at`

### doubt_cache
`id` (uuid PK), `question_hash`, `subject`, `grade`, `question_text`, `answer`, `sources` (jsonb), `suggestions` (jsonb), `created_at`

### doubt_feedback
`id` (uuid PK), `user_id`, `question`, `answer`, `subject`, `grade`, `rating`, `created_at`

## Environment Variables

Edge functions require these secrets (set via `supabase secrets set`):
- `VOYAGE_API_KEY` — Voyage AI embeddings
- `ANTHROPIC_API_KEY` — Claude API
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` — Meta Cloud API (WhatsApp Business)
- `WHATSAPP_VERIFY_TOKEN` — self-defined token for Meta webhook verification (`whatsapp-webhook` function)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase access from edge functions

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
