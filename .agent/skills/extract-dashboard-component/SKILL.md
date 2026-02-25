---
name: extract-dashboard-component
description: Systematically extracts inline HTML dashboard panels into standalone, dynamically loaded HTML components while modularizing their JavaScript handlers.
---

# Extracting Dashboard Components

## When to use this skill
- User asks to "extract a tab", "componentize this panel", or "move this dashboard section into its own file".
- When a single HTML file (like a dashboard or admin panel) is growing too large and needs to be broken down into modular pieces.

## Workflow

To successfully extract a component from a complex dashboard, you must follow these 5 rigid steps in order:

### 1. HTML Extraction
Locate the target UI block (usually a `<div class="panel">` or a `<form>`). Cut the *content* out of this block and paste it into a new file located at `components/[component_name].html`.
- *Rule*: Only extract the inner content. If there's an outer wrapper that determines styling inside the dashboard (like `.tab-panel`), leave it in the main dashboard file.

### 2. Container Stubbing
In the main dashboard HTML file, where you just removed the content, stub out an empty container with a specific ID.
- *Example*: `<div id="[componentName]Container">Loading component...</div>`

### 3. JS Loader Generation
In the main dashboard's `<script>` section, write an async function to fetch and inject the component's HTML.
```javascript
async function load[ComponentName]Component() {
    try {
        const response = await fetch('components/[component_name].html');
        if (response.ok) {
            const html = await response.text();
            document.getElementById('[componentName]Container').innerHTML = html;
            attach[ComponentName]Listeners();
        } else {
            console.error('Failed to load component: HTTP Status', response.status);
        }
    } catch (err) {
        console.error('Error loading component:', err);
    }
}
```

### 4. JS Listener Isolation
Locate all existing event listeners (like `form.addEventListener('submit', ...)` or toggle buttons) that handled logic for the extracted HTML snippet. Move ALL of this logic inside a new function named `attach[ComponentName]Listeners()`.
- *Rule*: You cannot leave event listeners floating globally in the script if they refer to elements inside the newly extracted component, because those elements do not exist in the DOM until `fetch()` completes.

### 5. Initialization
At the very bottom of the main dashboard's script section (where initializations happen on page load), call the loader function.
- *Example*: `load[ComponentName]Component();`

## Verification
- Double-check that `attach[ComponentName]Listeners()` is called *inside* the `if(response.ok)` block of the loader, after the `innerHTML` is set.
- Ensure any global variables needed by the listeners (like `api` or `auth`) are still accessible within the new modular function scope.
