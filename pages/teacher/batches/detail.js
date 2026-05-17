let currentBatchId = null;
let currentBatchGrade = null;
let currentBatchSubject = null;
let pickerChangeHandler = null;

function avatarLetter(name) {
    return (name || '?')[0].toUpperCase();
}

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
                        <td class="data-table__td--main">
                            <span class="member-avatar" aria-hidden="true">${avatarLetter(p.name)}</span>${window.esc(p.name) || '—'}
                        </td>
                        <td class="data-table__td">${window.esc(p.username) || '—'}</td>
                        <td class="data-table__td">${window.esc(p.grade) || '—'}</td>
                        <td class="data-table__td">
                            <button class="btn btn--danger btn--sm" data-action="remove-student" data-id="${m.id}" style="display:inline-flex;align-items:center;gap:0.3rem;">
                                <i class="ri-user-unfollow-line"></i> Remove
                            </button>
                        </td>
                    </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="detail-empty">
                            <i class="ri-group-line"></i>
                            No students enrolled yet. Add some from the panel on the right.
                        </div>
                    </td>
                </tr>`;
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

    const [studentsRes, membersRes] = await Promise.all([
        window.api.get('profiles', { role: 'student' }),
        window.api.get('batch_students', { batch_id: batchId }, 'student_id')
    ]);

    const memberIds = new Set();
    if (membersRes.success && membersRes.data) {
        membersRes.data.forEach(m => memberIds.add(m.student_id));
    }

    if (!studentsRes.success) {
        listEl.innerHTML = '<p class="loading-text">Failed to load students.</p>';
        return;
    }

    let allStudents = studentsRes.data || [];
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

    const available = allStudents
        .filter(s => !memberIds.has(s.id))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (available.length > 0) {
        listEl.innerHTML = available.map(s => `
            <label class="student-picker__item" data-name="${window.esc(s.name).toLowerCase()}">
                <input type="checkbox" class="form__checkbox" value="${s.id}" aria-label="${window.esc(s.name)}">
                <span class="picker-avatar" aria-hidden="true">${avatarLetter(s.name)}</span>
                <span class="student-picker__name">${window.esc(s.name) || 'Unnamed'}</span>
                <span class="student-picker__info">${window.esc(s.grade) || ''} · ${window.esc(s.username) || ''}</span>
            </label>
        `).join('');
    } else {
        listEl.innerHTML = `
            <div class="detail-empty">
                <i class="ri-checkbox-circle-line"></i>
                All eligible students are already enrolled.
            </div>`;
    }

    if (searchInput) {
        searchInput.oninput = () => {
            const q = searchInput.value.toLowerCase();
            listEl.querySelectorAll('.student-picker__item').forEach(item => {
                item.style.display = item.dataset.name.includes(q) ? '' : 'none';
            });
            updateSelectedCount();
        };
    }

    if (pickerChangeHandler) listEl.removeEventListener('change', pickerChangeHandler);
    pickerChangeHandler = () => updateSelectedCount();
    listEl.addEventListener('change', pickerChangeHandler);

    // Select-all toggle
    const btnSelectAll = document.getElementById('btnSelectAll');
    if (btnSelectAll) {
        btnSelectAll.onclick = () => {
            const items = listEl.querySelectorAll('.student-picker__item');
            const visible = [...items].filter(i => i.style.display !== 'none');
            const allChecked = visible.every(i => i.querySelector('input').checked);
            visible.forEach(i => { i.querySelector('input').checked = !allChecked; });
            btnSelectAll.textContent = allChecked ? 'Select all' : 'Clear all';
            updateSelectedCount();
        };
    }
}

function updateSelectedCount() {
    const listEl = document.getElementById('studentPickerList');
    const countEl = document.getElementById('selectedCount');
    if (!listEl || !countEl) return;
    const checked = listEl.querySelectorAll('input:checked').length;
    countEl.textContent = `${checked} selected`;
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
            const regular = b.classes.filter(c => c.type === 'regular');
            if (regular.length > 0) {
                const parts = regular.map(c => `${window.DAYS[c.day_of_week]} ${window.formatTime(c.start_time)}`);
                scheduleStr = [...new Set(parts)].join(', ');
            }
        }

        document.getElementById('batchDetailMeta').textContent = scheduleStr || 'No schedule set';

        if (b.grade) {
            document.getElementById('batchGradeLabel').textContent = b.grade;
            document.getElementById('batchGradeChip').style.display = '';
        }
        if (b.subject) {
            document.getElementById('batchSubjectLabel').textContent = b.subject;
            document.getElementById('batchSubjectChip').style.display = '';
        }
    }

    await loadBatchMembers(currentBatchId);
    await loadStudentPicker(currentBatchId);

    document.getElementById('btnBackToBatches').addEventListener('click', () => {
        window.loadPage('page-batches', '');
    });

    document.getElementById('batchMembersTable')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action="remove-student"]');
        if (!btn) return;
        if (!confirm('Remove this student from the batch?')) return;
        const { error } = await window.api.deleteMany('batch_students', { id: btn.dataset.id });
        if (error) {
            window.showStatus('batchDetailStatus', 'Failed to remove: ' + error, 'error');
        } else {
            await loadBatchMembers(currentBatchId);
            await loadStudentPicker(currentBatchId);
        }
    });

    document.getElementById('btnAddSelectedStudents')?.addEventListener('click', async () => {
        const listEl = document.getElementById('studentPickerList');
        const checked = listEl.querySelectorAll('input:checked');

        if (checked.length === 0) {
            window.showStatus('batchDetailStatus', 'Select at least one student.', 'error');
            return;
        }

        const btn = document.getElementById('btnAddSelectedStudents');
        const icon = document.getElementById('btnAddIcon');
        const text = document.getElementById('btnAddText');
        const spinner = document.getElementById('btnAddSpinner');

        btn.disabled = true;
        icon.style.display = 'none';
        text.textContent = 'Adding…';
        spinner.style.display = 'inline-block';

        const rows = Array.from(checked).map(cb => ({
            batch_id: currentBatchId,
            student_id: cb.value
        }));

        const { error } = await window.supabaseClient.from('batch_students').insert(rows);

        btn.disabled = false;
        icon.style.display = '';
        text.textContent = 'Add Selected';
        spinner.style.display = 'none';

        if (error) {
            window.showStatus('batchDetailStatus', 'Error: ' + error.message, 'error');
        } else {
            window.showStatus('batchDetailStatus', `${rows.length} student${rows.length !== 1 ? 's' : ''} added.`, 'success');
            document.getElementById('btnSelectAll').textContent = 'Select all';
            await loadBatchMembers(currentBatchId);
            await loadStudentPicker(currentBatchId);
        }
    });

    document.getElementById('btnDeleteBatch')?.addEventListener('click', async () => {
        if (!confirm('Delete this batch? All student assignments will be removed permanently.')) return;
        const res = await window.api.deleteMany('batches', { id: currentBatchId });
        if (!res.success) {
            window.showStatus('batchDetailStatus', 'Failed to delete: ' + res.error, 'error');
        } else {
            window.loadPage('page-batches', '');
        }
    });
}
