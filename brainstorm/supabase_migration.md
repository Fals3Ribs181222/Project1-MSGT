# Brainstorming: Migrating to Supabase

## Current Architecture

| Layer | Technology | Details |
|-------|-----------|---------|
| **Frontend** | Static HTML/CSS/JS | Pages served via `python -m http.server 8080` |
| **Backend** | Google Apps Script | Single `Code.gs` file (292 lines), deployed as a web app |
| **Database** | Google Sheets | 7 tabs: Students, Teachers, Files, Announcements, Tests, Marks, Results, Testimonials |
| **File Storage** | Google Drive | Teacher-uploaded materials (PDFs, etc.) |
| **Auth** | Custom (plaintext) | Username/password matched against sheets; stored in `localStorage` |

### Current API Surface (7 actions)

| Action | Method | Sheet(s) Hit |
|--------|--------|-----------|
| `login` | POST | Students / Teachers |
| `uploadFile` | POST | Files + Google Drive |
| `addAnnouncement` | POST | Announcements |
| `scheduleTest` | POST | Tests |
| `enterMarks` | POST | Marks |
| `addStudent` | POST | Students |
| `get*` (6 endpoints) | GET | Files, Announcements, Tests, Marks, Students, Results, Testimonials |

---

## Why Migrate?

**Pain points with Google Apps Script + Sheets:**
- **Performance**: Sheets become slow as data grows (row scans for every query)
- **No real auth**: Plaintext passwords stored in sheets, no sessions/tokens
- **CORS workarounds**: Headers deliberately omitted to avoid preflight issues
- **No real-time features**: Polling required; no subscriptions
- **Scalability ceiling**: GAS has 6-min execution limits, 90s URL fetch timeouts
- **File upload limits**: Base64 encoding through GAS is capped at ~50MB

---

## Approach 1: Full Supabase Migration (Recommended)

> **Description**: Replace Google Sheets with Supabase Postgres, Google Drive with Supabase Storage, and GAS auth with Supabase Auth. Frontend stays static HTML/JS but talks directly to Supabase via `supabase-js`.

### What Changes

| Component | Before | After |
|-----------|--------|-------|
| Database | Google Sheets | Supabase Postgres (tables) |
| Auth | Custom sheet lookup | Supabase Auth (email/password) |
| File Storage | Google Drive | Supabase Storage buckets |
| API Layer | Google Apps Script | Supabase client SDK (`supabase-js`) directly from frontend |
| Real-time | None | Supabase Realtime (optional) |

### Pros
- **Proper relational DB** — foreign keys, indexes, JOINs; no more row-scanning
- **Built-in auth** — hashed passwords, JWT tokens, row-level security (RLS)
- **Direct client SDK** — no backend server needed; the frontend talks to Supabase directly
- **File storage built-in** — upload directly from browser to Supabase Storage
- **Free tier** — 500MB DB, 1GB storage, 50K monthly active users
- **Real-time subscriptions** — live updates for marks, announcements, etc.
- **No CORS issues** — Supabase handles this natively
- **Architecture stays simple** — still a static site, no Node.js server required

### Cons
- **Data migration** — existing Google Sheets data needs to be exported and imported
- **Learning curve** — RLS policies, Postgres SQL, Supabase dashboard
- **Student onboarding** — existing student credentials need to be re-created in Supabase Auth
- **Google Drive links break** — existing file URLs stay valid, but new uploads go to Supabase Storage
- **Largest code change** — every `api.get()` / `api.post()` call needs to be rewritten

### Verification
- Set up a Supabase project and create matching tables
- Migrate one sheet (e.g., Students) and test login flow end-to-end
- Confirm file upload to Supabase Storage works from the browser

---

## Approach 2: Supabase as DB Only (Hybrid)

> **Description**: Replace Google Sheets with Supabase Postgres, but keep Google Drive for file storage and build a thin server layer (or Supabase Edge Functions) for API logic. Keep auth custom (but hashed).

### What Changes

| Component | Before | After |
|-----------|--------|-------|
| Database | Google Sheets | Supabase Postgres |
| Auth | Custom sheet lookup | Custom (Supabase DB, but hashed passwords) |
| File Storage | Google Drive | **Google Drive** (unchanged) |
| API Layer | Google Apps Script | Supabase Edge Functions or direct SDK |

### Pros
- **Simpler migration** — file storage doesn't change, existing Drive links stay valid
- **Incremental approach** — can migrate tables one at a time
- **Less disruption** — teachers don't have to re-learn file management

### Cons
- **Split architecture** — still dependent on Google Drive APIs for file ops
- **No built-in auth** — need to manually implement password hashing (bcrypt, etc.)
- **Edge Functions** — adds complexity; need Deno runtime knowledge
- **Misses real-time** — harder to add without full Supabase Auth integration

### Verification
- Create database tables in Supabase
- Rewrite `config.js` to point to Supabase, update `api` wrapper
- Test that Google Drive upload still works alongside Supabase DB reads

---

## Approach 3: Keep Google Sheets, Add Supabase Auth Only

> **Description**: Only replace the authentication layer with Supabase Auth. Keep Google Sheets as the database and Google Drive for storage.

### What Changes

| Component | Before | After |
|-----------|--------|-------|
| Auth | Custom sheet lookup | Supabase Auth |
| Everything else | Unchanged | Unchanged |

### Pros
- **Smallest change** — only `login` logic and `auth` module on frontend need updating
- **Immediate security win** — proper hashed passwords, JWT tokens
- **Fast to implement** — 1–2 day effort

### Cons
- **Band-aid solution** — doesn't solve performance/scalability issues
- **Auth-data mismatch** — users exist in two places (Supabase Auth + Google Sheets)
- **Still dependent on GAS** — all the original limitations remain
- **Complexity increases** — now managing *two* backends (Supabase + GAS)

### Verification
- Create Supabase Auth users matching existing students/teachers
- Update `login.html` to authenticate via Supabase, store JWT
- Confirm dashboard access still works with sheet-based data

---

## Comparison Table

| Criteria | Approach 1: Full Migration | Approach 2: DB Only | Approach 3: Auth Only |
|----------|---------------------------|--------------------|-----------------------|
| **Effort** | 🔴 High (5–7 days) | 🟡 Medium (3–4 days) | 🟢 Low (1–2 days) |
| **Security** | ✅ Full (Auth + RLS) | 🟡 Partial (hashed) | ✅ Auth only |
| **Performance** | ✅ Major improvement | ✅ Major improvement | 🔴 No change |
| **Scalability** | ✅ Future-proof | 🟡 Mostly | 🔴 No change |
| **Real-time** | ✅ Available | 🟡 Possible | 🔴 Not available |
| **File Storage** | ✅ Unified (Supabase) | 🟡 Split (Drive) | 🔴 Unchanged |
| **Maintenance** | ✅ One platform | 🟡 Two platforms | 🔴 Two platforms |
| **Data Migration** | 🔴 Full export/import | 🟡 Partial | 🟢 Minimal |

---

## 💡 Recommendation

**Approach 1 (Full Supabase Migration)** is the strongest path forward. The app is small enough (~292 lines of backend, ~130 lines of API wrapper) that a full migration is realistic in a week. You get massive wins in security, performance, and developer experience — and the frontend stays a simple static site.

### Suggested Migration Order
1. **Set up Supabase project** → create tables matching current sheet schemas
2. **Auth first** → migrate Students/Teachers to Supabase Auth
3. **Read endpoints** → replace `api.get()` calls with `supabase.from().select()`
4. **Write endpoints** → replace `api.post()` calls with `supabase.from().insert()`
5. **File storage** → migrate uploads from Google Drive to Supabase Storage
6. **Data migration** → export existing sheet data and import into Postgres
7. **Delete `Code.gs`** → remove Google Apps Script dependency entirely
