# Mobile Responsiveness

TuteFlow has been made fully usable on phones (375px–480px) without affecting the desktop or laptop experience. All changes are additive — new CSS rules inside media queries and targeted HTML fixes — leaving the existing desktop layout untouched.

---

## Breakpoint Strategy

| Breakpoint | Target | Purpose |
|------------|--------|---------|
| `max-width: 992px` | Tablets | Pre-existing; dashboard grid single-column |
| `max-width: 768px` | Large phones / small tablets | Hamburger menu, spacing reduction, leaderboard stack |
| `max-width: 600px` | Phones | Grid stacking (attendance, student detail) |
| `max-width: 480px` | Small phones (iPhone SE 375px) | Pill grid, form rows, touch targets, typography |

All new rules live at the bottom of `css/styles.css` under clearly labelled comment blocks.

---

## Teacher Dashboard — Sidebar Navigation (Mobile)

The teacher dashboard uses a **left sidebar** instead of the top navbar for tab navigation. On desktop the sidebar is always visible. On mobile it becomes a slide-in overlay.

### Sidebar mobile behaviour (≤768px)
- `.dash-sidebar` is fixed off-screen at `left: -260px` by default
- A hamburger button `.dash-menu-toggle` (shown only on mobile) adds `.dash-sidebar--open` to slide it in (`left: 0`)
- A full-screen backdrop `#sidebarBackdrop` adds `.dash-sidebar-backdrop--visible` and closes the sidebar on tap
- Navigating to any tab also closes the sidebar automatically

```js
document.getElementById('dashMenuToggle').addEventListener('click', () => {
    sidebar.classList.add('dash-sidebar--open');
    backdrop.classList.add('dash-sidebar-backdrop--visible');
});
backdrop.addEventListener('click', () => {
    sidebar.classList.remove('dash-sidebar--open');
    backdrop.classList.remove('dash-sidebar-backdrop--visible');
});
```

### Navbar hamburger (other pages)
On `index.html` and `student_dashboard.html` the top navbar hamburger (`<button class="navbar__toggle">`) is still used for mobile navigation, toggling `.navbar--open` on the navbar element.

---

## Back to Overview Button

The back button (`.back-to-home-container`) is **only shown on mobile** (≤768px) when inside a sub-tab. On desktop the sidebar handles all navigation back to home.

The router controls visibility:
```js
if (targetId === 'panel-home') {
    document.body.classList.add('is-home-active');
    backBtn.style.display = 'none';
} else {
    document.body.classList.remove('is-home-active');
    backBtn.style.display = window.innerWidth <= 768 ? 'block' : 'none';
}
```

The button shows abbreviated text on small screens via `.back-text-full` / `.back-text-mobile` spans.

---

## Inline Style Overrides (Critical Fix)

Several tab components used inline `style` attributes that completely override CSS media queries due to higher specificity. These were replaced with named CSS classes.

| File | Old | New class |
|------|-----|-----------|
| `components/tabs/attendance.html` | `style="display:grid; grid-template-columns: repeat(2, 1fr)..."` on `#todaysClassesGrid` | `.classes-grid` |
| `components/tabs/attendance.html` | `style="display: grid; grid-template-columns: 1fr 1fr..."` on transfer form | `.transfer-form-grid` |
| `components/tabs/leaderboard.html` | `style="display: grid; grid-template-columns: 1fr 1fr..."` on `#leaderboardColumns` | `.leaderboard-grid` |
| `components/tabs/students.html` | `style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))..."` on `.profile-card` | `.student-profile-grid` |
| `components/tabs/students.html` | `style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))..."` on two-column section | `.student-detail__twocol` |

Default desktop styles for each class are defined in `css/styles.css` outside any media query. Responsive overrides are inside the appropriate breakpoint blocks.

---

## Component-by-Component Changes

### Teacher Dashboard Home (Widget Grid)
The landing page now uses `.dash-widgets` — a CSS grid with `grid-template-columns: 1fr 1fr 0.6fr`. At ≤992px this becomes `1fr 1fr`; at ≤600px it becomes a single column. Today's Classes spans full width via `.dash-widget--full` (`grid-column: 1 / -1`) at all breakpoints.

### Landing Grid (legacy, no longer used on teacher dashboard)
The old `.landing-grid` pill layout has been replaced by the widget grid above. The `.landing-grid` CSS remains for potential reuse elsewhere.

### Form Rows (Global)
`.form__row` gained `flex-wrap: wrap` and `.form__row-item` gained `min-width: 160px` globally. At ≤480px, form rows stack to a single column (`flex-direction: column`). This fixes all multi-column form layouts across AI Tools and other tabs without touching any HTML.

### AI Tools Tab
- 3-column section marks picker (hardcoded `width: calc(33.333%)`) is overridden to `width: 100% !important` at ≤480px, stacking each section vertically
- Cognitive focus pill-toggle buttons wrap at ≤480px

### Attendance Tab
- Today's classes grid: 2-column → 1-column at ≤600px
- Cross-batch transfer form: side-by-side selects → stacked at ≤600px

### Students Tab
- Toolbar (search + 2 filters) stacks vertically at ≤480px; min-widths removed
- Profile card grid: switches to explicit `1fr 1fr` at ≤480px
- Attendance stats row: 5 items collapse to `repeat(3, 1fr)` at ≤480px with reduced font sizes
- Two-column section (calendar + batches): stacks to 1 column at ≤600px

### Leaderboard Tab
- Grade 11 and Grade 12 columns stack to 1 column at ≤768px

### Tables (All tabs)
All tables already had `.table-wrap { overflow-x: auto }` for horizontal scroll. At ≤480px, table font-size reduces to `0.8rem` and cell padding reduces to `0.45rem 0.4rem` so more columns are visible before scrolling.

### Student Dashboard Performance Card
At ≤480px: reduced gap and padding; `min-width: 110px` per stat card to prevent over-squishing.

### Touch Targets
At ≤480px, `.btn` has `min-height: 44px` and `.btn--sm` has `min-height: 36px`, meeting the Apple HIG minimum touch target guideline.

---

## Files Modified

| File | Change |
|------|--------|
| `css/styles.css` | Added `flex-wrap` to `.form__row`; added new layout classes; added `@media` blocks for 768px, 600px, 480px |
| `index.html` | Hamburger button + toggle script |
| `teacher_dashboard.html` | Sidebar slide-in overlay + hamburger toggle; removed navbar hamburger |
| `student_dashboard.html` | Hamburger button + toggle script |
| `js/dashboard/router.js` | Back button only shown on mobile; sidebar active state synced on every tab change |
| `components/tabs/attendance.html` | Replaced inline styles with `.classes-grid` and `.transfer-form-grid` |
| `components/tabs/leaderboard.html` | Replaced inline style with `.leaderboard-grid` |
| `components/tabs/students.html` | Replaced inline styles with `.student-profile-grid` and `.student-detail__twocol` |
