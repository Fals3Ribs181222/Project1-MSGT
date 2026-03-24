# Changelog

All notable changes to the TuteFlow project are documented here.

## [Unreleased] — Security & Architecture Improvements

### Added

#### Security Improvements
- **XSS Prevention Helpers** (`js/utils.js`):
  - `window.esc()` — HTML-escapes plain text for safe `innerHTML` insertion
  - `window.safeUrl()` — validates URLs, blocks `javascript:` and `data:text/html` URIs
  - Updated all 12+ dashboard modules to sanitize user-controlled data before display
  - Added `DOMPurify.sanitize()` for formatted content (testimonials, messages)
  - Created [21-Security-Improvements.md](Documentation/21-Security-Improvements.md) documentation

#### Auth & Session Management
- **Async Session Validation**:
  - `auth.requireRole(role)` is now **async** — verifies session server-side before access
  - Prevents "ghost user" state if Supabase session expires mid-browsing
  - Prevents UI flicker by hiding body during validation
  - Added `supabaseClient.auth.onAuthStateChange()` subscription to redirect on session expiry
  - Updated [02-Authentication-and-Roles.md](Documentation/02-Authentication-and-Roles.md) with session details

#### Error Handling
- **Error Boundaries in Router** (`js/dashboard/router.js`):
  - Router now catches `init()` errors and displays error message instead of loading state
  - Router catches `refresh()` errors and prepends error message to panel
  - Prevents tabs from appearing to "load forever" on module errors

### Changed

- **showConfirmModal** (`js/utils.js`): Now uses `textContent` instead of `innerHTML` for title and message parameters — prevents XSS through confirmation dialogs

- **Dashboard Module HTML** (12+ modules):
  - All user data interpolations now wrapped with `window.esc()`, `window.safeUrl()`, or `DOMPurify.sanitize()`
  - Affected modules: announcement, test, upload, attendance, batches, students, messages, testimonials, leaderboard, board_results, teachers, schedule, admin-users, admin-flags

### Fixed

- **.gitignore**: Added `.tmp.driveupload/` to prevent temporary upload files from being committed

### Documentation

- Created [21-Security-Improvements.md](Documentation/21-Security-Improvements.md) — comprehensive guide to XSS prevention, with testing procedures
- Updated [02-Authentication-and-Roles.md](Documentation/02-Authentication-and-Roles.md) — added Frontend Session Management section with async patterns
- Updated [09-Dashboard-Modularization.md](Documentation/09-Dashboard-Modularization.md) — added Error Handling & Boundaries section, security helpers reference
- Updated [01-System-Overview.md](Documentation/01-System-Overview.md) — added Security section with links to detailed docs

---

## Previous Releases

See git history for earlier versions.
