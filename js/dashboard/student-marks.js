let user, allTests, marksMap;

export async function init() {
    user = window.auth.getUser();
    await loadMarks();
    document.getElementById('btnRefreshMarks')?.addEventListener('click', loadMarks);
    document.getElementById('marksSubjectFilter')?.addEventListener('change', renderMarks);
    document.getElementById('marksDateFilter')?.addEventListener('change', renderMarks);
}

export async function refresh() {
    await loadMarks();
}

async function loadMarks() {
    window.tableLoading('marksTableBody', 6, 'Loading marks...');
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

    // Populate subject filter
    const subjects = [...new Set(allTests.map(t => t.subject).filter(Boolean))];
    const subjectSel = document.getElementById('marksSubjectFilter');
    if (subjectSel) {
        const current = subjectSel.value;
        subjectSel.innerHTML = '<option value="">All Subjects</option>';
        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = s;
            subjectSel.appendChild(opt);
        });
        if (current) subjectSel.value = current;
    }

    renderPerfCard();
    renderMarks();
}

function renderPerfCard() {
    let totalPercent = 0, bestPercent = 0, gradedCount = 0, pendingCount = 0;

    allTests.forEach(t => {
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

    if (gradedCount > 0 || pendingCount > 0) {
        document.getElementById('marksStatTests').textContent = gradedCount;
        document.getElementById('marksStatAvg').textContent = gradedCount > 0 ? Math.round(totalPercent / gradedCount) + '%' : '—';
        document.getElementById('marksStatBest').textContent = gradedCount > 0 ? Math.round(bestPercent) + '%' : '—';
        document.getElementById('marksStatPending').textContent = pendingCount;
        document.getElementById('marksPerfCard').style.display = '';
        document.getElementById('marksPerfCard').classList.add('perf-card--visible');
    }
}

function renderMarks() {
    const subjectFilter = document.getElementById('marksSubjectFilter')?.value || '';
    const dateFilter = document.getElementById('marksDateFilter')?.value || '';
    const tbody = document.getElementById('marksTableBody');

    const now = new Date();
    let cutoff = null;
    if (dateFilter === 'month') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    } else if (dateFilter === '3months') {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 3);
        cutoff = d.toISOString().slice(0, 10);
    } else if (dateFilter === '6months') {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 6);
        cutoff = d.toISOString().slice(0, 10);
    }

    const filtered = allTests.filter(t => {
        if (subjectFilter && t.subject !== subjectFilter) return false;
        if (cutoff && t.date < cutoff) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-text">No tests found.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(t => {
        const m = marksMap[t.id];
        const earnedDisplay = m
            ? `<span class="data-table__score">${m.marks_obtained}</span>`
            : `<span style="color:var(--gray-500);font-style:italic;">Not graded yet</span>`;
        const pctDisplay = m
            ? `<span style="font-weight:600;color:var(--primary);">${Math.round((Number(m.marks_obtained) / (Number(t.max_marks) || 100)) * 100)}%</span>`
            : '—';
        const dateStr = t.date ? new Date(t.date).toLocaleDateString('en-IN') : '—';
        return `<tr class="data-table__row">
            <td class="data-table__td">${dateStr}</td>
            <td class="data-table__td">${window.esc(t.subject || '—')}</td>
            <td class="data-table__td--main">${window.esc(t.title || 'Untitled Test')}</td>
            <td class="data-table__td">${t.max_marks || '—'}</td>
            <td class="data-table__td">${earnedDisplay}</td>
            <td class="data-table__td">${pctDisplay}</td>
        </tr>`;
    }).join('');
}
