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

All 19 tab modules live in `js/dashboard/` with paired HTML in `components/tabs/`.

**Teacher dashboard tabs:**

| Area | HTML Component | JS Module |
|------|---------------|-----------|
| Students | `components/tabs/students.html` | `js/dashboard/students.js` |
| Attendance | `components/tabs/attendance.html` | `js/dashboard/attendance.js` |
| Batches | `components/tabs/batches.html` | `js/dashboard/batches.js` |
| Schedule | `components/tabs/schedule.html` | `js/dashboard/schedule.js` |
| Tests | `components/tabs/test.html` | `js/dashboard/test.js` |
| Material Upload | `components/tabs/upload.html` | `js/dashboard/upload.js` |
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
  → upload.js stores file in Supabase Storage
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
- [supabase/functions/generate-report/index.ts](supabase/functions/generate-report/) — legacy report generation
- [supabase/functions/admin-api/index.ts](supabase/functions/admin-api/) — privileged admin operations (bypasses RLS via service role key)

### Authentication & Roles

Supabase Auth with JWT. Three roles: **teacher**, **student**, and **admin**. Role-based UI rendered on dashboards (`teacher_dashboard.html`, `student_dashboard.html`, `admin_dashboard.html`). Row-Level Security (RLS) enforced at the database level.

### Styling

Single stylesheet [css/styles.css](css/styles.css) using CSS custom properties for theming. No CSS framework.

## Documentation

Detailed documentation in [Documentation/](Documentation/) (22 markdown files):
- `01-System-Overview.md` — full tech stack & architecture
- `02-Authentication-and-Roles.md` — auth flow, roles, RLS
- `03-Dashboards-and-UI.md` — dashboard structure and UI patterns
- `04-Batch-and-Student-Management.md` — batch and student CRUD
- `05-Class-Scheduling-and-Attendance.md` — scheduling and attendance
- `06-Academic-Management.md` — tests and marks
- `07-Communication-and-Materials.md` — announcements and file sharing
- `08-Public-Features.md` — public landing page, testimonials, board results
- `09-Dashboard-Modularization.md` — router & module loading patterns
- `10-NBLM-Implementation-Plan.md` — NBLM planning notes
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
- `22-Standalone-Pages.md` — manage_marks, manage-board-results, results, testimonials
- `00-CSS-Data.md` — design system & CSS variables

## Environment Variables

Edge functions require these secrets (set via `supabase secrets set`):
- `VOYAGE_API_KEY` — Voyage AI embeddings
- `ANTHROPIC_API_KEY` — Claude API
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` — Meta Cloud API (WhatsApp Business)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase access from edge functions
