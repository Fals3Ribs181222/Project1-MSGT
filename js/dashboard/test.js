const user = window.auth.getUser();

// ── Date picker state ──────────────────────────────────────────────────────
let selectedDates = new Set();
let pickerYear = new Date().getFullYear();
let pickerMonth = new Date().getMonth();

// All loaded tests (used for client-side search)
let _allTests = [];

const DAY_NAMES   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function toTitleCase(str) {
    return (str || '').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function fmtDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function gradeStyle(grade) {
    if (grade === '11' || grade === '11th') return 'background:rgba(196,18,48,0.1);color:var(--grade-11);border:1px solid rgba(196,18,48,0.25);';
    if (grade === '12' || grade === '12th') return 'background:rgba(0,163,108,0.1);color:var(--grade-12);border:1px solid rgba(0,163,108,0.25);';
    return 'background:var(--bg-surface-hover);color:var(--text-muted);border:1px solid var(--border-color);';
}

function renderGradeBadge(grade) {
    if (!grade) return '<span style="color:var(--text-muted);">—</span>';
    const label = grade.endsWith('th') ? grade : `${grade}th`;
    return `<span style="${gradeStyle(grade)}display:inline-block;border-radius:20px;padding:0.15rem 0.6rem;font-weight:600;white-space:nowrap;">${label}</span>`;
}

function renderSubjectBadge(subject) {
    if (!subject) return '<span style="color:var(--text-muted);">—</span>';
    return `<span style="display:inline-block;background:rgba(30,58,95,0.08);color:var(--primary);border:1px solid rgba(30,58,95,0.15);border-radius:20px;padding:0.15rem 0.6rem;font-weight:500;">${window.esc(subject)}</span>`;
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
function renderTestCards(tests) {
    const container = document.getElementById('testsCardsContainer');
    if (!container) return;

    if (tests.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);">
            <i class="ri-file-list-3-line" style="display:block;font-size:2.5rem;margin-bottom:0.6rem;opacity:0.35;"></i>
            <p style="margin:0;">No tests found.</p>
        </div>`;
        return;
    }

    container.innerHTML = tests.map(test => {
        const g = test.grade || '';
        const accentColor = (g === '11' || g === '11th') ? 'var(--grade-11)'
            : (g === '12' || g === '12th') ? 'var(--grade-12)'
            : 'var(--border-color)';

        const schools = Array.isArray(test.schools) && test.schools.length > 0
            ? test.schools.join(', ')
            : 'All Schools';

        const dates = Array.isArray(test.dates) && test.dates.length > 1
            ? `${fmtDate(test.dates[0])} +${test.dates.length - 1} more`
            : test.date ? fmtDate(test.date) : '—';

        const subjectGrade = [test.subject, test.grade].filter(Boolean).join(' – ');

        return `
        <div class="test-card">
            <div class="test-card__accent" style="background:${accentColor};"></div>
            <div class="test-card__body">
                <div class="test-card__title">${window.esc(toTitleCase(test.title)) || '—'}</div>
                <div class="test-card__meta">
                    ${subjectGrade ? `<div>${window.esc(subjectGrade)}</div>` : ''}
                    ${dates ? `<div>${dates}</div>` : ''}
                    ${schools ? `<div>${window.esc(schools)}</div>` : ''}
                </div>
            </div>
            <div class="test-card__action">
                <a href="manage_marks?testId=${test.id}" class="btn btn--primary btn--sm" style="display:inline-flex;align-items:center;justify-content:center;gap:0.3rem;width:100%;">
                    <i class="ri-edit-line"></i> Marks
                </a>
            </div>
        </div>`;
    }).join('');
}

function filterAndRender() {
    const q = (document.getElementById('testsSearch')?.value || '').toLowerCase();
    const filtered = q
        ? _allTests.filter(t =>
            (t.title || '').toLowerCase().includes(q) ||
            (t.subject || '').toLowerCase().includes(q)
          )
        : _allTests;

    const countEl = document.getElementById('testsCount');
    if (countEl) {
        countEl.textContent = filtered.length === _allTests.length
            ? `${_allTests.length} test${_allTests.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${_allTests.length}`;
    }

    renderTestCards(filtered);
}

async function loadTestsList() {
    const status = document.getElementById('testsListStatus');
    const btnRefresh = document.getElementById('btnRefreshTestsList');
    const countEl = document.getElementById('testsCount');

    if (!status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.innerHTML = '<i class="ri-loader-4-line"></i> Loading…';
    if (countEl) countEl.textContent = '';
    const cardsEl = document.getElementById('testsCardsContainer');
    if (cardsEl) cardsEl.innerHTML = '<p class="loading-text">Loading tests...</p>';

    const response = await window.api.get('tests', {}, '*', { order: 'date', ascending: true });

    btnRefresh.disabled = false;
    btnRefresh.innerHTML = '<i class="ri-refresh-line"></i> Refresh';

    if (response.success) {
        const activeGrade = window.getActiveGrade();
        _allTests = activeGrade
            ? (response.data || []).filter(t => t.grade === activeGrade)
            : (response.data || []);
        filterAndRender();
    } else {
        _allTests = [];
        const c = document.getElementById('testsCardsContainer');
        if (c) c.innerHTML = '';
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

export function init(tabSlug) {
    loadTestsList();
    loadTestComponent();

    const btnRefresh = document.getElementById('btnRefreshTestsList');
    if (btnRefresh) btnRefresh.addEventListener('click', loadTestsList);

    const searchInput = document.getElementById('testsSearch');
    if (searchInput) searchInput.addEventListener('input', filterAndRender);

    const pillView          = document.getElementById('pillViewTests');
    const pillAdd           = document.getElementById('pillAddTest');
    const testsListContainer = document.getElementById('testsListContainer');
    const addTestContainer   = document.getElementById('addTestContainer');

    const tabTitle = document.getElementById('testsTabTitle');

    if (pillView && pillAdd) {
        pillView.addEventListener('click', () => {
            pillView.classList.add('tab-pill-selector__btn--active');
            pillAdd.classList.remove('tab-pill-selector__btn--active');
            if (testsListContainer) testsListContainer.style.display = 'block';
            if (addTestContainer)   addTestContainer.style.display   = 'none';
            if (tabTitle) tabTitle.textContent = 'Test List';
        });

        pillAdd.addEventListener('click', () => {
            pillAdd.classList.add('tab-pill-selector__btn--active');
            pillView.classList.remove('tab-pill-selector__btn--active');
            if (addTestContainer)   addTestContainer.style.display   = 'block';
            if (testsListContainer) testsListContainer.style.display = 'none';
            if (tabTitle) tabTitle.textContent = 'Assign Tests';
        });
    }
    // Activate tab from URL slug on initial load
    if (tabSlug) activateTab(tabSlug);
}


export function activateTab(tabSlug) {
    const _map = { 'tests_list': 'pillViewTests', 'schedule_test': 'pillAddTest' };
    const pillId = _map[tabSlug] || _map['tests_list'];
    const pill = document.getElementById(pillId);
    if (pill) pill.click();
}
export function refresh() {
    loadTestsList();
}
