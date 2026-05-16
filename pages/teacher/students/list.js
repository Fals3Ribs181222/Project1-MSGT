let allStudents = [];
const user = window.auth.getUser();

async function loadStudents() {
    const tbody = document.getElementById('studentsTableBody');
    const status = document.getElementById('studentsListStatus');
    const btnRefresh = document.getElementById('btnRefreshStudents');
    if (!tbody || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.innerHTML = '<i class="ri-refresh-line"></i> Refreshing...';
    status.style.display = 'none';
    window.tableLoading('studentsTableBody', 4, 'Loading students...');

    const response = await window.api.get('profiles', { role: 'student' }, '*', { order: 'name', ascending: true });

    btnRefresh.disabled = false;
    btnRefresh.innerHTML = '<i class="ri-refresh-line"></i> Refresh';

    if (response.success) {
        let students = response.data || [];
        const activeGrade = window.getActiveGrade();
        if (activeGrade) students = students.filter(s => s.grade === activeGrade);
        allStudents = students;
        renderStudentsTable(allStudents);
    } else {
        tbody.innerHTML = '';
        window.showStatus('studentsListStatus', response.error || 'Failed to load students.', 'error');
    }
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    if (students.length === 0) {
        window.tableLoading('studentsTableBody', 4, 'No students found.');
        return;
    }

    const countEl = document.getElementById('studentsCount');
    if (countEl) countEl.textContent = `${students.length} student${students.length !== 1 ? 's' : ''}`;

    tbody.innerHTML = students.map(student => `
        <tr class="data-table__row" data-student-id="${student.id}">
            <td class="data-table__td--main">${window.esc(student.name) || '-'}</td>
            <td class="data-table__td">${window.esc(student.username) || '-'}</td>
            <td class="data-table__td">${window.esc(student.subjects) || '-'}</td>
            <td class="data-table__td">
                <button class="btn btn--outline btn--sm" data-action="detail" data-id="${student.id}">Details</button>
            </td>
        </tr>
    `).join('');
}

async function deleteStudent(studentId) {
    const student = allStudents.find(s => s.id === studentId);
    window.showConfirmModal(
        'Delete Student',
        `Are you sure you want to delete <strong>${student?.name || 'this student'}</strong>? This cannot be undone.`,
        async () => {
            try {
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                const res = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/admin-api`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                    body: JSON.stringify({ action: 'delete_student', user_id: studentId })
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Delete failed');
                allStudents = allStudents.filter(s => s.id !== studentId);
                renderStudentsTable(allStudents);
            } catch (err) {
                alert('Failed to delete: ' + err.message);
            }
        }
    );
}

export function init() {
    loadStudents();

    const btnRefresh = document.getElementById('btnRefreshStudents');
    if (btnRefresh) btnRefresh.addEventListener('click', loadStudents);

    const searchInput = document.getElementById('studentsSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase();
            const filtered = q
                ? allStudents.filter(s =>
                    (s.name || '').toLowerCase().includes(q) ||
                    (s.username || '').toLowerCase().includes(q))
                : allStudents;
            renderStudentsTable(filtered);
        });
    }

    const tbody = document.getElementById('studentsTableBody');
    if (tbody) {
        tbody.addEventListener('click', async (e) => {
            const detailBtn = e.target.closest('[data-action="detail"]');
            if (detailBtn) {
                const student = allStudents.find(s => s.id === detailBtn.dataset.id);
                if (student) {
                    window._pendingStudent = student;
                    window.loadPage('page-students', 'profile');
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
                        window.showStatus('studentsListStatus', 'No phone number on record for this student.', 'error');
                        return;
                    }
                    const result = await window.whatsapp.send({
                        type: 'login', recipients,
                        payload: { student_name: student.name, username: student.username || '', password: student.username || '' },
                        sentBy: window.auth.getUser()?.id,
                    });
                    const msg = result.failed > 0
                        ? `Sent to ${result.sent}, failed: ${result.failed}.`
                        : `Welcome message sent to ${result.sent} recipient${result.sent !== 1 ? 's' : ''}.`;
                    window.showStatus('studentsListStatus', msg, result.failed > 0 ? 'error' : 'success');
                } catch (err) {
                    window.showStatus('studentsListStatus', 'Failed to send: ' + err.message, 'error');
                } finally {
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = '<i class="ri-whatsapp-line"></i> Send Welcome';
                }
            }
        });
    }

    window.deleteStudent = deleteStudent;
}

export function refresh() {
    loadStudents();
}
