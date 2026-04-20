let user, allAttendance, studentBatches;

export async function init() {
    user = window.auth.getUser();
    await loadAttendance();
    document.getElementById('btnRefreshAttendance')?.addEventListener('click', loadAttendance);
}

export async function refresh() {
    await loadAttendance();
}

async function loadAttendance() {
    window.tableLoading('attendanceTableBody', 4, 'Loading attendance...');
    window.showStatus('attendanceStatus', '', 'success');

    const [attRes, batchRes] = await Promise.all([
        window.api.get('attendance', { student_id: user.id }, '*, classes:class_id(title, batch_id, batches:batch_id(name, subject))'),
        window.api.get('batch_students', { student_id: user.id }, 'batch_id, batches:batch_id(name, subject)')
    ]);

    if (!attRes.success) {
        window.showStatus('attendanceStatus', attRes.error || 'Failed to load attendance.', 'error');
        return;
    }

    allAttendance = (attRes.data || []).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    studentBatches = batchRes.data || [];

    populateBatchPills();
    renderStats(allAttendance);
    renderAttendance();
}

function populateBatchPills() {
    const pillsEl = document.getElementById('attBatchPills');
    if (!pillsEl) return;

    const accountsBatch = studentBatches.find(bs => (bs.batches?.subject || '').toLowerCase() === 'accounts');
    const defaultBatchId = accountsBatch?.batch_id || studentBatches[0]?.batch_id || '';

    pillsEl.innerHTML = '';
    studentBatches.forEach(bs => {
        const b = bs.batches || {};
        const isDefault = bs.batch_id === defaultBatchId;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pill-toggle__btn' + (isDefault ? ' pill-toggle__btn--active' : '');
        btn.dataset.batch = bs.batch_id;
        btn.textContent = b.name || 'Batch';
        pillsEl.appendChild(btn);
    });
    pillsEl.querySelectorAll('.pill-toggle__btn').forEach(btn => {
        btn.addEventListener('click', () => {
            pillsEl.querySelectorAll('.pill-toggle__btn').forEach(b => b.classList.remove('pill-toggle__btn--active'));
            btn.classList.add('pill-toggle__btn--active');
            renderAttendance();
        });
    });
}

function renderStats(records) {
    const container = document.getElementById('attendanceSubjectSections');
    if (!container) return;

    const studentSubjects = (user.subjects || '').split(',').map(s => s.trim()).filter(Boolean);
    const subjects = studentSubjects.length ? studentSubjects : ['Overall'];

    container.innerHTML = subjects.map(subj => {
        const recs    = subj === 'Overall' ? records : records.filter(r => (r.classes?.batches?.subject || '') === subj);
        const total   = recs.length;
        const present = recs.filter(r => r.status === 'present').length;
        const absent  = recs.filter(r => r.status === 'absent').length;
        const late    = recs.filter(r => r.status === 'late').length;
        const pct     = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
        const calHtml = buildCalendarHtml(recs);

        const statBox = (val, label, color) =>
            `<div style="background:var(--bg-surface,#fff);border:1px solid var(--border-color);border-radius:var(--radius-lg,12px);padding:1.25rem;text-align:center;">
                <p style="font-size:1.75rem;font-weight:700;color:${color};margin:0 0 0.25rem;">${val}</p>
                <p style="font-size:0.78rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin:0;">${label}</p>
            </div>`;

        return `<div style="margin-bottom:0.5rem;">
            <p style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 0.6rem;">${window.esc(subj)}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem;">
                ${statBox(total, 'Total Classes', 'var(--primary)')}
                ${statBox(present, 'Present', '#1D9E75')}
                ${statBox(absent, 'Absent', '#E24B4A')}
                ${statBox(late, 'Late', '#BA7517')}
                <div style="grid-column:1/-1;background:var(--bg-surface,#fff);border:1px solid var(--border-color);border-radius:var(--radius-lg,12px);padding:1.25rem;text-align:center;">
                    <p style="font-size:1.75rem;font-weight:700;color:${pct>=80?'#1D9E75':pct>=60?'#BA7517':'#E24B4A'};margin:0 0 0.25rem;">${total > 0 ? pct + '%' : '—'}</p>
                    <p style="font-size:0.78rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin:0;">Attendance %</p>
                </div>
            </div>
            ${calHtml}
        </div>`;
    }).join('');
}

function buildCalendarHtml(records) {
    if (!records.length) return '';

    const priority = { absent: 3, late: 2, present: 1 };
    const dateMap = {};
    records.forEach(r => {
        if (!r.date) return;
        const prev = dateMap[r.date];
        if (!prev || (priority[r.status] || 0) > (priority[prev] || 0)) {
            dateMap[r.date] = r.status;
        }
    });

    const dates = Object.keys(dateMap).sort();
    if (dates.length === 0) return '';

    const now = new Date();
    let html = '<div style="display:flex;flex-wrap:wrap;gap:1.5rem;">';
    let cur = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    while (cur < end) {
        const year  = cur.getFullYear();
        const month = cur.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDow = new Date(year, month, 1).getDay();

        html += `<div style="min-width:200px;">`;
        html += `<p style="font-size:0.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin:0 0 0.5rem;">${window.MONTH_NAMES[month]} ${year}</p>`;
        html += `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-size:0.7rem;text-align:center;">`;
        ['S','M','T','W','T','F','S'].forEach(d => { html += `<div style="color:var(--text-muted);padding-bottom:2px;">${d}</div>`; });
        for (let i = 0; i < firstDow; i++) html += '<div></div>';
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const status = dateMap[dateStr];
            const bg = status === 'present' ? 'var(--success,#22c55e)' : status === 'absent' ? 'var(--danger,#ef4444)' : status === 'late' ? 'var(--warning,#f59e0b)' : 'transparent';
            const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
            html += `<div title="${dateStr}${label ? ' — ' + label : ''}" style="border-radius:3px;background:${bg};color:${status ? 'white' : 'var(--text-secondary)'};padding:2px 0;font-size:0.68rem;">${d}</div>`;
        }
        html += '</div></div>';
        cur.setMonth(cur.getMonth() + 1);
    }

    html += '</div>';
    html += `<div style="display:flex;gap:1rem;margin-top:0.75rem;font-size:0.78rem;color:var(--text-muted);">
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--success,#22c55e);margin-right:3px;"></span>Present</span>
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--danger,#ef4444);margin-right:3px;"></span>Absent</span>
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--warning,#f59e0b);margin-right:3px;"></span>Late</span>
    </div>`;
    return html;
}

function renderAttendance() {
    const activeBtn = document.querySelector('#attBatchPills .pill-toggle__btn--active');
    const batchFilter = activeBtn?.dataset.batch || '';
    const tbody = document.getElementById('attendanceTableBody');

    const filtered = allAttendance.filter(r => {
        if (batchFilter && r.classes?.batch_id !== batchFilter) return false;
        return true;
    });


    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-text">No attendance records found.</td></tr>';
        return;
    }

    const statusColor = { present: 'var(--success,#22c55e)', absent: 'var(--danger,#ef4444)', late: 'var(--warning,#f59e0b)' };
    const statusLabel = { present: 'Present', absent: 'Absent', late: 'Late' };

    tbody.innerHTML = filtered.map(r => {
        const batch   = r.classes?.batches || {};
        const dateStr = r.date ? new Date(r.date).toLocaleDateString('en-IN') : '—';
        const status  = r.status || 'present';
        const color   = statusColor[status] || 'inherit';
        const label   = statusLabel[status] || status;

        return `<tr class="data-table__row">
            <td class="data-table__td">${dateStr}</td>
            <td class="data-table__td">${window.esc(batch.name || '—')}</td>
            <td class="data-table__td">${window.esc(batch.subject || '—')}</td>
            <td class="data-table__td"><span style="font-weight:600;color:${color};">${label}</span></td>
        </tr>`;
    }).join('');
}
