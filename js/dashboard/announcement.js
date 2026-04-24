const user = window.auth.getUser();

async function loadAnnouncements() {
    const tbody = document.getElementById('announcementsTableBody');
    const status = document.getElementById('announcementsListStatus');
    const btnRefresh = document.getElementById('btnRefreshAnnouncements');

    if (!tbody || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Refreshing...';
    window.tableLoading('announcementsTableBody', 4, 'Loading announcements...');

    const response = await window.api.get('announcements');

    btnRefresh.disabled = false;
    btnRefresh.textContent = 'Refresh List';

    if (response.success) {
        if (response.data && response.data.length > 0) {
            tbody.innerHTML = response.data.reverse().map(ann => `
                <tr class="data-table__row">
                    <td class="data-table__td--main">${window.esc(ann.title) || '-'}</td>
                    <td class="data-table__td">${ann.grade || 'All'}</td>
                    <td class="data-table__td">${ann.created_at ? new Date(ann.created_at).toLocaleDateString() : '-'}</td>
                    <td class="data-table__td">${window.esc(ann.posted_by) || '-'}</td>
                </tr>
            `).join('');
        } else {
            window.tableLoading('announcementsTableBody', 4, 'No announcements posted yet.');
        }
    } else {
        document.getElementById('announcementsTableBody').innerHTML = '';
        window.showStatus('announcementsListStatus', response.error || 'Failed to load announcements.', 'error');
    }
}

async function loadAnnouncementComponent() {
    await window.loadComponent('modals/add_announcement.html', 'addAnnouncementContainer', attachAnnouncementListeners);
}

function attachAnnouncementListeners() {
    const form = document.getElementById('noticeForm');
    if (!form) return;

    window.populateGradeSelect('noticeGrade');
    window.lockGradeSelect('noticeGrade');

    const textarea = document.getElementById('noticeMessage');
    const waCheckbox = document.getElementById('noticeWhatsApp');
    const waHint = document.getElementById('waMessageHint');
    const waCount = document.getElementById('waCharCount');

    function updateWaHints() {
        if (!waCheckbox?.checked) {
            if (waHint) waHint.style.display = 'none';
            if (waCount) waCount.style.display = 'none';
            return;
        }
        const val = textarea?.value || '';
        const hasNewlines = /[\n\r]/.test(val);
        const len = val.length;
        if (waHint) waHint.style.display = hasNewlines ? 'block' : 'none';
        if (waCount) {
            waCount.style.display = 'block';
            waCount.textContent = `${len} / 900`;
            waCount.style.color = len > 900 ? 'var(--color-error, #dc2626)' : 'var(--text-muted)';
        }
    }

    textarea?.addEventListener('input', updateWaHints);
    waCheckbox?.addEventListener('change', updateWaHints);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnNotice');
        const status = document.getElementById('noticeStatus');
        const waStatus = document.getElementById('noticeWhatsAppStatus');

        btn.disabled = true;
        btn.textContent = 'Posting...';
        status.className = 'status';
        if (waStatus) waStatus.style.display = 'none';

        const title = document.getElementById('noticeTitle').value;
        const message = document.getElementById('noticeMessage').value;
        const gradeEl = document.getElementById('noticeGrade');
        const grade = gradeEl.dataset.gradeLocked ? (user?.grade || null) : (gradeEl.value || null);
        const sendWhatsApp = document.getElementById('noticeWhatsApp')?.checked;

        const response = await window.api.post('announcements', {
            title,
            message,
            grade,
            posted_by: user.id
        });

        if (response.success) {
            window.showStatus('noticeStatus', 'Announcement posted successfully!', 'success');

            // Send via WhatsApp if checked
            if (sendWhatsApp && window.whatsapp) {
                try {
                    if (waStatus) {
                        waStatus.textContent = 'Sending WhatsApp messages...';
                        waStatus.className = 'status status--info';
                        waStatus.style.display = 'block';
                    }

                    // Fetch student profiles for the grade
                    let query = window.supabaseClient
                        .from('profiles')
                        .select('id, name, phone, father_phone, mother_phone')
                        .eq('role', 'student');

                    if (grade) {
                        query = query.eq('grade', grade);
                    }

                    const { data: students } = await query;

                    if (students && students.length > 0) {
                        // Resolve parent recipients, deduplicated by phone
                        const seen = new Set();
                        const recipients = [];
                        students.forEach(s => {
                            window.whatsapp.resolveRecipients(s, 'both').forEach(r => {
                                if (r.phone && !seen.has(r.phone)) {
                                    seen.add(r.phone);
                                    recipients.push(r);
                                }
                            });
                        });

                        if (recipients.length > 0) {
                            const result = await window.whatsapp.send({
                                type: 'announcement',
                                recipients,
                                payload: { title, message },
                                sentBy: user.id,
                            });

                            if (waStatus) {
                                waStatus.textContent = `WhatsApp: ${result.sent} sent, ${result.failed} failed`;
                                waStatus.className = result.failed > 0 ? 'status status--error' : 'status status--success';
                                waStatus.style.display = 'block';
                            }
                        } else {
                            if (waStatus) {
                                waStatus.textContent = 'No mother/father phone numbers found.';
                                waStatus.className = 'status status--error';
                                waStatus.style.display = 'block';
                            }
                        }
                    }
                } catch (waErr) {
                    if (waStatus) {
                        waStatus.textContent = 'WhatsApp failed: ' + waErr.message;
                        waStatus.className = 'status status--error';
                        waStatus.style.display = 'block';
                    }
                }
            }

            window.safeFormReset(e.target);
            loadAnnouncements();
        } else {
            window.showStatus('noticeStatus', response.error || 'Failed to post.', 'error');
        }

        btn.disabled = false;
        btn.textContent = 'Post Announcement';
    });
}

export function init() {
    loadAnnouncements();
    loadAnnouncementComponent();

    const btnRefresh = document.getElementById('btnRefreshAnnouncements');
    if (btnRefresh) btnRefresh.addEventListener('click', loadAnnouncements);

    const pillView = document.getElementById('pillViewAnnouncements');
    const pillAdd = document.getElementById('pillAddAnnouncement');
    const listContainer = document.getElementById('announcementsListContainer');
    const addContainer = document.getElementById('addAnnouncementContainer');

    if (pillView && pillAdd) {
        pillView.addEventListener('click', () => {
            pillView.classList.add('pill-toggle__btn--active');
            pillAdd.classList.remove('pill-toggle__btn--active');
            if (listContainer) listContainer.style.display = 'block';
            if (addContainer) addContainer.style.display = 'none';
            if (btnRefresh) btnRefresh.style.display = 'inline-block';
        });

        pillAdd.addEventListener('click', () => {
            pillAdd.classList.add('pill-toggle__btn--active');
            pillView.classList.remove('pill-toggle__btn--active');
            if (addContainer) addContainer.style.display = 'block';
            if (listContainer) listContainer.style.display = 'none';
            if (btnRefresh) btnRefresh.style.display = 'none';
        });
    }
}

export function refresh() {
    loadAnnouncements();
}
