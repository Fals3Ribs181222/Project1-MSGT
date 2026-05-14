// Shared UI and Formatting Utilities

// ── Grade Constants ───────────────────────────────────────────────────────
window._Grade11 = '11th';
window._Grade12 = '12th';

// Returns the currently active grade for list-view filtering ('11th' or '12th').
// All list views should call this instead of reading the teacher's profile grade directly.
window.getActiveGrade = function () {
    const g = window._activeGrade;
    return (g === window._Grade11 || g === window._Grade12) ? g : null;
};

// ── Subject Constants ─────────────────────────────────────────────────────
window._Subject_Accounts = 'Accounts';
window._Subject_Commerce = 'Commerce';
window._Subjects = [window._Subject_Accounts, window._Subject_Commerce];

// Populates a subject <select> with standard options.
// includeAll=true adds an "All Subjects" first option.
window.populateSubjectSelect = function (selectId, includeAll = true) {
    const el = document.getElementById(selectId);
    if (!el) return;
    el.innerHTML = '';
    if (includeAll) el.innerHTML += `<option value="">All Subjects</option>`;
    else el.innerHTML += `<option value="">-- Select Subject --</option>`;
    window._Subjects.forEach(s => {
        el.innerHTML += `<option value="${s}">${s}</option>`;
    });
};

// Populates a grade <select> with standard options derived from the constants.
// includeAll=true adds an "All Grades" first option (for filters/announcements).
window.populateGradeSelect = function (selectId, includeAll = true) {
    const el = document.getElementById(selectId);
    if (!el) return;
    el.innerHTML = '';
    if (includeAll) el.innerHTML += `<option value="">All Grades</option>`;
    else el.innerHTML += `<option value="">-- Select Grade --</option>`;
    el.innerHTML += `<option value="${window._Grade11}">${window._Grade11}</option>`;
    el.innerHTML += `<option value="${window._Grade12}">${window._Grade12}</option>`;
};

// Populates a container div with radio-based grade pills (single-select).
// includeAll=true adds an "All Grades" pill (pre-checked, for filter contexts).
// includeAll=false leaves no pill pre-checked (user must pick, for form contexts).
window.populateGradePills = function (containerId, includeAll = false) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const name = containerId + '_grade';
    let html = '';
    if (includeAll) {
        html += `<label class="subject-pill">
            <input type="radio" name="${name}" value="" checked>
            <span class="subject-pill__label">All Grades</span>
        </label>`;
    }
    [window._Grade11, window._Grade12].forEach(g => {
        html += `<label class="subject-pill">
            <input type="radio" name="${name}" value="${g}">
            <span class="subject-pill__label">${g}</span>
        </label>`;
    });
    el.innerHTML = html;
};

// Returns the currently selected grade value from a grade-pills container.
// Returns '' if nothing is selected (filter context) or nothing checked yet.
window.getSelectedGrade = function (containerId) {
    const el = document.getElementById(containerId);
    if (!el) return '';
    const checked = el.querySelector('input[type="radio"]:checked');
    return checked ? checked.value : '';
};

window.safeFormReset = function (form) {
    if (!form) return;
    form.reset();
};

/**
 * Formats a 24-hour time string (e.g., "14:30") into a 12-hour format with AM/PM
 * @param {string} timeStr - The time string in HH:MM format
 * @returns {string} The formatted time string
 */
function formatTime(timeStr) {
    if (!timeStr) return '';
    try {
        const [hourString, minute] = timeStr.split(':');
        const hour = parseInt(hourString);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 || 12; // Convert 0 to 12
        return `${formattedHour}:${minute} ${ampm}`;
    } catch (e) {
        return timeStr;
    }
}

/**
 * Shows a browser confirmation dialog
 * @param {string} title - The action title (for context)
 * @param {string} message - The message to display to the user
 * @param {function} onConfirm - Callback if the user confirms
 */
function showConfirmModal(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-modal">
            <h3></h3>
            <p></p>
            <div class="confirm-modal__actions">
                <button class="btn btn--outline btn--sm" id="confirmCancel">Cancel</button>
                <button class="btn btn--danger btn--sm" id="confirmOk">Delete</button>
            </div>
        </div>
    `;
    overlay.querySelector('h3').textContent = title;
    overlay.querySelector('p').textContent = message;
    document.body.appendChild(overlay);

    overlay.querySelector('#confirmCancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#confirmOk').addEventListener('click', async () => {
        overlay.querySelector('#confirmOk').disabled = true;
        overlay.querySelector('#confirmOk').textContent = 'Deleting...';
        await onConfirm();
        overlay.remove();
    });
}

// Escapes a plain-text string for safe insertion into innerHTML.
// Converts < > & " etc. using the browser's own DOM encoding.
function esc(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

// Validates a URL for use in href/src attributes.
// Blocks javascript: and data: URIs to prevent injection.
function safeUrl(url) {
    if (!url) return '#';
    const t = url.trim().toLowerCase();
    if (t.startsWith('javascript:') || t.startsWith('data:text/html')) return '#';
    return url;
}

// ── Date/Time Constants ───────────────────────────────────────────────────
window.DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
window.MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Expose utilities globally
window.formatTime = formatTime;
window.showConfirmModal = showConfirmModal;
window.esc = esc;
window.safeUrl = safeUrl;

// ── Navbar mobile toggle ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.navbar__toggle');
    if (!toggle) return;
    const sidebar = document.getElementById('dashSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar && backdrop) {
        toggle.addEventListener('click', () => {
            sidebar.classList.add('dash-sidebar--open');
            backdrop.classList.add('dash-sidebar-backdrop--visible');
        });
        backdrop.addEventListener('click', () => {
            sidebar.classList.remove('dash-sidebar--open');
            backdrop.classList.remove('dash-sidebar-backdrop--visible');
        });
    } else {
        const nav = document.querySelector('.navbar');
        toggle.addEventListener('click', function () {
            const open = nav.classList.toggle('navbar--open');
            this.setAttribute('aria-expanded', open);
        });
    }
});
