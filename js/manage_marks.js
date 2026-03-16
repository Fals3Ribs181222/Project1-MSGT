const user = auth.requireRole('teacher');
const urlParams = new URLSearchParams(window.location.search);
const testId = urlParams.get('testId');

if (!testId) {
    alert('No Test ID specified.');
    window.location.href = 'teacher_dashboard';
}

let currentTest = null;
let allStudents = [];
let existingMarks = [];

document.addEventListener('DOMContentLoaded', init);

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
    });

    document.getElementById('studentCount').textContent = `${eligibleStudents.length} Students found`;

    const tbody = document.getElementById('marksTableBody');
    const marksMap = {};
    existingMarks.forEach(m => {
        marksMap[m.student_id] = { id: m.id, marks: m.marks_obtained };
    });

    if (eligibleStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-text">No students found matching this Grade and Subject.</td></tr>';
    } else {
        tbody.innerHTML = eligibleStudents.map(s => {
            const markData = marksMap[s.id] || {};
            const existingMark = markData.marks;
            const maxM = Number(currentTest.max_marks) || 100;
            const pct = existingMark !== undefined && existingMark !== '' ? ((Number(existingMark) / maxM) * 100).toFixed(1) + '%' : '-';
            return `
            <tr class="data-table__row">
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

            // Show Send Scores button
            const btnSend = document.getElementById('btnSendScores');
            if (btnSend) {
                btnSend.style.display = 'inline-flex';
                btnSend._savedMarks = marksPayload;
            }

            // Refresh marks to get new IDs
            const refreshRes = await api.get('marks', { test_id: testId });
            if (refreshRes.success) {
                existingMarks = refreshRes.data;
                renderPage();
                // Re-show send button after re-render
                if (btnSend) btnSend.style.display = 'inline-flex';
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

// ── Send Scores via WhatsApp ─────────────────────────────────
document.getElementById('btnSendScores')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnSendScores');
    const statusEl = document.getElementById('sendScoresStatus');
    if (!btn || !currentTest) return;

    btn.disabled = true;
    btn.textContent = 'Sending...';
    if (statusEl) statusEl.style.display = 'none';

    try {
        // Get all inputs with marks
        const inputs = document.querySelectorAll('.student-mark-input');
        const marksData = Array.from(inputs)
            .filter(i => i.value.trim() !== '')
            .map(i => ({
                studentId: i.dataset.studentId,
                marks: i.value.trim(),
            }));

        if (marksData.length === 0) {
            if (statusEl) {
                statusEl.textContent = 'No marks to send.';
                statusEl.className = 'status status--error';
                statusEl.style.display = 'block';
            }
            return;
        }

        // Fetch profiles with phone numbers
        const studentIds = marksData.map(m => m.studentId);
        const { data: profiles } = await window.supabaseClient
            .from('profiles')
            .select('id, name, phone, parent_phone')
            .in('id', studentIds);

        if (!profiles || profiles.length === 0) {
            if (statusEl) {
                statusEl.textContent = 'No student profiles found.';
                statusEl.className = 'status status--error';
                statusEl.style.display = 'block';
            }
            return;
        }

        let totalSent = 0;
        let totalFailed = 0;

        for (const mark of marksData) {
            const profile = profiles.find(p => p.id === mark.studentId);
            if (!profile) continue;

            const recipients = window.whatsapp.resolveRecipients(profile, 'both');
            if (recipients.length === 0) {
                totalFailed++;
                continue;
            }

            try {
                const result = await window.whatsapp.send({
                    type: 'score',
                    recipients,
                    payload: {
                        student_name: profile.name,
                        test_title: currentTest.title,
                        score: `${mark.marks}/${currentTest.max_marks}`,
                        subject: currentTest.subject,
                    },
                    sentBy: user.id,
                });
                totalSent += result.sent || 0;
                totalFailed += result.failed || 0;
            } catch (err) {
                totalFailed++;
            }
        }

        btn.style.display = 'none';

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
        btn.innerHTML = '<i class="ri-whatsapp-line"></i> Send Scores via WhatsApp';
    }
});

// Live update summary as teacher types
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('student-mark-input')) {
        updatePerformanceSummary();
    }
});
