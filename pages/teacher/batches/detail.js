let currentBatchId = null;
let currentBatchGrade = null;
let currentBatchSubject = null;
let pickerChangeHandler = null;

async function loadBatchMembers(batchId) {
    const tbody = document.getElementById('batchMembersBody');
    const countBadge = document.getElementById('batchMemberCount');
    tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Loading members...</td></tr>';

    const res = await window.api.get('batch_students', { batch_id: batchId }, '*, profiles:student_id(name, username, grade)');

    if (res.success) {
        const members = (res.data || []).sort((a, b) => (a.profiles?.name || '').localeCompare(b.profiles?.name || ''));
        countBadge.textContent = members.length;

        if (members.length > 0) {
            tbody.innerHTML = members.map(m => {
                const p = m.profiles || {};
                return `
                    <tr class="data-table__row">
                        <td class="data-table__td--main">${window.esc(p.name) || '-'}</td>
                        <td class="data-table__td">${window.esc(p.username) || '-'}</td>
                        <td class="data-table__td">${window.esc(p.grade) || '-'}</td>
                        <td class="data-table__td">
                            <button class="btn btn--danger btn--sm" data-action="remove-student" data-id="${m.id}">Remove</button>
                        </td>
                    </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="loading-text">No students in this batch yet.</td></tr>';
        }
    } else {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Failed to load members.</td></tr>';
    }
}

async function loadStudentPicker(batchId) {
    const listEl = document.getElementById('studentPickerList');
    const searchInput = document.getElementById('studentPickerSearch');
    listEl.innerHTML = '<p class="loading-text">Loading students...</p>';
    if (searchInput) searchInput.value = '';

    const studentsRes = await window.api.get('profiles', { role: 'student' });
    const membersRes = await window.api.get('batch_students', { batch_id: batchId }, 'student_id');

    const memberIds = new Set();
    if (membersRes.success && membersRes.data) {
        membersRes.data.forEach(m => memberIds.add(m.student_id));
    }

    if (studentsRes.success && studentsRes.data) {
        let allStudents = studentsRes.data;
        if (currentBatchGrade) {
            allStudents = allStudents.filter(s => s.grade === currentBatchGrade);
        } else {
            const teacherGrade = window.auth.getUser()?.grade;
            if (teacherGrade && teacherGrade !== 'All Grades') {
                const allowedGrades = teacherGrade.split(',').map(g => g.trim()).filter(Boolean);
                allStudents = allStudents.filter(s => allowedGrades.includes(s.grade));
            }
        }
        if (currentBatchSubject) {
            const batchSubjects = currentBatchSubject.split(',').map(s => s.trim()).filter(Boolean);
            allStudents = allStudents.filter(s => {
                if (!s.subjects) return false;
                return s.subjects.split(',').map(s => s.trim()).some(s => batchSubjects.includes(s));
            });
        }

        const available = allStudents.filter(s => !memberIds.has(s.id))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (available.length > 0) {
            listEl.innerHTML = available.map(s => `
                <label class="student-picker__item" data-name="${window.esc(s.name).toLowerCase()}">
                    <input type="checkbox" class="form__checkbox" value="${s.id}">
                    <span class="student-picker__name">${window.esc(s.name) || 'Unnamed'}</span>
                    <span class="student-picker__info">${window.esc(s.grade) || ''} • ${window.esc(s.username) || ''}</span>
                </label>
            `).join('');
        } else {
            listEl.innerHTML = '<p class="loading-text">All students are already in this batch.</p>';
        }

        if (searchInput) {
            searchInput.oninput = () => {
                const q = searchInput.value.toLowerCase();
                listEl.querySelectorAll('.student-picker__item').forEach(item => {
                    item.style.display = item.dataset.name.includes(q) ? 'flex' : 'none';
                });
            };
        }

        if (pickerChangeHandler) listEl.removeEventListener('change', pickerChangeHandler);
        pickerChangeHandler = () => {
            const checked = listEl.querySelectorAll('input:checked').length;
            document.getElementById('selectedCount').textContent = `${checked} selected`;
        };
        listEl.addEventListener('change', pickerChangeHandler);
    } else {
        listEl.innerHTML = '<p class="loading-text">Failed to load students.</p>';
    }
}

export async function init() {
    const batch = window._pendingBatch;
    if (!batch) {
        window.loadPage('page-batches', '');
        return;
    }

    currentBatchId = batch.id;
    document.getElementById('batchDetailName').textContent = batch.name;

    const batchRes = await window.api.get('batches', { id: currentBatchId }, '*, classes(type, day_of_week, class_date, start_time)');
    if (batchRes.success && batchRes.data && batchRes.data.length > 0) {
        const b = batchRes.data[0];
        currentBatchGrade = b.grade || null;
        currentBatchSubject = b.subject || null;

        let scheduleStr = '';
        if (b.classes && b.classes.length > 0) {
            const regularClasses = b.classes.filter(c => c.type === 'regular');
            if (regularClasses.length > 0) {
                const schedParts = regularClasses.map(c => `${window.DAYS[c.day_of_week]} ${window.formatTime(c.start_time)}`);
                scheduleStr = [...new Set(schedParts)].join(', ');
            }
        }

        document.getElementById('batchDetailMeta').textContent =
            `${b.grade || ''} • ${b.subject || ''} • ${scheduleStr}`;
    }

    await loadBatchMembers(currentBatchId);
    await loadStudentPicker(currentBatchId);

    document.getElementById('btnBackToBatches').addEventListener('click', () => {
        window.loadPage('page-batches', '');
    });

    const membersTbody = document.getElementById('batchMembersTable');
    if (membersTbody) {
        membersTbody.addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-action="remove-student"]');
            if (!btn) return;
            if (!confirm('Remove this student from the batch?')) return;
            const { error } = await window.api.deleteMany('batch_students', { id: btn.dataset.id });
            if (error) {
                alert('Failed to remove: ' + error);
            } else {
                await loadBatchMembers(currentBatchId);
                await loadStudentPicker(currentBatchId);
            }
        });
    }

    const btnAddSelected = document.getElementById('btnAddSelectedStudents');
    if (btnAddSelected) {
        btnAddSelected.addEventListener('click', async () => {
            const listEl = document.getElementById('studentPickerList');
            const checked = listEl.querySelectorAll('input:checked');
            const statusEl = document.getElementById('batchDetailStatus');

            if (checked.length === 0) {
                window.showStatus('batchDetailStatus', 'Please select at least one student.', 'error');
                return;
            }

            btnAddSelected.disabled = true;
            btnAddSelected.textContent = 'Adding...';
            statusEl.style.display = 'none';

            const rows = Array.from(checked).map(cb => ({
                batch_id: currentBatchId,
                student_id: cb.value
            }));

            const { error } = await window.supabaseClient.from('batch_students').insert(rows);

            btnAddSelected.disabled = false;
            btnAddSelected.textContent = 'Add Selected';

            if (error) {
                window.showStatus('batchDetailStatus', 'Error: ' + error.message, 'error');
            } else {
                window.showStatus('batchDetailStatus', `${rows.length} student(s) added!`, 'success');
                document.getElementById('selectedCount').textContent = '0 selected';
                await loadBatchMembers(currentBatchId);
                await loadStudentPicker(currentBatchId);
            }
        });
    }

    const btnDeleteBatch = document.getElementById('btnDeleteBatch');
    if (btnDeleteBatch) {
        btnDeleteBatch.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to delete this entire batch? All student assignments will be removed.')) return;
            const res = await window.api.deleteMany('batches', { id: currentBatchId });
            if (!res.success) {
                alert('Failed to delete batch: ' + res.error);
            } else {
                window.loadPage('page-batches', '');
            }
        });
    }
}
