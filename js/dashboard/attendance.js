const user = window.auth.getUser();

let currentAttendanceClass = null;
let currentAttendanceBatch = null;
let currentBatchName = '';
let currentClassTime = ''; // "HH:MM" 24h — used for WhatsApp notify payload

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

    // Attach click listeners
    const pills = grid.querySelectorAll('.landing-pill');
    pills.forEach(pill => {
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
    currentClassTime = time; // "HH:MM"

    document.getElementById('attendancePreSelectionContainer').style.display = 'none';
    document.getElementById('attendanceGridContainer').style.display = 'block';
    document.getElementById('attendanceHeaderActions').style.display = 'inline-flex';

    document.getElementById('attendanceClassName').textContent = title;
    document.getElementById('attendanceClassMeta').textContent = `${batchName} • ${time}`;

    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = '<tr><td colspan="2" class="loading-text">Loading roster...</td></tr>';
    document.getElementById('attendanceSaveStatus').style.display = 'none';

    const res = await window.api.get('batch_students', { batch_id: batchId }, '*, profiles:student_id(id, name)');

    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="2" class="loading-text status--error">Error: ${res.error}</td></tr>`;
        return;
    }

    const students = res.data.map(m => m.profiles).filter(Boolean);

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="loading-text">No students enrolled in this batch.</td></tr>';
        return;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const attRes = await window.api.get('attendance', { class_id: classId, date: dateStr });

    const statusMap = {};
    if (attRes.success && attRes.data) {
        attRes.data.forEach(a => {
            statusMap[a.student_id] = a.status;
        });
    }

    tbody.innerHTML = students.map(s => {
        const status = statusMap[s.id] || 'present';
        return `
        <tr>
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
}

async function mergeTransferredGuests(currentBatchId, classId, statusMap) {
    const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayDay = days[new Date().getDay()];

    const res = await window.api.get('batch_transfers', { to_batch_id: currentBatchId }, '*, profiles:student_id(id, name), batches:from_batch_id(name)');
    if (!res.success || !res.data) return;

    const todaysGuests = res.data.filter(t => {
        if (t.transfer_date !== dateStr) return false;
        if (!t.end_date || t.end_date !== dateStr) return false;
        if (t.reason !== `classId:${classId}`) return false;
        return true;
    });

    if (todaysGuests.length === 0) return;

    const tbody = document.getElementById('attendanceTableBody');
    const tagStyle = 'display:inline-block; margin-left:0.35rem; padding:0.15rem 0.5rem; border-radius:var(--radius-full); font-size:0.7rem; font-weight:600;';

    todaysGuests.forEach(t => {
        const s = t.profiles;
        if (!s) return;
        if (tbody.querySelector(`input[data-student="${s.id}"]`)) return;

        const batchName = t.batches ? t.batches.name : 'Unknown';
        const status = statusMap[s.id] || 'present';
        const row = document.createElement('tr');
        row.dataset.transferId = t.id;
        row.innerHTML = `
            <td>
                <div style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
                    <strong>${window.esc(s.name)}</strong>
                    <span style="${tagStyle} background:rgba(115,147,179,0.15); color:var(--primary);">Guest</span>
                    <span style="${tagStyle} background:rgba(138,154,91,0.15); color:var(--secondary);">${window.esc(batchName)}</span>
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

        const btnRemove = row.querySelector('.btn-remove-guest');
        if (btnRemove) {
            btnRemove.addEventListener('click', async () => {
                if (!confirm('Remove this guest from the roster?')) return;
                const res = await window.api.delete('batch_transfers', t.id);
                if (res.success) {
                    row.remove();
                } else {
                    alert('Failed to remove: ' + res.error);
                }
            });
        }

        tbody.appendChild(row);
    });
}

export function init() {
    loadTodaysClasses();

    const btnAddGuest = document.getElementById('btnAddGuest');
    if (btnAddGuest) {
        btnAddGuest.addEventListener('click', async () => {
            const form = document.getElementById('addGuestForm');
            form.style.display = form.style.display === 'none' ? 'block' : 'none';

            const batchSelect = document.getElementById('guestBatchSelect');
            if (batchSelect.options.length <= 1) {
                const res = await window.api.get('batches', {});
                if (res.success) {
                    res.data.forEach(b => {
                        if (b.id !== currentAttendanceBatch) {
                            const opt = document.createElement('option');
                            opt.value = b.id;
                            opt.textContent = b.name;
                            batchSelect.appendChild(opt);
                        }
                    });
                }
            }
        });
    }

    const guestBatchSelect = document.getElementById('guestBatchSelect');
    if (guestBatchSelect) {
        guestBatchSelect.addEventListener('change', async (e) => {
            const batchId = e.target.value;
            const studentSelect = document.getElementById('guestStudentSelect');
            studentSelect.innerHTML = '<option value="">Loading...</option>';
            studentSelect.disabled = true;

            if (!batchId) {
                studentSelect.innerHTML = '<option value="">Pick a batch first...</option>';
                return;
            }

            const res = await window.api.get('batch_students', { batch_id: batchId }, '*, profiles:student_id(id, name)');
            if (res.success && res.data) {
                studentSelect.innerHTML = '<option value="">Select student...</option>';
                res.data.forEach(m => {
                    if (m.profiles) {
                        const opt = document.createElement('option');
                        opt.value = m.profiles.id;
                        opt.textContent = m.profiles.name;
                        opt.dataset.name = m.profiles.name;
                        studentSelect.appendChild(opt);
                    }
                });
                studentSelect.disabled = false;
            } else {
                studentSelect.innerHTML = '<option value="">No students found</option>';
            }
        });
    }

    const btnCancelGuest = document.getElementById('btnCancelGuest');
    if (btnCancelGuest) {
        btnCancelGuest.addEventListener('click', () => {
            document.getElementById('addGuestForm').style.display = 'none';
        });
    }

    const btnConfirmGuest = document.getElementById('btnConfirmGuest');
    if (btnConfirmGuest) {
        btnConfirmGuest.addEventListener('click', async () => {
            const studentId = document.getElementById('guestStudentSelect').value;
            const fromBatchId = document.getElementById('guestBatchSelect').value;
            const statusEl = document.getElementById('guestStatus');

            if (!studentId || !fromBatchId) {
                statusEl.textContent = 'Please select a batch and student.';
                statusEl.className = 'status status--error';
                statusEl.style.display = 'block';
                return;
            }

            const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

            const res = await window.api.post('batch_transfers', {
                student_id: studentId,
                from_batch_id: fromBatchId,
                to_batch_id: currentAttendanceBatch,
                transfer_date: dateStr,
                reason: `classId:${currentAttendanceClass}`,
                created_by: user.id
            });

            if (!res.success) {
                statusEl.textContent = 'Failed: ' + res.error;
                statusEl.className = 'status status--error';
                statusEl.style.display = 'block';
                return;
            }

            const studentName = document.getElementById('guestStudentSelect').selectedOptions[0].dataset.name;
            const batchName = document.getElementById('guestBatchSelect').selectedOptions[0].textContent;
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const todayDay = days[new Date().getDay()];
            const transferId = res.data.id;
            const tagStyle = 'display:inline-block; margin-left:0.35rem; padding:0.15rem 0.5rem; border-radius:var(--radius-full); font-size:0.7rem; font-weight:600;';

            const tbody = document.getElementById('attendanceTableBody');
            const row = document.createElement('tr');
            row.dataset.transferId = transferId;
            row.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
                        <strong>${window.esc(studentName)}</strong>
                        <span style="${tagStyle} background:rgba(115,147,179,0.15); color:var(--primary);">Guest</span>
                        <span style="${tagStyle} background:rgba(138,154,91,0.15); color:var(--secondary);">${window.esc(batchName)}</span>
                        <span style="${tagStyle} background:rgba(0,0,0,0.06); color:var(--text-muted);">${todayDay}</span>
                        <button class="btn-remove-guest" data-id="${transferId}" style="margin-left:auto; background:none; border:none; color:var(--cadmium-red); cursor:pointer; font-size:1.1rem; padding:0 0.3rem;" title="Remove guest">✕</button>
                    </div>
                </td>
                <td style="text-align: right;">
                    <div class="attendance-toggles">
                        <label class="attendance-toggle" title="Present">
                            <input type="radio" name="att_${studentId}" value="present" checked data-student="${studentId}">
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

            const btnRemove = row.querySelector('.btn-remove-guest');
            if (btnRemove) {
                btnRemove.addEventListener('click', async () => {
                    if (!confirm('Remove this guest from the roster?')) return;
                    const delRes = await window.api.delete('batch_transfers', transferId);
                    if (delRes.success) {
                        row.remove();
                    } else {
                        alert('Failed to remove: ' + delRes.error);
                    }
                });
            }

            tbody.appendChild(row);

            document.getElementById('addGuestForm').style.display = 'none';
            document.getElementById('guestBatchSelect').value = '';
            document.getElementById('guestStudentSelect').innerHTML = '<option value="">Pick a batch first...</option>';
            document.getElementById('guestStudentSelect').disabled = true;

            const saveStatus = document.getElementById('attendanceSaveStatus');
            saveStatus.textContent = `${studentName} added as guest!`;
            saveStatus.className = 'status status--success';
            saveStatus.style.display = 'block';
            setTimeout(() => saveStatus.style.display = 'none', 3000);
        });
    }

    const btnSwitchClassAttendance = document.getElementById('btnSwitchClassAttendance');
    if (btnSwitchClassAttendance) {
        btnSwitchClassAttendance.addEventListener('click', () => {
            document.getElementById('attendancePreSelectionContainer').style.display = 'block';
            document.getElementById('attendanceGridContainer').style.display = 'none';
            document.getElementById('attendanceHeaderActions').style.display = 'none';
            document.getElementById('addGuestForm').style.display = 'none';
        });
    }

    const btnMarkAllPresent = document.getElementById('btnMarkAllPresent');
    if (btnMarkAllPresent) {
        btnMarkAllPresent.addEventListener('click', () => {
            const radios = document.querySelectorAll('#attendanceTableBody input[value="present"]');
            radios.forEach(r => r.checked = true);
        });
    }

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

            const { data, error } = await window.supabaseClient
                .from('attendance')
                .upsert(records, { onConflict: 'class_id, student_id, date' })
                .select();

            btnSaveAttendance.disabled = false;
            btnSaveAttendance.textContent = 'Save Attendance';

            if (!error) {
                statusText.textContent = 'Attendance saved successfully!';
                statusText.className = 'status status--success';
                statusText.style.display = 'block';

                // Always show Notify button after saving — notifies all students
                const btnNotify = document.getElementById('btnNotifyAbsentLate');
                if (btnNotify) {
                    btnNotify.style.display = 'inline-flex';
                    btnNotify.disabled = false;
                    btnNotify.innerHTML = `<i class="ri-whatsapp-line"></i> Notify via WhatsApp (${records.length})`;
                    btnNotify._absentLateRecords = records;
                }

                setTimeout(() => {
                    statusText.style.display = 'none';
                }, 3000);
            } else {
                statusText.textContent = 'Failed to save: ' + error.message;
                statusText.className = 'status status--error';
                statusText.style.display = 'block';
            }
        });
    }

    // ── Notify Absent/Late via WhatsApp ──────────────────────────
    const btnNotifyAbsentLate = document.getElementById('btnNotifyAbsentLate');
    if (btnNotifyAbsentLate) {
        btnNotifyAbsentLate.addEventListener('click', async () => {
            const records = btnNotifyAbsentLate._absentLateRecords;
            if (!records || records.length === 0) return;

            const notifyStatus = document.getElementById('notifyAbsentStatus');
            btnNotifyAbsentLate.disabled = true;
            btnNotifyAbsentLate.textContent = 'Sending...';
            if (notifyStatus) notifyStatus.style.display = 'none';

            const dateStr = new Date().toISOString().split('T')[0];

            // Fetch profiles for student phone + mother/father phone
            const studentIds = records.map(r => r.student_id);
            const { data: profiles } = await window.supabaseClient
                .from('profiles')
                .select('id, name, phone, father_name, father_phone, mother_name, mother_phone')
                .in('id', studentIds);

            if (!profiles || profiles.length === 0) {
                if (notifyStatus) {
                    notifyStatus.textContent = 'No student profiles found.';
                    notifyStatus.className = 'status status--error';
                    notifyStatus.style.display = 'block';
                }
                btnNotifyAbsentLate.disabled = false;
                btnNotifyAbsentLate.innerHTML = '<i class="ri-whatsapp-line"></i> Notify Absent/Late';
                return;
            }

            let totalSent = 0;
            let totalFailed = 0;

            for (const record of records) {
                const profile = profiles.find(p => p.id === record.student_id);
                if (!profile) continue;

                const recipients = window.whatsapp.resolveRecipients(profile, 'both');
                if (recipients.length === 0) {
                    totalFailed++;
                    continue;
                }

                try {
                    const result = await window.whatsapp.send({
                        type: 'attendance',
                        recipients,
                        payload: {
                            status: record.status,
                            student_name: profile.name,
                            batch_name: currentBatchName,
                            class_time: currentClassTime,
                            date: dateStr,
                            // punch_in_time: — omitted until biometric machine is connected
                        },
                        sentBy: user.id,
                    });
                    totalSent += result.sent || 0;
                    totalFailed += result.failed || 0;
                } catch (err) {
                    totalFailed++;
                }
            }

            btnNotifyAbsentLate.disabled = false;
            btnNotifyAbsentLate.style.display = 'none';

            if (notifyStatus) {
                notifyStatus.textContent = `WhatsApp: ${totalSent} sent, ${totalFailed} failed`;
                notifyStatus.className = totalFailed > 0 ? 'status status--error' : 'status status--success';
                notifyStatus.style.display = 'block';
                setTimeout(() => notifyStatus.style.display = 'none', 5000);
            }
        });
    }
}

export function refresh() {
    loadTodaysClasses();
}
