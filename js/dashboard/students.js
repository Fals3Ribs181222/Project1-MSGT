// js/dashboard/students.js

let allStudents = [];
let currentStudent = null;
const user = window.auth.getUser();

let studentReportData = null;

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
            <td class="data-table__td">${window.esc(student.grade) || '-'}</td>
            <td class="data-table__td">${window.esc(student.subjects) || '-'}</td>
            <td class="data-table__td">
                <button class="btn btn--primary btn--sm" data-action="detail" data-id="${student.id}">Manage Student</button>
            </td>
        </tr>
    `).join('');
}

function filterStudents() {
    const searchVal = (document.getElementById('studentSearchInput')?.value || '').toLowerCase();
    const gradeVal = document.getElementById('studentGradeFilter')?.value || '';
    const subjectVal = document.getElementById('studentSubjectFilter')?.value || '';

    let filtered = allStudents;
    if (searchVal) filtered = filtered.filter(s =>
        (s.name || '').toLowerCase().includes(searchVal) ||
        (s.username || '').toLowerCase().includes(searchVal)
    );
    if (gradeVal) filtered = filtered.filter(s => s.grade === gradeVal);
    if (subjectVal) filtered = filtered.filter(s => (s.subjects || '').includes(subjectVal));

    renderStudentsTable(filtered);
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteStudent(studentId) {
    const student = allStudents.find(s => s.id === studentId);
    window.showConfirmModal(
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

// ── STUDENT DETAIL VIEW ───────────────────────────────────────────────────────

async function showStudentDetail(studentId) {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    currentStudent = student; // Store for WhatsApp delivery

    studentReportData = {
        student: {
            name: student.name || 'Unknown',
            grade: student.grade || '',
            subjects: student.subjects || '',
        },
        attendance: { total: 0, present: 0, absent: 0, late: 0, rate: 0 },
        batches: [],
        marks: [],
    };
    setReportButtonState('idle');
    clearReportOutput();

    document.getElementById('studentsListContainer').style.display = 'none';
    document.getElementById('addStudentContainer').style.display = 'none';
    document.getElementById('importStudentsContainer').style.display = 'none';
    document.getElementById('studentDetailContainer').style.display = 'block';
    const refreshBtn = document.getElementById('btnRefreshStudents');
    if (refreshBtn) refreshBtn.style.display = 'none';

    document.getElementById('studentDetailName').textContent = student.name || 'Unknown';
    document.getElementById('studentDetailUsername').textContent = student.username || '-';
    document.getElementById('studentDetailGrade').textContent = student.grade || '-';
    document.getElementById('studentDetailSubjects').textContent = student.subjects || '-';

    // Student phone
    const sdStudentPhone = document.getElementById('sdStudentPhone');
    const sdStudentWaLink = document.getElementById('sdStudentWaLink');
    if (student.phone) {
        sdStudentPhone.textContent = student.phone;
        sdStudentWaLink.href = `https://wa.me/91${student.phone}`;
        sdStudentWaLink.style.display = 'inline-block';
    } else {
        sdStudentPhone.textContent = 'Not set';
        sdStudentWaLink.style.display = 'none';
    }

    // Parent phone
    const sdParentPhone = document.getElementById('sdParentPhone');
    const sdParentWaLink = document.getElementById('sdParentWaLink');
    if (student.parent_phone) {
        sdParentPhone.textContent = student.parent_phone;
        sdParentWaLink.href = `https://wa.me/91${student.parent_phone}`;
        sdParentWaLink.style.display = 'inline-block';
    } else {
        sdParentPhone.textContent = 'Not set';
        sdParentWaLink.style.display = 'none';
    }
    setupParentPhoneEdit(student.id, student.parent_phone || '');

    // Teacher notes + WA history
    loadTeacherNotes(student.id, student.teacher_notes || '');
    loadWhatsappLog(student.id);

    // Reset new sections
    document.getElementById('sdTrendChart').innerHTML = '<div class="loading-text">Loading...</div>';
    document.getElementById('sdAttendanceCalendar').innerHTML = '<div class="loading-text">Loading...</div>';


    window.tableLoading('studentBatchesBody', 4, 'Loading batches...');
    window.tableLoading('studentMarksBody', 5, 'Loading marks...');
    ['sdTotalClasses', 'sdPresent', 'sdAbsent', 'sdLate', 'sdAttendanceRate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '...';
    });

    if (!window.supabaseClient) {
        console.warn('window.supabaseClient is not defined!');
        return;
    }

    await Promise.all([
        // Fetch batch memberships
        (async () => {
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
                        .select('*, classes(type, day_of_week, start_time)')
                        .in('id', batchIds);

                    if (batches && batches.length > 0) {
                        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                        studentReportData.batches = batches.map(b => {
                            let scheduleStr = '';
                            if (b.classes && b.classes.length > 0) {
                                const regular = b.classes.filter(c => c.type === 'regular');
                                if (regular.length > 0) {
                                    const parts = regular.map(c => {
                                        const t = window.formatTime ? window.formatTime(c.start_time) : c.start_time;
                                        return `${days[c.day_of_week]} ${t}`;
                                    });
                                    scheduleStr = [...new Set(parts)].join(', ');
                                }
                            }
                            return {
                                name: b.name || '',
                                subject: b.subject || '',
                                grade: b.grade || '',
                                schedule: scheduleStr,
                            };
                        });

                        batchBody.innerHTML = batches.map((b, idx) => `
                            <tr class="data-table__row">
                                <td class="data-table__td--main">${window.esc(b.name) || '-'}</td>
                                <td class="data-table__td">${window.esc(b.subject) || '-'}</td>
                                <td class="data-table__td">${window.esc(b.grade) || '-'}</td>
                                <td class="data-table__td">${window.esc(studentReportData.batches[idx].schedule) || '-'}</td>
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
        })(),

        // Fetch attendance records
        (async () => {
            try {
                const { data: attendanceData } = await window.supabaseClient
                    .from('attendance')
                    .select('status, date')
                    .eq('student_id', studentId);

                const total = attendanceData?.length || 0;
                const present = attendanceData?.filter(a => a.status === 'present').length || 0;
                const absent = attendanceData?.filter(a => a.status === 'absent').length || 0;
                const late = attendanceData?.filter(a => a.status === 'late').length || 0;
                const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

                studentReportData.attendance = { total, present, absent, late, rate };

                document.getElementById('sdTotalClasses').textContent = total;
                document.getElementById('sdPresent').textContent = present;
                document.getElementById('sdAbsent').textContent = absent;
                document.getElementById('sdLate').textContent = late;
                document.getElementById('sdAttendanceRate').textContent = total > 0 ? rate + '%' : 'N/A';
                renderAttendanceCalendar(attendanceData || []);
            } catch (err) {
                console.error('Attendance fetch error:', err);
            }
        })(),

        // Fetch marks + tests
        (async () => {
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

                    // Sort by test date (newest first)
                    marksData.sort((a, b) => {
                        const dateA = testMap[a.test_id]?.date || '';
                        const dateB = testMap[b.test_id]?.date || '';
                        return dateA.localeCompare(dateB);
                    });

                    studentReportData.marks = marksData.map(m => {
                        const test = testMap[m.test_id] || {};
                        return {
                            title: test.title || 'Untitled',
                            subject: test.subject || '',
                            marks_obtained: Number(m.marks_obtained) || 0,
                            max_marks: Number(test.max_marks) || 0,
                            date: test.date || '',
                        };
                    });

                    // Initial render (without rank — rank loads async below)
                    marksBody.innerHTML = marksData.map(m => {
                        const test = testMap[m.test_id] || {};
                        const pct = test.max_marks > 0
                            ? Math.round((Number(m.marks_obtained) / test.max_marks) * 100)
                            : 0;
                        const pctColor = pct >= 75
                            ? 'color:#1D9E75;font-weight:600;'
                            : pct >= 50
                                ? 'color:#BA7517;font-weight:600;'
                                : 'color:#E24B4A;font-weight:600;';
                        return `
                    <tr class="data-table__row">
                        <td class="data-table__td--main">${window.esc(test.title) || '-'}</td>
                        <td class="data-table__td">${window.esc(test.subject) || '-'}</td>
                        <td class="data-table__td"><strong>${m.marks_obtained || '-'}</strong></td>
                        <td class="data-table__td">${test.max_marks || '-'}</td>
                        <td class="data-table__td" style="${pctColor}">${pct}%</td>
                        <td class="data-table__td" style="color:var(--text-muted);font-size:0.8rem;">...</td>
                        <td class="data-table__td">${test.date ? new Date(test.date).toLocaleDateString('en-IN') : '-'}</td>
                    </tr>
                `;
                    }).join('');

                    // Render trend chart
                    renderTrendChart(studentReportData.marks);

                    // Fetch ranks async (separate query, doesn't block UI)
                    fetchAndRenderRanks(studentId, marksData, testMap);

                } else {
                    marksBody.innerHTML = '<tr><td colspan="7" class="student-detail__empty">No test scores recorded.</td></tr>';
                    renderTrendChart([]);
                }
            } catch (err) {
                console.error('Marks fetch error:', err);
            }

            // All data loaded — enable the report button
            setReportButtonState('ready');
        })(),
    ]);

    // All data loaded — enable the button
    setReportButtonState('ready');
}

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

    studentReportData = null;
    clearReportOutput();
}

// ── AI REPORT GENERATION ──────────────────────────────────────────────────────

function setReportButtonState(state) {
    const btn = document.getElementById('btnGenerateReport');
    if (!btn) return;
    if (state === 'loading') {
        btn.disabled = true;
        btn.textContent = 'Generating...';
    } else {
        btn.disabled = (state === 'idle');
        btn.textContent = '✨ Generate Report';
    }
}

function clearReportOutput() {
    const section = document.getElementById('reportOutputSection');
    const text = document.getElementById('reportOutputText');
    if (section) section.style.display = 'none';
    if (text) text.textContent = '';
}

async function generateReport() {
    if (!studentReportData) return;

    setReportButtonState('loading');

    const section = document.getElementById('reportOutputSection');
    const text = document.getElementById('reportOutputText');
    const copyBtn = document.getElementById('btnCopyReport');

    if (section) section.style.display = 'block';
    if (text) text.textContent = 'Generating report...';
    if (copyBtn) copyBtn.style.display = 'none';

    section?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
        const token = window.CONFIG.SUPABASE_ANON_KEY;
        const GENERATE_REPORT_URL = `${window.CONFIG.SUPABASE_URL}/functions/v1/generate-report`;

        const response = await fetch(GENERATE_REPORT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(studentReportData),
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(result.error || 'Failed to generate report.');
        }

        if (text) text.textContent = result.report;
        if (copyBtn) copyBtn.style.display = 'inline-block';

        const whatsAppBtn = document.getElementById('btnSendWhatsappReport');
        if (whatsAppBtn) whatsAppBtn.style.display = 'inline-flex';

    } catch (err) {
        console.error('Report generation error:', err);
        console.dir(err); // Log the full object to see if it's a network error or Anthropic error
        if (text) {
            text.textContent = '⚠ ' + (err.message || 'Something went wrong. Please try again.');
        }
    } finally {
        setReportButtonState('ready');
    }
}

async function sendWhatsAppReport() {
    const textEl = document.getElementById('reportOutputText');
    const reportText = textEl?.textContent || '';
    const student = currentStudent;

    if (!reportText || !student) return;

    // Resolve recipients — prefer parent, fallback to student
    const recipients = window.whatsapp.resolveRecipients(student, 'parent');
    if (recipients.length === 0) {
        // Fallback to student phone if no parent phone
        const fallback = window.whatsapp.resolveRecipients(student, 'student');
        if (fallback.length === 0) {
            alert("This student doesn't have a phone number registered. Please update their profile.");
            return;
        }
        recipients.push(...fallback);
    }

    const btn = document.getElementById('btnSendWhatsappReport');
    if (!btn) return;

    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Sending...';
    btn.disabled = true;

    try {
        const result = await window.whatsapp.send({
            type: 'report',
            recipients,
            payload: { report: reportText },
        });

        btn.innerHTML = '<i class="ri-check-line"></i> Sent!';
        btn.style.backgroundColor = '#1DA954';

        // Refresh the log panel
        if (student.id) loadWhatsappLog(student.id);

        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.style.backgroundColor = '#25D366';
            btn.disabled = false;
        }, 3000);

    } catch (err) {
        console.error('WhatsApp dispatch error:', err);
        alert('Failed to send WhatsApp message: ' + err.message);
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

function copyReportToClipboard() {
    const text = document.getElementById('reportOutputText')?.textContent || '';
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('btnCopyReport');
        if (btn) {
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = original; }, 2000);
        }
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
    });
}

// ── ADD STUDENT FORM ──────────────────────────────────────────────────────────

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

    window.populateGradeSelect('studentGrade', false);
    window.lockGradeSelect('studentGrade');

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

        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-block';
        btn.disabled = true;
        status.style.display = 'none';

        try {
            const { data: sessionData } = await window.supabaseClient.auth.getSession();
            const teacherSession = sessionData?.session;

            const email = `${username}@msgt.internal`;
            const metadata = { name, username, grade, subjects, phone, role: 'student' };

            const { data, error } = await window.supabaseClient.auth.signUp({
                email,
                password,
                options: { data: metadata }
            });

            if (teacherSession) {
                await window.supabaseClient.auth.setSession({
                    access_token: teacherSession.access_token,
                    refresh_token: teacherSession.refresh_token
                });
            }

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

    if (studentSearchInput) studentSearchInput.addEventListener('input', filterStudents);
    if (studentGradeFilter) studentGradeFilter.addEventListener('change', filterStudents);
    if (studentSubjectFilter) studentSubjectFilter.addEventListener('change', filterStudents);

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

    const btnBack = document.getElementById('btnBackToStudents');
    if (btnBack) btnBack.addEventListener('click', hideStudentDetail);

    // Report Generator button
    document.getElementById('btnGenerateReport')?.addEventListener('click', generateReport);

    // Copy Report button
    document.getElementById('btnCopyReport')?.addEventListener('click', copyReportToClipboard);

    // Send WhatsApp Report button
    document.getElementById('btnSendWhatsappReport')?.addEventListener('click', sendWhatsAppReport);

    // Initial check for report button state
    // setReportButtonState('checking'); // This line was malformed in the instruction, assuming it's not needed or should be placed elsewhere.

    const btnDeleteDetail = document.getElementById('btnDeleteStudentDetail');
    if (btnDeleteDetail) {
        btnDeleteDetail.addEventListener('click', () => {
            if (currentStudent?.id) deleteStudent(currentStudent.id);
        });
    }

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

    window.deleteStudent = deleteStudent;

    initImportSection();
}

// ── CSV IMPORT ─────────────────────────────────────────────────────────────────

function initImportSection() {
    document.getElementById('btnDownloadCsvTemplate')?.addEventListener('click', downloadCsvTemplate);
    document.getElementById('btnPreviewCsv')?.addEventListener('click', previewCsvImport);
    document.getElementById('btnImportAll')?.addEventListener('click', importAllStudents);
}

function downloadCsvTemplate() {
    const csv = 'name,grade,subjects,phone\nRahul Sharma,11,"Accounts, Commerce",9876543210\nPriya Patel,12,Accounts,9123456789';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'students_template.csv';
    a.click();
}

function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return { headers: [], rows: [] };

    const parseRow = (line) => {
        const fields = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                fields.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        fields.push(cur.trim());
        return fields;
    };

    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).filter(l => l.trim()).map(l => parseRow(l));
    return { headers, rows };
}

function detectColumns(headers) {
    const map = {};
    headers.forEach((h, i) => {
        const lh = h.toLowerCase();
        if (!map.name && lh.includes('name')) map.name = i;
        if (!map.grade && (lh.includes('grade') || lh.includes('class') || lh.includes('std'))) map.grade = i;
        if (!map.subjects && lh.includes('subject')) map.subjects = i;
        if (!map.phone && (lh.includes('phone') || lh.includes('mobile') || lh.includes('whatsapp') || lh.includes('contact'))) map.phone = i;
    });
    return map;
}

function generateUsername(name, taken) {
    const base = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '.');
    let username = base;
    let n = 2;
    while (taken.has(username)) { username = base + n; n++; }
    taken.add(username);
    return username;
}

let importRows = [];

function previewCsvImport() {
    const file = document.getElementById('importCsvFile')?.files[0];
    const statusEl = document.getElementById('importStatus');
    const previewSection = document.getElementById('importPreviewSection');

    if (!file) {
        window.showStatus('importStatus', 'Please select a CSV file first.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const { headers, rows } = parseCSV(e.target.result);
        const colMap = detectColumns(headers);

        if (colMap.name === undefined) {
            window.showStatus('importStatus', 'Could not find a "name" column. Check your CSV headers.', 'error');
            previewSection.style.display = 'none';
            return;
        }

        const taken = new Set(allStudents.map(s => s.username).filter(Boolean));
        importRows = rows.map(row => ({
            name: row[colMap.name] || '',
            grade: colMap.grade !== undefined ? row[colMap.grade] : '',
            subjects: colMap.subjects !== undefined ? row[colMap.subjects] : '',
            phone: colMap.phone !== undefined ? row[colMap.phone] : '',
            username: generateUsername(row[colMap.name] || 'student', taken),
            status: 'pending',
        })).filter(r => r.name);

        if (importRows.length === 0) {
            window.showStatus('importStatus', 'No valid rows found in the CSV.', 'error');
            previewSection.style.display = 'none';
            return;
        }

        document.getElementById('importPreviewCount').textContent = `${importRows.length} student${importRows.length !== 1 ? 's' : ''} ready to import`;
        renderImportPreview();
        previewSection.style.display = 'block';
        statusEl.style.display = 'none';
    };
    reader.readAsText(file);
}

function renderImportPreview() {
    const tbody = document.getElementById('importPreviewBody');
    tbody.innerHTML = importRows.map((r, i) => {
        const statusBadge = r.status === 'done'
            ? '<span style="color:var(--success-color,green);font-weight:600;">✓ Done</span>'
            : r.status === 'error'
            ? `<span style="color:var(--danger-color,red);font-size:0.8rem;">${window.esc(r.errorMsg || 'Error')}</span>`
            : '<span style="color:var(--text-muted);">Pending</span>';

        return `<tr>
            <td class="data-table__td">${i + 1}</td>
            <td class="data-table__td--main">${window.esc(r.name)}</td>
            <td class="data-table__td">${window.esc(r.grade)}</td>
            <td class="data-table__td">${window.esc(r.subjects)}</td>
            <td class="data-table__td">${window.esc(r.phone)}</td>
            <td class="data-table__td">
                <input type="text" value="${window.esc(r.username)}" data-row="${i}"
                    style="padding:3px 8px;border:1px solid var(--border-color);border-radius:var(--radius-md);font-size:0.85rem;width:130px;background:var(--bg-surface);color:var(--text-main);"
                    ${r.status === 'done' ? 'disabled' : ''}>
            </td>
            <td class="data-table__td">${statusBadge}</td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('input[data-row]').forEach(input => {
        input.addEventListener('change', e => {
            importRows[parseInt(e.target.dataset.row)].username = e.target.value.trim().toLowerCase();
        });
    });
}

async function importAllStudents() {
    const defaultPassword = document.getElementById('importDefaultPassword')?.value.trim();
    if (!defaultPassword || defaultPassword.length < 6) {
        window.showStatus('importStatus', 'Please set a default password (at least 6 characters).', 'error');
        return;
    }

    const btn = document.getElementById('btnImportAll');
    btn.disabled = true;
    btn.textContent = 'Importing...';
    document.getElementById('importStatus').style.display = 'none';

    let done = 0, failed = 0;

    for (let i = 0; i < importRows.length; i++) {
        const r = importRows[i];
        if (r.status === 'done') { done++; continue; }

        const { data: sessionData } = await window.supabaseClient.auth.getSession();
        const teacherSession = sessionData?.session;

        const email = `${r.username}@msgt.internal`;
        const meta = { name: r.name, username: r.username, grade: r.grade, subjects: r.subjects, phone: r.phone, role: 'student' };

        const { data, error } = await window.supabaseClient.auth.signUp({ email, password: defaultPassword, options: { data: meta } });

        if (teacherSession) {
            await window.supabaseClient.auth.setSession({ access_token: teacherSession.access_token, refresh_token: teacherSession.refresh_token });
        }

        if (error) {
            importRows[i].status = 'error';
            importRows[i].errorMsg = error.message;
            failed++;
        } else {
            if (data?.user?.id) {
                await window.supabaseClient.from('profiles').update(meta).eq('id', data.user.id);
            }
            importRows[i].status = 'done';
            done++;
        }

        renderImportPreview();
    }

    btn.disabled = false;
    btn.textContent = 'Import All Students';

    const msg = `Import complete: ${done} succeeded${failed ? `, ${failed} failed` : ''}.`;
    window.showStatus('importStatus', msg, failed ? 'error' : 'success');
    document.getElementById('importPreviewCount').textContent = `${importRows.length} students — ${done} imported`;
    if (!failed) loadStudents();
}

function renderAttendanceCalendar(attendanceData) {
    const container = document.getElementById('sdAttendanceCalendar');
    if (!container) return;

    if (!attendanceData || attendanceData.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No attendance records yet.</p>';
        return;
    }

    // Keep only records that have a date
    const datedRecords = attendanceData.filter(a => a.date);
    if (datedRecords.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No dated records found.</p>';
        return;
    }

    // Build date → status map
    const statusMap = {};
    datedRecords.forEach(a => { statusMap[a.date] = a.status; });

    // Only show the class days (days that actually have records), sorted
    const classDays = Object.keys(statusMap).sort();

    const colorMap = {
        present: '#1D9E75',
        late: '#BA7517',
        absent: '#E24B4A',
    };

    const dots = classDays.map(d => {
        const status = statusMap[d];
        const color = colorMap[status] || '#ccc';
        const label = new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return `<div title="${label} · ${status}"
            style="width:14px;height:14px;border-radius:3px;background:${color};cursor:default;flex-shrink:0;"></div>`;
    }).join('');

    container.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:0.25rem 0;">
            ${dots}
        </div>
        <div style="display:flex;gap:1.25rem;margin-top:0.75rem;font-size:0.78rem;color:var(--text-muted);">
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#1D9E75;margin-right:3px;vertical-align:middle;"></span>Present</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#BA7517;margin-right:3px;vertical-align:middle;"></span>Late</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#E24B4A;margin-right:3px;vertical-align:middle;"></span>Absent</span>
        </div>
    `;
}

// ── Performance Trend Chart (pure CSS/HTML — no dependencies) ─

function renderTrendChart(marks) {
    const container = document.getElementById('sdTrendChart');
    if (!container) return;

    if (!marks || marks.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No test data to plot yet.</p>';
        return;
    }

    const sorted = [...marks].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const BAR_MAX_H = 80; // px

    const bars = sorted.map(m => {
        const pct = m.max_marks > 0 ? Math.round((m.marks_obtained / m.max_marks) * 100) : 0;
        const height = Math.max(4, Math.round((pct / 100) * BAR_MAX_H));
        const color = pct >= 75 ? '#1D9E75' : pct >= 50 ? '#BA7517' : '#E24B4A';
        const label = (m.title || '').length > 10 ? m.title.substring(0, 10) + '…' : (m.title || '-');
        return `
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:44px;max-width:80px;">
                <span style="font-size:0.75rem;font-weight:600;color:${color};">${pct}%</span>
                <div style="width:100%;height:${BAR_MAX_H}px;display:flex;align-items:flex-end;">
                    <div style="width:100%;height:${height}px;background:${color};border-radius:4px 4px 0 0;"></div>
                </div>
                <span style="font-size:0.68rem;color:var(--text-muted);text-align:center;line-height:1.3;word-break:break-word;">${window.esc(label)}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="display:flex;align-items:flex-end;gap:6px;padding:0.5rem 0 0;overflow-x:auto;">
            ${bars}
        </div>
        <p style="font-size:0.78rem;color:var(--text-muted);margin-top:0.5rem;">Each bar = one test · left to right by date</p>
    `;
}

// ── Rank in Batch ─────────────────────────────────────────────

async function fetchAndRenderRanks(studentId, marksData, testMap) {
    if (!marksData || marksData.length === 0) return;

    const testIds = marksData.map(m => m.test_id);

    try {
        // Fetch all students' marks for the same tests
        const { data: allMarks } = await window.supabaseClient
            .from('marks')
            .select('student_id, test_id, marks_obtained')
            .in('test_id', testIds);

        if (!allMarks) return;

        // Build per-test sorted score lists
        const rankMap = {};
        testIds.forEach(tid => {
            rankMap[tid] = allMarks
                .filter(m => m.test_id === tid)
                .map(m => Number(m.marks_obtained) || 0)
                .sort((a, b) => b - a);
        });

        // Sort by test date (newest first) to match initial render
        marksData.sort((a, b) => {
            const dateA = testMap[a.test_id]?.date || '';
            const dateB = testMap[b.test_id]?.date || '';
            return dateA.localeCompare(dateB);
        });

        // Re-render the full marks table with rank column populated
        const tbody = document.getElementById('studentMarksBody');
        if (!tbody) return;

        tbody.innerHTML = marksData.map(m => {
            const test = testMap[m.test_id] || {};
            const myScore = Number(m.marks_obtained) || 0;
            const pct = test.max_marks > 0 ? Math.round((myScore / test.max_marks) * 100) : 0;
            const pctColor = pct >= 75
                ? 'color:#1D9E75;font-weight:600;'
                : pct >= 50
                    ? 'color:#BA7517;font-weight:600;'
                    : 'color:#E24B4A;font-weight:600;';

            const scores = rankMap[m.test_id] || [];
            const rank = scores.indexOf(myScore) + 1;
            const total = scores.length;
            const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
            const rankLabel = total > 0 ? `${rank}${suffix} / ${total}` : '-';
            const rankColor = rank === 1
                ? 'color:#1D9E75;font-weight:600;'
                : rank <= 3
                    ? 'color:#BA7517;font-weight:600;'
                    : 'color:var(--text-muted);';

            return `
                <tr class="data-table__row">
                    <td class="data-table__td--main">${window.esc(test.title) || '-'}</td>
                    <td class="data-table__td">${window.esc(test.subject) || '-'}</td>
                    <td class="data-table__td"><strong>${m.marks_obtained || '-'}</strong></td>
                    <td class="data-table__td">${test.max_marks || '-'}</td>
                    <td class="data-table__td" style="${pctColor}">${pct}%</td>
                    <td class="data-table__td" style="${rankColor}font-size:0.85rem;">${rankLabel}</td>
                    <td class="data-table__td">${test.date ? new Date(test.date).toLocaleDateString('en-IN') : '-'}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Rank fetch error:', err);
    }
}

// ── Teacher Notes ─────────────────────────────────────────────

function loadTeacherNotes(studentId, existingNotes) {
    const textarea = document.getElementById('sdNotesInput');
    const statusEl = document.getElementById('sdNotesSaveStatus');
    const saveBtn = document.getElementById('btnSaveNotes');

    if (textarea) textarea.value = existingNotes || '';
    if (statusEl) statusEl.textContent = '';

    if (saveBtn) {
        // Remove any old listener by cloning
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

        newSaveBtn.addEventListener('click', async () => {
            const notes = document.getElementById('sdNotesInput')?.value || '';
            newSaveBtn.disabled = true;
            newSaveBtn.textContent = 'Saving...';
            try {
                const { error } = await window.supabaseClient
                    .from('profiles')
                    .update({ teacher_notes: notes })
                    .eq('id', studentId);
                if (error) throw error;

                if (statusEl) {
                    statusEl.textContent = '✓ Saved';
                    statusEl.style.color = '#1D9E75';
                }
                // Keep local cache in sync
                const cached = allStudents.find(s => s.id === studentId);
                if (cached) cached.teacher_notes = notes;

            } catch (err) {
                if (statusEl) {
                    statusEl.textContent = 'Error saving';
                    statusEl.style.color = '#E24B4A';
                }
                console.error('Notes save error:', err);
            } finally {
                newSaveBtn.disabled = false;
                newSaveBtn.textContent = 'Save Notes';
                setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
            }
        });
    }
}

// ── WhatsApp History ──────────────────────────────────────────

async function loadWhatsappLog(studentId) {
    const container = document.getElementById('sdWhatsappLog');
    if (!container) return;

    try {
        const { data, error } = await window.supabaseClient
            .from('whatsapp_log')
            .select('*')
            .eq('student_id', studentId)
            .order('sent_at', { ascending: false })
            .limit(15);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No messages sent to this student yet.</p>';
            return;
        }

        container.innerHTML = data.map(log => {
            const date = new Date(log.sent_at).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
            const typeLabel = log.message_type === 'report'
                ? '📊 Progress Report'
                : log.message_type === 'attendance'
                    ? '✅ Attendance'
                    : '💬 Message';
            return `
                <div style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.65rem 0;border-bottom:1px solid var(--border-light);">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:0.9rem;font-weight:600;color:var(--text-main);">${typeLabel}</div>
                        ${log.preview
                    ? `<div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${DOMPurify.sanitize(log.preview)}…</div>`
                    : ''}
                    </div>
                    <div style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap;padding-top:2px;">${date}</div>
                </div>
            `;
        }).join('');

    } catch (err) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">Could not load history.</p>';
        console.error('WA log fetch error:', err);
    }
}

// ── Parent Phone Edit ─────────────────────────────────────────

function setupParentPhoneEdit(studentId, currentParentPhone) {
    const editBtn = document.getElementById('btnEditParentPhone');
    const editForm = document.getElementById('sdParentPhoneEdit');
    const input = document.getElementById('sdParentPhoneInput');
    const saveBtn = document.getElementById('btnSaveParentPhone');
    const cancelBtn = document.getElementById('btnCancelParentPhone');
    const display = document.getElementById('sdParentPhone');
    const waLink = document.getElementById('sdParentWaLink');

    if (!editBtn || !editForm || !saveBtn) return;

    // Pre-fill
    input.value = currentParentPhone || '';

    // Clone to remove stale listeners from previous student
    [editBtn, saveBtn, cancelBtn].forEach(btn => {
        const clone = btn.cloneNode(true);
        btn.parentNode.replaceChild(clone, btn);
    });

    const freshEdit = document.getElementById('btnEditParentPhone');
    const freshSave = document.getElementById('btnSaveParentPhone');
    const freshCancel = document.getElementById('btnCancelParentPhone');
    const freshInput = document.getElementById('sdParentPhoneInput');

    freshEdit.addEventListener('click', () => {
        editForm.style.display = 'block';
        freshEdit.style.display = 'none';
        freshInput.focus();
    });

    freshCancel.addEventListener('click', () => {
        editForm.style.display = 'none';
        freshEdit.style.display = 'inline-block';
    });

    freshSave.addEventListener('click', async () => {
        const phone = (freshInput.value || '').trim().replace(/\D/g, '');
        if (phone && phone.length !== 10) {
            alert('Please enter a valid 10-digit number (without country code)');
            return;
        }
        freshSave.disabled = true;
        freshSave.textContent = 'Saving...';
        try {
            const { error } = await window.supabaseClient
                .from('profiles')
                .update({ parent_phone: phone || null })
                .eq('id', studentId);
            if (error) throw error;

            display.textContent = phone || 'Not set';
            if (phone) {
                waLink.href = `https://wa.me/91${phone}`;
                waLink.style.display = 'inline-block';
            } else {
                waLink.style.display = 'none';
            }
            editForm.style.display = 'none';
            freshEdit.style.display = 'inline-block';

            // Sync local cache
            const cached = allStudents.find(s => s.id === studentId);
            if (cached) cached.parent_phone = phone;

        } catch (err) {
            alert('Failed to save: ' + (err.message || 'Unknown error'));
        } finally {
            freshSave.disabled = false;
            freshSave.textContent = 'Save';
        }
    });
}


export function refresh() {
    loadStudents();
}