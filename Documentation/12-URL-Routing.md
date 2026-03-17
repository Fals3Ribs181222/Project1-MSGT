# URL Routing

This document covers two layers of URL routing in TuteFlow: clean page URLs (no `.html` extensions) and hash-based tab routing within the dashboards.

---

## Part 1 — Clean URLs

### What it does
Removes `.html` extensions from the address bar so users see `/login` instead of `/login.html`, improving aesthetics and SEO.

### Configuration

**Production (Vercel)**

Enabled via `vercel.json` in the project root:

```json
{
  "cleanUrls": true
}
```

Vercel maps `/login` → `login.html` internally. Any direct request to a `.html` URL gets a 308 permanent redirect to the clean version.

**Local development (`npx serve`)**

A `serve.json` in the project root mirrors the same behaviour:

```json
{
  "cleanUrls": true
}
```

### Code changes required
All internal links must omit `.html`:

1. **HTML anchors** — `<a href="login">` not `<a href="login.html">`
2. **JS navigation** — `window.location.href = 'login'` not `'login.html'`
3. **Component fetching in the router** — `fetch('components/tabs/students')` not `'students.html'`

---

## Part 2 — Hash-Based Tab Routing

### What it does
The teacher dashboard is a tab-based SPA. Hash routing keeps the URL in sync with the active tab so that:

- The URL updates when the user switches tabs (e.g. `#students`, `#attendance`)
- Refreshing or sharing the URL reopens the correct tab

### How it works

Implemented in [js/dashboard/router.js](../js/dashboard/router.js).

**On tab switch** — `loadTab()` calls `history.replaceState` to update the hash:

```js
history.replaceState(null, '', featureSlug === 'home' ? location.pathname : `#${featureSlug}`);
```

- Navigating to **Students** → URL becomes `teacher_dashboard#students`
- Navigating back to **Home** → hash is removed, URL returns to `teacher_dashboard`

**On page load** — the `DOMContentLoaded` listener reads the hash and loads the matching tab:

```js
const initialTab = location.hash.slice(1);
if (initialTab) {
    loadTab(`panel-${initialTab}`);
}
```

### URL examples

| Active tab | URL |
|------------|-----|
| Home (overview) | `/teacher_dashboard` |
| Students | `/teacher_dashboard#students` |
| Attendance | `/teacher_dashboard#attendance` |
| AI Tools | `/teacher_dashboard#ai-tools` |
| WhatsApp | `/teacher_dashboard#messages` |

### Tab ID conventions
Tab panel IDs follow the pattern `panel-<featureName>`. The hash stores only the `<featureName>` part. The router strips/adds the `panel-` prefix when converting between the two.
