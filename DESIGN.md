# DESIGN.md — TuteFlow (Mitesh Sir's Study Circle)

A plain-text design system for AI agents. Read this before generating any HTML or CSS for this project.

---

## 1. Mood & Brand

Warm, calm, academic. Feels like a well-organized study room — not a startup dashboard. The palette is built around a warm beige base with muted blue and earthy green accents. Glassmorphism is the primary surface treatment: frosted white panels over the beige background. Nothing is harsh, sharp, or neon. The UI should feel trustworthy and unhurried.

---

## 2. Color Palette

All colors are defined as CSS custom properties on `:root` in `css/styles.css`. Always use these variables — never hardcode hex values.

### Core Variables

| Variable             | Value                        | Usage                                              |
|----------------------|------------------------------|----------------------------------------------------|
| `--bg-base`          | `#EADDCA`                    | Page background (warm beige)                       |
| `--bg-surface`       | `#ffffff`                    | Cards, footer, clean surfaces                      |
| `--bg-surface-hover` | `#f3e9d8`                    | Hover states, pill containers, form inputs         |
| `--glass-bg`         | `rgba(255, 255, 255, 0.7)`   | Glassmorphic panels, cards, navbar                 |
| `--glass-border`     | `rgba(0, 0, 0, 0.08)`        | Borders on glass elements                          |
| `--border-color`     | `rgba(0, 0, 0, 0.1)`         | Standard borders on non-glass elements             |
| `--primary`          | `#7393B3`                    | Primary actions, headings in panels, active nav    |
| `--primary-hover`    | `#5a7691`                    | Hover state for primary elements                   |
| `--secondary`        | `#8A9A5B`                    | Active tab buttons, subject pill selection, accents|
| `--text-main`        | `#2d3748`                    | Body text, headings, high-contrast labels          |
| `--text-muted`       | `#4a5568`                    | Secondary text, labels, table cells                |
| `--shadow-glow`      | `0 4px 6px rgba(0,0,0,0.05)` | Subtle elevation on hover                          |
| `--amber`            | `#FFBF00`                    | Sparse highlights (e.g. warning states)            |
| `--cadmium-red`      | `#D22B2B`                    | Danger/error (alongside `.btn--danger`)            |

### Semantic One-offs (not variables)

- **Success status:** `#10b981` with `rgba(16, 185, 129, 0.1)` background
- **Error status:** `#ef4444` with `rgba(239, 68, 68, 0.1)` background
- **Highlight row:** `rgba(99, 102, 241, 0.08)` with `var(--primary)` left border

---

## 3. Typography

```css
font-family: 'Outfit', 'Inter', sans-serif;   /* --font-main */
line-height: 1.6;   /* body */
line-height: 1.2;   /* headings */
font-weight: 700;   /* h1–h4 */
```

### Heading Scale (fluid)

| Element | `font-size` |
|---------|-------------|
| `h1`    | `clamp(2.5rem, 5vw, 4rem)` |
| `h2`    | `clamp(2rem, 4vw, 3rem)` |
| `h3`    | `clamp(1.5rem, 3vw, 2rem)` |
| Panel heading (`panel__header h3`) | Color: `var(--primary)` |
| Welcome heading | `2rem`, name in `var(--primary)` |
| Breadcrumb title | `2.5rem` |

### Gradient Text (hero headings, login header)

```css
background: linear-gradient(135deg, var(--primary), var(--secondary));
-webkit-background-clip: text;
background-clip: text;
-webkit-text-fill-color: transparent;
```

Use on hero highlight spans and the login card `h2`.

---

## 4. Layout & Spacing

- **Max content width:** `1200px`, centered, `padding: 0 2rem`
- **Section padding:** `3rem 0 6rem`
- **Section header bottom margin:** `4rem`
- **Panel padding:** `2rem`
- **Gap between panels/cards:** `2rem`
- **Form group margin:** `1.5rem` bottom

### Dashboard Grid

```css
/* Default: single column */
.dashboard { display: grid; gap: 2rem; }
/* ≥992px: content + sidebar */
@media (min-width: 992px) { grid-template-columns: 2fr 1fr; }
```

### Common Grid Patterns

- Stats row: `repeat(auto-fit, minmax(200px, 1fr))`
- Stat cards: `repeat(auto-fit, minmax(200px, 1fr))`, `gap: 1.5rem`
- Testimonials: `repeat(auto-fit, minmax(300px, 1fr))`
- Landing pills: `repeat(auto-fit, minmax(280px, 1fr))`
- Footer: `repeat(auto-fit, minmax(250px, 1fr))`

---

## 5. Border Radii

| Variable        | Value    | Used on                                      |
|-----------------|----------|----------------------------------------------|
| `--radius-full` | `9999px` | Buttons, nav pills, pill toggles, badges     |
| `--radius-lg`   | `24px`   | Panels, glass cards, modals, filter bars     |
| `--radius-md`   | `12px`   | Form inputs, material list items, stat cards |

**Rule:** If something is interactive and prominent (button, tab, nav item) → `--radius-full`. If it's a container (panel, card, table wrapper) → `--radius-lg`. If it's an input field or smaller widget → `--radius-md`.

---

## 6. Glassmorphism (Primary Surface Pattern)

This is the signature visual pattern. Apply to panels, cards, filter bars, navbar.

```css
background: var(--glass-bg);           /* rgba(255,255,255,0.7) */
border: 1px solid var(--glass-border); /* rgba(0,0,0,0.08) */
border-radius: var(--radius-lg);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
```

Navbar adds `padding: 0.4rem 0` and is `position: sticky; top: 0; z-index: 100`.

The utility class `.glass` applies this pattern with `padding: 2rem`.

---

## 7. Components

### Buttons

All buttons: `display: inline-flex; align-items: center; gap: 0.5rem; border-radius: var(--radius-full); font-weight: 600; transition: var(--transition);`

| Class          | Background              | Text    | Hover effect                          |
|----------------|-------------------------|---------|---------------------------------------|
| `.btn--primary`| `var(--primary)`        | white   | darken + `translateY(-2px)`           |
| `.btn--outline`| transparent             | `--text-main` | white bg + primary border        |
| `.btn--danger` | `rgba(239,68,68,1)`     | white   | darker red + `translateY(-2px)`       |

Modifiers: `.btn--full` (full width, `padding: 1rem`, `font-size: 1.1rem`), `.btn--sm` (compact).

Disabled: `opacity: 0.7; cursor: not-allowed;`

### Tabs (Dashboard Navigation)

```
.tabs__nav — white 40% bg, radius-full, padding 0.4rem, gap 0.25rem
.tabs__btn — flex:1, transparent, radius-full, white-space: nowrap
.tabs__btn--active — background: var(--secondary), color: white
.tabs__btn:hover:not(.active) — rgba(255,255,255,0.5)
```

**Important:** Active tabs use `--secondary` (green), not `--primary` (blue). Active nav links in the navbar use `--primary`.

### Pill Toggle (Binary Switch inside Panels)

Container: `--bg-surface-hover` background, `--border-color` border, `--radius-full`, `padding: 0.25rem`.
Active pill: `--primary` background, white text.

### Subject Pill Selector

Same container style as pill toggle. Each option is a hidden checkbox + visible `<span class="subject-pill__label">`.
Selected: `--secondary` (green) background.

### Panel

```css
.panel { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: 2rem; backdrop-filter: blur(16px); }
.panel__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.panel__header h3 { color: var(--primary); }
```

### Form Controls

Inputs, selects, textareas share: `background: var(--bg-surface-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.75rem 1rem; font-family: var(--font-main);`

Focus ring: `border-color: var(--primary); box-shadow: 0 0 0 2px rgba(115, 147, 179, 0.2);`

Label: `color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.5rem;`

Upload zone: `border: 2px dashed var(--border-color); border-radius: var(--radius-md);`

### Data Table

Wrapper: `.data-table` — glass surface + `overflow-x: auto`. Table: `border-collapse: collapse; text-align: left; width: 100%;`

- `th`: `color: var(--primary); font-weight: 600;`
- `td`: `color: var(--text-muted);` | `td.--main` or `.data-table__td--main`: `color: var(--text-main); font-weight: 500;`
- Row hover: `rgba(0,0,0,0.03)` background
- Highlight row: `rgba(99,102,241,0.08)` + `border-left: 3px solid var(--primary)`
- Cell padding: `1rem`–`1.25rem`

### Badge

```css
.badge { background: rgba(138,154,91,0.15); color: var(--secondary); font-weight: 700; padding: 0.25rem 0.75rem; border-radius: var(--radius-full); border: 1px solid rgba(138,154,91,0.3); }
.badge--green { background: rgba(16,185,129,0.12); color: #10b981; border-color: rgba(16,185,129,0.35); }
```

### Status Messages

```css
.status--success { background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.3); }
.status--error   { background: rgba(239,68,68,0.1);  color: #ef4444;  border: 1px solid rgba(239,68,68,0.3);  }
```

Both use `border-radius: var(--radius-md); padding: 1rem; font-size: 0.9rem;`

### Stat Card

Glass surface, `border-radius: var(--radius-md)`, centered text.
- Value: `font-size: 2rem; font-weight: 700; color: var(--primary);`
- Label: `font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;`

### Notice List (Announcements)

```css
.notice-list__item { background: rgba(138,154,91,0.05); border-left: 4px solid var(--secondary); border-radius: 0 var(--radius-md) var(--radius-md) 0; padding: 1rem; }
```

### Spinner

```css
width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: white; animation: spin 1s ease-in-out infinite;
```

### Navbar Logo

`logo.png` (52px tall) + "Mitesh Sir's Study Circle" text. `font-weight: 800; color: var(--text-main); font-size: 1.5rem; letter-spacing: -0.5px;`

---

## 8. Motion & Interaction

```css
--transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

Apply to all interactive elements. Use `transition: all 0.25s ease` for navbar links.

### Hover Conventions

- **Cards/stats on hover:** `transform: translateY(-5px)` + `box-shadow` intensifies
- **Primary/danger buttons:** `transform: translateY(-2px)`
- **Nav links:** color darkens, subtle white background
- **Table rows:** `rgba(0,0,0,0.03)` background
- **Border highlight on hover:** `border-color: var(--primary)`

### Animations

```css
@keyframes fadeUp  { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn  { from { opacity:0; transform:translateY(5px)  } to { opacity:1; transform:translateY(0) } }
@keyframes spin    { to { transform: rotate(360deg) } }
```

Use `fadeUp` (0.8s) on hero/page load. Use `fadeIn` (0.3s) on tab panel reveals and detail views.

---

## 9. Responsive Breakpoints

| Breakpoint | Behaviour |
|------------|-----------|
| `≤768px`   | Logo font shrinks to `1.15rem`; batch detail goes single column |
| `≤480px`   | Stat grid goes 2-column; stat card padding reduces |
| `≥992px`   | Dashboard gains 2-column layout (`2fr 1fr`) |

Scrollable tab nav hides scrollbar: `scrollbar-width: none; overflow-x: auto;`

---

## 10. Do's and Don'ts

**Do:**
- Always use CSS variables — never hardcode colors
- Apply `backdrop-filter: blur(16px)` alongside `--glass-bg` (they're a pair)
- Use `--radius-full` for anything pill/button shaped, `--radius-lg` for containers
- Use `--secondary` (green) for active tab state, `--primary` (blue) for active nav and panel headings
- Add `transition: var(--transition)` to every interactive element
- Keep forms and inputs on `--bg-surface-hover` background to distinguish from panels
- Use `fadeIn` animation on dynamically injected content

**Don't:**
- Don't use dark mode — there is none
- Don't use any external CSS framework (no Tailwind, Bootstrap, etc.)
- Don't use `box-shadow` with heavy opacity — all shadows are very subtle (≤0.1 alpha)
- Don't use `--primary` for active tab buttons (that's `--secondary`)
- Don't add `border-radius` values not in the three standard sizes
- Don't use emojis in UI text unless the feature already has them
- Don't add `!important` — specificity is handled by class naming
