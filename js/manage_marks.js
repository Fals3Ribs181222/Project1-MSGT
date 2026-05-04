let user = null;
let urlParams = null;
let testId = null;
let currentTest = null;
let allStudents = [];
let existingMarks = [];
let eligibleStudents = [];

// Async initialization wrapper
(async () => {
    user = await window.auth.requireRole('teacher');
    if (!user) return;

    urlParams = new URLSearchParams(window.location.search);
    testId = urlParams.get('testId');

    if (!testId) {
        alert('No Test ID specified.');
        window.location.href = 'teacher_dashboard';
        return;
    }

    document.addEventListener('DOMContentLoaded', init);
    if (document.readyState === 'loading') {
        // Page is still loading, event will fire
    } else {
        // Page already loaded, call init immediately
        await init();
    }
})();

async function init() {
    try {
        const [testsRes, studentsRes, marksRes] = await Promise.all([
            api.get('tests'),
            api.get('profiles', { role: 'student' }),
            api.get('marks', { test_id: testId })
        ]);

        if (!testsRes.success || !studentsRes.success || !marksRes.success) {
            throw new Error('Failed to fetch data from Supabase.');
        }

        currentTest = testsRes.data.find(t => t.id === testId);
        if (!currentTest) {
            throw new Error('Test not found.');
        }

        allStudents = studentsRes.data;
        existingMarks = marksRes.data;

        renderPage();
        await applySentState();
    } catch (err) {
        console.error(err);
        document.getElementById('loadingState').innerHTML = `<p class="status status--error">${err.message}</p>`;
    }
}

function renderPage() {
    document.getElementById('testTitle').textContent = currentTest.title;
    document.getElementById('testMeta').textContent = `Subject: ${currentTest.subject} | Grade: ${currentTest.grade} | Date: ${currentTest.date} | Max Marks: ${currentTest.max_marks}`;

    const targetGrade = String(currentTest.grade).trim();
    const targetSubject = String(currentTest.subject).trim().toLowerCase();

    const testSchools = Array.isArray(currentTest.schools) ? currentTest.schools : [];
    const schoolRestricted = testSchools.length > 0;

    eligibleStudents = allStudents.filter(s => {
        const sGrade = String(s.grade).trim();
        const sSubjects = String(s.subjects || '').toLowerCase();
        if (sGrade !== targetGrade || !sSubjects.includes(targetSubject)) return false;
        if (schoolRestricted) return testSchools.includes(s.school);
        return true;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    document.getElementById('studentCount').textContent = `${eligibleStudents.length} Students found`;

    const grid = document.getElementById('marksGrid');
    const marksMap = {};
    existingMarks.forEach(m => {
        marksMap[m.student_id] = { id: m.id, marks: m.marks_obtained };
    });

    if (eligibleStudents.length === 0) {
        grid.innerHTML = '<p class="loading-text">No students found matching this Grade and Subject.</p>';
    } else {
        const max = Number(currentTest.max_marks) || 100;
        grid.innerHTML = eligibleStudents.map(s => {
            const markData = marksMap[s.id] || {};
            const existingMark = markData.marks;
            const pct = existingMark !== undefined && existingMark !== ''
                ? ((Number(existingMark) / max) * 100).toFixed(1) + '%' : '—';
            return `
            <div class="mark-card" data-student-id="${s.id}" data-name="${window.esc(s.name)}">
                <div class="mark-card__name">${window.esc(s.name)}</div>
                <div class="mark-card__input-row">
                    <input type="number"
                        class="form__control student-mark-input"
                        data-student-id="${s.id}"
                        data-mark-id="${markData.id || ''}"
                        value="${existingMark !== undefined ? existingMark : ''}"
                        min="0"
                        max="${currentTest.max_marks}"
                        step="any"
                        placeholder="–"
                    >
                    <span class="mark-card__max">/ ${currentTest.max_marks}</span>
                    <span class="mark-card__pct pct-cell">${pct}</span>
                </div>
                <div class="mark-card__badges">
                    <span class="score-status-cell"></span>
                    <span class="missed-status-cell"></span>
                </div>
            </div>
        `}).join('');
    }

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('marksTableContainer').hidden = false;
    document.getElementById('marksStickyBar').hidden = false;

    updatePerformanceSummary();
}

function updatePerformanceSummary() {
    const inputs = document.querySelectorAll('.student-mark-input');
    const max = Number(currentTest.max_marks) || 100;
    const marksValues = Array.from(inputs)
        .map(i => i.value.trim())
        .filter(v => v !== '')
        .map(Number);

    const pctCells = document.querySelectorAll('.pct-cell');
    inputs.forEach((input, idx) => {
        const val = input.value.trim();
        if (!pctCells[idx]) return;
        if (val !== '') {
            const pct = (Number(val) / max) * 100;
            pctCells[idx].textContent = pct.toFixed(1) + '%';
            pctCells[idx].style.color = pct >= 60 ? 'var(--secondary)' : pct >= 40 ? '#b45309' : 'var(--cadmium-red)';
            pctCells[idx].style.fontWeight = '600';
        } else {
            pctCells[idx].textContent = '-';
            pctCells[idx].style.color = '';
            pctCells[idx].style.fontWeight = '';
        }
    });

    if (marksValues.length === 0) {
        document.getElementById('statAverage').textContent = '-';
        document.getElementById('statHighest').textContent = '-';
        document.getElementById('statLowest').textContent = '-';
        document.getElementById('statAvgPercent').textContent = '-';
        const progressEl = document.getElementById('marksProgress');
        if (progressEl) progressEl.textContent = inputs.length > 0 ? `0 / ${inputs.length} entered` : '';
        return;
    }

    const high = Math.max(...marksValues);
    const low = Math.min(...marksValues);
    const avg = marksValues.reduce((a, b) => a + b, 0) / marksValues.length;
    const avgPercent = (avg / max) * 100;

    document.getElementById('statAverage').textContent = avg.toFixed(1);
    document.getElementById('statHighest').textContent = high;
    document.getElementById('statLowest').textContent = low;
    document.getElementById('statAvgPercent').textContent = avgPercent.toFixed(1) + '%';

    const progressEl = document.getElementById('marksProgress');
    if (progressEl) {
        const total = inputs.length;
        progressEl.textContent = total > 0 ? `${marksValues.length} / ${total} entered` : '';
    }
}

const SENT_BADGE = 'display:inline-block;padding:0.15rem 0.4rem;border-radius:3px;font-size:0.7rem;font-weight:600;background:rgba(37,211,102,0.15);color:#1a9e52;';

function markScoreSent(studentId) {
    const card = document.querySelector(`.mark-card[data-student-id="${studentId}"]`);
    if (!card || card.classList.contains('mark-row--sent')) return;
    card.classList.add('mark-row--sent');
    const cell = card.querySelector('.score-status-cell');
    if (cell) cell.innerHTML = `<span style="${SENT_BADGE}">✓ Score</span>`;
    updateSendBtns();
}

function markMissedSent(studentId) {
    const card = document.querySelector(`.mark-card[data-student-id="${studentId}"]`);
    if (!card) return;
    card.classList.add('mark-missed--sent');
    const cell = card.querySelector('.missed-status-cell');
    if (cell) cell.innerHTML = `<span style="display:inline-block;padding:0.15rem 0.4rem;border-radius:3px;font-size:0.7rem;font-weight:600;background:rgba(210,43,43,0.1);color:#D22B2B;">✓ Not Attempted</span>`;
}

async function applySentState() {
    if (!currentTest) return;
    const eligibleIds = Array.from(document.querySelectorAll('.mark-card[data-student-id]')).map(r => r.dataset.studentId).filter(Boolean);
    if (!eligibleIds.length) return;

    const { data } = await window.supabaseClient
        .from('whatsapp_log')
        .select('student_id, message_type')
        .eq('test_id', currentTest.id)
        .in('student_id', eligibleIds);

    (data || []).forEach(row => {
        if (row.message_type === 'score') markScoreSent(row.student_id);
        else if (row.message_type === 'test_missed') markMissedSent(row.student_id);
    });
}

function updateSendBtns() {
    const marksCount = Array.from(document.querySelectorAll('#marksGrid .mark-card:not(.mark-row--sent)'))
        .filter(card => {
            const input = card.querySelector('.student-mark-input');
            return input && input.value.trim() !== '';
        }).length;

    const missedCount = Array.from(document.querySelectorAll('#marksGrid .mark-card:not(.mark-missed--sent)'))
        .filter(card => {
            const input = card.querySelector('.student-mark-input');
            return input && input.value.trim() === '';
        }).length;

    const btnMarks = document.getElementById('btnSendMarks');
    if (btnMarks) {
        btnMarks.textContent = `📱 Send Marks (${marksCount})`;
        btnMarks.disabled = marksCount === 0;
        btnMarks.style.opacity = marksCount === 0 ? '0.5' : '1';
    }

    const btnMissed = document.getElementById('btnSendNotAttempted');
    if (btnMissed) {
        btnMissed.textContent = `📱 Send Not Attempted (${missedCount})`;
        btnMissed.disabled = missedCount === 0;
        btnMissed.style.opacity = missedCount === 0 ? '0.5' : '1';
    }
}

document.getElementById('marksForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSaveMarks');
    const status = document.getElementById('marksStatus');
    const inputs = document.querySelectorAll('.student-mark-input');

    const marksPayload = Array.from(inputs)
        .map(i => ({
            id: i.dataset.markId || crypto.randomUUID(),
            test_id: testId,
            student_id: i.dataset.studentId,
            marks_obtained: i.value.trim()
        }))
        .filter(m => m.marks_obtained !== '');

    if (marksPayload.length === 0) {
        status.textContent = 'Please enter at least one mark.';
        status.className = 'status status--error';
        status.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Saving Marks...';
    status.style.display = 'none';

    try {
        // Upsert handles both new and existing marks
        const response = await api.upsert('marks', marksPayload);

        if (response.success) {
            status.textContent = 'All marks saved successfully!';
            status.className = 'status status--success';
            status.style.display = 'block';

            // Refresh marks to get new IDs
            const refreshRes = await api.get('marks', { test_id: testId });
            if (refreshRes.success) {
                existingMarks = refreshRes.data;
                renderPage();
                await applySentState();
                document.getElementById('btnSendMarks').style.display = 'inline-flex';
                document.getElementById('btnSendNotAttempted').style.display = 'inline-flex';
                updateSendBtns();
                document.getElementById('marksStickyBar').hidden = false;
            }
        } else {
            throw new Error(response.error || 'Failed to save marks.');
        }
    } catch (err) {
        status.textContent = err.message;
        status.className = 'status status--error';
        status.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save All Marks';
    }
});

// ── Send Marks via WhatsApp ───────────────────────────────────
document.getElementById('btnSendMarks')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnSendMarks');
    const statusEl = document.getElementById('sendMarksStatus');
    if (!btn || !currentTest) return;

    const allInputs = document.querySelectorAll('.student-mark-input');
    const marksData = Array.from(document.querySelectorAll('#marksGrid .mark-card:not(.mark-row--sent)'))
        .map(card => ({ studentId: card.dataset.studentId, marks: card.querySelector('.student-mark-input')?.value.trim() }))
        .filter(m => m.marks !== '' && m.marks !== undefined);

    if (marksData.length === 0) return;

    btn.disabled = true;
    if (statusEl) statusEl.style.display = 'none';

    try {
        const allValues = Array.from(allInputs).map(i => i.value.trim()).filter(v => v !== '').map(Number);
        const classAverage = allValues.length > 0
            ? (allValues.reduce((a, b) => a + b, 0) / allValues.length).toFixed(1)
            : 'N/A';

        const { data: profiles } = await window.supabaseClient
            .from('profiles')
            .select('id, name, phone, father_name, father_phone, mother_name, mother_phone')
            .in('id', marksData.map(m => m.studentId));

        let totalSent = 0, totalFailed = 0;

        for (let i = 0; i < marksData.length; i++) {
            const mark = marksData[i];
            btn.textContent = `📱 Sending ${i + 1}/${marksData.length}...`;
            const profile = (profiles || []).find(p => p.id === mark.studentId);
            if (!profile) { totalFailed++; continue; }
            const recipients = window.whatsapp.resolveRecipients(profile, 'both');
            if (recipients.length === 0) { totalFailed++; continue; }
            try {
                const result = await window.whatsapp.send({
                    type: 'score',
                    recipients,
                    payload: {
                        student_name: profile.name,
                        test_title: currentTest.title,
                        score: String(mark.marks),
                        total: String(currentTest.max_marks),
                        subject: currentTest.subject,
                        class_average: classAverage,
                    },
                    sentBy: user.id,
                    testId: currentTest.id,
                });
                totalSent += result.sent || 0;
                totalFailed += result.failed || 0;
                markScoreSent(mark.studentId);
            } catch { totalFailed++; }
        }

        if (statusEl) {
            statusEl.textContent = `WhatsApp: ${totalSent} sent, ${totalFailed} failed`;
            statusEl.className = totalFailed > 0 ? 'status status--error' : 'status status--success';
            statusEl.style.display = 'block';
            setTimeout(() => statusEl.style.display = 'none', 5000);
        }
    } catch (err) {
        if (statusEl) {
            statusEl.textContent = 'Failed: ' + err.message;
            statusEl.className = 'status status--error';
            statusEl.style.display = 'block';
        }
    } finally {
        btn.disabled = false;
        updateSendBtns();
    }
});

// ── Send Not Attempted via WhatsApp ───────────────────────────
document.getElementById('btnSendNotAttempted')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnSendNotAttempted');
    const statusEl = document.getElementById('sendNotAttemptedStatus');
    if (!btn || !currentTest) return;

    const absentIds = Array.from(document.querySelectorAll('#marksGrid .mark-card:not(.mark-missed--sent)'))
        .filter(card => {
            const input = card.querySelector('.student-mark-input');
            return input && input.value.trim() === '';
        })
        .map(card => card.dataset.studentId);

    if (absentIds.length === 0) return;

    btn.disabled = true;
    if (statusEl) statusEl.style.display = 'none';

    try {
        const { data: profiles } = await window.supabaseClient
            .from('profiles')
            .select('id, name, phone, father_name, father_phone, mother_name, mother_phone')
            .in('id', absentIds);

        let totalSent = 0, totalFailed = 0;

        for (let i = 0; i < absentIds.length; i++) {
            const absentId = absentIds[i];
            btn.textContent = `📱 Sending ${i + 1}/${absentIds.length}...`;
            const profile = (profiles || []).find(p => p.id === absentId);
            if (!profile) { totalFailed++; continue; }
            const recipients = window.whatsapp.resolveRecipients(profile, 'both');
            if (recipients.length === 0) { totalFailed++; continue; }
            try {
                const result = await window.whatsapp.send({
                    type: 'test_missed',
                    recipients,
                    payload: {
                        student_name: profile.name,
                        test_title: currentTest.title,
                        subject: currentTest.subject,
                        date: currentTest.date,
                    },
                    sentBy: user.id,
                    testId: currentTest.id,
                });
                totalSent += result.sent || 0;
                totalFailed += result.failed || 0;
                markMissedSent(absentId);
            } catch { totalFailed++; }
        }

        if (statusEl) {
            statusEl.textContent = `WhatsApp: ${totalSent} sent, ${totalFailed} failed`;
            statusEl.className = totalFailed > 0 ? 'status status--error' : 'status status--success';
            statusEl.style.display = 'block';
            setTimeout(() => statusEl.style.display = 'none', 5000);
        }
    } catch (err) {
        if (statusEl) {
            statusEl.textContent = 'Failed: ' + err.message;
            statusEl.className = 'status status--error';
            statusEl.style.display = 'block';
        }
    } finally {
        btn.disabled = false;
        updateSendBtns();
    }
});

// ── Leaderboard Modal ─────────────────────────────────────────
function openLeaderboardModal() {
    const modal = document.getElementById('leaderboardModal');
    const tbody = document.getElementById('lbModalBody');
    const titleEl = document.getElementById('lbModalTitle');
    const metaEl = document.getElementById('lbModalMeta');
    const max = Number(currentTest.max_marks) || 100;

    titleEl.textContent = `${currentTest.title} — Leaderboard`;
    metaEl.textContent = `${currentTest.subject} · Grade ${currentTest.grade} · Max: ${max}`;

    const savedMap = {};
    existingMarks.forEach(m => { savedMap[m.student_id] = m.marks_obtained; });

    const withMarks = eligibleStudents
        .filter(s => savedMap[s.id] !== undefined && savedMap[s.id] !== '')
        .map(s => ({ name: s.name, marks: Number(savedMap[s.id]) }))
        .sort((a, b) => b.marks - a.marks);

    const withoutMarks = eligibleStudents
        .filter(s => savedMap[s.id] === undefined || savedMap[s.id] === '');

    if (withMarks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-text">No marks recorded yet. Save marks first.</td></tr>';
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        return;
    }

    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    let rank = 1;
    let prevMarks = null;

    tbody.innerHTML = [
        ...withMarks.map((s, i) => {
            if (s.marks !== prevMarks) rank = i + 1;
            prevMarks = s.marks;
            const pctNum = (s.marks / max) * 100;
            const pct = pctNum.toFixed(1);
            const color = pctNum >= 60 ? 'var(--secondary)' : pctNum >= 40 ? '#b45309' : 'var(--cadmium-red)';
            return `<tr class="data-table__row">
                <td class="data-table__td" style="font-weight:700;">${medals[rank] ? medals[rank] + ' ' : ''}${rank}</td>
                <td class="data-table__td--main">${window.esc(s.name)}</td>
                <td class="data-table__td">${s.marks}/${max}</td>
                <td class="data-table__td" style="font-weight:600;color:${color};">${pct}%</td>
            </tr>`;
        }),
        ...withoutMarks.map(s => `<tr class="data-table__row" style="opacity:0.5;">
            <td class="data-table__td">—</td>
            <td class="data-table__td--main">${window.esc(s.name)}</td>
            <td class="data-table__td">—</td>
            <td class="data-table__td">—</td>
        </tr>`)
    ].join('');

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeLeaderboardModal() {
    document.getElementById('leaderboardModal').style.display = 'none';
    document.body.style.overflow = '';
}

document.getElementById('btnOpenLeaderboard')?.addEventListener('click', openLeaderboardModal);
document.getElementById('btnOpenLeaderboard')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLeaderboardModal(); }
});
document.getElementById('lbModalClose')?.addEventListener('click', closeLeaderboardModal);
document.getElementById('leaderboardModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeLeaderboardModal();
});

// ── Search filter ─────────────────────────────────────────────
document.getElementById('marksSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#marksGrid .mark-card').forEach(card => {
        card.style.display = (card.dataset.name || '').toLowerCase().includes(q) ? '' : 'none';
    });
});

// ── Keyboard nav: Enter moves to next input ───────────────────
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('student-mark-input')) {
        e.preventDefault();
        const inputs = Array.from(document.querySelectorAll('.student-mark-input'));
        const idx = inputs.indexOf(e.target);
        if (idx < inputs.length - 1) inputs[idx + 1].focus();
    }
});

// Live update summary as teacher types
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('student-mark-input')) {
        updatePerformanceSummary();
    }
});
