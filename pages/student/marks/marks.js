let user, allTests, marksMap;

export async function init() {
    user = window.auth.getUser();
    injectLeaderboardModal();
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
            const active = s === defaultSubject ? ' tab-pill-selector__btn--active' : '';
            return `<button type="button" class="tab-pill-selector__btn${active}" data-subject="${window.esc(s)}">${window.esc(s)}</button>`;
        }).join('');
        pillsEl.querySelectorAll('.tab-pill-selector__btn').forEach(btn => {
            btn.addEventListener('click', () => {
                pillsEl.querySelectorAll('.tab-pill-selector__btn').forEach(b => b.classList.remove('tab-pill-selector__btn--active'));
                btn.classList.add('tab-pill-selector__btn--active');
                renderMarks();
            });
        });
    }

    renderPerfCard();
    renderMarks();

    const tbody = document.getElementById('marksTableBody');
    if (tbody && !tbody.dataset.lbListenerAdded) {
        tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-lb-trigger');
            if (btn) openStudentLbModal(btn.dataset.testId, btn.dataset.testTitle);
        });
        tbody.dataset.lbListenerAdded = 'true';
    }
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

        return `<article class="stat-card">
            <p style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 0.75rem;">${window.esc(subj)}</p>
            <p class="stat-card__value">${gradedCount > 0 ? Math.round(totalPercent / gradedCount) + '%' : '—'}</p>
            <p class="stat-card__label">Avg. Score</p>
            <div style="display:flex;justify-content:center;gap:1.5rem;margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-color);">
                <div style="text-align:center;">
                    <p style="font-size:1rem;font-weight:700;color:var(--text-primary);margin:0;">${gradedCount}</p>
                    <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Taken</p>
                </div>
                <div style="text-align:center;">
                    <p style="font-size:1rem;font-weight:700;color:var(--text-primary);margin:0;">${gradedCount > 0 ? Math.round(bestPercent) + '%' : '—'}</p>
                    <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Best</p>
                </div>
                <div style="text-align:center;">
                    <p style="font-size:1rem;font-weight:700;color:var(--text-primary);margin:0;">${pendingCount}</p>
                    <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Pending</p>
                </div>
            </div>
        </article>`;
    }).join('');
}

function injectLeaderboardModal() {
    if (document.getElementById('studentLbModal')) return;
    const modal = document.createElement('div');
    modal.id = 'studentLbModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
        <div class="class-modal" style="max-width:500px;">
            <div class="class-modal__header">
                <div>
                    <h3 id="studentLbTitle">Test Leaderboard</h3>
                    <p class="class-modal__meta" id="studentLbMeta"></p>
                </div>
                <button class="class-modal__close" id="studentLbClose" aria-label="Close">&times;</button>
            </div>
            <div class="class-modal__content">
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">Rank</th>
                                <th scope="col">Name</th>
                                <th scope="col">Score</th>
                                <th scope="col">%</th>
                            </tr>
                        </thead>
                        <tbody id="studentLbBody">
                            <tr><td colspan="4" class="loading-text">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    document.getElementById('studentLbClose').addEventListener('click', closeStudentLbModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeStudentLbModal(); });
}

function closeStudentLbModal() {
    document.getElementById('studentLbModal').style.display = 'none';
    document.body.style.overflow = '';
}

async function openStudentLbModal(testId, testTitle) {
    const modal = document.getElementById('studentLbModal');
    const tbody = document.getElementById('studentLbBody');
    const titleEl = document.getElementById('studentLbTitle');
    const metaEl = document.getElementById('studentLbMeta');

    titleEl.textContent = (testTitle || 'Test') + ' — Leaderboard';
    tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Loading...</td></tr>';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const test = allTests.find(t => t.id === testId);
    metaEl.textContent = test ? `${test.subject} · Grade ${test.grade} · Max: ${test.max_marks}` : '';
    const max = Number(test?.max_marks) || 100;

    try {
        const { data, error } = await window.supabaseClient
            .from('test_leaderboard')
            .select('student_id, student_name, marks_obtained, max_marks, percentage, rank')
            .eq('test_id', testId)
            .order('rank', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="loading-text">No marks recorded yet.</td></tr>';
            return;
        }

        const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

        tbody.innerHTML = data.map(r => {
            const isMe = r.student_id === user.id;
            const rankLabel = (medals[r.rank] ? medals[r.rank] + ' ' : '') + r.rank;
            const pct = r.percentage !== null ? r.percentage + '%' : '—';
            const color = r.percentage >= 60 ? 'var(--secondary)' : r.percentage >= 40 ? '#b45309' : 'var(--cadmium-red)';
            return `<tr class="data-table__row" style="${isMe ? 'background:rgba(115,147,179,0.12);' : ''}">
                <td class="data-table__td" style="font-weight:700;">${rankLabel}</td>
                <td class="data-table__td--main" style="${isMe ? 'font-weight:700;' : ''}">${window.esc(r.student_name)}${isMe ? ' <span style="font-size:0.75rem;color:var(--primary);">(you)</span>' : ''}</td>
                <td class="data-table__td">${r.marks_obtained}/${r.max_marks}</td>
                <td class="data-table__td" style="font-weight:600;color:${r.percentage !== null ? color : ''};">${pct}</td>
            </tr>`;
        }).join('');
    } catch {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Failed to load leaderboard.</td></tr>';
    }
}

function renderMarks() {
    const activeBtn = document.querySelector('#marksSubjectPills .tab-pill-selector__btn--active');
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
        const pctNum = m ? Math.round((Number(m.marks_obtained) / (Number(t.max_marks) || 100)) * 100) : null;
        const pctColor = pctNum !== null ? (pctNum >= 60 ? 'var(--secondary)' : pctNum >= 40 ? '#b45309' : 'var(--cadmium-red)') : '';
        const pctDisplay = pctNum !== null
            ? `<div style="display:flex;align-items:center;gap:0.4rem;">
                <span style="font-weight:600;color:${pctColor};min-width:2.8rem;">${pctNum}%</span>
                <div style="flex:1;min-width:40px;background:rgba(0,0,0,0.08);border-radius:2px;height:4px;overflow:hidden;">
                    <div style="width:${pctNum}%;background:${pctColor};height:4px;border-radius:2px;transition:width 0.3s;"></div>
                </div>
                <button type="button" class="btn-lb-trigger" data-test-id="${t.id}" data-test-title="${window.esc(t.title || 'Test')}" title="View leaderboard" aria-label="View leaderboard" style="background:none;border:none;cursor:pointer;padding:0;color:var(--text-muted);line-height:1;flex-shrink:0;"><i class="ri-trophy-line" style="font-size:0.95rem;"></i></button>
               </div>`
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
