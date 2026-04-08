// Home panel widgets are initialised by loadDashboardWidgets() in teacher_dashboard.html
// on DOMContentLoaded. This module exists so the router doesn't 404 when it tries to
// import it, and to allow widget refresh when the teacher returns to the home tab.

export function init() {}

export function refresh() {
    if (typeof window.loadDashboardWidgets === 'function') {
        window.loadDashboardWidgets();
    }
}
