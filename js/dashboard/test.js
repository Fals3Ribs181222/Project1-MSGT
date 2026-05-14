const user = window.auth.getUser();

// ── Date picker state ──────────────────────────────────────────────────────
let selectedDates = new Set();
let pickerYear = new Date().getFullYear();
let pickerMonth = new Date().getMonth();

const DAY_NAMES   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function fmtDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function renderDatePicker() {
    const container = document.getElementById('testDatePicker');
    if (!container) return;

    const todayStr   = new Date().toISOString().slice(0, 10);
    const firstDay   = new Date(pickerYear, pickerMonth, 1).getDay();
    const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();

    let cells = '';
    for (let i = 0; i < firstDay; i++) {
        cells += `<div class="date-picker__cell date-picker__cell--empty"></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const iso = `${pickerYear}-${String(pickerMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        let cls = 'date-picker__cell';
        if (selectedDates.has(iso)) cls += ' date-picker__cell--selected';
        if (iso === todayStr)       cls += ' date-picker__cell--today';
        cells += `<div class="${cls}" data-date="${iso}">${d}</div>`;
    }

    container.innerHTML = `
        <div class="date-picker__header">
            <button type="button" class="date-picker__nav" id="dpPrev">&#8249;</button>
            <span class="date-picker__month">${MONTH_NAMES[pickerMonth]} ${pickerYear}</span>
            <button type="button" class="date-picker__nav" id="dpNext">&#8250;</button>
        </div>
        <div class="date-picker__grid">
            ${DAY_NAMES.map(n => `<div class="date-picker__day-name">${n}</div>`).join('')}
            ${cells}
        </div>`;

    document.getElementById('dpPrev').addEventListener('click', () => {
        pickerMonth--;
        if (pickerMonth < 0) { pickerMonth = 11; pickerYear--; }
        renderDatePicker();
    });
    document.getElementById('dpNext').addEventListener('click', () => {
        pickerMonth++;
        if (pickerMonth > 11) { pickerMonth = 0; pickerYear++; }
        renderDatePicker();
    });

    container.querySelectorAll('.date-picker__cell[data-date]').forEach(cell => {
        cell.addEventListener('click', () => {
            const date = cell.dataset.date;
            if (selectedDates.has(date)) selectedDates.delete(date);
            else selectedDates.add(date);
            renderDatePicker();
            renderDateChips();
        });
    });
}

function renderDateChips() {
    const container = document.getElementById('testDateChips');
    if (!container) return;

    const sorted = [...selectedDates].sort();
    if (sorted.length === 0) { container.innerHTML = ''; return; }

    container.innerHTML = sorted.map(iso => `
        <span class="date-chip">
            ${fmtDate(iso)}
            <button type="button" class="date-chip__remove" data-date="${iso}" aria-label="Remove ${fmtDate(iso)}">&#x2715;</button>
        </span>`).join('');

    container.querySelectorAll('.date-chip__remove').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedDates.delete(btn.dataset.date);
            renderDatePicker();
            renderDateChips();
        });
    });
}

// ── Tests list ─────────────────────────────────────────────────────────────
async function loadTestsList() {
    const tbody = document.getElementById('testsListTableBody');
    const status = document.getElementById('testsListStatus');
    const btnRefresh = document.getElementById('btnRefreshTestsList');

    if (!tbody || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Refreshing...';
    window.tableLoading('testsListTableBody', 6, 'Loading tests...');

    const response = await window.api.get('tests', {}, '*', { order: 'date', ascending: true });

    btnRefresh.disabled = false;
    btnRefresh.textContent = 'Refresh List';

    if (response.success) {
        const activeGrade = window.getActiveGrade();
        const tests = activeGrade
            ? (response.data || []).filter(t => t.grade === activeGrade)
            : (response.data || []);
        if (tests.length > 0) {
            tbody.innerHTML = tests.map(test => {
                const schools = Array.isArray(test.schools) && test.schools.length > 0
                    ? test.schools.join(', ')
                    : 'All';
                const dates = Array.isArray(test.dates) && test.dates.length > 1
                    ? `${fmtDate(test.dates[0])} +${test.dates.length - 1} more`
                    : test.date ? fmtDate(test.date) : '-';
                return `
                <tr class="data-table__row">
                    <td class="data-table__td--main">${window.esc(test.title) || '-'}</td>
                    <td class="data-table__td">${test.subject || '-'}</td>
                    <td class="data-table__td">${test.grade || '-'}</td>
                    <td class="data-table__td">${window.esc(schools)}</td>
                    <td class="data-table__td">${dates}</td>
                    <td class="data-table__td">
                        <a href="manage_marks?testId=${test.id}" class="btn btn--primary btn--sm">Manage Marks</a>
                    </td>
                </tr>`;
            }).join('');
        } else {
            window.tableLoading('testsListTableBody', 6, 'No tests scheduled yet.');
        }
    } else {
        document.getElementById('testsListTableBody').innerHTML = '';
        window.showStatus('testsListStatus', response.error || 'Failed to load tests.', 'error');
    }
}

// ── Form ───────────────────────────────────────────────────────────────────
async function loadTestComponent() {
    await window.loadComponent('modals/add_test.html', 'addTestContainer', attachTestListeners);
}

function attachTestListeners() {
    const form = document.getElementById('testForm');
    if (!form) return;

    selectedDates.clear();
    pickerYear  = new Date().getFullYear();
    pickerMonth = new Date().getMonth();

    window.populateGradePills('schedTestGrade', false);
    renderDatePicker();
    renderDateChips();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn    = document.getElementById('btnScheduleTest');
        const status = document.getElementById('testStatus');

        if (selectedDates.size === 0) {
            window.showStatus('testStatus', 'Please select at least one date.', 'error');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Scheduling...';
        status.className = 'status';

        const subjectCheckboxes = document.querySelectorAll('input[name="testSubjects"]:checked');
        const subjects = Array.from(subjectCheckboxes).map(cb => cb.value).join(', ');

        const schoolCheckboxes = document.querySelectorAll('input[name="testSchools"]:checked');
        const schools = Array.from(schoolCheckboxes).map(cb => cb.value);

        const title      = document.getElementById('testTitle').value;
        const grade      = window.getSelectedGrade('schedTestGrade');
        const sortedDates = [...selectedDates].sort();

        const response = await window.api.post('tests', {
            title,
            subject: subjects,
            grade,
            date: sortedDates[0],
            dates: sortedDates,
            max_marks: document.getElementById('testMaxMarks').value,
            scheduled_by: user.id,
            schools,
        });

        if (response.success) {
            // Create one attendance-able class per selected date
            const groupId = crypto.randomUUID();
            const classResults = await Promise.all(sortedDates.map(date => window.api.post('classes', {
                grade,
                title: `Test – ${title}`,
                type: 'extra',
                class_date: date,
                batch_id: null,
                start_time: '00:00',
                end_time: '00:00',
                class_group_id: groupId,
                created_by: user.id,
                notes: null,
            })));

            const failedCount = classResults.filter(r => !r.success).length;
            if (failedCount > 0) {
                window.showStatus('testStatus', `Test saved but ${failedCount} attendance class(es) failed to create.`, 'error');
            } else {
                window.showStatus('testStatus', 'Test scheduled successfully!', 'success');
            }
            selectedDates.clear();
            pickerYear  = new Date().getFullYear();
            pickerMonth = new Date().getMonth();
            window.safeFormReset(e.target);
            renderDatePicker();
            renderDateChips();
            loadTestsList();
        } else {
            window.showStatus('testStatus', response.error || 'Failed to schedule.', 'error');
        }

        btn.disabled = false;
        btn.textContent = 'Schedule Test';
    });
}

export function init() {
    loadTestsList();
    loadTestComponent();

    const btnRefresh = document.getElementById('btnRefreshTestsList');
    if (btnRefresh) btnRefresh.addEventListener('click', loadTestsList);

    const pillView          = document.getElementById('pillViewTests');
    const pillAdd           = document.getElementById('pillAddTest');
    const testsListContainer = document.getElementById('testsListContainer');
    const addTestContainer   = document.getElementById('addTestContainer');

    if (pillView && pillAdd) {
        pillView.addEventListener('click', () => {
            pillView.classList.add('pill-toggle__btn--active');
            pillAdd.classList.remove('pill-toggle__btn--active');
            if (testsListContainer) testsListContainer.style.display = 'block';
            if (addTestContainer)   addTestContainer.style.display   = 'none';
            if (btnRefresh)         btnRefresh.style.display          = 'inline-block';
        });

        pillAdd.addEventListener('click', () => {
            pillAdd.classList.add('pill-toggle__btn--active');
            pillView.classList.remove('pill-toggle__btn--active');
            if (addTestContainer)   addTestContainer.style.display   = 'block';
            if (testsListContainer) testsListContainer.style.display = 'none';
            if (btnRefresh)         btnRefresh.style.display          = 'none';
        });
    }
}

export function refresh() {
    loadTestsList();
}
