// js/dashboard/messages.js — Messages tab logic

const user = window.auth.getUser();

let allStudentsCache = [];

// ── Load students into the picker ────────────────────────────
async function loadStudentPicker() {
    const select = document.getElementById('msgStudentSelect');
    if (!select) return;

    const res = await window.api.get('profiles', { role: 'student' }, 'id, name, phone, parent_phone');
    if (res.success && res.data) {
        allStudentsCache = res.data;
        select.innerHTML = '<option value="">Select a student...</option>' +
            res.data.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    } else {
        select.innerHTML = '<option value="">Failed to load students</option>';
    }
}

// ── Show phone info when student is selected ─────────────────
function updatePhoneInfo() {
    const studentId = document.getElementById('msgStudentSelect')?.value;
    const recipient = document.getElementById('msgRecipient')?.value;
    const infoEl = document.getElementById('msgPhoneInfo');
    const detailsEl = document.getElementById('msgPhoneDetails');
    if (!infoEl || !detailsEl) return;

    if (!studentId) {
        infoEl.style.display = 'none';
        return;
    }

    const student = allStudentsCache.find(s => s.id === studentId);
    if (!student) {
        infoEl.style.display = 'none';
        return;
    }

    const parts = [];
    if (recipient === 'student' || recipient === 'both') {
        parts.push(`Student: ${student.phone || '⚠ No phone'}`);
    }
    if (recipient === 'parent' || recipient === 'both') {
        parts.push(`Parent: ${student.parent_phone || '⚠ No phone'}`);
    }

    detailsEl.textContent = parts.join(' • ');
    infoEl.style.display = 'block';
}

// ── Send custom message ──────────────────────────────────────
async function sendCustomMessage() {
    const studentId = document.getElementById('msgStudentSelect')?.value;
    const recipient = document.getElementById('msgRecipient')?.value;
    const messageText = document.getElementById('msgText')?.value?.trim();
    const btn = document.getElementById('btnSendCustomMsg');
    const statusEl = document.getElementById('msgSendStatus');

    if (!studentId || !messageText) {
        window.showStatus('msgSendStatus', 'Please select a student and type a message.', 'error');
        return;
    }

    const student = allStudentsCache.find(s => s.id === studentId);
    if (!student) return;

    const recipients = window.whatsapp.resolveRecipients(student, recipient);
    if (recipients.length === 0) {
        window.showStatus('msgSendStatus', 'No phone number available for the selected recipient.', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending...';
    statusEl.style.display = 'none';

    try {
        const result = await window.whatsapp.send({
            type: 'custom',
            recipients,
            payload: { message: messageText },
            sentBy: user.id,
        });

        window.showStatus('msgSendStatus',
            `✓ Sent to ${result.sent} recipient(s)${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
            result.failed > 0 ? 'error' : 'success'
        );

        if (result.sent > 0) {
            document.getElementById('msgText').value = '';
            document.getElementById('msgCharCount').textContent = '0';
        }
    } catch (err) {
        window.showStatus('msgSendStatus', 'Failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="ri-whatsapp-line"></i> Send WhatsApp';
    }
}

// ── Message History ──────────────────────────────────────────
async function loadHistory() {
    const tbody = document.getElementById('msgHistoryBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Loading history...</td></tr>';

    const typeFilter = document.getElementById('msgHistoryFilter')?.value || '';

    try {
        const logs = await window.whatsapp.getAllLogs({
            type: typeFilter || undefined,
            limit: 100,
        });

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="loading-text">No messages sent yet.</td></tr>';
            return;
        }

        const typeLabels = {
            report: '📊 Report',
            attendance: '✅ Attendance',
            score: '📝 Score',
            announcement: '📢 Announcement',
            custom: '💬 Custom',
        };

        tbody.innerHTML = logs.map(log => {
            const date = new Date(log.sent_at).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            });
            const typeLabel = typeLabels[log.message_type] || log.message_type || '—';
            const recipientName = log.recipient_name || '—';
            const recipientType = log.recipient_type ? ` (${log.recipient_type})` : '';
            const preview = log.preview || '—';

            return `
                <tr class="data-table__row">
                    <td class="data-table__td" style="white-space:nowrap;">${typeLabel}</td>
                    <td class="data-table__td">${recipientName}${recipientType}</td>
                    <td class="data-table__td"><div class="text-truncate" style="max-width:300px;" title="${preview.replace(/"/g, '&quot;')}">${preview}</div></td>
                    <td class="data-table__td" style="white-space:nowrap;">${date}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="loading-text">Error: ${err.message}</td></tr>`;
    }
}

// ── Init & Refresh ───────────────────────────────────────────
export function init() {
    loadStudentPicker();

    // Pill toggle
    const pillCompose = document.getElementById('pillCompose');
    const pillHistory = document.getElementById('pillHistory');
    const composeContainer = document.getElementById('messagesComposeContainer');
    const historyContainer = document.getElementById('messagesHistoryContainer');

    if (pillCompose && pillHistory) {
        pillCompose.addEventListener('click', () => {
            pillCompose.classList.add('pill-toggle__btn--active');
            pillHistory.classList.remove('pill-toggle__btn--active');
            composeContainer.style.display = 'block';
            historyContainer.style.display = 'none';
        });

        pillHistory.addEventListener('click', () => {
            pillHistory.classList.add('pill-toggle__btn--active');
            pillCompose.classList.remove('pill-toggle__btn--active');
            historyContainer.style.display = 'block';
            composeContainer.style.display = 'none';
            loadHistory();
        });
    }

    // Student selection → show phone info
    document.getElementById('msgStudentSelect')?.addEventListener('change', updatePhoneInfo);
    document.getElementById('msgRecipient')?.addEventListener('change', updatePhoneInfo);

    // Character counter
    document.getElementById('msgText')?.addEventListener('input', (e) => {
        const count = document.getElementById('msgCharCount');
        if (count) count.textContent = e.target.value.length;
    });

    // Send button
    document.getElementById('btnSendCustomMsg')?.addEventListener('click', sendCustomMessage);

    // History filter + refresh
    document.getElementById('msgHistoryFilter')?.addEventListener('change', loadHistory);
    document.getElementById('btnRefreshHistory')?.addEventListener('click', loadHistory);
}

export function refresh() {
    loadStudentPicker();
}
