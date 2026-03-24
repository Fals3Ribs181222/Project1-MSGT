// Shared UI and Formatting Utilities

// ── Grade Constants ───────────────────────────────────────────────────────
window._Grade11 = '11th';
window._Grade12 = '12th';

// ── Subject Constants ─────────────────────────────────────────────────────
window._Subject_Accounts = 'Accounts';
window._Subject_Commerce = 'Commerce';

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

// Replaces a grade <select> with a green pill badge for grade-restricted teachers.
// Pass one or more element IDs. Safe to call multiple times (guarded by data attr).
window.lockGradeSelect = function (...elementIds) {
    const teacherGrade = window.auth.getUser()?.grade;
    if (!teacherGrade || teacherGrade === 'All Grades') return;
    elementIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.gradeLocked) return;
        el.value = teacherGrade;
        el.style.display = 'none';
        el.dataset.gradeLocked = '1';
        const pill = document.createElement('span');
        pill.className = 'badge badge--green';
        pill.textContent = teacherGrade;
        el.parentElement.appendChild(pill);
    });
};

// Resets a form and restores any grade-locked selects to the teacher's grade.
// Use this instead of form.reset() to avoid breaking locked grade selects.
window.safeFormReset = function (form) {
    if (!form) return;
    form.reset();
    const teacherGrade = window.auth.getUser()?.grade;
    if (!teacherGrade || teacherGrade === 'All Grades') return;
    form.querySelectorAll('select[data-grade-locked]').forEach(el => {
        el.value = teacherGrade;
    });
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
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="confirm-modal__actions">
                <button class="btn btn--outline btn--sm" id="confirmCancel">Cancel</button>
                <button class="btn btn--danger btn--sm" id="confirmOk">Delete</button>
            </div>
        </div>
    `;
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

// Expose utilities globally
window.formatTime = formatTime;
window.showConfirmModal = showConfirmModal;

// ── Navbar mobile toggle ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.navbar__toggle');
    if (!toggle) return;
    const nav = document.querySelector('.navbar');
    toggle.addEventListener('click', function () {
        const open = nav.classList.toggle('navbar--open');
        this.setAttribute('aria-expanded', open);
    });
});
