// js/dashboard/student-detail.js
// Student detail view, AI report generation, and all supporting helpers.
// Exported: openStudentDetail(student, callbacks)
//
// callbacks shape:
//   onBack:        () => void
//   onDelete:      (studentId) => void
//   onNotesUpdate: (studentId, notes) => void
//   onPhoneUpdate: (studentId, field, value) => void

let currentStudent = null;
let studentReportData = null;

export function openStudentDetail(student, callbacks) {
    currentStudent = student;

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

    // Email
    const sdEmail = document.getElementById('sdEmail');
    if (sdEmail) sdEmail.textContent = student.email || 'Not set';

    // Father
    const sdFatherName = document.getElementById('sdFatherName');
    const sdFatherPhone = document.getElementById('sdFatherPhone');
    const sdFatherWaLink = document.getElementById('sdFatherWaLink');
    if (sdFatherName) sdFatherName.textContent = student.father_name || 'Not set';
    if (sdFatherPhone) {
        sdFatherPhone.textContent = student.father_phone || 'Not set';
        if (sdFatherWaLink) {
            if (student.father_phone) {
                sdFatherWaLink.href = `https://wa.me/91${student.father_phone}`;
                sdFatherWaLink.style.display = 'inline-block';
            } else {
                sdFatherWaLink.style.display = 'none';
            }
        }
    }
    setupFatherPhoneEdit(student.id, student.father_phone || '', callbacks.onPhoneUpdate);

    // Mother
    const sdMotherName = document.getElementById('sdMotherName');
    const sdMotherPhone = document.getElementById('sdMotherPhone');
    const sdMotherWaLink = document.getElementById('sdMotherWaLink');
    if (sdMotherName) sdMotherName.textContent = student.mother_name || 'Not set';
    if (sdMotherPhone) {
        sdMotherPhone.textContent = student.mother_phone || 'Not set';
        if (sdMotherWaLink) {
            if (student.mother_phone) {
                sdMotherWaLink.href = `https://wa.me/91${student.mother_phone}`;
                sdMotherWaLink.style.display = 'inline-block';
            } else {
                sdMotherWaLink.style.display = 'none';
            }
        }
    }
    setupMotherPhoneEdit(student.id, student.mother_phone || '', callbacks.onPhoneUpdate);

    // Teacher notes + WA history
    loadTeacherNotes(student.id, student.teacher_notes || '', callbacks.onNotesUpdate);
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

    // Wire back button (clone to remove any stale listener from a previous student)
    const btnBack = document.getElementById('btnBackToStudents');
    if (btnBack) {
        const fresh = btnBack.cloneNode(true);
        btnBack.parentNode.replaceChild(fresh, btnBack);
        fresh.addEventListener('click', callbacks.onBack);
    }

    // Wire delete button
    const btnDel = document.getElementById('btnDeleteStudentDetail');
    if (btnDel) {
        const fresh = btnDel.cloneNode(true);
        btnDel.parentNode.replaceChild(fresh, btnDel);
        fresh.addEventListener('click', () => callbacks.onDelete(student.id));
    }

    // Wire report / copy / whatsapp buttons
    const btnGenerate = document.getElementById('btnGenerateReport');
    if (btnGenerate) {
        const fresh = btnGenerate.cloneNode(true);
        btnGenerate.parentNode.replaceChild(fresh, btnGenerate);
        fresh.addEventListener('click', generateReport);
    }

    const btnCopy = document.getElementById('btnCopyReport');
    if (btnCopy) {
        const fresh = btnCopy.cloneNode(true);
        btnCopy.parentNode.replaceChild(fresh, btnCopy);
        fresh.addEventListener('click', copyReportToClipboard);
    }

    const btnWa = document.getElementById('btnSendWhatsappReport');
    if (btnWa) {
        const fresh = btnWa.cloneNode(true);
        btnWa.parentNode.replaceChild(fresh, btnWa);
        fresh.addEventListener('click', sendWhatsAppReport);
    }

    if (!window.supabaseClient) {
        console.warn('window.supabaseClient is not defined!');
        return;
    }

    Promise.all([
        // Fetch batch memberships
        (async () => {
            try {
                const { data: batchLinks } = await window.supabaseClient
                    .from('batch_students')
                    .select('batch_id')
                    .eq('student_id', student.id);

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
                    .eq('student_id', student.id);

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
                    .eq('student_id', student.id);

                const marksBody = document.getElementById('studentMarksBody');

                if (marksData && marksData.length > 0) {
                    const testIds = [...new Set(marksData.map(m => m.test_id))];
                    const { data: testsData } = await window.supabaseClient
                        .from('tests')
                        .select('*')
                        .in('id', testIds);

                    const testMap = {};
                    (testsData || []).forEach(t => testMap[t.id] = t);

                    // Sort by test date (oldest first for chart)
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
                    fetchAndRenderRanks(student.id, marksData, testMap);

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
        console.dir(err);
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
        // Fallback to student phone if no mother/father phone
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

// ── Attendance Calendar ───────────────────────────────────────────────────────

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

// ── Performance Trend Chart ───────────────────────────────────────────────────

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

// ── Rank in Batch ─────────────────────────────────────────────────────────────

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

        // Sort by test date (oldest first) to match initial render
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

// ── Teacher Notes ─────────────────────────────────────────────────────────────

function loadTeacherNotes(studentId, existingNotes, onNotesUpdate) {
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
                // Notify parent to keep local cache in sync
                if (onNotesUpdate) onNotesUpdate(studentId, notes);

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

// ── WhatsApp History ──────────────────────────────────────────────────────────

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

// ── Father Phone Edit ─────────────────────────────────────────────────────────

function setupFatherPhoneEdit(studentId, currentPhone, onPhoneUpdate) {
    const editBtn = document.getElementById('btnEditFatherPhone');
    const editForm = document.getElementById('sdFatherPhoneEdit');
    const input = document.getElementById('sdFatherPhoneInput');
    const saveBtn = document.getElementById('btnSaveFatherPhone');
    const cancelBtn = document.getElementById('btnCancelFatherPhone');

    if (!editBtn || !editForm || !saveBtn) return;

    input.value = currentPhone || '';

    [editBtn, saveBtn, cancelBtn].forEach(btn => {
        const clone = btn.cloneNode(true);
        btn.parentNode.replaceChild(clone, btn);
    });

    const freshEdit = document.getElementById('btnEditFatherPhone');
    const freshSave = document.getElementById('btnSaveFatherPhone');
    const freshCancel = document.getElementById('btnCancelFatherPhone');
    const freshInput = document.getElementById('sdFatherPhoneInput');

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
                .update({ father_phone: phone || null })
                .eq('id', studentId);
            if (error) throw error;

            const display = document.getElementById('sdFatherPhone');
            const waLink = document.getElementById('sdFatherWaLink');
            if (display) display.textContent = phone || 'Not set';
            if (waLink) {
                if (phone) {
                    waLink.href = `https://wa.me/91${phone}`;
                    waLink.style.display = 'inline-block';
                } else {
                    waLink.style.display = 'none';
                }
            }
            editForm.style.display = 'none';
            freshEdit.style.display = 'inline-block';

            // Notify parent to keep local cache in sync
            if (onPhoneUpdate) onPhoneUpdate(studentId, 'father_phone', phone);

        } catch (err) {
            alert('Failed to save: ' + (err.message || 'Unknown error'));
        } finally {
            freshSave.disabled = false;
            freshSave.textContent = 'Save';
        }
    });
}

// ── Mother Phone Edit ─────────────────────────────────────────────────────────

function setupMotherPhoneEdit(studentId, currentPhone, onPhoneUpdate) {
    const editBtn = document.getElementById('btnEditMotherPhone');
    const editForm = document.getElementById('sdMotherPhoneEdit');
    const input = document.getElementById('sdMotherPhoneInput');
    const saveBtn = document.getElementById('btnSaveMotherPhone');
    const cancelBtn = document.getElementById('btnCancelMotherPhone');

    if (!editBtn || !editForm || !saveBtn) return;

    input.value = currentPhone || '';

    [editBtn, saveBtn, cancelBtn].forEach(btn => {
        const clone = btn.cloneNode(true);
        btn.parentNode.replaceChild(clone, btn);
    });

    const freshEdit = document.getElementById('btnEditMotherPhone');
    const freshSave = document.getElementById('btnSaveMotherPhone');
    const freshCancel = document.getElementById('btnCancelMotherPhone');
    const freshInput = document.getElementById('sdMotherPhoneInput');

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
                .update({ mother_phone: phone || null })
                .eq('id', studentId);
            if (error) throw error;

            const display = document.getElementById('sdMotherPhone');
            const waLink = document.getElementById('sdMotherWaLink');
            if (display) display.textContent = phone || 'Not set';
            if (waLink) {
                if (phone) {
                    waLink.href = `https://wa.me/91${phone}`;
                    waLink.style.display = 'inline-block';
                } else {
                    waLink.style.display = 'none';
                }
            }
            editForm.style.display = 'none';
            freshEdit.style.display = 'inline-block';

            // Notify parent to keep local cache in sync
            if (onPhoneUpdate) onPhoneUpdate(studentId, 'mother_phone', phone);

        } catch (err) {
            alert('Failed to save: ' + (err.message || 'Unknown error'));
        } finally {
            freshSave.disabled = false;
            freshSave.textContent = 'Save';
        }
    });
}
