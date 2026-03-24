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
                    <td class="data-table__td--main">${ann.title || '-'}</td>
                    <td class="data-table__td">${ann.grade || 'All'}</td>
                    <td class="data-table__td">${ann.created_at ? new Date(ann.created_at).toLocaleDateString() : '-'}</td>
                    <td class="data-table__td">${ann.posted_by || '-'}</td>
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
    await window.loadComponent('add_announcement', 'addAnnouncementContainer', attachAnnouncementListeners);
}

function attachAnnouncementListeners() {
    const form = document.getElementById('noticeForm');
    if (!form) return;

    window.populateGradeSelect('noticeGrade');
    window.lockGradeSelect('noticeGrade');

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
        const grade = document.getElementById('noticeGrade').value;
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
                        .select('id, name, phone, parent_phone')
                        .eq('role', 'student');

                    if (grade) {
                        query = query.eq('grade', grade);
                    }

                    const { data: students } = await query;

                    if (students && students.length > 0) {
                        // Resolve parent recipients
                        const recipients = [];
                        students.forEach(s => {
                            const r = window.whatsapp.resolveRecipients(s, 'both');
                            recipients.push(...r);
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
                                waStatus.textContent = 'No parent phone numbers found.';
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
