let user, studentBatchIds, currentDate;

export async function init() {
    user = window.auth.getUser();
    currentDate = new Date();
    studentBatchIds = [];

    await loadStudentBatches();
    await renderCalendar();

    document.getElementById('btnSchedPrev')?.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 14);
        renderCalendar();
    });
    document.getElementById('btnSchedNext')?.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 14);
        renderCalendar();
    });
    document.getElementById('btnRefreshSchedule')?.addEventListener('click', async () => {
        await loadStudentBatches();
        await renderCalendar();
    });
    document.getElementById('btnClosePopover')?.addEventListener('click', () => {
        document.getElementById('schedPopover').style.display = 'none';
    });
}

export async function refresh() {
    await loadStudentBatches();
    await renderCalendar();
}

async function loadStudentBatches() {
    const infoEl = document.getElementById('enrolledBatchesInfo');

    const res = await window.api.get('batch_students', { student_id: user.id }, 'batch_id, batches:batch_id(name, subject, grade)');
    if (!res.success || !res.data || res.data.length === 0) {
        studentBatchIds = [];
        if (infoEl) infoEl.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem;">Not enrolled in any batches yet.</span>';
        return;
    }

    studentBatchIds = res.data.map(bs => bs.batch_id);

    if (infoEl) {
        infoEl.innerHTML = res.data.map(bs => {
            const b = bs.batches || {};
            return `<span style="background:var(--primary-light,rgba(99,102,241,0.12));color:var(--primary);border-radius:999px;padding:0.25rem 0.75rem;font-size:0.8rem;font-weight:600;">${window.esc(b.grade || '')} ${window.esc(b.subject || '')} — ${window.esc(b.name || '')}</span>`;
        }).join('');
    }
}

async function renderCalendar() {
    const grid = document.getElementById('schedCalendarGrid');
    const header = document.getElementById('schedMonthYear');
    if (!grid || !header) return;

    // Calculate 14-day window starting from Monday of current week
    const startDate = new Date(currentDate);
    const dow = startDate.getDay();
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    startDate.setDate(startDate.getDate() + diffToMonday);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 13);

    header.textContent = `${window.MONTH_NAMES[startDate.getMonth()]} ${startDate.getDate()} – ${window.MONTH_NAMES[endDate.getMonth()]} ${endDate.getDate()}, ${endDate.getFullYear()}`;

    // Remove old day cells (keep header row)
    grid.querySelectorAll('.calendar__day').forEach(c => c.remove());

    // Loading placeholder
    const loadingCell = document.createElement('div');
    loadingCell.className = 'calendar__day';
    loadingCell.style.gridColumn = '1 / -1';
    loadingCell.style.textAlign = 'center';
    loadingCell.textContent = 'Loading schedule...';
    grid.appendChild(loadingCell);

    // Fetch all classes with batch info
    const res = await window.api.get('classes', {}, '*, batches:batch_id(name, grade, subject)');
    const allClasses = res.success ? (res.data || []) : [];

    // Filter to only student's enrolled batches
    const myClasses = studentBatchIds.length > 0
        ? allClasses.filter(c => studentBatchIds.includes(c.batch_id))
        : [];

    loadingCell.remove();

    const today = new Date();

    for (let i = 0; i < 14; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);

        const year  = cellDate.getFullYear();
        const month = cellDate.getMonth();
        const day   = cellDate.getDate();
        const cellDow = cellDate.getDay();
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

        const cell = document.createElement('div');
        cell.className = 'calendar__day';
        cell.innerHTML = `<div class="calendar__date${isToday ? ' calendar__date--today' : ''}">${day}</div>`;

        const dayClasses = myClasses.filter(c => {
            if (c.type === 'regular' && c.day_of_week === cellDow) return true;
            if (c.type === 'extra' && c.class_date === dateString) return true;
            return false;
        }).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

        const pillsContainer = document.createElement('div');
        pillsContainer.className = 'calendar__pills';

        dayClasses.forEach(c => {
            const pill = document.createElement('div');
            pill.className = `calendar__pill calendar__pill--${c.type}`;
            pill.style.cursor = 'pointer';

            const timeStr = window.formatTime ? window.formatTime(c.start_time) : (c.start_time || '');
            const batchSubject = c.batches?.subject || '';
            const batchName = c.batches?.name || '';

            pill.innerHTML = `
                <div class="calendar__pill-time">${timeStr}</div>
                <div class="calendar__pill-title">${window.esc(batchSubject)}</div>
                <div class="calendar__pill-subtitle">${window.esc(batchName)}</div>
            `;

            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                showPopover(c, timeStr);
            });

            pillsContainer.appendChild(pill);
        });

        cell.appendChild(pillsContainer);
        grid.appendChild(cell);
    }
}

function showPopover(c, timeStr) {
    const popover = document.getElementById('schedPopover');
    const titleEl = document.getElementById('schedPopoverTitle');
    const metaEl  = document.getElementById('schedPopoverMeta');
    if (!popover || !titleEl || !metaEl) return;

    const b = c.batches || {};
    titleEl.textContent = c.title || `${b.grade || ''} ${b.subject || ''} Class`;

    const endTime = window.formatTime ? window.formatTime(c.end_time) : (c.end_time || '');
    const timeSpan = endTime ? `${timeStr} – ${endTime}` : timeStr;
    const typeLabel = c.type === 'extra' ? 'Extra Class' : 'Regular Class';
    metaEl.textContent = `${timeSpan} · ${window.esc(b.name || '')} · ${typeLabel}${c.notes ? ' · ' + c.notes : ''}`;

    popover.style.display = 'block';
    popover.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
