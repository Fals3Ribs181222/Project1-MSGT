const user = window.auth.getUser();

let pickerState = {
    active: null,
    start: { hour: '12', min: '00', ampm: 'PM', set: false },
    end:   { hour: '12', min: '00', ampm: 'PM', set: false }
};

function filterBatchByGrade(grade) {
    const batchSelect = document.getElementById('classBatch');
    if (!batchSelect) return;
    Array.from(batchSelect.options).forEach(opt => {
        if (!opt.value) return;
        opt.style.display = (!grade || opt.dataset.gradeFilter === grade) ? '' : 'none';
    });
    const sel = batchSelect.options[batchSelect.selectedIndex];
    if (sel && sel.value && sel.style.display === 'none') batchSelect.value = '';
}

async function loadDropdowns() {
    const gradeSelect = document.getElementById('classGrade');
    const batchSelect = document.getElementById('classBatch');
    if (!gradeSelect || !batchSelect) return;

    batchSelect.innerHTML = '<option value="">Open Class</option>';

    const res = await window.api.get('batches');
    if (!res.success || !res.data) return;

    const sorted = (res.data || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const grades = [...new Set(sorted.map(b => b.grade).filter(Boolean))].sort();

    gradeSelect.innerHTML = '<option value="" disabled selected>Select Grade</option>';
    grades.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        gradeSelect.appendChild(opt);
    });

    sorted.forEach(batch => {
        const opt = document.createElement('option');
        opt.value = batch.id;
        opt.textContent = `${batch.name || 'Unknown Batch'} – ${batch.subject || 'General Segment'}`;
        opt.dataset.subject = batch.subject || 'General Segment';
        opt.dataset.name = batch.name || '';
        opt.dataset.grade = batch.grade || '';
        opt.dataset.gradeFilter = batch.grade || '';
        batchSelect.appendChild(opt);
    });

    batchSelect.disabled = true;
    gradeSelect.addEventListener('change', () => {
        batchSelect.disabled = !gradeSelect.value;
        if (!gradeSelect.value) batchSelect.value = '';
        filterBatchByGrade(gradeSelect.value);
    });
    filterBatchByGrade(gradeSelect.value);
}

function initTimePicker() {
    const panel = document.getElementById('timePickerPanel');
    const hourCol = document.getElementById('timeHourCol');
    const minCol = document.getElementById('timeMinuteCol');
    const amPmCol = document.getElementById('timeAmPmCol');
    const startDisplay = document.getElementById('classStartTimeDisplay');
    const endDisplay = document.getElementById('classEndTimeDisplay');
    const startVal = document.getElementById('startDisplayValue');
    const endVal = document.getElementById('endDisplayValue');
    const startInput = document.getElementById('classStartTime');
    const endInput = document.getElementById('classEndTime');

    const renderPanel = () => {
        if (!pickerState.active) return;
        const s = pickerState[pickerState.active];
        hourCol.innerHTML = Array.from({ length: 12 }, (_, i) => {
            const h = String(i + 1).padStart(2, '0');
            return `<div class="time-option time-option--hour ${h === s.hour ? 'time-option--selected' : ''}" data-val="${h}">${h}</div>`;
        }).join('');
        minCol.innerHTML = ['00', '15', '30', '45'].map(m =>
            `<div class="time-option time-option--min ${m === s.min ? 'time-option--selected' : ''}" style="flex:1 1 calc(50% - 0.4rem);" data-val="${m}">${m}</div>`
        ).join('');
        amPmCol.innerHTML = ['AM', 'PM'].map(a =>
            `<div class="time-option time-option--ampm ${a === s.ampm ? 'time-option--selected' : ''}" style="flex:1 1 100%;" data-val="${a}">${a}</div>`
        ).join('');
    };

    const syncInputs = () => {
        if (!pickerState.active) return;
        const mode = pickerState.active;
        const s = pickerState[mode];
        s.set = true;
        (mode === 'start' ? startVal : endVal).textContent = `${s.hour}:${s.min} ${s.ampm}`;
        let hh = parseInt(s.hour);
        if (s.ampm === 'PM' && hh !== 12) hh += 12;
        if (s.ampm === 'AM' && hh === 12) hh = 0;
        (mode === 'start' ? startInput : endInput).value = `${String(hh).padStart(2, '0')}:${s.min}`;
    };

    const openPanel = (mode) => {
        if (pickerState.active === mode && panel.style.display === 'flex') {
            panel.style.display = 'none';
            pickerState.active = null;
            startDisplay.style.borderColor = endDisplay.style.borderColor = 'var(--border-color)';
            return;
        }
        pickerState.active = mode;
        renderPanel();
        panel.style.display = 'flex';
        startDisplay.style.borderColor = mode === 'start' ? 'var(--primary)' : 'var(--border-color)';
        endDisplay.style.borderColor   = mode === 'end'   ? 'var(--primary)' : 'var(--border-color)';
    };

    startDisplay?.addEventListener('click', (e) => { e.stopPropagation(); openPanel('start'); });
    endDisplay?.addEventListener('click',   (e) => { e.stopPropagation(); openPanel('end'); });

    panel?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!e.target.classList.contains('time-option') || !pickerState.active) return;
        const val = e.target.dataset.val;
        if (e.target.classList.contains('time-option--hour'))  pickerState[pickerState.active].hour = val;
        if (e.target.classList.contains('time-option--min'))   pickerState[pickerState.active].min  = val;
        if (e.target.classList.contains('time-option--ampm'))  pickerState[pickerState.active].ampm = val;
        renderPanel();
        syncInputs();
    });

    if (startInput) startInput.value = '';
    if (endInput)   endInput.value   = '';

    window.addEventListener('click', () => {
        if (panel) panel.style.display = 'none';
        pickerState.active = null;
        if (startDisplay) startDisplay.style.borderColor = 'var(--border-color)';
        if (endDisplay)   endDisplay.style.borderColor   = 'var(--border-color)';
    });
}

export async function init() {
    await loadDropdowns();
    initTimePicker();

    const btnReg   = document.getElementById('btnTypeRegular');
    const btnEx    = document.getElementById('btnTypeExtra');
    const typeInput = document.getElementById('classType');
    const groupDay  = document.getElementById('groupDayOfWeek');
    const groupDate = document.getElementById('groupDate');

    btnReg?.addEventListener('click', () => {
        btnReg.classList.add('tab-pill-selector__btn--active');
        btnEx.classList.remove('tab-pill-selector__btn--active');
        typeInput.value = 'regular';
        groupDay.style.display = 'block';
        groupDate.style.display = 'none';
        document.getElementById('classDate').required = false;
    });

    btnEx?.addEventListener('click', () => {
        btnEx.classList.add('tab-pill-selector__btn--active');
        btnReg.classList.remove('tab-pill-selector__btn--active');
        typeInput.value = 'extra';
        groupDay.style.display = 'none';
        groupDate.style.display = 'block';
        document.getElementById('classDate').required = true;
    });

    const form = document.getElementById('classForm');
    if (!form) return;

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
        const gradeSelect = document.getElementById('classGrade');
        const batchSelect = document.getElementById('classBatch');
        const gradeName = gradeSelect?.value || '';
        const batchOpt = batchSelect.value ? batchSelect.options[batchSelect.selectedIndex] : null;
        const subjectName = batchOpt?.dataset.subject || '';
        const batchName = batchOpt?.dataset.name || '';

        const autoTitle = batchOpt
            ? (type === 'regular' ? `${gradeName} – ${batchName} – ${subjectName}` : `${gradeName} – ${batchName} – ${subjectName} (Extra)`)
            : (type === 'regular' ? `${gradeName} – Open Class` : `${gradeName} – Open Class (Extra)`);

        const sharedGroupId = crypto.randomUUID();
        const basePayload = {
            batch_id: batchSelect.value || null,
            grade: gradeName,
            title: autoTitle,
            type,
            start_time: document.getElementById('classStartTime').value,
            end_time: document.getElementById('classEndTime').value,
            notes: null,
            created_by: user.id,
            class_group_id: sharedGroupId
        };

        let success = true;
        let errorMessage = '';

        try {
            if (type === 'regular') {
                const checkedDays = Array.from(document.querySelectorAll('input[name="classDays"]:checked')).map(cb => parseInt(cb.value));
                if (checkedDays.length === 0) throw new Error('Please select at least one day for a regular class.');
                const responses = await Promise.all(checkedDays.map(day => window.api.post('classes', { ...basePayload, day_of_week: day })));
                const failed = responses.find(r => !r.success);
                if (failed) { success = false; errorMessage = failed.error; }
            } else {
                basePayload.class_date = document.getElementById('classDate').value;
                const response = await window.api.post('classes', basePayload);
                if (!response.success) { success = false; errorMessage = response.error; }
            }
        } catch (err) {
            success = false;
            errorMessage = err.message;
        }

        btnText.style.display = 'inline-block';
        btnSpinner.style.display = 'none';
        btn.disabled = false;

        if (success) {
            window.showStatus('classFormStatus', type === 'regular' ? 'Classes scheduled successfully!' : 'Class scheduled successfully!', 'success');
            window.safeFormReset(form);
            pickerState = { active: null, start: { hour: '12', min: '00', ampm: 'PM', set: false }, end: { hour: '12', min: '00', ampm: 'PM', set: false } };
            document.getElementById('startDisplayValue').textContent = '--:-- --';
            document.getElementById('endDisplayValue').textContent = '--:-- --';
            if (type === 'regular') btnReg?.click();
            else btnEx?.click();
        } else {
            window.showStatus('classFormStatus', errorMessage || 'Failed to schedule class(es).', 'error');
        }
    });
}
