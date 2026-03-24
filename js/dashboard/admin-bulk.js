async function callAdminApi(action, payload = {}) {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const res = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/admin-api`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action, ...payload })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Admin API error');
    return json;
}

function showBulkStatus(elId, msg, type) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg;
    el.className = `status status--${type}`;
    el.style.display = 'block';
}

async function loadDropdowns() {
    // Load batches
    const batchRes = await window.api.get('batches', {}, 'id, name, grade', { order: 'name' });
    const batchSel = document.getElementById('bulkAttendanceBatch');
    if (batchSel && batchRes.success) {
        batchSel.innerHTML = '<option value="">Select batch...</option>';
        batchRes.data.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = `${b.name} (${b.grade || 'no grade'})`;
            batchSel.appendChild(opt);
        });
    }

    // Load tests
    const testRes = await window.api.get('tests', {}, 'id, title, subject, grade', { order: 'title' });
    const testSel = document.getElementById('bulkMarksTest');
    if (testSel && testRes.success) {
        testSel.innerHTML = '<option value="">Select test...</option>';
        testRes.data.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = `${t.title} — ${t.subject || ''} ${t.grade || ''}`.trim();
            testSel.appendChild(opt);
        });
    }

    // Load students
    const studentRes = await window.api.get('profiles', { role: 'student' }, 'id, name, username, grade', { order: 'name' });
    const studentSel = document.getElementById('bulkDeleteStudent');
    if (studentSel && studentRes.success) {
        studentSel.innerHTML = '<option value="">Select student...</option>';
        studentRes.data.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.name} (@${s.username}) ${s.grade ? '— ' + s.grade : ''}`;
            studentSel.appendChild(opt);
        });
    }
}

export function init() {
    loadDropdowns();

    // Delete attendance for batch
    document.getElementById('btnDeleteAttendance')?.addEventListener('click', () => {
        const batchId = document.getElementById('bulkAttendanceBatch')?.value;
        if (!batchId) { showBulkStatus('bulkAttendanceStatus', 'Please select a batch.', 'error'); return; }
        const batchName = document.getElementById('bulkAttendanceBatch').selectedOptions[0]?.text || 'selected batch';
        window.showConfirmModal(
            'Delete Attendance',
            `Delete ALL attendance records for "${batchName}"? This cannot be undone.`,
            async () => {
                try {
                    const { deleted } = await callAdminApi('bulk_delete_attendance', { batch_id: batchId });
                    showBulkStatus('bulkAttendanceStatus', `Deleted ${deleted} attendance records.`, 'success');
                } catch (err) {
                    showBulkStatus('bulkAttendanceStatus', `Error: ${err.message}`, 'error');
                }
            }
        );
    });

    // Clear marks for test
    document.getElementById('btnDeleteMarks')?.addEventListener('click', () => {
        const testId = document.getElementById('bulkMarksTest')?.value;
        if (!testId) { showBulkStatus('bulkMarksStatus', 'Please select a test.', 'error'); return; }
        const testName = document.getElementById('bulkMarksTest').selectedOptions[0]?.text || 'selected test';
        window.showConfirmModal(
            'Clear Marks',
            `Delete ALL marks for "${testName}"? The test itself will remain. This cannot be undone.`,
            async () => {
                try {
                    const { deleted } = await callAdminApi('bulk_delete_marks', { test_id: testId });
                    showBulkStatus('bulkMarksStatus', `Cleared ${deleted} mark records.`, 'success');
                } catch (err) {
                    showBulkStatus('bulkMarksStatus', `Error: ${err.message}`, 'error');
                }
            }
        );
    });

    // Delete student account
    document.getElementById('btnDeleteStudent')?.addEventListener('click', () => {
        const userId = document.getElementById('bulkDeleteStudent')?.value;
        if (!userId) { showBulkStatus('bulkStudentStatus', 'Please select a student.', 'error'); return; }
        const studentName = document.getElementById('bulkDeleteStudent').selectedOptions[0]?.text || 'selected student';
        window.showConfirmModal(
            'Delete Student',
            `Permanently delete "${studentName}" and ALL their data (marks, attendance, batch memberships)? This cannot be undone.`,
            async () => {
                try {
                    await callAdminApi('delete_user', { user_id: userId });
                    showBulkStatus('bulkStudentStatus', 'Student account deleted.', 'success');
                    await loadDropdowns();
                } catch (err) {
                    showBulkStatus('bulkStudentStatus', `Error: ${err.message}`, 'error');
                }
            }
        );
    });

    // Wipe all seed data — double confirmation
    let wipeConfirmed = false;
    document.getElementById('btnWipeSeed')?.addEventListener('click', () => {
        if (!wipeConfirmed) {
            wipeConfirmed = true;
            const btn = document.getElementById('btnWipeSeed');
            btn.textContent = 'Are you sure? Click again to confirm.';
            btn.style.background = '#7f1d1d';
            setTimeout(() => {
                wipeConfirmed = false;
                btn.textContent = 'Wipe All Seed Data';
                btn.style.background = '';
            }, 5000);
            return;
        }
        wipeConfirmed = false;
        window.showConfirmModal(
            'Wipe All Seed Data',
            'This will DELETE every student account and all their linked data. Teacher accounts are kept. This CANNOT be undone.',
            async () => {
                const btn = document.getElementById('btnWipeSeed');
                btn.disabled = true;
                btn.textContent = 'Wiping...';
                try {
                    const { deleted } = await callAdminApi('wipe_seed_data');
                    showBulkStatus('bulkWipeStatus', `Wiped ${deleted} student accounts and all linked data.`, 'success');
                    await loadDropdowns();
                } catch (err) {
                    showBulkStatus('bulkWipeStatus', `Error: ${err.message}`, 'error');
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Wipe All Seed Data';
                    btn.style.background = '';
                }
            }
        );
    });
}

export function refresh() {
    loadDropdowns();
}
