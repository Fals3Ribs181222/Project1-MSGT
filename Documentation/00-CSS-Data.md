# CSS Variables and Theme Data

This document lists all the custom CSS variables used across the project to maintain a consistent theme, including colors, fonts, layout properties, and styling utilities. These variables are defined in the `:root` selector of `css/styles.css`.

## Color Palette

### Base & Backgrounds
- `--bg-base`: `#EADDCA` (A warm, neutral background color)
- `--bg-surface`: `#ffffff` (White, used for cards and clean surface areas)
- `--bg-surface-hover`: `#f3e9d8` (A slightly tinted white/beige for hover states)
- `--glass-bg`: `rgba(255, 255, 255, 0.7)` (Semi-transparent white for glassmorphism effects)

### Brand & Interactive Colors
- `--primary`: `#7393B3` (A muted, professional blue used for primary actions, headings, and highlights)
- `--primary-hover`: `#5a7691` (A darker shade of primary blue for interactive hover states)
- `--secondary`: `#8A9A5B` (A soft, natural green used for active states, accents, and success items)
- `--amber`: `#FFBF00` (A bright amber/yellow for specific highlights, though usage is sparse in the core CSS snippet provided)
- `--cadmium-red`: `#D22B2B` (A strong red, likely intended for danger/error states alongside the explicit rgba reds used in `.btn--danger`)

### Grade Colors
- `--grade-11`: `#FF4433` (Red Orange — used to identify Grade 11 students and UI elements)
- `--grade-12`: `#00A36C` (Jade — used to identify Grade 12 students and UI elements)

Applied via `.calendar__pill--grade-11` and `.calendar__pill--grade-12` on schedule calendar pills. Falls back to type-based colour (`.calendar__pill--regular` / `.calendar__pill--extra`) if the batch has no grade.

### Typography Colors
- `--text-main`: `#2d3748` (A dark slate gray for high contrast readability of body text)
- `--text-muted`: `#4a5568` (A lighter slate gray for secondary text, labels, and less prominent information)

### Borders & Effects
- `--border-color`: `rgba(0, 0, 0, 0.1)` (Subtle, semi-transparent black for standard borders)
- `--glass-border`: `rgba(0, 0, 0, 0.08)` (Even lighter semi-transparent black for the borders of glassmorphic elements)
- `--shadow-glow`: `0 4px 6px rgba(0, 0, 0, 0.05)` (A soft, faint shadow to provide subtle elevation to components like cards and stats items)

## Typography

- `--font-main`: `'Outfit', 'Inter', sans-serif` (The primary font stack prioritizing modern, clean sans-serif typefaces)

## Structural & Utilities

### Border Radii
Used to maintain consistent rounding across components.
- `--radius-md`: `12px` (Medium rounding, typically for standard inputs or small cards)
- `--radius-lg`: `24px` (Large rounding, used for prominent panels, modals, and major layout blocks)
- `--radius-full`: `9999px` (Full rounding, used to create perfectly circular or pill-shaped elements like buttons and navigation links)

### Transitions
- `--transition`: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)` (A standardized, smooth easing curve used globally for hover effects, state changes, and minor animations)

## UI Components

### Navbar Logo (`.navbar__logo`)
Displays the brand in the top navbar as a flex row: `logo.png` (52px tall) + "Mitesh Sir's Study Circle" text. Uses `display: flex; align-items: center; gap: 0.6rem`. Font weight 800, color `--text-main`. On mobile (≤768px) font size reduces to 1.15rem via a media query override.

### Pill Toggle (`.pill-toggle`)
Used for binary/multi-mode switching inside panels (e.g. View Students / + Add Student). A beige container with `--bg-surface-hover` background and `--border-color` border. Active pill fills with `--primary` blue.

### Subject Pill Selector (`.subject-pills`)
Used on all forms that include a subject field (Add Student, Upload Material, Schedule Test, Create Batch). Shares the same container style as `.pill-toggle` (beige background, border, `--radius-full`). Each subject option is a hidden checkbox with a styled `<span class="subject-pill__label">`. Selected pills fill with `--secondary` (theme green). When **all** subjects are selected, a CSS `:has()` rule also turns the container itself green, filling the gap between pills for a fully unified look.
