# Brainstorming: Tabbed Interface Implementation

We need to convert the current stacked panels in the Teacher Dashboard into a tabbed interface where only the selected section is visible. Based on the `brainstorming-ideas` skill, here are 3 distinct approaches for implementing this:

## Approach 1: Vanilla JavaScript Tab Switching (Recommended)
- **Description**: Add a horizontal navigation bar with buttons for each panel. We use simple JavaScript to listen for click events. When a tab is clicked, we hide all panels and show only the target panel, while updating the "active" styling of the tab button.
- **Pros / Evidence For**: Very straightforward to implement and maintain. Flexible enough to allow programmatic tab switching (e.g., automatically switching to the "Marks" tab after a test is scheduled).
- **Cons / Evidence Against**: Requires a small amount of custom JavaScript state management.
- **Verification step**: Click each tab and verify only the corresponding panel is visible.

## Approach 2: CSS-only Tabs using Radio Buttons (Alternative)
- **Description**: Use hidden `<input type="radio">` elements and corresponding `<label>` tags for the tabs. The CSS `:checked` pseudo-class and sibling combinators are used to display the active panel.
- **Pros / Evidence For**: Zero JavaScript required for the layout switching. Extremely fast rendering.
- **Cons / Evidence Against**: The HTML structure becomes very rigid. It is difficult to programmatically switch tabs via JavaScript after a user performs an action (like successfully submitting a form).
- **Verification step**: Click labels and verify the layout updates correctly using browser dev tools.

## Approach 3: URL Hash-based Routing (Advanced)
- **Description**: Each tab is an anchor link (e.g., `#upload`, `#marks`). A JavaScript event listener for `hashchange` detects URL updates and changes the visible panel accordingly.
- **Pros / Evidence For**: Supports browser back/forward buttons and allows deep-linking (users can bookmark a specific tab directly).
- **Cons / Evidence Against**: Overkill for a simple dashboard. The URL changes on every click, which might distract the user or trigger unwanted scrolling behavior.
- **Verification step**: Change the URL hash manually and verify the correct tab renders.

### Comparison Summary

| Feature | Approach 1: JS Tabs | Approach 2: CSS-only | Approach 3: Hash Routing |
| :--- | :--- | :--- | :--- |
| **Implementation Speed** | Fast | Medium | Medium |
| **Maintainability** | High | Low | Medium |
| **JS Required** | Yes | No | Yes |
| **Deep Linking** | No | No | Yes |
| **Programmatic Switching**| Easy | Hard | Medium |

### Recommendation
**Approach 1 (Vanilla JS Tabs)** is the optimal path forward. It aligns perfectly with the current architecture (which already uses Vanilla JS for API calls) and provides the flexibility needed if we want to switch tabs automatically in the future.

### Note on the Panels
The screenshot shows 4 tabs: **Upload Study Material**, **Post Announcement**, **Student List**, and **Marks**. 
However, the current code has 5 panels (it also includes **Schedule Test**). I plan to either combine "Schedule Test" and "Marks" into one tab, or add "Schedule Test" as a 5th tab. Please let me know your preference!
