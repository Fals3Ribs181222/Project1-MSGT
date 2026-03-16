# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TuteFlow** — an educational management system for Mitesh Sir's Group Tuitions (ISC Accountancy coaching, Mumbai). Multi-role web app with teacher and student portals, AI-powered tools, and WhatsApp integration.

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
- **Messaging:** Twilio WhatsApp API
- **Hosting:** Vercel (`cleanUrls: true` — `.html` extension omitted in URLs)

### Frontend Architecture

The dashboards are **tab-based SPAs** using a custom router ([js/dashboard/router.js](js/dashboard/router.js)):
- Pill button clicks call `loadTab(targetId)`
- HTML is lazily fetched from `components/tabs/<name>.html`
- The corresponding JS module `js/dashboard/<name>.js` is dynamically imported
- Each module exports `init()` (first load) and optionally `refresh()` (revisit)

Global API wrapper in [js/app.js](js/app.js) exposes `window.api` (Supabase CRUD abstraction) and `window.auth` (session management). Shared utilities in [js/utils.js](js/utils.js).

### Key Modules

| Area | HTML Component | JS Module |
|------|---------------|-----------|
| Students | `components/tabs/students.html` | `js/dashboard/students.js` |
| Attendance | `components/tabs/attendance.html` | `js/dashboard/attendance.js` |
| Material Upload | `components/tabs/upload.html` | `js/dashboard/upload.js` |
| AI Tools | `components/tabs/ai-tools.html` | `js/dashboard/ai-tools.js` |
| WhatsApp | `components/tabs/messages.html` | `js/dashboard/messages.js` |

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
- [supabase/functions/send-whatsapp/index.ts](supabase/functions/send-whatsapp/) — Twilio delivery
- [supabase/functions/generate-report/index.ts](supabase/functions/generate-report/) — legacy report generation

### Authentication & Roles

Supabase Auth with JWT. Two roles: **teacher** and **student**. Role-based UI rendered on dashboards (`teacher_dashboard.html`, `student_dashboard.html`). Row-Level Security (RLS) enforced at the database level.

### Styling

Single stylesheet [css/styles.css](css/styles.css) using CSS custom properties for theming. No CSS framework.

## Documentation

Detailed documentation in [Documentation/](Documentation/) (17 markdown files):
- `01-System-Overview.md` — full tech stack & architecture
- `15-RAG-Pipeline-and-AI-Tools.md` — AI/RAG implementation details
- `09-Dashboard-Modularization.md` — router & module loading patterns
- `11-WhatsApp-Notifications.md` — Twilio integration
- `00-CSS-Data.md` — design system & CSS variables

## Environment Variables

Edge functions require these secrets (set via `supabase secrets set`):
- `VOYAGE_API_KEY` — Voyage AI embeddings
- `ANTHROPIC_API_KEY` — Claude API
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` — WhatsApp
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase access from edge functions
