const user = window.auth.getUser();
let currentBatchId = null;

async function loadBatches() {
    const tbody = document.getElementById('batchesTableBody');
    const status = document.getElementById('batchesListStatus');
    const btnRefresh = document.getElementById('btnRefreshBatches');

    if (!tbody || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Refreshing...';
    status.style.display = 'none';
    tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Loading batches...</td></tr>';

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

            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            tbody.innerHTML = batchRes.data.reverse().map(batch => {
                let scheduleStr = 'No schedule';
                if (batch.classes && batch.classes.length > 0) {
                    const regularClasses = batch.classes.filter(c => c.type === 'regular');
                    if (regularClasses.length > 0) {
                        const schedParts = regularClasses.map(c => {
                            const timeFormat = formatTime(c.start_time);
                            return `${days[c.day_of_week]} ${timeFormat}`;
                        });
                        scheduleStr = [...new Set(schedParts)].join(', ');
                    }
                }

                return `
                <tr class="data-table__row">
                    <td class="data-table__td--main">${batch.name || '-'}</td>
                    <td class="data-table__td">${batch.subject || '-'}</td>
                    <td class="data-table__td">${batch.grade || '-'}</td>
                    <td class="data-table__td"><div class="text-truncate" style="max-width:200px;" title="${scheduleStr}">${scheduleStr}</div></td>
                    <td class="data-table__td"><span class="badge">${counts[batch.id] || 0}</span></td>
                    <td class="data-table__td">
                        <button class="btn btn--primary btn--sm" onclick="openBatchDetail('${batch.id}', '${(batch.name || '').replace(/'/g, "\\'")}')">Manage</button>
                    </td>
                </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="loading-text">No batches created yet.</td></tr>';
        }
    } else {
        tbody.innerHTML = '';
        status.textContent = batchRes.error || 'Failed to load batches.';
        status.className = 'status status--error';
        status.style.display = 'block';
    }
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    let hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
}

async function loadBatchComponent() {
    try {
        const response = await fetch('components/add_batch.html');
        if (response.ok) {
            const html = await response.text();
            const container = document.getElementById('addBatchContainer');
            if (container) {
                container.innerHTML = html;
                attachBatchFormListeners();
            }
        }
    } catch (err) {
        console.error('Error loading batch component:', err);
    }
}

function attachBatchFormListeners() {
    const form = document.getElementById('batchForm');
    if (!form) return;

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
            status.textContent = 'Batch created successfully!';
            status.className = 'status status--success';
            status.style.display = 'block';
            form.reset();
            loadBatches();
        } else {
            status.textContent = response.error || 'Failed to create batch.';
            status.className = 'status status--error';
            status.style.display = 'block';
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

    const batchRes = await window.api.get('batches', { id: batchId });
    if (batchRes.success && batchRes.data && batchRes.data.length > 0) {
        const b = batchRes.data[0];
        document.getElementById('batchDetailMeta').textContent =
            `${b.grade || ''} • ${b.subject || ''} • ${b.schedule || ''}`;
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
        const members = res.data || [];
        countBadge.textContent = members.length;

        if (members.length > 0) {
            tbody.innerHTML = members.map(m => {
                const p = m.profiles || {};
                return `
                    <tr class="data-table__row">
                        <td class="data-table__td--main">${p.name || '-'}</td>
                        <td class="data-table__td">${p.username || '-'}</td>
                        <td class="data-table__td">${p.grade || '-'}</td>
                        <td class="data-table__td">
                            <button class="btn btn--danger btn--sm" onclick="removeStudentFromBatch('${m.id}')">Remove</button>
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
        const available = studentsRes.data.filter(s => !memberIds.has(s.id));

        if (available.length > 0) {
            listEl.innerHTML = available.map(s => `
                <label class="student-picker__item" data-name="${(s.name || '').toLowerCase()}">
                    <input type="checkbox" class="form__checkbox" value="${s.id}">
                    <span class="student-picker__name">${s.name || 'Unnamed'}</span>
                    <span class="student-picker__info">${s.grade || ''} • ${s.username || ''}</span>
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
    const { error } = await window.supabaseClient.from('batch_students').delete().eq('id', batchStudentId);
    if (error) {
        alert('Failed to remove: ' + error.message);
    } else {
        await loadBatchMembers(currentBatchId);
        await loadStudentPicker(currentBatchId);
    }
};

export function init() {
    loadBatches();
    loadBatchComponent();

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
            const { error } = await window.supabaseClient.from('batches').delete().eq('id', currentBatchId);
            if (error) {
                alert('Failed to delete batch: ' + error.message);
            } else {
                if (detailContainer) detailContainer.style.display = 'none';
                if (listContainer) listContainer.style.display = 'block';
                if (btnRefresh) btnRefresh.style.display = 'inline-block';
                if (pillView) pillView.classList.add('pill-toggle__btn--active');
                currentBatchId = null;
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
    loadBatches();
}
