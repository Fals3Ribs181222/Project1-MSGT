// js/dashboard/teachers.js

let allTeachers = [];
let editingTeacherId = null;

async function loadTeachers() {
    const tbody = document.getElementById('teachersTableBody');
    const status = document.getElementById('teachersListStatus');
    const btnRefresh = document.getElementById('btnRefreshTeachers');

    if (!tbody) return;

    if (btnRefresh) { btnRefresh.disabled = true; btnRefresh.textContent = 'Refreshing...'; }
    if (status) status.style.display = 'none';
    window.tableLoading('teachersTableBody', 5, 'Loading teachers...');

    const response = await window.api.get('profiles', { role: 'teacher' });

    if (btnRefresh) { btnRefresh.disabled = false; btnRefresh.textContent = 'Refresh List'; }

    if (response.success) {
        allTeachers = (response.data || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        renderTeachersTable();
    } else {
        window.showStatus('teachersListStatus', response.error || 'Failed to load teachers.', 'error');
    }
}

function renderTeachersTable() {
    const tbody = document.getElementById('teachersTableBody');
    if (!tbody) return;

    if (allTeachers.length === 0) {
        window.tableLoading('teachersTableBody', 5, 'No teachers found.');
        return;
    }

    tbody.innerHTML = allTeachers.map(t => {
        const gradeLabel = t.grade && t.grade !== '' ? t.grade : 'All Grades';
        return `
        <tr class="data-table__row">
            <td class="data-table__td--main">${window.esc(t.name) || '-'}</td>
            <td class="data-table__td">${window.esc(t.username) || '-'}</td>
            <td class="data-table__td">
                <span style="font-weight:600; color:${gradeLabel === 'All Grades' ? 'var(--text-muted)' : 'var(--primary)'};">
                    ${window.esc(gradeLabel)}
                </span>
            </td>
            <td class="data-table__td">${window.esc(t.subjects) || '-'}</td>
            <td class="data-table__td">
                <button class="btn btn--outline btn--sm" data-action="edit-grade" data-id="${t.id}" data-name="${window.esc(t.name) || ''}" data-grade="${window.esc(t.grade) || ''}">
                    Assign Grade
                </button>
            </td>
        </tr>`;
    }).join('');
}

function openGradeModal(teacherId, teacherName, currentGrade) {
    editingTeacherId = teacherId;

    const modal = document.getElementById('teacherGradeModal');
    const nameEl = document.getElementById('teacherGradeModalName');
    const gradeSelect = document.getElementById('teacherGradeSelect');
    const modalStatus = document.getElementById('teacherGradeModalStatus');

    if (!modal || !gradeSelect) return;

    nameEl.textContent = teacherName;
    gradeSelect.value = currentGrade || '';
    if (modalStatus) { modalStatus.style.display = 'none'; }

    modal.style.display = 'flex';
}

function closeGradeModal() {
    const modal = document.getElementById('teacherGradeModal');
    if (modal) modal.style.display = 'none';
    editingTeacherId = null;
}

async function saveTeacherGrade() {
    if (!editingTeacherId) return;

    const gradeSelect = document.getElementById('teacherGradeSelect');
    const btnSave = document.getElementById('btnSaveTeacherGrade');
    const newGrade = gradeSelect?.value || '';

    if (btnSave) { btnSave.disabled = true; btnSave.textContent = 'Saving...'; }

    const response = await window.api.patch('profiles', editingTeacherId, { grade: newGrade || null });

    if (btnSave) { btnSave.disabled = false; btnSave.textContent = 'Save'; }

    if (response.success) {
        // Update local cache
        const teacher = allTeachers.find(t => t.id === editingTeacherId);
        if (teacher) teacher.grade = newGrade || null;
        renderTeachersTable();
        closeGradeModal();
    } else {
        window.showStatus('teacherGradeModalStatus', response.error || 'Failed to save.', 'error');
    }
}

export function init() {
    loadTeachers();

    document.getElementById('btnRefreshTeachers')?.addEventListener('click', loadTeachers);

    // Table row actions (delegated)
    document.getElementById('teachersTable')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-action="edit-grade"]');
        if (btn) openGradeModal(btn.dataset.id, btn.dataset.name, btn.dataset.grade);
    });

    // Modal actions
    document.getElementById('btnSaveTeacherGrade')?.addEventListener('click', saveTeacherGrade);
    document.getElementById('btnCancelTeacherGrade')?.addEventListener('click', closeGradeModal);

    // Close modal on backdrop click
    document.getElementById('teacherGradeModal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('teacherGradeModal')) closeGradeModal();
    });
}

export function refresh() {
    loadTeachers();
}
