// js/dashboard/students.js
// Entry point for the Students tab.
// Owns: student list, add-student form, view orchestration.
// Delegates: detail view → student-detail.js, CSV import → student-import.js

import { openStudentDetail } from './student-detail.js';
import { initImportSection } from './student-import.js';

let allStudents = [];
let studentBatchMap = {}; // studentId → [batchId, ...]
const user = window.auth.getUser();

const SUPABASE_URL = window.CONFIG?.SUPABASE_URL || 'https://tksruuqtzxflgglnljef.supabase.co';


// ── STUDENTS LIST ─────────────────────────────────────────────────────────────

export async function loadStudents() {
    const tbody = document.getElementById('studentsTableBody');
    const status = document.getElementById('studentsListStatus');
    const btnRefresh = document.getElementById('btnRefreshStudents');

    if (!tbody || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Refreshing...';
    status.style.display = 'none';
    window.tableLoading('studentsTableBody', 5, 'Loading students...');

    const response = await window.api.get('profiles', { role: 'student' }, '*', { order: 'name', ascending: true });

    btnRefresh.disabled = false;
    btnRefresh.textContent = 'Refresh List';

    if (response.success) {
        let students = response.data || [];
        const teacherGrade = window.auth.getUser()?.grade;
        if (teacherGrade && teacherGrade !== 'All Grades') {
            students = students.filter(s => s.grade === teacherGrade);
        }
        allStudents = students;

        // Load batches + memberships in parallel, then populate filter
        const [batchesRes, membershipsRes] = await Promise.all([
            window.api.get('batches', {}, 'id, name'),
            window.api.get('batch_students', {}, 'student_id, batch_id'),
        ]);
        const batches = batchesRes.data || [];
        const memberships = membershipsRes.data || [];
        studentBatchMap = {};
        memberships.forEach(m => {
            if (!studentBatchMap[m.student_id]) studentBatchMap[m.student_id] = [];
            studentBatchMap[m.student_id].push(m.batch_id);
        });
        const batchFilter = document.getElementById('studentBatchFilter');
        if (batchFilter) {
            batchFilter.innerHTML = '<option value="">All Batches</option>' +
                batches.map(b => `<option value="${window.esc(b.id)}">${window.esc(b.name)}</option>`).join('');
        }

        filterStudents();
    } else {
        tbody.innerHTML = '';
        window.showStatus('studentsListStatus', response.error || 'Failed to load students.', 'error');
    }
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    const countEl = document.getElementById('studentsCount');
    if (!tbody) return;

    if (countEl) countEl.textContent = `Showing ${students.length} of ${allStudents.length}`;

    if (students.length === 0) {
        window.tableLoading('studentsTableBody', 5, 'No students match your filters.');
        return;
    }

    tbody.innerHTML = students.map(student => `
        <tr class="data-table__row" data-student-id="${student.id}">
            <td class="data-table__td--main">${window.esc(student.name) || '-'}</td>
            <td class="data-table__td">${window.esc(student.username) || '-'}</td>
            <td class="data-table__td">${window.esc(student.subjects) || '-'}</td>
            <td class="data-table__td" style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <button class="btn btn--primary btn--sm" data-action="detail" data-id="${student.id}">Manage Student</button>
                <button class="btn btn--sm" data-action="send-login" data-id="${student.id}" style="background:var(--color-whatsapp,#25d366);color:#fff;border:none;" ${student.phone ? '' : 'disabled title="No phone number"'}>
                    <i class="ri-whatsapp-line"></i> Send Welcome
                </button>
            </td>
        </tr>
    `).join('');
}

function filterStudents() {
    const searchVal = (document.getElementById('studentSearchInput')?.value || '').toLowerCase();
    const gradeVal = document.getElementById('studentGradeFilter')?.value || '';
    const subjectVal = document.getElementById('studentSubjectFilter')?.value || '';
    const batchVal = document.getElementById('studentBatchFilter')?.value || '';

    let filtered = allStudents;
    if (searchVal) filtered = filtered.filter(s =>
        (s.name || '').toLowerCase().includes(searchVal) ||
        (s.username || '').toLowerCase().includes(searchVal)
    );
    if (gradeVal) filtered = filtered.filter(s => s.grade === gradeVal);
    if (subjectVal) filtered = filtered.filter(s => (s.subjects || '').includes(subjectVal));
    if (batchVal) filtered = filtered.filter(s => (studentBatchMap[s.id] || []).includes(batchVal));

    renderStudentsTable(filtered);
}


// ── DELETE ────────────────────────────────────────────────────────────────────

async function deleteStudent(studentId, onSuccess) {
    const student = allStudents.find(s => s.id === studentId);
    window.showConfirmModal(
        'Delete Student',
        `Are you sure you want to delete <strong>${student?.name || 'this student'}</strong>? This cannot be undone.`,
        async () => {
            try {
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                const res = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/admin-api`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ action: 'delete_student', user_id: studentId })
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Delete failed');
                allStudents = allStudents.filter(s => s.id !== studentId);
                filterStudents();
                if (onSuccess) onSuccess();
            } catch (err) {
                alert('Failed to delete: ' + err.message);
            }
        }
    );
}


// ── DETAIL VIEW TRANSITIONS ───────────────────────────────────────────────────

function hideStudentDetail() {
    document.getElementById('studentDetailContainer').style.display = 'none';
    document.getElementById('studentsListContainer').style.display = 'block';
    const refreshBtn = document.getElementById('btnRefreshStudents');
    if (refreshBtn) refreshBtn.style.display = 'inline-block';

    const pillView = document.getElementById('pillViewStudents');
    const pillAdd = document.getElementById('pillAddStudent');
    const pillImport = document.getElementById('pillImportStudents');
    if (pillView) pillView.classList.add('pill-toggle__btn--active');
    if (pillAdd) pillAdd.classList.remove('pill-toggle__btn--active');
    if (pillImport) pillImport.classList.remove('pill-toggle__btn--active');
}


// ── ADD STUDENT FORM ──────────────────────────────────────────────────────────

async function loadAddStudentComponent() {
    try {
        const response = await fetch('components/modals/add_student');
        if (response.ok) {
            const html = await response.text();
            const container = document.getElementById('addStudentContainer');
            if (container) {
                container.innerHTML = html;
                attachAddStudentListeners();
            }
        }
    } catch (err) {
        console.error('Error loading add student HTML:', err);
    }
}

function generateUsernameFromName(name) {
    const parts = name.trim().toLowerCase().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return parts[0] + '.' + parts[parts.length - 1];
}

function attachAddStudentListeners() {
    const form = document.getElementById('addStudentForm');
    if (!form) return;

    window.populateGradeSelect('studentGrade', false);
    window.lockGradeSelect('studentGrade');

    const nameInput = document.getElementById('studentName');
    const usernameInput = document.getElementById('studentUsername');
    const passwordInput = document.getElementById('studentPassword');

    nameInput?.addEventListener('input', () => {
        const generated = generateUsernameFromName(nameInput.value);
        usernameInput.value = generated;
        passwordInput.value = generated;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const status = document.getElementById('addStudentStatus');
        const btn = document.getElementById('btnAddStudent');
        const btnText = document.getElementById('btnAddStudentText');
        const btnSpinner = document.getElementById('btnAddStudentSpinner');

        const name = document.getElementById('studentName').value.trim();
        const grade = document.getElementById('studentGrade').value;
        const username = document.getElementById('studentUsername').value.trim().toLowerCase();
        const password = document.getElementById('studentPassword').value;
        const phone = document.getElementById('studentPhone').value.trim();
        const email = document.getElementById('studentEmail').value.trim() || null;
        const father_name = document.getElementById('studentFatherName').value.trim() || null;
        const father_phone = document.getElementById('studentFatherPhone').value.trim() || null;
        const mother_name = document.getElementById('studentMotherName').value.trim() || null;
        const mother_phone = document.getElementById('studentMotherPhone').value.trim() || null;

        const subjectCheckboxes = document.querySelectorAll('input[name="studentSubjects"]:checked');
        const subjects = Array.from(subjectCheckboxes).map(cb => cb.value).join(', ');

        if (!name || !grade || !username || !password) {
            status.textContent = 'Please fill in all required fields.';
            status.className = 'status status--error';
            status.style.display = 'block';
            return;
        }

        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-block';
        btn.disabled = true;
        status.style.display = 'none';

        try {
            const { data: sessionData } = await window.supabaseClient.auth.getSession();
            const token = sessionData?.session?.access_token;

            const meta = { name, username, grade, subjects, phone, email, father_name, father_phone, mother_name, mother_phone, role: 'student' };

            const res = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/admin-api`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'apikey': window.CONFIG.SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ action: 'create_student', email: `${username}@msgt.internal`, password, meta }),
            });
            const result = await res.json();
            const error = result.error ? { message: result.error } : null;

            if (error) {
                status.textContent = `Error: ${error.message}`;
                status.className = 'status status--error';
                status.style.display = 'block';
            } else {
                status.innerHTML = `<strong>✓ Student registered!</strong><br>
                    Name: ${window.esc(name)}<br>Username: ${window.esc(username)}<br>Grade: ${window.esc(grade)}<br>
                    The student can now log in.`;
                status.className = 'status status--info';
                status.style.display = 'block';
                window.safeFormReset(form);
                loadStudents();
            }
        } catch (err) {
            status.textContent = `Unexpected error: ${err.message}`;
            status.className = 'status status--error';
            status.style.display = 'block';
        } finally {
            btnText.style.display = 'inline-block';
            btnSpinner.style.display = 'none';
            btn.disabled = false;
        }
    });
}


// ── INIT / REFRESH ────────────────────────────────────────────────────────────

export function init() {
    loadStudents();
    loadAddStudentComponent();

    const btnRefresh = document.getElementById('btnRefreshStudents');
    if (btnRefresh) btnRefresh.addEventListener('click', loadStudents);

    const studentSearchInput = document.getElementById('studentSearchInput');
    const studentGradeFilter = document.getElementById('studentGradeFilter');
    const studentSubjectFilter = document.getElementById('studentSubjectFilter');

    window.populateGradeSelect('studentGradeFilter');

    const studentBatchFilter = document.getElementById('studentBatchFilter');

    if (studentSearchInput) studentSearchInput.addEventListener('input', filterStudents);
    if (studentGradeFilter) studentGradeFilter.addEventListener('change', filterStudents);
    if (studentSubjectFilter) studentSubjectFilter.addEventListener('change', filterStudents);
    if (studentBatchFilter) studentBatchFilter.addEventListener('change', filterStudents);

    const teacherGrade = window.auth.getUser()?.grade;
    if (teacherGrade && teacherGrade !== 'All Grades' && studentGradeFilter) {
        studentGradeFilter.style.display = 'none';
    }

    const pillView = document.getElementById('pillViewStudents');
    const pillAdd = document.getElementById('pillAddStudent');
    const pillImport = document.getElementById('pillImportStudents');
    const listContainer = document.getElementById('studentsListContainer');
    const addContainer = document.getElementById('addStudentContainer');
    const importContainer = document.getElementById('importStudentsContainer');
    const studentDetailCtr = document.getElementById('studentDetailContainer');

    function switchStudentsView(active) {
        [pillView, pillAdd, pillImport].forEach(p => p?.classList.remove('pill-toggle__btn--active'));
        [listContainer, addContainer, importContainer, studentDetailCtr].forEach(c => { if (c) c.style.display = 'none'; });
        active.pill?.classList.add('pill-toggle__btn--active');
        if (active.container) active.container.style.display = 'block';
        if (btnRefresh) btnRefresh.style.display = active.showRefresh ? 'inline-block' : 'none';
    }

    pillView?.addEventListener('click', () => switchStudentsView({ pill: pillView, container: listContainer, showRefresh: true }));
    pillAdd?.addEventListener('click', () => switchStudentsView({ pill: pillAdd, container: addContainer, showRefresh: false }));
    pillImport?.addEventListener('click', () => switchStudentsView({ pill: pillImport, container: importContainer, showRefresh: false }));

    // Table row delegation — opens detail view
    const tbody = document.getElementById('studentsTableBody');
    if (tbody) {
        tbody.addEventListener('click', async (e) => {
            const detailBtn = e.target.closest('[data-action="detail"]');
            if (detailBtn) {
                const student = allStudents.find(s => s.id === detailBtn.dataset.id);
                if (student) {
                    openStudentDetail(student, {
                        onBack:        hideStudentDetail,
                        onDelete:      (id) => deleteStudent(id, hideStudentDetail),
                        onNotesUpdate: (id, notes) => {
                            const cached = allStudents.find(s => s.id === id);
                            if (cached) cached.teacher_notes = notes;
                        },
                        onPhoneUpdate: (id, field, val) => {
                            const cached = allStudents.find(s => s.id === id);
                            if (cached) cached[field] = val;
                        },
                    });
                }
                return;
            }

            const loginBtn = e.target.closest('[data-action="send-login"]');
            if (loginBtn) {
                const student = allStudents.find(s => s.id === loginBtn.dataset.id);
                if (!student) return;

                loginBtn.disabled = true;
                loginBtn.textContent = 'Sending...';

                try {
                    const recipients = window.whatsapp.resolveRecipients(student, 'student');
                    if (recipients.length === 0) {
                        alert('No phone number on record for this student.');
                        return;
                    }
                    // Password is always set to username by default (CSV import + manual add)
                    const result = await window.whatsapp.send({
                        type: 'login',
                        recipients,
                        payload: {
                            student_name: student.name,
                            username: student.username || '',
                            password: student.username || '',
                        },
                        sentBy: window.auth.getUser()?.id,
                    });
                    alert(`Sent: ${result.sent}, Failed: ${result.failed}`);
                } catch (err) {
                    alert('Failed to send: ' + err.message);
                } finally {
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = '<i class="ri-whatsapp-line"></i> Send Welcome';
                }
            }
        });
    }

    // Keep window.deleteStudent for any legacy onclick attributes in HTML
    window.deleteStudent = (id) => deleteStudent(id);

    // Delegate to import sub-module
    initImportSection(() => allStudents, () => loadStudents());
}

export function refresh() {
    loadStudents();
}
