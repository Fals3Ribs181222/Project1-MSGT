# Clean URLs Implementation

The application has been updated to use clean URLs (removing `.html` extensions from the address bar) to improve SEO, user experience, and overall aesthetics.

## Configuration

### 1. Vercel (Production)
The repository uses Vercel for hosting. The clean URL feature is natively enabled via the `vercel.json` configuration file located in the root directory:

```json
{
  "cleanUrls": true
}
```

When a user navigates to `https://your-domain.com/login`, Vercel automatically maps this to `login.html` internally, while keeping the URL clean. Furthermore, any direct requests to a `.html` file will result in a 308 permanent redirect to the clean version.

### 2. Local Development (serve)
To replicate this behavior locally, a `serve.json` file has been added to the root directory. 

```json
{
  "cleanUrls": true
}
```

When running `npx serve`, this configuration ensures that local testing accurately reflects the production routing environment.

## Routing Updates
To prevent unnecessary 308 redirects and improve performance, absolute and relative links within the codebase have been standardized:

1. **HTML Anchors:** All `href` attributes linking to internal pages have had the `.html` extension removed (e.g., `<a href="login">`).
2. **JavaScript Navigation:** All `window.location.href` assignments have been updated to target the clean path.
3. **Dynamic Component Fetching (`js/dashboard/router.js`):** The dashboard router has been updated to fetch components without the `.html` extension to align seamlessly with the new routing environment.
