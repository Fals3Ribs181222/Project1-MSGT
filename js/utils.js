// Shared UI and Formatting Utilities

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
