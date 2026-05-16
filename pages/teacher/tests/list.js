let _allTests = [];

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

export function init() {
    loadTestsList();

    const btnRefresh = document.getElementById('btnRefreshTestsList');
    if (btnRefresh) btnRefresh.addEventListener('click', loadTestsList);

    const searchInput = document.getElementById('testsSearch');
    if (searchInput) searchInput.addEventListener('input', filterAndRender);
}

export function refresh() {
    loadTestsList();
}
