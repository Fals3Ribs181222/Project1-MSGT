let user, allTests, marksMap;

export async function init() {
    user = window.auth.getUser();
    await loadMarks();
    document.getElementById('btnRefreshMarks')?.addEventListener('click', loadMarks);
}

export async function refresh() {
    await loadMarks();
}

async function loadMarks() {
    window.tableLoading('marksTableBody', 4, 'Loading marks...');
    window.showStatus('marksStatus', '', 'success');

    const [testsRes, marksRes] = await Promise.all([
        window.api.get('tests', { grade: user.grade }, '*', { order: 'date', ascending: false }),
        window.api.get('marks', { student_id: user.id })
    ]);

    if (!testsRes.success) {
        window.showStatus('marksStatus', testsRes.error || 'Failed to load tests.', 'error');
        return;
    }

    allTests = testsRes.data || [];

    const studentSubjects = (user.subjects || '').split(',').map(s => s.trim()).filter(Boolean);
    if (studentSubjects.length > 0) {
        allTests = allTests.filter(t => {
            if (!t.subject) return true;
            return t.subject.split(',').map(s => s.trim()).some(s => studentSubjects.includes(s));
        });
    }

    marksMap = {};
    (marksRes.data || []).forEach(m => { marksMap[m.test_id] = m; });

    // Build pill filters from student's enrolled subjects, default to first (Accounts)
    const pillsEl = document.getElementById('marksSubjectPills');
    if (pillsEl) {
        const defaultSubject = studentSubjects.find(s => s.toLowerCase() === 'accounts') || studentSubjects[0] || '';
        pillsEl.innerHTML = studentSubjects.map((s, i) => {
            const active = s === defaultSubject ? ' pill-toggle__btn--active' : '';
            return `<button type="button" class="pill-toggle__btn${active}" data-subject="${window.esc(s)}">${window.esc(s)}</button>`;
        }).join('');
        pillsEl.querySelectorAll('.pill-toggle__btn').forEach(btn => {
            btn.addEventListener('click', () => {
                pillsEl.querySelectorAll('.pill-toggle__btn').forEach(b => b.classList.remove('pill-toggle__btn--active'));
                btn.classList.add('pill-toggle__btn--active');
                renderMarks();
            });
        });
    }

    renderPerfCard();
    renderMarks();
}

function renderPerfCard() {
    const container = document.getElementById('marksPerfCards');
    if (!container) return;

    const studentSubjects = (user.subjects || '').split(',').map(s => s.trim()).filter(Boolean);
    const subjects = studentSubjects.length ? studentSubjects : ['Overall'];

    container.innerHTML = subjects.map(subj => {
        const tests = allTests.filter(t => {
            if (subj === 'Overall') return true;
            return (t.subject || '').split(',').map(s => s.trim()).includes(subj);
        });

        let totalPercent = 0, bestPercent = 0, gradedCount = 0, pendingCount = 0;
        tests.forEach(t => {
            const m = marksMap[t.id];
            if (m) {
                gradedCount++;
                const pct = (Number(m.marks_obtained) / (Number(t.max_marks) || 100)) * 100;
                totalPercent += pct;
                if (pct > bestPercent) bestPercent = pct;
            } else {
                pendingCount++;
            }
        });

        return `<div style="background:var(--bg-surface,#fff);border:1px solid var(--border-color);border-radius:var(--radius-lg,12px);padding:1.25rem;">
            <p style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 1rem;">${window.esc(subj)}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
                <div class="perf-card__stat" style="margin:0;border:none;">
                    <p class="perf-card__value">${gradedCount}</p>
                    <p class="perf-card__label">Tests Taken</p>
                </div>
                <div class="perf-card__stat" style="margin:0;border:none;">
                    <p class="perf-card__value">${gradedCount > 0 ? Math.round(totalPercent / gradedCount) + '%' : '—'}</p>
                    <p class="perf-card__label">Avg. Score</p>
                </div>
                <div class="perf-card__stat" style="margin:0;border:none;">
                    <p class="perf-card__value">${gradedCount > 0 ? Math.round(bestPercent) + '%' : '—'}</p>
                    <p class="perf-card__label">Best Score</p>
                </div>
                <div class="perf-card__stat" style="margin:0;border:none;">
                    <p class="perf-card__value">${pendingCount}</p>
                    <p class="perf-card__label">Pending</p>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderMarks() {
    const activeBtn = document.querySelector('#marksSubjectPills .pill-toggle__btn--active');
    const subjectFilter = activeBtn?.dataset.subject || '';
    const tbody = document.getElementById('marksTableBody');

    const filtered = allTests.filter(t => {
        if (!subjectFilter) return true;
        return (t.subject || '').split(',').map(s => s.trim()).includes(subjectFilter);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-text">No tests found.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(t => {
        const m = marksMap[t.id];
        const earnedDisplay = m
            ? `<span class="data-table__score">${m.marks_obtained}/${t.max_marks || '?'}</span>`
            : `<span style="color:var(--gray-500);font-style:italic;">Not graded yet</span>`;
        const pctDisplay = m
            ? `<span style="font-weight:600;color:var(--primary);">${Math.round((Number(m.marks_obtained) / (Number(t.max_marks) || 100)) * 100)}%</span>`
            : '—';
        const dateStr = t.date ? new Date(t.date).toLocaleDateString('en-IN') : '—';
        return `<tr class="data-table__row">
            <td class="data-table__td">${dateStr}</td>
            <td class="data-table__td--main">${window.esc(t.title || 'Untitled Test')}</td>
            <td class="data-table__td">${earnedDisplay}</td>
            <td class="data-table__td">${pctDisplay}</td>
        </tr>`;
    }).join('');
}
