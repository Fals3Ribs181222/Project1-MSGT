const user = window.auth.getUser();

// State for custom time picker and calendar
let currentDate = new Date(); // Month currently being viewed
let currentOpenClass = null;
let currentOpenClassGroup = null;

let pickerState = {
    active: null, // 'start' or 'end'
    start: { hour: '12', min: '00', ampm: 'PM', set: false },
    end: { hour: '12', min: '00', ampm: 'PM', set: false }
};

async function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const header = document.getElementById('calendarMonthYear');
    if (!grid || !header) return;

    const startDate = new Date(currentDate);
    const dayOfWeek = startDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate.setDate(startDate.getDate() + diffToMonday);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 13); // 14 days total

    header.innerHTML = `<span class="cal-range-start">${window.MONTH_NAMES[startDate.getMonth()]} ${startDate.getDate()}</span><span class="cal-range-sep"> – </span><span class="cal-range-end">${window.MONTH_NAMES[endDate.getMonth()]} ${endDate.getDate()}</span>`;

    const dayCells = grid.querySelectorAll('.calendar__day');
    dayCells.forEach(cell => cell.remove());

    const loadingCell = document.createElement('div');
    loadingCell.className = 'calendar__day';
    loadingCell.style.gridColumn = '1 / -1';
    loadingCell.style.textAlign = 'center';
    loadingCell.textContent = 'Loading classes...';
    grid.appendChild(loadingCell);

    const resClasses = await window.api.get('classes', {}, '*, batches:batch_id(name, grade, subject)');
    const classes = resClasses.success ? resClasses.data : [];

    loadingCell.remove();

    for (let i = 0; i < 14; i++) {
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
        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            cell.innerHTML = `<div class="calendar__date calendar__date--today">${day}</div>`;
        } else {
            cell.innerHTML = `<div class="calendar__date">${day}</div>`;
        }

        const dayClasses = classes.filter(c => {
            if (c.type === 'regular' && c.day_of_week === cellDayOfWeek) return true;
            if (c.type === 'extra' && c.class_date === dateString) return true;
            return false;
        });

        dayClasses.sort((a, b) => a.start_time.localeCompare(b.start_time));

        const pillsContainer = document.createElement('div');
        pillsContainer.className = 'calendar__pills';

        dayClasses.forEach(c => {
            const pill = document.createElement('div');
            const batchGrade = c.batches?.grade || '';
            const gradeClass = batchGrade.includes('11') ? 'calendar__pill--grade-11'
                : batchGrade.includes('12') ? 'calendar__pill--grade-12'
                : `calendar__pill--${c.type}`;
            pill.className = `calendar__pill ${gradeClass}`;
            const batchSubject = c.batches?.subject || '';
            const batchName = c.batches?.name || '';
            pill.innerHTML = `
                <div class="calendar__pill-time">${window.formatTime(c.start_time)}</div>
                <div class="calendar__pill-title">${window.esc(batchGrade)} ${window.esc(batchSubject)}</div>
                <div class="calendar__pill-subtitle">${window.esc(batchName)}</div>
            `;

            const relatedClasses = c.class_group_id ? classes.filter(other =>
                other.class_group_id === c.class_group_id && other.id !== c.id
            ) : [];

            const relatedDays = relatedClasses.map(rc => window.DAYS[rc.day_of_week]).join(', ');

            pill.dataset.classData = JSON.stringify({
                id: c.id,
                class_group_id: c.class_group_id,
                title: c.title,
                batchName: c.batches ? c.batches.name : 'Unknown Batch',
                timeSpan: `${window.formatTime(c.start_time)} – ${window.formatTime(c.end_time)}`,
                startTime: c.start_time.substring(0, 5),
                type: c.type,
                notes: c.notes,
                batch_id: c.batch_id,
                relatedDays: relatedDays
            });

            pill.addEventListener('click', async (e) => {
                const data = JSON.parse(e.currentTarget.dataset.classData);
                await window.loadTab('panel-attendance');
                if (window.openAttendanceGrid) {
                    window.openAttendanceGrid(data.id, data.batch_id, data.title, data.batchName, data.startTime);
                }
            });

            pillsContainer.appendChild(pill);
        });

        cell.appendChild(pillsContainer);
        grid.appendChild(cell);
    }
}

async function loadClassComponent() {
    try {
        const response = await fetch('components/modals/add_class');
        if (response.ok) {
            const html = await response.text();
            const container = document.getElementById('addClassContainer');
            if (container) {
                container.innerHTML = html;
                attachClassFormListeners();
            }
        }
    } catch (err) {
        console.error('Error loading class component:', err);
    }
}

async function refreshBatchDropdown() {
    const select = document.getElementById('classBatch');
    if (!select) return;

    select.innerHTML = '<option value="">-- Select Batch --</option>';
    const res = await window.api.get('batches');
    if (res.success && res.data) {
        const sorted = (res.data || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        sorted.forEach(batch => {
            const opt = document.createElement('option');
            opt.value = batch.id;
            const subject = batch.subject || 'General Segment';
            const grade = batch.grade || 'General Grade';
            const name = batch.name || 'Unknown Batch';
            opt.textContent = `${grade} – ${name} – ${subject}`;
            opt.dataset.subject = subject;
            opt.dataset.name = name;
            opt.dataset.grade = grade;
            select.appendChild(opt);
        });
    }
}

function attachClassFormListeners() {
    const form = document.getElementById('classForm');
    if (!form) return;

    const btnReg = document.getElementById('btnTypeRegular');
    const btnEx = document.getElementById('btnTypeExtra');
    const typeInput = document.getElementById('classType');
    const groupDay = document.getElementById('groupDayOfWeek');
    const groupDate = document.getElementById('groupDate');

    if (btnReg && btnEx) {
        btnReg.addEventListener('click', () => {
            btnReg.classList.add('pill-toggle__btn--active');
            btnEx.classList.remove('pill-toggle__btn--active');
            typeInput.value = 'regular';
            groupDay.style.display = 'block';
            groupDate.style.display = 'none';
            document.getElementById('classDate').required = false;
        });

        btnEx.addEventListener('click', () => {
            btnEx.classList.add('pill-toggle__btn--active');
            btnReg.classList.remove('pill-toggle__btn--active');
            typeInput.value = 'extra';
            groupDay.style.display = 'none';
            groupDate.style.display = 'block';
            document.getElementById('classDate').required = true;
        });
    }

    // Time Picker Logic
    const startDisplay = document.getElementById('classStartTimeDisplay');
    const endDisplay = document.getElementById('classEndTimeDisplay');
    const startVal = document.getElementById('startDisplayValue');
    const endVal = document.getElementById('endDisplayValue');
    const startInput = document.getElementById('classStartTime');
    const endInput = document.getElementById('classEndTime');

    const panel = document.getElementById('timePickerPanel');
    const hourCol = document.getElementById('timeHourCol');
    const minCol = document.getElementById('timeMinuteCol');
    const amPmCol = document.getElementById('timeAmPmCol');

    const renderPanelOptions = () => {
        if (!pickerState.active) return;
        const s = pickerState[pickerState.active];

        hourCol.innerHTML = Array.from({ length: 12 }, (_, i) => {
            const h = String(i + 1).padStart(2, '0');
            return `<div class="time-option time-option--hour ${h === s.hour ? 'time-option--selected' : ''}" data-val="${h}">${h}</div>`;
        }).join('');

        minCol.innerHTML = ['00', '15', '30', '45'].map(m => {
            return `<div class="time-option time-option--min ${m === s.min ? 'time-option--selected' : ''}" style="flex: 1 1 calc(25% - 0.4rem);" data-val="${m}">${m}</div>`;
        }).join('');

        amPmCol.innerHTML = ['AM', 'PM'].map(a => {
            return `<div class="time-option time-option--ampm ${a === s.ampm ? 'time-option--selected' : ''}" style="flex: 1 1 calc(50% - 0.4rem);" data-val="${a}">${a}</div>`;
        }).join('');
    };

    const syncInputs = () => {
        if (!pickerState.active) return;
        const activeMode = pickerState.active;
        const s = pickerState[activeMode];
        s.set = true;

        const valTarget = activeMode === 'start' ? startVal : endVal;
        valTarget.textContent = `${s.hour}:${s.min} ${s.ampm}`;

        const inputTarget = activeMode === 'start' ? startInput : endInput;
        let hh = parseInt(s.hour);
        if (s.ampm === 'PM' && hh !== 12) hh += 12;
        if (s.ampm === 'AM' && hh === 12) hh = 0;
        inputTarget.value = `${String(hh).padStart(2, '0')}:${s.min}`;
    };

    const openPanel = (mode) => {
        if (pickerState.active === mode && panel.style.display === 'flex') {
            panel.style.display = 'none';
            pickerState.active = null;
            startDisplay.style.borderColor = 'var(--border-color)';
            endDisplay.style.borderColor = 'var(--border-color)';
            return;
        }
        pickerState.active = mode;
        renderPanelOptions();
        panel.style.display = 'flex';

        if (mode === 'end') {
            panel.style.marginLeft = 'calc(50% + 0.75rem)';
        } else {
            panel.style.marginLeft = '0';
        }

        startDisplay.style.borderColor = mode === 'start' ? 'var(--primary)' : 'var(--border-color)';
        endDisplay.style.borderColor = mode === 'end' ? 'var(--primary)' : 'var(--border-color)';
    };

    if (startDisplay) startDisplay.addEventListener('click', (e) => { e.stopPropagation(); openPanel('start'); });
    if (endDisplay) endDisplay.addEventListener('click', (e) => { e.stopPropagation(); openPanel('end'); });

    if (panel) {
        panel.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!e.target.classList.contains('time-option') || !pickerState.active) return;
            const val = e.target.dataset.val;
            if (e.target.classList.contains('time-option--hour')) pickerState[pickerState.active].hour = val;
            else if (e.target.classList.contains('time-option--min')) pickerState[pickerState.active].min = val;
            else if (e.target.classList.contains('time-option--ampm')) pickerState[pickerState.active].ampm = val;
            renderPanelOptions();
            syncInputs();
        });
    }

    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';

    window.addEventListener('click', () => {
        if (panel) panel.style.display = 'none';
        pickerState.active = null;
        if (startDisplay) startDisplay.style.borderColor = 'var(--border-color)';
        if (endDisplay) endDisplay.style.borderColor = 'var(--border-color)';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnCreateClass');
        const btnText = document.getElementById('btnCreateClassText');
        const btnSpinner = document.getElementById('btnCreateClassSpinner');
        const status = document.getElementById('classFormStatus');

        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-block';
        btn.disabled = true;
        status.style.display = 'none';

        const type = typeInput?.value || 'regular';
        const batchSelect = document.getElementById('classBatch');
        const selectedOption = batchSelect.options[batchSelect.selectedIndex];
        const subjectName = selectedOption ? selectedOption.dataset.subject : 'Class';
        const batchName = selectedOption ? selectedOption.dataset.name : 'Batch';
        const gradeName = selectedOption ? selectedOption.dataset.grade : 'Grade';

        const autoTitle = type === 'regular'
            ? `${gradeName} – ${batchName} – ${subjectName}`
            : `${gradeName} – ${batchName} – ${subjectName} (Extra)`;

        const sharedGroupId = crypto.randomUUID();

        const basePayload = {
            batch_id: batchSelect.value,
            title: autoTitle,
            type: type,
            start_time: document.getElementById('classStartTime').value,
            end_time: document.getElementById('classEndTime').value,
            notes: document.getElementById('classNotes').value.trim() || null,
            created_by: user.id,
            class_group_id: sharedGroupId
        };

        let success = true;
        let errorMessage = '';

        try {
            if (type === 'regular') {
                const checkedDays = Array.from(document.querySelectorAll('input[name="classDays"]:checked')).map(cb => parseInt(cb.value));
                if (checkedDays.length === 0) throw new Error('Please select at least one day for a regular class.');

                const promises = checkedDays.map(day => {
                    const payload = { ...basePayload, day_of_week: day };
                    return window.api.post('classes', payload);
                });

                const responses = await Promise.all(promises);
                const failed = responses.find(r => !r.success);
                if (failed) {
                    success = false;
                    errorMessage = failed.error;
                }
            } else {
                basePayload.class_date = document.getElementById('classDate').value;
                const response = await window.api.post('classes', basePayload);
                if (!response.success) {
                    success = false;
                    errorMessage = response.error;
                }
            }
        } catch (err) {
            success = false;
            errorMessage = err.message;
        }

        btnText.style.display = 'inline-block';
        btnSpinner.style.display = 'none';
        btn.disabled = false;

        if (success) {
            status.textContent = type === 'regular' ? 'Classes scheduled successfully!' : 'Class scheduled successfully!';
            status.className = 'status status--success';
            status.style.display = 'block';
            window.safeFormReset(form);
            if (type === 'regular' && btnReg) btnReg.click();
            else if (btnEx) btnEx.click();
            renderCalendar();
        } else {
            status.textContent = errorMessage || 'Failed to schedule class(es).';
            status.className = 'status status--error';
            status.style.display = 'block';
        }
    });
}

window.openClassModal = async function (data) {
    const classModal = document.getElementById('classModalOverlay');
    if (!classModal) return;

    currentOpenClass = data.id;
    currentOpenClassGroup = data.class_group_id;

    document.getElementById('modalClassTitle').textContent = data.title;

    let metaString = `${window.esc(data.timeSpan)} • ${window.esc(data.batchName)} (${data.type === 'regular' ? 'Weekly' : 'Extra Class'})`;
    if (data.relatedDays) {
        metaString += `<br><span style="color: var(--primary); font-weight: 500; font-size: 0.85rem;">Also held on: ${window.esc(data.relatedDays)}</span>`;
    }
    document.getElementById('modalClassMeta').innerHTML = metaString;

    const notesEl = document.getElementById('modalClassNotes');
    if (data.notes) {
        notesEl.textContent = data.notes;
        notesEl.style.display = 'block';
    } else {
        notesEl.style.display = 'none';
    }

    const tbody = document.getElementById('modalStudentList');
    const countSpan = document.getElementById('modalStudentCount');
    tbody.innerHTML = '<tr><td colspan="2" class="loading-text">Loading students...</td></tr>';

    classModal.style.display = 'flex';

    const res = await window.api.get('batch_students', { batch_id: data.batch_id }, '*, profiles:student_id(name, grade)');
    if (res.success && res.data) {
        countSpan.textContent = res.data.length;
        if (res.data.length > 0) {
            tbody.innerHTML = res.data.map(m => {
                const p = m.profiles || {};
                return `<tr>
                            <td>${window.esc(p.name) || '-'}</td>
                            <td>${window.esc(p.grade) || '-'}</td>
                        </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="2" class="loading-text">No students enrolled in this batch.</td></tr>';
        }
    } else {
        tbody.innerHTML = '<tr><td colspan="2" class="loading-text">Failed to load students.</td></tr>';
        countSpan.textContent = '0';
    }
};

export function init() {
    renderCalendar();
    loadClassComponent();

    const pillViewCalendar = document.getElementById('pillViewCalendar');
    const pillAddClass = document.getElementById('pillAddClass');
    const calendarContainer = document.getElementById('calendarContainer');
    const addClassContainer = document.getElementById('addClassContainer');

    if (pillViewCalendar && pillAddClass) {
        pillViewCalendar.addEventListener('click', () => {
            pillViewCalendar.classList.add('pill-toggle__btn--active');
            pillAddClass.classList.remove('pill-toggle__btn--active');
            if (calendarContainer) calendarContainer.style.display = 'block';
            if (addClassContainer) addClassContainer.style.display = 'none';
            renderCalendar();
        });

        pillAddClass.addEventListener('click', () => {
            pillAddClass.classList.add('pill-toggle__btn--active');
            pillViewCalendar.classList.remove('pill-toggle__btn--active');
            if (calendarContainer) calendarContainer.style.display = 'none';
            if (addClassContainer) addClassContainer.style.display = 'block';
            refreshBatchDropdown();
        });
    }

    const btnPrevMonth = document.getElementById('btnPrevMonth');
    const btnNextMonth = document.getElementById('btnNextMonth');

    if (btnPrevMonth) {
        btnPrevMonth.addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() - 14);
            renderCalendar();
        });
    }

    if (btnNextMonth) {
        btnNextMonth.addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() + 14);
            renderCalendar();
        });
    }

    const classModal = document.getElementById('classModalOverlay');
    const btnModalClose = document.getElementById('btnModalClose');

    if (btnModalClose) {
        btnModalClose.addEventListener('click', () => {
            classModal.style.display = 'none';
            currentOpenClass = null;
        });
    }

    const btnModalDeleteClass = document.getElementById('btnModalDeleteClass');
    if (btnModalDeleteClass) {
        btnModalDeleteClass.addEventListener('click', async () => {
            if (!currentOpenClass) return;

            const isGrouped = !!currentOpenClassGroup;
            const confirmMsg = isGrouped
                ? 'Are you sure you want to delete this class AND all its linked days across the week? They will be removed from all future weeks.'
                : 'Are you sure you want to delete this class? It will be removed from all future weeks.';

            if (!confirm(confirmMsg)) return;

            classModal.style.display = 'none';

            let res;
            if (isGrouped) {
                res = await window.api.deleteMany('classes', { class_group_id: currentOpenClassGroup });
            } else {
                res = await window.api.delete('classes', currentOpenClass);
            }

            if (res.success) {
                currentOpenClass = null;
                currentOpenClassGroup = null;
                renderCalendar();
            } else {
                alert('Failed to delete class: ' + res.error);
                classModal.style.display = 'flex';
            }
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === classModal) {
            classModal.style.display = 'none';
            currentOpenClass = null;
            currentOpenClassGroup = null;
        }
    });

}

export function refresh() {
    renderCalendar();
}
