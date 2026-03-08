let allStudents = [];
const user = window.auth.getUser();

// Load Students List handler
export async function loadStudents() {
    const tbody = document.getElementById('studentsTableBody');
    const status = document.getElementById('studentsListStatus');
    const btnRefresh = document.getElementById('btnRefreshStudents');

    if (!tbody || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Refreshing...';
    status.style.display = 'none';
    tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Loading students...</td></tr>';

    const response = await window.api.get('profiles', { role: 'student' });

    btnRefresh.disabled = false;
    btnRefresh.textContent = 'Refresh List';

    if (response.success) {
        allStudents = response.data || [];
        filterStudents();
    } else {
        tbody.innerHTML = '';
        status.textContent = response.error || 'Failed to load students.';
        status.className = 'status status--error';
        status.style.display = 'block';
    }
}

// Render the students table from a filtered array
function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    const countEl = document.getElementById('studentsCount');
    if (!tbody) return;

    // Update count
    if (countEl) {
        countEl.textContent = `Showing ${students.length} of ${allStudents.length}`;
    }

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-text">No students match your filters.</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(student => `
        <tr class="data-table__row" data-student-id="${student.id}">
            <td class="data-table__td--main">${student.name || '-'}</td>
            <td class="data-table__td">${student.username || '-'}</td>
            <td class="data-table__td">${student.grade || '-'}</td>
            <td class="data-table__td">${student.subjects || '-'}</td>
            <td class="data-table__td">
                <button class="btn btn--primary btn--sm" data-action="detail" data-id="${student.id}">Manage Student</button>
            </td>
        </tr>
    `).join('');
}

// Filter students based on search, grade, and subject
function filterStudents() {
    const searchVal = (document.getElementById('studentSearchInput')?.value || '').toLowerCase();
    const gradeVal = document.getElementById('studentGradeFilter')?.value || '';
    const subjectVal = document.getElementById('studentSubjectFilter')?.value || '';

    let filtered = allStudents;

    if (searchVal) {
        filtered = filtered.filter(s =>
            (s.name || '').toLowerCase().includes(searchVal) ||
            (s.username || '').toLowerCase().includes(searchVal)
        );
    }

    if (gradeVal) {
        filtered = filtered.filter(s => s.grade === gradeVal);
    }

    if (subjectVal) {
        filtered = filtered.filter(s =>
            (s.subjects || '').includes(subjectVal)
        );
    }

    renderStudentsTable(filtered);
}

// ====== DELETE ======
function showConfirmModal(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-modal">
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="confirm-modal__actions">
                <button class="btn btn--outline btn--sm" id="confirmCancel">Cancel</button>
                <button class="btn btn--danger btn--sm" id="confirmOk">Delete</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#confirmCancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#confirmOk').addEventListener('click', async () => {
        overlay.querySelector('#confirmOk').disabled = true;
        overlay.querySelector('#confirmOk').textContent = 'Deleting...';
        await onConfirm();
        overlay.remove();
    });
}

export async function deleteStudent(studentId) {
    const student = allStudents.find(s => s.id === studentId);
    showConfirmModal(
        'Delete Student',
        `Are you sure you want to delete <strong>${student?.name || 'this student'}</strong>? This cannot be undone.`,
        async () => {
            const resp = await window.api.delete('profiles', studentId);
            if (resp.success) {
                allStudents = allStudents.filter(s => s.id !== studentId);
                filterStudents();
            } else {
                alert('Failed to delete: ' + (resp.error || 'Unknown error'));
            }
        }
    );
}

// ====== STUDENT DETAIL VIEW ======
async function showStudentDetail(studentId) {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    // Hide list and add containers, show detail
    document.getElementById('studentsListContainer').style.display = 'none';
    document.getElementById('addStudentContainer').style.display = 'none';
    document.getElementById('studentDetailContainer').style.display = 'block';
    const refreshBtn = document.getElementById('btnRefreshStudents');
    if (refreshBtn) refreshBtn.style.display = 'none';

    // Set header info
    document.getElementById('studentDetailName').textContent = student.name || 'Unknown';
    document.getElementById('studentDetailUsername').textContent = student.username || '-';
    document.getElementById('studentDetailGrade').textContent = student.grade || '-';
    document.getElementById('studentDetailSubjects').textContent = student.subjects || '-';

    // Reset loading states
    document.getElementById('studentBatchesBody').innerHTML = '<tr><td colspan="4" class="loading-text">Loading batches...</td></tr>';
    document.getElementById('studentMarksBody').innerHTML = '<tr><td colspan="5" class="loading-text">Loading marks...</td></tr>';
    ['sdTotalClasses', 'sdPresent', 'sdAbsent', 'sdLate', 'sdAttendanceRate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '...';
    });

    // We defer to window.supabaseClient for these direct calls
    if (!window.supabaseClient) {
        console.warn("window.supabaseClient is not defined!");
        return;
    }

    // Fetch batch memberships
    try {
        const { data: batchLinks } = await window.supabaseClient
            .from('batch_students')
            .select('batch_id')
            .eq('student_id', studentId);

        const batchBody = document.getElementById('studentBatchesBody');
        if (batchLinks && batchLinks.length > 0) {
            const batchIds = batchLinks.map(bl => bl.batch_id);
            const { data: batches } = await window.supabaseClient
                .from('batches')
                .select('*')
                .in('id', batchIds);

            if (batches && batches.length > 0) {
                batchBody.innerHTML = batches.map(b => `
                    <tr class="data-table__row">
                        <td class="data-table__td--main">${b.name || '-'}</td>
                        <td class="data-table__td">${b.subject || '-'}</td>
                        <td class="data-table__td">${b.grade || '-'}</td>
                        <td class="data-table__td">${b.schedule || '-'}</td>
                    </tr>
                `).join('');
            } else {
                batchBody.innerHTML = '<tr><td colspan="4" class="student-detail__empty">No batches found.</td></tr>';
            }
        } else {
            batchBody.innerHTML = '<tr><td colspan="4" class="student-detail__empty">Not assigned to any batches.</td></tr>';
        }
    } catch (err) {
        console.error('Batch fetch error:', err);
    }

    // Fetch attendance records
    try {
        const { data: attendanceData } = await window.supabaseClient
            .from('attendance')
            .select('status')
            .eq('student_id', studentId);

        const total = attendanceData?.length || 0;
        const present = attendanceData?.filter(a => a.status === 'present').length || 0;
        const absent = attendanceData?.filter(a => a.status === 'absent').length || 0;
        const late = attendanceData?.filter(a => a.status === 'late').length || 0;
        const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

        document.getElementById('sdTotalClasses').textContent = total;
        document.getElementById('sdPresent').textContent = present;
        document.getElementById('sdAbsent').textContent = absent;
        document.getElementById('sdLate').textContent = late;
        document.getElementById('sdAttendanceRate').textContent = total > 0 ? rate + '%' : 'N/A';
    } catch (err) {
        console.error('Attendance fetch error:', err);
    }

    // Fetch marks + tests
    try {
        const { data: marksData } = await window.supabaseClient
            .from('marks')
            .select('marks_obtained, test_id')
            .eq('student_id', studentId);

        const marksBody = document.getElementById('studentMarksBody');

        if (marksData && marksData.length > 0) {
            const testIds = [...new Set(marksData.map(m => m.test_id))];
            const { data: testsData } = await window.supabaseClient
                .from('tests')
                .select('*')
                .in('id', testIds);

            const testMap = {};
            (testsData || []).forEach(t => testMap[t.id] = t);

            marksBody.innerHTML = marksData.map(m => {
                const test = testMap[m.test_id] || {};
                return `
                    <tr class="data-table__row">
                        <td class="data-table__td--main">${test.title || '-'}</td>
                        <td class="data-table__td">${test.subject || '-'}</td>
                        <td class="data-table__td"><strong>${m.marks_obtained || '-'}</strong></td>
                        <td class="data-table__td">${test.max_marks || '-'}</td>
                        <td class="data-table__td">${test.date ? new Date(test.date).toLocaleDateString() : '-'}</td>
                    </tr>
                `;
            }).join('');
        } else {
            marksBody.innerHTML = '<tr><td colspan="5" class="student-detail__empty">No test scores recorded.</td></tr>';
        }
    } catch (err) {
        console.error('Marks fetch error:', err);
    }
}

function hideStudentDetail() {
    document.getElementById('studentDetailContainer').style.display = 'none';
    document.getElementById('studentsListContainer').style.display = 'block';
    const refreshBtn = document.getElementById('btnRefreshStudents');
    if (refreshBtn) refreshBtn.style.display = 'inline-block';

    // Reset pill toggle
    const pillView = document.getElementById('pillViewStudents');
    const pillAdd = document.getElementById('pillAddStudent');
    if (pillView) pillView.classList.add('pill-toggle__btn--active');
    if (pillAdd) pillAdd.classList.remove('pill-toggle__btn--active');
}

// Load Add Student Component HTML
async function loadAddStudentComponent() {
    try {
        const response = await fetch('components/add_student');
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

function attachAddStudentListeners() {
    const form = document.getElementById('addStudentForm');
    if (!form) return;

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

        const subjectCheckboxes = document.querySelectorAll('input[name="studentSubjects"]:checked');
        const subjects = Array.from(subjectCheckboxes).map(cb => cb.value).join(', ');

        if (!name || !grade || !username || !password) {
            status.textContent = 'Please fill in all required fields.';
            status.className = 'status status--error';
            status.style.display = 'block';
            return;
        }

        // Show loading state
        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-block';
        btn.disabled = true;
        status.style.display = 'none';

        try {
            // Save teacher's current session before creating the student
            const { data: sessionData } = await window.supabaseClient.auth.getSession();
            const teacherSession = sessionData?.session;

            const email = `${username}@msgt.internal`;
            const metadata = {
                name: name,
                username: username,
                grade: grade,
                subjects: subjects,
                phone: phone,
                role: 'student'
            };

            // Create the student account
            const { data, error } = await window.supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: { data: metadata }
            });

            // Restore teacher session immediately
            if (teacherSession) {
                await window.supabaseClient.auth.setSession({
                    access_token: teacherSession.access_token,
                    refresh_token: teacherSession.refresh_token
                });
            }

            // Ensure profile has the correct data
            if (!error && data?.user?.id) {
                await window.supabaseClient
                    .from('profiles')
                    .update({ name, username, grade, subjects, phone, role: 'student' })
                    .eq('id', data.user.id);
            }

            if (error) {
                status.textContent = `Error: ${error.message}`;
                status.className = 'status status--error';
                status.style.display = 'block';
            } else {
                status.innerHTML = `<strong>✓ Student registered!</strong><br>
                    Name: ${name}<br>
                    Username: ${username}<br>
                    Grade: ${grade}<br>
                    The student can now log in.`;
                status.className = 'status status--info';
                status.style.display = 'block';
                form.reset();
                loadStudents(); // Refresh the students list
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

// Exported Initialization function called by router
export function init() {
    // 1. Initial Data Load
    loadStudents();
    loadAddStudentComponent(); // pre-load the form HTML

    // 2. Attach DOM Event Listeners
    const btnRefresh = document.getElementById('btnRefreshStudents');
    if (btnRefresh) btnRefresh.addEventListener('click', loadStudents);

    const studentSearchInput = document.getElementById('studentSearchInput');
    const studentGradeFilter = document.getElementById('studentGradeFilter');
    const studentSubjectFilter = document.getElementById('studentSubjectFilter');

    if (studentSearchInput) studentSearchInput.addEventListener('input', filterStudents);
    if (studentGradeFilter) studentGradeFilter.addEventListener('change', filterStudents);
    if (studentSubjectFilter) studentSubjectFilter.addEventListener('change', filterStudents);

    // Pill Toggle Logic
    const pillView = document.getElementById('pillViewStudents');
    const pillAdd = document.getElementById('pillAddStudent');
    const listContainer = document.getElementById('studentsListContainer');
    const addContainer = document.getElementById('addStudentContainer');
    const studentDetailCtr = document.getElementById('studentDetailContainer');

    if (pillView && pillAdd) {
        pillView.addEventListener('click', () => {
            pillView.classList.add('pill-toggle__btn--active');
            pillAdd.classList.remove('pill-toggle__btn--active');
            if (listContainer) listContainer.style.display = 'block';
            if (addContainer) addContainer.style.display = 'none';
            if (studentDetailCtr) studentDetailCtr.style.display = 'none';
            if (btnRefresh) btnRefresh.style.display = 'inline-block';
        });

        pillAdd.addEventListener('click', () => {
            pillAdd.classList.add('pill-toggle__btn--active');
            pillView.classList.remove('pill-toggle__btn--active');
            if (addContainer) addContainer.style.display = 'block';
            if (listContainer) listContainer.style.display = 'none';
            if (studentDetailCtr) studentDetailCtr.style.display = 'none';
            if (btnRefresh) btnRefresh.style.display = 'none';
        });
    }

    // Back to Students button inside Detail view
    const btnBack = document.getElementById('btnBackToStudents');
    if (btnBack) btnBack.addEventListener('click', hideStudentDetail);

    // Event Delegation for Table action buttons (Detail View)
    const tbody = document.getElementById('studentsTableBody');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            if (action === 'detail') showStudentDetail(id);
        });
    }

    // Expose delete to global scope temporarily if inline handlers were used (not ideal but safe fallback)
    window.deleteStudent = deleteStudent;
}

// Exported Refresh function called when tab is revisited
export function refresh() {
    loadStudents();
}
