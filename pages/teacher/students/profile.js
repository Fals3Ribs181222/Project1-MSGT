import { renderAttendanceCalendar, renderTrendChart } from './student-detail-charts.js';
import { fetchAndRenderRanks } from './student-detail-ranks.js';
import { loadTeacherNotes } from './student-detail-notes.js';
import { loadWhatsappLog } from './student-detail-whatsapp-log.js';
import { setupFatherPhoneEdit, setupMotherPhoneEdit } from './student-detail-phone.js';
import { initReport, setReportButtonState } from './student-detail-report.js';

export async function init() {
    let student = window._pendingStudent;

    if (!student && window._pendingIdentifier) {
        const { data } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('username', window._pendingIdentifier)
            .eq('role', 'student')
            .single();
        if (data) {
            student = data;
            window._pendingStudent = student;
        }
        window._pendingIdentifier = null;
    }

    if (!student) {
        window.loadPage('page-students', '');
        return;
    }

    if (student.username) {
        history.replaceState(null, '', `${location.search}#students#profile@${student.username}`);
    }

    let reportData = {
        student: { name: student.name || 'Unknown', grade: student.grade || '', subjects: student.subjects || '' },
        attendance: { total: 0, present: 0, absent: 0, late: 0, rate: 0 },
        batches: [],
        marks: [],
    };

    initReport({ getStudent: () => student, getReportData: () => reportData });

    document.getElementById('studentDetailName').textContent = student.name || 'Unknown';
    document.getElementById('studentDetailUsername').textContent = student.username || '-';
    document.getElementById('studentDetailGrade').textContent = student.grade || '-';
    document.getElementById('studentDetailSubjects').textContent = student.subjects || '-';
    const sdSchool = document.getElementById('studentDetailSchool');
    if (sdSchool) sdSchool.textContent = student.school || '-';

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

    const sdEmail = document.getElementById('sdEmail');
    if (sdEmail) sdEmail.textContent = student.email || 'Not set';

    const sdFatherName = document.getElementById('sdFatherName');
    const sdFatherPhone = document.getElementById('sdFatherPhone');
    const sdFatherWaLink = document.getElementById('sdFatherWaLink');
    if (sdFatherName) sdFatherName.textContent = student.father_name || 'Not set';
    if (sdFatherPhone) {
        sdFatherPhone.textContent = student.father_phone || 'Not set';
        if (sdFatherWaLink) {
            if (student.father_phone) { sdFatherWaLink.href = `https://wa.me/91${student.father_phone}`; sdFatherWaLink.style.display = 'inline-block'; }
            else sdFatherWaLink.style.display = 'none';
        }
    }
    setupFatherPhoneEdit(student.id, student.father_phone || '', () => {});

    const sdMotherName = document.getElementById('sdMotherName');
    const sdMotherPhone = document.getElementById('sdMotherPhone');
    const sdMotherWaLink = document.getElementById('sdMotherWaLink');
    if (sdMotherName) sdMotherName.textContent = student.mother_name || 'Not set';
    if (sdMotherPhone) {
        sdMotherPhone.textContent = student.mother_phone || 'Not set';
        if (sdMotherWaLink) {
            if (student.mother_phone) { sdMotherWaLink.href = `https://wa.me/91${student.mother_phone}`; sdMotherWaLink.style.display = 'inline-block'; }
            else sdMotherWaLink.style.display = 'none';
        }
    }
    setupMotherPhoneEdit(student.id, student.mother_phone || '', () => {});

    loadTeacherNotes(student.id, student.teacher_notes || '', () => {});
    loadWhatsappLog(student.id);

    document.getElementById('sdTrendChart').innerHTML = '<div class="loading-text">Loading...</div>';
    document.getElementById('sdAttendanceCalendar').innerHTML = '<div class="loading-text">Loading...</div>';
    window.tableLoading('studentBatchesBody', 4, 'Loading batches...');
    window.tableLoading('studentMarksBody', 5, 'Loading marks...');
    ['sdTotalClasses', 'sdPresent', 'sdAbsent', 'sdLate', 'sdAttendanceRate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '...';
    });

    const btnDel = document.getElementById('btnDeleteStudentDetail');
    if (btnDel) {
        btnDel.addEventListener('click', async () => {
            window.showConfirmModal('Delete Student',
                `Are you sure you want to delete <strong>${student.name || 'this student'}</strong>? This cannot be undone.`,
                async () => {
                    try {
                        const { data: { session } } = await window.supabaseClient.auth.getSession();
                        const res = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/admin-api`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                            body: JSON.stringify({ action: 'delete_student', user_id: student.id })
                        });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json.error || 'Delete failed');
                        window.loadPage('page-students', '');
                    } catch (err) {
                        alert('Failed to delete: ' + err.message);
                    }
                }
            );
        });
    }

    if (!window.supabaseClient) return;

    Promise.all([
        (async () => {
            try {
                const { data: batchLinks } = await window.supabaseClient.from('batch_students').select('batch_id').eq('student_id', student.id);
                const batchBody = document.getElementById('studentBatchesBody');
                if (batchLinks && batchLinks.length > 0) {
                    const batchIds = batchLinks.map(bl => bl.batch_id);
                    const { data: batches } = await window.supabaseClient.from('batches').select('*, classes(type, day_of_week, start_time)').in('id', batchIds);
                    if (batches && batches.length > 0) {
                        reportData.batches = batches.map(b => {
                            let scheduleStr = '';
                            if (b.classes && b.classes.length > 0) {
                                const regular = b.classes.filter(c => c.type === 'regular');
                                if (regular.length > 0) {
                                    const parts = regular.map(c => `${window.DAYS[c.day_of_week]} ${window.formatTime ? window.formatTime(c.start_time) : c.start_time}`);
                                    scheduleStr = [...new Set(parts)].join(', ');
                                }
                            }
                            return { name: b.name || '', subject: b.subject || '', grade: b.grade || '', schedule: scheduleStr };
                        });
                        batchBody.innerHTML = batches.map((b, idx) => `
                            <tr class="data-table__row">
                                <td class="data-table__td--main">${window.esc(b.name) || '-'}</td>
                                <td class="data-table__td">${window.esc(b.subject) || '-'}</td>
                                <td class="data-table__td">${window.esc(b.grade) || '-'}</td>
                                <td class="data-table__td">${window.esc(reportData.batches[idx].schedule) || '-'}</td>
                            </tr>`).join('');
                    } else {
                        batchBody.innerHTML = '<tr><td colspan="4" class="student-detail__empty">No batches found.</td></tr>';
                    }
                } else {
                    batchBody.innerHTML = '<tr><td colspan="4" class="student-detail__empty">Not assigned to any batches.</td></tr>';
                }
            } catch (err) { console.error('Batch fetch error:', err); }
        })(),

        (async () => {
            try {
                const { data: attendanceData } = await window.supabaseClient.from('attendance').select('status, date').eq('student_id', student.id);
                const total = attendanceData?.length || 0;
                const present = attendanceData?.filter(a => a.status === 'present').length || 0;
                const absent = attendanceData?.filter(a => a.status === 'absent').length || 0;
                const late = attendanceData?.filter(a => a.status === 'late').length || 0;
                const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
                reportData.attendance = { total, present, absent, late, rate };
                document.getElementById('sdTotalClasses').textContent = total;
                document.getElementById('sdPresent').textContent = present;
                document.getElementById('sdAbsent').textContent = absent;
                document.getElementById('sdLate').textContent = late;
                document.getElementById('sdAttendanceRate').textContent = total > 0 ? rate + '%' : 'N/A';
                renderAttendanceCalendar(attendanceData || []);
            } catch (err) { console.error('Attendance fetch error:', err); }
        })(),

        (async () => {
            try {
                const { data: marksData } = await window.supabaseClient.from('marks').select('marks_obtained, test_id').eq('student_id', student.id);
                const marksBody = document.getElementById('studentMarksBody');
                if (marksData && marksData.length > 0) {
                    const testIds = [...new Set(marksData.map(m => m.test_id))];
                    const { data: testsData } = await window.supabaseClient.from('tests').select('*').in('id', testIds);
                    const testMap = {};
                    (testsData || []).forEach(t => testMap[t.id] = t);
                    marksData.sort((a, b) => (testMap[a.test_id]?.date || '').localeCompare(testMap[b.test_id]?.date || ''));
                    reportData.marks = marksData.map(m => {
                        const test = testMap[m.test_id] || {};
                        return { title: test.title || 'Untitled', subject: test.subject || '', marks_obtained: Number(m.marks_obtained) || 0, max_marks: Number(test.max_marks) || 0, date: test.date || '' };
                    });
                    marksBody.innerHTML = marksData.map(m => {
                        const test = testMap[m.test_id] || {};
                        const pct = test.max_marks > 0 ? Math.round((Number(m.marks_obtained) / test.max_marks) * 100) : 0;
                        const pctColor = pct >= 75 ? 'color:#00A36C;font-weight:600;' : pct >= 50 ? 'color:#C48A14;font-weight:600;' : 'color:#C41230;font-weight:600;';
                        return `<tr class="data-table__row">
                            <td class="data-table__td--main">${window.esc(test.title) || '-'}</td>
                            <td class="data-table__td">${window.esc(test.subject) || '-'}</td>
                            <td class="data-table__td"><strong>${m.marks_obtained || '-'}</strong></td>
                            <td class="data-table__td">${test.max_marks || '-'}</td>
                            <td class="data-table__td" style="${pctColor}">${pct}%</td>
                            <td class="data-table__td" style="color:var(--text-muted);font-size:0.8rem;">...</td>
                            <td class="data-table__td">${test.date ? new Date(test.date).toLocaleDateString('en-IN') : '-'}</td>
                        </tr>`;
                    }).join('');
                    renderTrendChart(reportData.marks);
                    fetchAndRenderRanks(student.id, marksData, testMap);
                } else {
                    marksBody.innerHTML = '<tr><td colspan="7" class="student-detail__empty">No test scores recorded.</td></tr>';
                    renderTrendChart([]);
                }
            } catch (err) { console.error('Marks fetch error:', err); }
            setReportButtonState('ready');
        })(),
    ]);

    setReportButtonState('ready');
}
