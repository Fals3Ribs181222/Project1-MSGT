# Dashboard Modularization Architecture

The Teacher Dashboard has been refactored from a single monolithic file into a scalable, modular architecture. This allows for easier maintenance, separation of concerns, and reusable components.

## Core Concepts

### 1. Dynamic Routing (`js/dashboard/router.js`)
Instead of having all HTML embedded in the main dashboard file, content is loaded dynamically.
- When a user clicks a "landing pill" (e.g., Students, Attendance), the router fetches the corresponding HTML component from the `components/tabs/` directory.
- Once the HTML is injected into the DOM, the router dynamically imports the associated JavaScript module from the `js/dashboard/` directory.
- The router then calls the module's exported `init()` function to initialize event listeners and fetch initial data.
- If the user switches tabs and comes back, the router calls the module's `refresh()` function to update the data.

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

These ES6 modules are responsible for all data fetching, form handling, and DOM manipulation strictly within their own domain. They rely on the global `window.api` and `window.supabaseClient` objects initialized in `app.js`.

## Benefits
- **Maintainability:** Developers can easily locate and modify the code for a specific feature without navigating thousands of lines of unrelated code.
- **Performance:** JavaScript is split and loaded asynchronously (lazy-loading), reducing the initial payload when the dashboard is first accessed.
- **Reusability:** Tab components can be more easily adapted or reused in other parts of the application or new dashboards if needed.
