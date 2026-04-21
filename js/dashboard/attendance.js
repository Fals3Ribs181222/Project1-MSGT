const user = window.auth.getUser();

let currentAttendanceClass = null;
let currentAttendanceBatch = null;
let currentBatchName = '';
let currentClassTime = ''; // "HH:MM" 24h
let guestListLoadedForBatch = null;

async function loadTodaysClasses() {
    const grid = document.getElementById('todaysClassesGrid');
    if (!grid) return;
    grid.innerHTML = `<div class="loading-text">Loading today's classes...</div>`;

    const today = new Date();
    const dayOfWeek = today.getDay();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const res = await window.api.get('classes', {}, '*, batches(*)');

    if (!res.success) {
        grid.innerHTML = `<div class="status status--error">Failed to load classes: ${res.error}</div>`;
        return;
    }

    const todaysClasses = res.data.filter(c => {
        if (c.type === 'regular' && c.day_of_week === dayOfWeek) return true;
        if (c.type === 'extra' && c.class_date === dateStr) return true;
        return false;
    });

    if (todaysClasses.length === 0) {
        grid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1;">No classes scheduled for today.</p>';
        return;
    }

    todaysClasses.sort((a, b) => a.start_time.localeCompare(b.start_time));

    grid.innerHTML = todaysClasses.map(c => `
        <button class="landing-pill" data-class-id="${c.id}" data-batch-id="${c.batch_id}" data-title="${window.esc(c.title)}" data-batch-name="${window.esc(c.batches ? c.batches.name : 'Unknown Batch')}" data-time="${c.start_time.substring(0, 5)}">
            <span class="landing-pill__icon" style="${c.type === 'extra' ? 'background: rgba(255,191,0,0.15); color: var(--amber);' : 'background: rgba(115,147,179,0.15); color: var(--primary);'} font-size: 0.75rem; font-weight: 600; width: auto; height: auto; padding: 0.3rem 0.75rem; border-radius: var(--radius-full); letter-spacing: 0.05em; text-transform: uppercase;">${c.type === 'extra' ? 'Extra' : 'Regular'}</span>
            <span class="landing-pill__text">
                ${window.esc(c.title)}
                <span style="display:block; font-size: 0.85rem; font-weight: 400; color: var(--text-muted); margin-top: 0.15rem;">${window.esc(c.batches ? c.batches.name : 'Unknown Batch')} &bull; ${c.start_time.substring(0, 5)}</span>
            </span>
        </button>
    `).join('');

    grid.querySelectorAll('.landing-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const t = pill.dataset;
            openAttendanceGrid(t.classId, t.batchId, t.title, t.batchName, t.time);
        });
    });
}

window.openAttendanceGrid = openAttendanceGrid;
async function openAttendanceGrid(classId, batchId, title, batchName, time) {
    currentAttendanceClass = classId;
    currentAttendanceBatch = batchId;
    currentBatchName = batchName;
    currentClassTime = time;

    document.getElementById('attendancePreSelectionContainer').style.display = 'none';
    document.getElementById('attendanceGridContainer').style.display = 'block';
    document.getElementById('attendanceHeaderActions').style.display = 'inline-flex';

    document.getElementById('attendanceClassName').textContent = title;
    document.getElementById('attendanceClassMeta').textContent = `${batchName} • ${time}`;

    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = '<tr><td colspan="2" class="loading-text">Loading roster...</td></tr>';
    document.getElementById('attendanceSaveStatus').style.display = 'none';
    resetSendCheckedBtn();

    const res = await window.api.get('batch_students', { batch_id: batchId }, '*, profiles:student_id(id, name)');

    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="2" class="loading-text status--error">Error: ${res.error}</td></tr>`;
        return;
    }

    const students = res.data.map(m => m.profiles).filter(Boolean)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="loading-text">No students enrolled in this batch.</td></tr>';
        return;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const attRes = await window.api.get('attendance', { class_id: classId, date: dateStr });

    const statusMap = {};
    if (attRes.success && attRes.data) {
        attRes.data.forEach(a => { statusMap[a.student_id] = a.status; });
    }

    tbody.innerHTML = students.map(s => {
        const status = statusMap[s.id] || '';
        return `
        <tr class="att-row" data-student="${s.id}">
            <td><strong>${window.esc(s.name)}</strong></td>
            <td style="text-align: right;">
                <div class="attendance-toggles">
                    <label class="attendance-toggle" title="Present">
                        <input type="radio" name="att_${s.id}" value="present" ${status === 'present' ? 'checked' : ''} data-student="${s.id}">
                        <span class="attendance-toggle__mark">Present</span>
                    </label>
                    <label class="attendance-toggle" title="Late">
                        <input type="radio" name="att_${s.id}" value="late" ${status === 'late' ? 'checked' : ''} data-student="${s.id}">
                        <span class="attendance-toggle__mark">Late</span>
                    </label>
                    <label class="attendance-toggle" title="Absent">
                        <input type="radio" name="att_${s.id}" value="absent" ${status === 'absent' ? 'checked' : ''} data-student="${s.id}">
                        <span class="attendance-toggle__mark">Absent</span>
                    </label>
                </div>
            </td>
        </tr>
        `;
    }).join('');

    await mergeTransferredGuests(batchId, classId, statusMap);

    const todayStr = new Date().toISOString().split('T')[0];
    const sentRes = await window.supabaseClient
        .from('whatsapp_log')
        .select('student_id')
        .eq('message_type', 'attendance')
        .gte('sent_at', todayStr + 'T00:00:00')
        .or(`class_id.eq.${classId},class_id.is.null`);
    if (sentRes.data) {
        const sentIds = new Set(sentRes.data.map(r => r.student_id));
        sentIds.forEach(id => markRowAsSent(id));
    }

    updateSendCheckedBtn();
}

async function mergeTransferredGuests(currentBatchId, classId, statusMap) {
    const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    const todayDay = window.DAYS[new Date().getDay()];

    const res = await window.api.get('batch_transfers', { to_batch_id: currentBatchId }, '*, profiles:student_id(id, name)');
    if (!res.success || !res.data) return;

    const todaysGuests = res.data.filter(t =>
        t.transfer_date === dateStr && t.reason === `classId:${classId}`
    );

    if (todaysGuests.length === 0) return;

    const tbody = document.getElementById('attendanceTableBody');
    const tagStyle = 'display:inline-block; margin-left:0.35rem; padding:0.15rem 0.5rem; border-radius:var(--radius-full); font-size:0.7rem; font-weight:600;';

    todaysGuests.forEach(t => {
        const s = t.profiles;
        if (!s) return;
        if (tbody.querySelector(`tr[data-student="${s.id}"]`)) return;

        const status = statusMap[s.id] || '';
        const row = document.createElement('tr');
        row.className = 'att-row';
        row.dataset.student = s.id;
        row.dataset.transferId = t.id;
        row.innerHTML = `
            <td>
                <div style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
                    <strong>${window.esc(s.name)}</strong>
                    <span style="${tagStyle} background:rgba(115,147,179,0.15); color:var(--primary);">Guest</span>
                    <span style="${tagStyle} background:rgba(0,0,0,0.06); color:var(--text-muted);">${todayDay}</span>
                    <button class="btn-remove-guest" data-id="${t.id}" style="margin-left:auto; background:none; border:none; color:var(--cadmium-red); cursor:pointer; font-size:1.1rem; padding:0 0.3rem;" title="Remove guest">✕</button>
                </div>
            </td>
            <td style="text-align: right;">
                <div class="attendance-toggles">
                    <label class="attendance-toggle" title="Present">
                        <input type="radio" name="att_${s.id}" value="present" ${status === 'present' ? 'checked' : ''} data-student="${s.id}">
                        <span class="attendance-toggle__mark">Present</span>
                    </label>
                    <label class="attendance-toggle" title="Late">
                        <input type="radio" name="att_${s.id}" value="late" ${status === 'late' ? 'checked' : ''} data-student="${s.id}">
                        <span class="attendance-toggle__mark">Late</span>
                    </label>
                    <label class="attendance-toggle" title="Absent">
                        <input type="radio" name="att_${s.id}" value="absent" ${status === 'absent' ? 'checked' : ''} data-student="${s.id}">
                        <span class="attendance-toggle__mark">Absent</span>
                    </label>
                </div>
            </td>
        `;

        row.querySelector('.btn-remove-guest')?.addEventListener('click', async () => {
            if (!confirm('Remove this guest from the roster?')) return;
            const res = await window.api.delete('batch_transfers', t.id);
            if (res.success) { row.remove(); updateSendCheckedBtn(); }
            else alert('Failed to remove: ' + res.error);
        });

        tbody.appendChild(row);
    });
}

async function saveAndSendOne(studentId) {
    const radioChecked = document.querySelector(`#attendanceTableBody input[name="att_${studentId}"]:checked`);
    if (!radioChecked) return { ok: false, msg: 'No status selected' };

    const status = radioChecked.value;
    const dateStr = new Date().toISOString().split('T')[0];

    const { error } = await window.supabaseClient
        .from('attendance')
        .upsert([{
            class_id: currentAttendanceClass,
            batch_id: currentAttendanceBatch,
            student_id: studentId,
            date: dateStr,
            status,
            marked_by: user.id
        }], { onConflict: 'class_id, student_id, date' });

    if (error) return { ok: false, msg: error.message };

    const { data: profiles } = await window.supabaseClient
        .from('profiles')
        .select('id, name, phone, father_name, father_phone, mother_name, mother_phone')
        .eq('id', studentId);

    if (!profiles?.length) return { ok: false, msg: 'Profile not found' };

    const profile = profiles[0];
    const recipients = window.whatsapp.resolveRecipients(profile, 'both');
    if (!recipients.length) return { ok: false, msg: 'No phone on file' };

    try {
        await window.whatsapp.send({
            type: 'attendance',
            recipients,
            payload: {
                status,
                student_name: profile.name,
                batch_name: currentBatchName,
                class_time: currentClassTime,
                date: dateStr,
            },
            sentBy: user.id,
            classId: currentAttendanceClass,
        });
        return { ok: true };
    } catch (err) {
        return { ok: false, msg: err.message };
    }
}

function markRowAsSent(studentId) {
    const row = document.querySelector(`#attendanceTableBody tr.att-row[data-student="${studentId}"]`);
    if (!row) return;
    row.classList.add('att-row--sent');
    row.style.background = 'rgba(37,211,102,0.12)';
    row.style.borderLeft = '3px solid #25D366';
    row.querySelectorAll('input[type="radio"]').forEach(r => r.disabled = true);

    const nameTd = row.querySelector('td:first-child strong');
    if (nameTd && !row.querySelector('.sent-badge')) {
        const badge = document.createElement('span');
        badge.className = 'sent-badge';
        badge.textContent = 'Sent';
        badge.style.cssText = 'display:inline-block;margin-left:0.5rem;padding:0.1rem 0.5rem;border-radius:var(--radius-full);font-size:0.7rem;font-weight:600;background:rgba(37,211,102,0.2);color:#25D366;vertical-align:middle;';
        nameTd.after(badge);
    }

    document.getElementById('attendanceTableBody').appendChild(row);
    updateSendCheckedBtn();
}

function updateSendCheckedBtn() {
    const btn = document.getElementById('btnSendChecked');
    if (!btn) return;
    const rows = document.querySelectorAll('#attendanceTableBody tr.att-row:not(.att-row--sent)');
    const count = [...rows].filter(row => row.querySelector('input[type="radio"]:checked')).length;
    btn.innerHTML = `<i class="ri-whatsapp-line"></i> Send WhatsApp (${count})`;
    btn.disabled = count === 0;
    btn.style.opacity = count === 0 ? '0.5' : '1';
}

function resetSendCheckedBtn() {
    const btn = document.getElementById('btnSendChecked');
    if (!btn) return;
    btn.innerHTML = '<i class="ri-whatsapp-line"></i> Send WhatsApp (0)';
    btn.disabled = true;
    btn.style.opacity = '0.5';
}

export function init() {
    loadTodaysClasses();

    // Auto-update send button count when any radio changes
    const tbody = document.getElementById('attendanceTableBody');
    if (tbody) {
        tbody.addEventListener('change', (e) => {
            if (e.target.type === 'radio') updateSendCheckedBtn();
        });
    }

    // Send WhatsApp to all marked, un-sent students
    const btnSendChecked = document.getElementById('btnSendChecked');
    if (btnSendChecked) {
        btnSendChecked.addEventListener('click', async () => {
            const rows = [...document.querySelectorAll('#attendanceTableBody tr.att-row:not(.att-row--sent)')]
                .filter(row => row.querySelector('input[type="radio"]:checked'));
            if (!rows.length) return;

            const statusEl = document.getElementById('sendCheckedStatus');
            btnSendChecked.disabled = true;
            if (statusEl) statusEl.style.display = 'none';

            let sent = 0, failed = 0;
            const total = rows.length;

            for (const row of rows) {
                btnSendChecked.innerHTML = `<i class="ri-loader-4-line"></i> Sending ${sent + failed + 1}/${total}...`;
                const { ok } = await saveAndSendOne(row.dataset.student);
                if (ok) { sent++; markRowAsSent(row.dataset.student); } else failed++;
            }

            btnSendChecked.disabled = false;
            updateSendCheckedBtn();

            if (statusEl) {
                statusEl.textContent = `WhatsApp: ${sent} sent${failed > 0 ? `, ${failed} failed` : ''}`;
                statusEl.className = failed > 0 ? 'status status--error' : 'status status--success';
                statusEl.style.display = 'block';
                setTimeout(() => statusEl.style.display = 'none', 4000);
            }
        });
    }

    // Add Guest
    const btnAddGuest = document.getElementById('btnAddGuest');
    if (btnAddGuest) {
        btnAddGuest.addEventListener('click', async () => {
            const form = document.getElementById('addGuestForm');
            const isOpen = form.style.display !== 'none';
            form.style.display = isOpen ? 'none' : 'block';
            if (isOpen) return;

            if (guestListLoadedForBatch === currentAttendanceBatch) return;

            const listEl = document.getElementById('guestStudentList');
            const searchInput = document.getElementById('guestStudentSearch');
            const countEl = document.getElementById('guestSelectedCount');

            listEl.innerHTML = '<p class="loading-text" style="padding:0.5rem;">Loading...</p>';
            searchInput.disabled = true;
            searchInput.value = '';
            if (countEl) countEl.textContent = '0 selected';

            const batchRes = await window.api.get('batches', { id: currentAttendanceBatch }, 'subject, grade');
            if (!batchRes.success || !batchRes.data?.length) {
                listEl.innerHTML = '<p class="loading-text" style="padding:0.5rem;">Failed to load batch info.</p>';
                return;
            }
            const { grade } = batchRes.data[0];

            const enrolledRes = await window.api.get('batch_students', { batch_id: currentAttendanceBatch }, 'student_id');
            const enrolledIds = new Set((enrolledRes.data || []).map(r => r.student_id));

            const studentsRes = await window.api.get('profiles', { role: 'student', grade }, 'id, name');
            if (!studentsRes.success) {
                listEl.innerHTML = '<p class="loading-text" style="padding:0.5rem;">Failed to load students.</p>';
                return;
            }

            const eligible = (studentsRes.data || [])
                .filter(s => !enrolledIds.has(s.id))
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            if (eligible.length === 0) {
                listEl.innerHTML = '<p class="loading-text" style="padding:0.5rem;">No other students in this grade.</p>';
                return;
            }

            listEl.innerHTML = eligible.map(s => `
                <label class="student-picker__item" data-name="${window.esc(s.name).toLowerCase()}" style="padding:0.4rem 0.5rem;">
                    <input type="checkbox" class="form__checkbox" value="${s.id}" data-name="${window.esc(s.name)}">
                    <span class="student-picker__name">${window.esc(s.name)}</span>
                </label>
            `).join('');

            searchInput.disabled = false;
            searchInput.oninput = () => {
                const q = searchInput.value.toLowerCase();
                listEl.querySelectorAll('.student-picker__item').forEach(item => {
                    item.style.display = item.dataset.name.includes(q) ? 'flex' : 'none';
                });
            };

            listEl.addEventListener('change', () => {
                const n = listEl.querySelectorAll('input:checked').length;
                if (countEl) countEl.textContent = `${n} selected`;
            });

            guestListLoadedForBatch = currentAttendanceBatch;
        });
    }

    document.getElementById('btnCancelGuest')?.addEventListener('click', () => {
        document.getElementById('addGuestForm').style.display = 'none';
    });

    const btnConfirmGuest = document.getElementById('btnConfirmGuest');
    if (btnConfirmGuest) {
        btnConfirmGuest.addEventListener('click', async () => {
            const listEl = document.getElementById('guestStudentList');
            const statusEl = document.getElementById('guestStatus');
            const checked = listEl ? Array.from(listEl.querySelectorAll('input:checked')) : [];

            if (checked.length === 0) {
                statusEl.textContent = 'Please select at least one student.';
                statusEl.className = 'status status--error';
                statusEl.style.display = 'block';
                return;
            }

            btnConfirmGuest.disabled = true;
            btnConfirmGuest.textContent = 'Adding...';
            statusEl.style.display = 'none';

            const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
            const todayDay = window.DAYS[new Date().getDay()];
            const tbody = document.getElementById('attendanceTableBody');
            const tagStyle = 'display:inline-block; margin-left:0.35rem; padding:0.15rem 0.5rem; border-radius:var(--radius-full); font-size:0.7rem; font-weight:600;';

            let failed = 0;
            for (const cb of checked) {
                const studentId = cb.value;
                const studentName = cb.dataset.name;

                const res = await window.api.post('batch_transfers', {
                    student_id: studentId,
                    to_batch_id: currentAttendanceBatch,
                    transfer_date: dateStr,
                    reason: `classId:${currentAttendanceClass}`,
                    created_by: user.id
                });

                if (!res.success) { failed++; continue; }

                const transferId = res.data.id;
                const row = document.createElement('tr');
                row.className = 'att-row';
                row.dataset.student = studentId;
                row.dataset.transferId = transferId;
                row.innerHTML = `
                    <td>
                        <div style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
                            <strong>${window.esc(studentName)}</strong>
                            <span style="${tagStyle} background:rgba(115,147,179,0.15); color:var(--primary);">Guest</span>
                            <span style="${tagStyle} background:rgba(0,0,0,0.06); color:var(--text-muted);">${todayDay}</span>
                            <button class="btn-remove-guest" data-id="${transferId}" style="margin-left:auto; background:none; border:none; color:var(--cadmium-red); cursor:pointer; font-size:1.1rem; padding:0 0.3rem;" title="Remove guest">✕</button>
                        </div>
                    </td>
                    <td style="text-align: right;">
                        <div class="attendance-toggles">
                            <label class="attendance-toggle" title="Present">
                                <input type="radio" name="att_${studentId}" value="present" data-student="${studentId}">
                                <span class="attendance-toggle__mark">Present</span>
                            </label>
                            <label class="attendance-toggle" title="Late">
                                <input type="radio" name="att_${studentId}" value="late" data-student="${studentId}">
                                <span class="attendance-toggle__mark">Late</span>
                            </label>
                            <label class="attendance-toggle" title="Absent">
                                <input type="radio" name="att_${studentId}" value="absent" data-student="${studentId}">
                                <span class="attendance-toggle__mark">Absent</span>
                            </label>
                        </div>
                    </td>
                `;

                row.querySelector('.btn-remove-guest')?.addEventListener('click', async () => {
                    if (!confirm('Remove this guest from the roster?')) return;
                    const delRes = await window.api.delete('batch_transfers', transferId);
                    if (delRes.success) { row.remove(); updateSendCheckedBtn(); }
                    else alert('Failed to remove: ' + delRes.error);
                });

                tbody.appendChild(row);
            }

            btnConfirmGuest.disabled = false;
            btnConfirmGuest.textContent = 'Add to Roster';

            const added = checked.length - failed;
            document.getElementById('addGuestForm').style.display = 'none';
            document.getElementById('guestStudentSearch').disabled = true;
            document.getElementById('guestStudentSearch').value = '';
            document.getElementById('guestSelectedCount').textContent = '0 selected';

            updateSendCheckedBtn();
            const saveStatus = document.getElementById('attendanceSaveStatus');
            saveStatus.textContent = failed > 0
                ? `${added} student(s) added, ${failed} failed.`
                : `${added} student(s) added as guests!`;
            saveStatus.className = failed > 0 ? 'status status--error' : 'status status--success';
            saveStatus.style.display = 'block';
            setTimeout(() => saveStatus.style.display = 'none', 3000);
        });
    }

    document.getElementById('btnSwitchClassAttendance')?.addEventListener('click', () => {
        window.loadTab('panel-schedule');
    });

    document.getElementById('btnMarkAllPresent')?.addEventListener('click', () => {
        document.querySelectorAll('#attendanceTableBody input[value="present"]').forEach(r => r.checked = true);
        updateSendCheckedBtn();
    });

    const btnSaveAttendance = document.getElementById('btnSaveAttendance');
    if (btnSaveAttendance) {
        btnSaveAttendance.addEventListener('click', async () => {
            if (!currentAttendanceClass || !currentAttendanceBatch) return;

            btnSaveAttendance.disabled = true;
            btnSaveAttendance.textContent = 'Saving...';

            const statusText = document.getElementById('attendanceSaveStatus');
            statusText.style.display = 'none';

            const dateStr = new Date().toISOString().split('T')[0];
            const studentRadios = document.querySelectorAll('#attendanceTableBody input[type="radio"]:checked');

            const records = Array.from(studentRadios).map(r => ({
                class_id: currentAttendanceClass,
                batch_id: currentAttendanceBatch,
                student_id: r.getAttribute('data-student'),
                date: dateStr,
                status: r.value,
                marked_by: user.id
            }));

            const { error } = await window.supabaseClient
                .from('attendance')
                .upsert(records, { onConflict: 'class_id, student_id, date' })
                .select();

            btnSaveAttendance.disabled = false;
            btnSaveAttendance.textContent = 'Save Attendance';

            if (!error) {
                statusText.textContent = 'Attendance saved!';
                statusText.className = 'status status--success';
                statusText.style.display = 'block';
                setTimeout(() => statusText.style.display = 'none', 3000);
            } else {
                statusText.textContent = 'Failed to save: ' + error.message;
                statusText.className = 'status status--error';
                statusText.style.display = 'block';
            }
        });
    }
}

export function refresh() {
    loadTodaysClasses();
}
