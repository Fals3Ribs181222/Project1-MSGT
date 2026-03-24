# Dashboard Modularization Architecture

The Teacher Dashboard has been refactored from a single monolithic file into a scalable, modular architecture. This allows for easier maintenance, separation of concerns, and reusable components.

## Core Concepts

### 1. Dynamic Routing (`js/dashboard/router.js`)
Instead of having all HTML embedded in the main dashboard file, content is loaded dynamically.
- When a user clicks a **sidebar nav item** (e.g., Students, Attendance), it calls `window.loadTab(targetId)`. The router fetches the corresponding HTML component from the `components/tabs/` directory.
- Once the HTML is injected into the DOM, the router dynamically imports the associated JavaScript module from the `js/dashboard/` directory.
- The router then calls the module's exported `init()` function to initialize event listeners and fetch initial data.
- If the user switches tabs and comes back, the router calls the module's `refresh()` function to update the data.
- On every `loadTab()` call, the router syncs the active sidebar item by toggling `.dash-sidebar__item--active` on the matching `data-target` button.
- The URL hash is always updated including for the home panel: `teacher_dashboard#home`, `teacher_dashboard#students`, etc.
- `body.is-home-active` is added when on the home panel and removed on sub-tabs, used to control back-button and CSS state.

### 2. HTML Components (`components/tabs/`)
Each major feature of the dashboard has its own distinct HTML file containing only its specific UI structure:
- `students.html`
- `attendance.html`
- `batches.html`
- `schedule.html`
- `upload.html` (Materials)
- `test.html`
- `announcement.html`
- `board_results.html`
- `testimonials.html`

### 3. JavaScript Modules (`js/dashboard/`)
The JavaScript logic has been split to correspond 1-to-1 with the HTML components:
- `students.js`
- `attendance.js`
- `batches.js`
- `schedule.js`
- `upload.js`
- `test.js`
- `announcement.js`
- `board_results.js`
- `testimonials.js`

These ES6 modules are responsible for all data fetching, form handling, and DOM manipulation strictly within their own domain. They rely on the following global resources provided by `app.js` and `utils.js`:
- **`window.api`**: An extended wrapper for Supabase operations. Methods: `.get()`, `.post()`, `.patch()`, `.upsert()`, `.delete()`, `.deleteMany()`.
- **UI Helpers**: `tableLoading()`, `showStatus()`, and `loadComponent()` for standardized loading states and component fetching.
- **Shared Utilities** (`js/utils.js`):
  - `formatTime()` — formats 24h time to 12h AM/PM
  - `showConfirmModal()` — confirmation dialog before destructive actions
  - `window._Grade11` / `window._Grade12` — canonical grade string constants (`'11th'` / `'12th'`)
  - `window.populateGradeSelect(id, includeAll)` — fills a grade `<select>` with options from the constants; all HTML components ship with empty `<select>` shells
  - `window.lockGradeSelect(...ids)` — for grade-restricted teachers, hides grade selects and replaces them with a green `badge badge--green` pill

> **Note on `window.api.patch()`:** Added to support in-place profile updates (e.g., teacher grade assignment). Signature: `api.patch(tableName, id, updates)` — performs an `.update().eq('id', id)` and returns `{ success, data }`.

### Additional Modules
- **`teachers.js`** — loads and renders the teacher list with grade assignment modal. Available for future tab integration. Currently used as the logic source for `manage_teachers.html`.

## Benefits
- **Maintainability:** Developers can easily locate and modify the code for a specific feature without navigating thousands of lines of unrelated code.
- **Performance:** JavaScript is split and loaded asynchronously (lazy-loading), reducing the initial payload when the dashboard is first accessed.
- **Reusability:** Tab components can be more easily adapted or reused in other parts of the application or new dashboards if needed.
