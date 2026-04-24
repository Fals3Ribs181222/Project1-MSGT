let user = null;
let urlParams = null;
let testId = null;
let currentTest = null;
let allStudents = [];
let existingMarks = [];

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

    const eligibleStudents = allStudents.filter(s => {
        const sGrade = String(s.grade).trim();
        const sSubjects = String(s.subjects || '').toLowerCase();
        return sGrade === targetGrade && sSubjects.includes(targetSubject);
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    document.getElementById('studentCount').textContent = `${eligibleStudents.length} Students found`;

    const tbody = document.getElementById('marksTableBody');
    const marksMap = {};
    existingMarks.forEach(m => {
        marksMap[m.student_id] = { id: m.id, marks: m.marks_obtained };
    });

    if (eligibleStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-text">No students found matching this Grade and Subject.</td></tr>';
    } else {
        tbody.innerHTML = eligibleStudents.map(s => {
            const markData = marksMap[s.id] || {};
            const existingMark = markData.marks;
            const maxM = Number(currentTest.max_marks) || 100;
            const pct = existingMark !== undefined && existingMark !== '' ? ((Number(existingMark) / maxM) * 100).toFixed(1) + '%' : '-';
            return `
            <tr class="data-table__row" data-student-id="${s.id}">
                <td class="data-table__td--main">${s.name}</td>
                <td class="data-table__td">${s.username || '-'}</td>
                <td class="data-table__td">
                    <input type="number"
                        class="form__control form__control--narrow student-mark-input"
                        data-student-id="${s.id}"
                        data-mark-id="${markData.id || ''}"
                        value="${existingMark !== undefined ? existingMark : ''}"
                        min="0"
                        max="${currentTest.max_marks}"
                        placeholder="Max: ${currentTest.max_marks}"
                    >
                </td>
                <td class="data-table__td pct-cell">${pct}</td>
                <td class="data-table__td score-status-cell" style="text-align:center;"></td>
                <td class="data-table__td missed-status-cell" style="text-align:center;"></td>
            </tr>
        `}).join('');
    }

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('marksTableContainer').hidden = false;

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
        if (pctCells[idx]) {
            pctCells[idx].textContent = val !== '' ? ((Number(val) / max) * 100).toFixed(1) + '%' : '-';
        }
    });

    if (marksValues.length === 0) {
        document.getElementById('statAverage').textContent = '-';
        document.getElementById('statHighest').textContent = '-';
        document.getElementById('statLowest').textContent = '-';
        document.getElementById('statAvgPercent').textContent = '-';
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
}

const SENT_BADGE = 'display:inline-block;padding:0.15rem 0.4rem;border-radius:3px;font-size:0.7rem;font-weight:600;background:rgba(37,211,102,0.15);color:#1a9e52;';

function markScoreSent(studentId) {
    const row = document.querySelector(`#marksTableBody tr.data-table__row[data-student-id="${studentId}"]`);
    if (!row || row.classList.contains('mark-row--sent')) return;
    row.classList.add('mark-row--sent');
    row.style.background = 'rgba(37,211,102,0.12)';
    row.style.borderLeft = '3px solid #25D366';
    const chk = row.querySelector('.row-send-chk');
    if (chk) { chk.checked = false; chk.disabled = true; }
    const cell = row.querySelector('.score-status-cell');
    if (cell) cell.innerHTML = `<span style="${SENT_BADGE}">✓ Sent</span>`;
    updateSendBtns();
}

function markMissedSent(studentId) {
    const row = document.querySelector(`#marksTableBody tr.data-table__row[data-student-id="${studentId}"]`);
    if (!row) return;
    row.classList.add('mark-missed--sent');
    const cell = row.querySelector('.missed-status-cell');
    if (cell) cell.innerHTML = `<span style="${SENT_BADGE}">✓ Sent</span>`;
}

async function applySentState() {
    if (!currentTest) return;
    const eligibleIds = Array.from(document.querySelectorAll('[data-student-id]')).map(r => r.dataset.studentId).filter(Boolean);
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
    const marksCount = Array.from(document.querySelectorAll('#marksTableBody tr.data-table__row:not(.mark-row--sent)'))
        .filter(row => {
            const input = row.querySelector('.student-mark-input');
            return input && input.value.trim() !== '';
        }).length;

    const missedCount = Array.from(document.querySelectorAll('#marksTableBody tr.data-table__row:not(.mark-missed--sent)'))
        .filter(row => {
            const input = row.querySelector('.student-mark-input');
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
        .map(i => {
            const row = {
                test_id: testId,
                student_id: i.dataset.studentId,
                marks_obtained: i.value.trim()
            };
            // If we have an existing mark ID, include it for upsert
            if (i.dataset.markId) row.id = i.dataset.markId;
            return row;
        })
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
    const marksData = Array.from(document.querySelectorAll('#marksTableBody tr.data-table__row:not(.mark-row--sent)'))
        .map(row => ({ studentId: row.dataset.studentId, marks: row.querySelector('.student-mark-input')?.value.trim() }))
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

    const absentIds = Array.from(document.querySelectorAll('#marksTableBody tr.data-table__row:not(.mark-missed--sent)'))
        .filter(row => {
            const input = row.querySelector('.student-mark-input');
            return input && input.value.trim() === '';
        })
        .map(row => row.dataset.studentId);

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

// Live update summary as teacher types
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('student-mark-input')) {
        updatePerformanceSummary();
    }
});
