let currentDate = new Date();
let currentOpenClass = null;
let currentOpenClassGroup = null;

async function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const header = document.getElementById('calendarMonthYear');
    if (!grid || !header) return;

    const startDate = new Date(currentDate);
    const dayOfWeek = startDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate.setDate(startDate.getDate() + diffToMonday);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    header.innerHTML = `<span class="cal-range-start">${window.MONTH_NAMES[startDate.getMonth()]} ${startDate.getDate()}</span><span class="cal-range-sep"> – </span><span class="cal-range-end">${window.MONTH_NAMES[endDate.getMonth()]} ${endDate.getDate()}</span>`;

    grid.querySelectorAll('.calendar__day').forEach(cell => cell.remove());

    const loadingCell = document.createElement('div');
    loadingCell.className = 'calendar__day';
    loadingCell.style.gridColumn = '1 / -1';
    loadingCell.style.textAlign = 'center';
    loadingCell.textContent = 'Loading classes...';
    grid.appendChild(loadingCell);

    const resClasses = await window.api.get('classes', {}, '*, batches:batch_id(name, grade, subject)');
    const classes = resClasses.success ? resClasses.data : [];

    loadingCell.remove();

    for (let i = 0; i < 7; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);

        const cell = document.createElement('div');
        cell.className = 'calendar__day';

        const year = cellDate.getFullYear();
        const month = cellDate.getMonth();
        const day = cellDate.getDate();
        const cellDayOfWeek = cellDate.getDay();
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const today = new Date();
        const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        cell.innerHTML = isToday
            ? `<div class="calendar__date calendar__date--today">${day}</div>`
            : `<div class="calendar__date">${day}</div>`;
        if (isToday) cell.classList.add('calendar__day--today');

        const activeGrade = window.getActiveGrade();
        const dayClasses = classes.filter(c => {
            if (activeGrade && (c.grade || c.batches?.grade) !== activeGrade) return false;
            if (c.type === 'regular' && c.day_of_week === cellDayOfWeek) return true;
            if (c.type === 'extra' && c.class_date === dateString) return true;
            return false;
        });

        dayClasses.sort((a, b) => a.start_time.localeCompare(b.start_time));
        if (dayClasses.length === 0) cell.classList.add('calendar__day--empty');

        const pillsContainer = document.createElement('div');
        pillsContainer.className = 'calendar__pills';

        dayClasses.forEach(c => {
            const pill = document.createElement('div');
            const batchGrade = c.grade || c.batches?.grade || '';
            const isExtra = c.type === 'extra';
            const gradeClass = batchGrade.includes('11') ? ' class-item--grade-11'
                : batchGrade.includes('12') ? ' class-item--grade-12' : '';
            pill.className = `class-item${gradeClass}`;
            const batchSubject = c.batches?.subject || '';
            const batchName = c.batches?.name || 'Open Class';
            const timeStr = window.formatTime(c.start_time);
            pill.innerHTML = `
                ${isExtra ? '<div class="class-item__top-row"><span class="class-item__badge class-item__badge--extra">Extra</span></div>' : ''}
                <div class="class-item__body">
                    <strong>${window.esc(batchName)}</strong>
                    <div class="class-item__meta">
                        <span class="text-muted">${window.esc(batchSubject)}</span>
                        <span class="text-muted">${timeStr}</span>
                    </div>
                </div>`;

            const relatedClasses = c.class_group_id
                ? classes.filter(other => other.class_group_id === c.class_group_id && other.id !== c.id)
                : [];
            const relatedDays = relatedClasses.map(rc => window.DAYS[rc.day_of_week]).join(', ');

            pill.dataset.classData = JSON.stringify({
                id: c.id,
                class_group_id: c.class_group_id,
                title: c.title,
                batchName,
                grade: batchGrade,
                timeSpan: `${window.formatTime(c.start_time)} – ${window.formatTime(c.end_time)}`,
                startTime: c.start_time.substring(0, 5),
                type: c.type,
                notes: c.notes,
                batch_id: c.batch_id,
                relatedDays,
                date: dateString
            });

            pill.addEventListener('click', async (e) => {
                const data = JSON.parse(e.currentTarget.dataset.classData);
                await window.loadPage('page-attendance');
                if (window.openAttendanceGrid) {
                    window.openAttendanceGrid(data.id, data.batch_id, data.title, data.batchName, data.startTime, data.date, data.grade);
                }
            });

            pillsContainer.appendChild(pill);
        });

        cell.appendChild(pillsContainer);
        grid.appendChild(cell);
    }
}

export function init() {
    renderCalendar();

    document.getElementById('btnPrevMonth')?.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 7);
        renderCalendar();
    });

    document.getElementById('btnNextMonth')?.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 7);
        renderCalendar();
    });

    // Class detail modal — lives in the dashboard shell
    const classModal = document.getElementById('classModalOverlay');
    document.getElementById('btnModalClose')?.addEventListener('click', () => {
        if (classModal) classModal.style.display = 'none';
        currentOpenClass = null;
        currentOpenClassGroup = null;
    });

    document.getElementById('btnModalDeleteClass')?.addEventListener('click', async () => {
        if (!currentOpenClass) return;
        const isGrouped = !!currentOpenClassGroup;
        const confirmMsg = isGrouped
            ? 'Delete this class AND all its linked days? They will be removed from all future weeks.'
            : 'Delete this class? It will be removed from all future weeks.';
        if (!confirm(confirmMsg)) return;
        if (classModal) classModal.style.display = 'none';

        const res = isGrouped
            ? await window.api.deleteMany('classes', { class_group_id: currentOpenClassGroup })
            : await window.api.delete('classes', currentOpenClass);

        if (res.success) {
            currentOpenClass = null;
            currentOpenClassGroup = null;
            renderCalendar();
        } else {
            alert('Failed to delete class: ' + res.error);
            if (classModal) classModal.style.display = 'flex';
        }
    });

    window.addEventListener('click', (e) => {
        if (classModal && e.target === classModal) {
            classModal.style.display = 'none';
            currentOpenClass = null;
            currentOpenClassGroup = null;
        }
    });

    window.openClassModal = async function (data) {
        if (!classModal) return;
        currentOpenClass = data.id;
        currentOpenClassGroup = data.class_group_id;

        document.getElementById('modalClassTitle').textContent = data.title;

        let metaString = `${window.esc(data.timeSpan)} • ${window.esc(data.batchName)} (${data.type === 'regular' ? 'Weekly' : 'Extra Class'})`;
        if (data.relatedDays) {
            metaString += `<br><span style="color:var(--primary);font-weight:500;font-size:0.85rem;">Also held on: ${window.esc(data.relatedDays)}</span>`;
        }
        document.getElementById('modalClassMeta').innerHTML = metaString;

        const notesEl = document.getElementById('modalClassNotes');
        if (notesEl) {
            if (data.notes) { notesEl.textContent = data.notes; notesEl.style.display = 'block'; }
            else notesEl.style.display = 'none';
        }

        const tbody = document.getElementById('modalStudentList');
        const countSpan = document.getElementById('modalStudentCount');
        classModal.style.display = 'flex';

        if (!data.batch_id) {
            if (countSpan) countSpan.textContent = '0';
            if (tbody) tbody.innerHTML = '<tr><td colspan="2" class="loading-text">Open class — no assigned batch.</td></tr>';
        } else {
            if (tbody) tbody.innerHTML = '<tr><td colspan="2" class="loading-text">Loading students...</td></tr>';
            const res = await window.api.get('batch_students', { batch_id: data.batch_id }, '*, profiles:student_id(name, grade)');
            if (res.success && res.data) {
                if (countSpan) countSpan.textContent = res.data.length;
                if (tbody) tbody.innerHTML = res.data.length > 0
                    ? res.data.map(m => `<tr><td>${window.esc(m.profiles?.name) || '-'}</td><td>${window.esc(m.profiles?.grade) || '-'}</td></tr>`).join('')
                    : '<tr><td colspan="2" class="loading-text">No students enrolled.</td></tr>';
            } else {
                if (tbody) tbody.innerHTML = '<tr><td colspan="2" class="loading-text">Failed to load students.</td></tr>';
                if (countSpan) countSpan.textContent = '0';
            }
        }
    };
}

export function refresh() {
    renderCalendar();
}
