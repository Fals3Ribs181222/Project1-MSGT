# Multi-Site Deployment Portability Plan

Currently, the app has hardcoded details like "Mitesh Sir's Group Tuitions" and "@msgt.internal" scattered across HTML and JavaScript files. To make the project modular and easy to deploy for different tuition classes or businesses, we'll adopt a **White-Label Configuration Approach**.

## Proposed Changes

### JavaScript Configuration & Logic
#### `js/config.js`
- Expand `CONFIG` to include `TENANT_NAME`, `INTERNAL_DOMAIN`, `HERO_TITLE`, `CONTACT_PHONE`, `CONTACT_EMAIL`, `COPYRIGHT_TEXT`, etc.

#### `js/theme.js` (New File)
- Create a script that runs on page load. It will scan the DOM for elements with specific `data-config` attributes and insert the corresponding values from `CONFIG`. This avoids having to edit string literals in `.html` files.

#### `js/app.js`
- Replace the hardcoded `` `${username.toLowerCase()}@msgt.internal` `` logic with `` `${username.toLowerCase()}@${CONFIG.INTERNAL_DOMAIN}` ``.

---

### Frontend HTML Modularity
#### HTML Files (`index.html`, `login.html`, `teacher_dashboard.html`, `student_dashboard.html`, etc.)
- Replace hardcoded text like "Mitesh Sir's Group Tuitions" with empty spans or placeholder text using `data-config="TENANT_NAME"`.
- Similar genericization for addresses, phone numbers, and page `<title>` tags.

---

### Styling and Theming
#### `css/styles.css`
- Ensure all main colors (e.g., primary button color, header background) use CSS variables (like `--color-primary`, `--color-secondary`) at the `:root` level. 
- In the future, deploying a new site is as simple as tweaking the `:root` variables in one place to match the new tuition's branding.

## Verification Plan
### Manual Verification
1. I will edit `js/config.js` with dummy data for a different tuition class (e.g., "Rahul's Coding Classes").
2. Validate that `index.html` prominently shows "Rahul's Coding Classes" dynamically without altering the HTML code.
3. Try standard teacher/student logins, verifying auth resolves correctly against `rahul.internal` rather than `msgt.internal`.
