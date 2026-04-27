const user = window.auth.getUser();
let currentBatchId = null;
let currentBatchGrade = null;
let currentBatchSubject = null;

async function loadBatches() {
    const tbody = document.getElementById('batchesTableBody');
    const status = document.getElementById('batchesListStatus');
    const btnRefresh = document.getElementById('btnRefreshBatches');

    if (!tbody || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Refreshing...';
    window.tableLoading('batchesTableBody', 6, 'Loading batches...');

    const batchRes = await window.api.get('batches', {}, '*, classes(type, day_of_week, class_date, start_time)');

    btnRefresh.disabled = false;
    btnRefresh.textContent = 'Refresh List';

    if (batchRes.success) {
        if (batchRes.data && batchRes.data.length > 0) {
            const countRes = await window.api.get('batch_students', {}, 'batch_id');
            const counts = {};
            if (countRes.success && countRes.data) {
                countRes.data.forEach(bs => {
                    counts[bs.batch_id] = (counts[bs.batch_id] || 0) + 1;
                });
            }

            tbody.innerHTML = [...batchRes.data].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(batch => {
                let scheduleStr = 'No schedule';
                if (batch.classes && batch.classes.length > 0) {
                    const regularClasses = batch.classes.filter(c => c.type === 'regular');
                    if (regularClasses.length > 0) {
                        const schedParts = regularClasses.map(c => {
                            const timeFormat = window.formatTime(c.start_time);
                            return `${window.DAYS[c.day_of_week]} ${timeFormat}`;
                        });
                        scheduleStr = [...new Set(schedParts)].join(', ');
                    }
                }

                return `
                <tr class="data-table__row">
                    <td class="data-table__td--main">${window.esc(batch.name) || '-'}</td>
                    <td class="data-table__td">${batch.subject || '-'}</td>
                    <td class="data-table__td">${batch.grade || '-'}</td>
                    <td class="data-table__td"><div class="text-truncate" style="max-width:200px;" title="${scheduleStr}">${scheduleStr}</div></td>
                    <td class="data-table__td"><span class="badge">${counts[batch.id] || 0}</span></td>
                    <td class="data-table__td">
                        <button class="btn btn--primary btn--sm" data-action="manage" data-id="${batch.id}" data-name="${window.esc(batch.name) || ''}">Manage</button>
                    </td>
                </tr>
                `;
            }).join('');
        } else {
            window.tableLoading('batchesTableBody', 6, 'No batches created yet.');
        }
    } else {
        document.getElementById('batchesTableBody').innerHTML = '';
        window.showStatus('batchesListStatus', batchRes.error || 'Failed to load batches.', 'error');
    }
}

async function loadBatchComponent() {
    await window.loadComponent('modals/add_batch.html', 'addBatchContainer', attachBatchFormListeners);
}

function attachBatchFormListeners() {
    const form = document.getElementById('batchForm');
    if (!form) return;
    window.populateGradeSelect('batchGrade', false);
    window.lockGradeSelect('batchGrade');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnCreateBatch');
        const btnText = document.getElementById('btnCreateBatchText');
        const btnSpinner = document.getElementById('btnCreateBatchSpinner');
        const status = document.getElementById('batchFormStatus');

        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-block';
        btn.disabled = true;
        status.style.display = 'none';

        const subjectCheckboxes = document.querySelectorAll('input[name="batchSubjects"]:checked');
        const subjects = Array.from(subjectCheckboxes).map(cb => cb.value).join(', ');

        const response = await window.api.post('batches', {
            name: document.getElementById('batchName').value.trim(),
            subject: subjects,
            grade: document.getElementById('batchGrade').value,
            created_by: user.id
        });

        btnText.style.display = 'inline-block';
        btnSpinner.style.display = 'none';
        btn.disabled = false;

        if (response.success) {
            window.showStatus('batchFormStatus', 'Batch created successfully!', 'success');
            window.safeFormReset(form);
            loadBatches();
        } else {
            window.showStatus('batchFormStatus', response.error || 'Failed to create batch.', 'error');
        }
    });
}

window.openBatchDetail = async function (batchId, batchName) {
    currentBatchId = batchId;

    const batchesListContainer = document.getElementById('batchesListContainer');
    const addBatchContainer = document.getElementById('addBatchContainer');
    const batchDetailContainer = document.getElementById('batchDetailContainer');
    const btnRefreshBatches = document.getElementById('btnRefreshBatches');
    const pillViewBatches = document.getElementById('pillViewBatches');
    const pillAddBatch = document.getElementById('pillAddBatch');

    batchesListContainer.style.display = 'none';
    addBatchContainer.style.display = 'none';
    if (btnRefreshBatches) btnRefreshBatches.style.display = 'none';
    batchDetailContainer.style.display = 'block';

    if (pillViewBatches) pillViewBatches.classList.add('pill-toggle__btn--active');
    if (pillAddBatch) pillAddBatch.classList.remove('pill-toggle__btn--active');

    document.getElementById('batchDetailName').textContent = batchName;

    const batchRes = await window.api.get('batches', { id: batchId }, '*, classes(type, day_of_week, class_date, start_time)');
    if (batchRes.success && batchRes.data && batchRes.data.length > 0) {
        const b = batchRes.data[0];
        currentBatchGrade = b.grade || null;
        currentBatchSubject = b.subject || null;

        let scheduleStr = '';
        if (b.classes && b.classes.length > 0) {
            const regularClasses = b.classes.filter(c => c.type === 'regular');
            if (regularClasses.length > 0) {
                const schedParts = regularClasses.map(c => {
                    const timeFormat = window.formatTime(c.start_time);
                    return `${window.DAYS[c.day_of_week]} ${timeFormat}`;
                });
                scheduleStr = [...new Set(schedParts)].join(', ');
            }
        }

        document.getElementById('batchDetailMeta').textContent =
            `${b.grade || ''} • ${b.subject || ''} • ${scheduleStr}`;
    }

    await loadBatchMembers(batchId);
    await loadStudentPicker(batchId);
};

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
                    </tr>
                `;
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

        listEl.addEventListener('change', () => {
            const checked = listEl.querySelectorAll('input:checked').length;
            document.getElementById('selectedCount').textContent = `${checked} selected`;
        });
    } else {
        listEl.innerHTML = '<p class="loading-text">Failed to load students.</p>';
    }
}

window.removeStudentFromBatch = async function (batchStudentId) {
    if (!confirm('Remove this student from the batch?')) return;
    const { error } = await window.api.deleteMany('batch_students', { id: batchStudentId });
    if (error) {
        alert('Failed to remove: ' + error);
    } else {
        await loadBatchMembers(currentBatchId);
        await loadStudentPicker(currentBatchId);
    }
};

export function init() {
    loadBatches();
    loadBatchComponent();

    const tbody = document.getElementById('batchesTableBody');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action="manage"]');
            if (btn) {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                openBatchDetail(id, name);
            }
        });
    }

    const membersTbody = document.getElementById('batchMembersTable');
    if (membersTbody) {
        membersTbody.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action="remove-student"]');
            if (btn) {
                const id = btn.getAttribute('data-id');
                removeStudentFromBatch(id);
            }
        });
    }

    const btnRefresh = document.getElementById('btnRefreshBatches');
    if (btnRefresh) btnRefresh.addEventListener('click', loadBatches);

    const pillView = document.getElementById('pillViewBatches');
    const pillAdd = document.getElementById('pillAddBatch');
    const listContainer = document.getElementById('batchesListContainer');
    const addContainer = document.getElementById('addBatchContainer');
    const detailContainer = document.getElementById('batchDetailContainer');

    if (pillView && pillAdd) {
        pillView.addEventListener('click', () => {
            pillView.classList.add('pill-toggle__btn--active');
            pillAdd.classList.remove('pill-toggle__btn--active');
            if (listContainer) listContainer.style.display = 'block';
            if (addContainer) addContainer.style.display = 'none';
            if (detailContainer) detailContainer.style.display = 'none';
            if (btnRefresh) btnRefresh.style.display = 'inline-block';
        });

        pillAdd.addEventListener('click', () => {
            pillAdd.classList.add('pill-toggle__btn--active');
            pillView.classList.remove('pill-toggle__btn--active');
            if (addContainer) addContainer.style.display = 'block';
            if (listContainer) listContainer.style.display = 'none';
            if (detailContainer) detailContainer.style.display = 'none';
            if (btnRefresh) btnRefresh.style.display = 'none';
        });
    }

    const btnBack = document.getElementById('btnBackToBatches');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            if (detailContainer) detailContainer.style.display = 'none';
            if (listContainer) listContainer.style.display = 'block';
            if (btnRefresh) btnRefresh.style.display = 'inline-block';
            if (pillView) pillView.classList.add('pill-toggle__btn--active');
            currentBatchId = null;
            currentBatchGrade = null;
            currentBatchSubject = null;
            loadBatches();
        });
    }

    const btnAddSelected = document.getElementById('btnAddSelectedStudents');
    if (btnAddSelected) {
        btnAddSelected.addEventListener('click', async () => {
            const listEl = document.getElementById('studentPickerList');
            const checked = listEl.querySelectorAll('input:checked');
            const statusEl = document.getElementById('batchDetailStatus');

            if (checked.length === 0) {
                statusEl.textContent = 'Please select at least one student.';
                statusEl.className = 'status status--error';
                statusEl.style.display = 'block';
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
                statusEl.textContent = 'Error: ' + error.message;
                statusEl.className = 'status status--error';
                statusEl.style.display = 'block';
            } else {
                statusEl.textContent = `${rows.length} student(s) added!`;
                statusEl.className = 'status status--success';
                statusEl.style.display = 'block';
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
                if (detailContainer) detailContainer.style.display = 'none';
                if (listContainer) listContainer.style.display = 'block';
                if (btnRefresh) btnRefresh.style.display = 'inline-block';
                if (pillView) pillView.classList.add('pill-toggle__btn--active');
                currentBatchId = null;
                currentBatchGrade = null;
                currentBatchSubject = null;
                loadBatches();
            }
        });
    }
}

export function refresh() {
    const listContainer = document.getElementById('batchesListContainer');
    const addContainer = document.getElementById('addBatchContainer');
    const detailContainer = document.getElementById('batchDetailContainer');
    const pillView = document.getElementById('pillViewBatches');
    const pillAdd = document.getElementById('pillAddBatch');
    const btnRefresh = document.getElementById('btnRefreshBatches');

    if (listContainer) listContainer.style.display = 'block';
    if (addContainer) addContainer.style.display = 'none';
    if (detailContainer) detailContainer.style.display = 'none';
    if (pillView) pillView.classList.add('pill-toggle__btn--active');
    if (pillAdd) pillAdd.classList.remove('pill-toggle__btn--active');
    if (btnRefresh) btnRefresh.style.display = 'inline-block';

    currentBatchId = null;
    currentBatchGrade = null;
    currentBatchSubject = null;
    loadBatches();
}
