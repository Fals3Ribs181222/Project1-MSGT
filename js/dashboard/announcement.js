const user = window.auth.getUser();

async function loadAnnouncements() {
    const tbody = document.getElementById('announcementsTableBody');
    const status = document.getElementById('announcementsListStatus');
    const btnRefresh = document.getElementById('btnRefreshAnnouncements');

    if (!tbody || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Refreshing...';
    status.style.display = 'none';
    tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Loading announcements...</td></tr>';

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
            tbody.innerHTML = '<tr><td colspan="4" class="loading-text">No announcements posted yet.</td></tr>';
        }
    } else {
        tbody.innerHTML = '';
        status.textContent = response.error || 'Failed to load announcements.';
        status.className = 'status status--error';
        status.style.display = 'block';
    }
}

async function loadAnnouncementComponent() {
    try {
        const response = await fetch('components/add_announcement');
        if (response.ok) {
            const html = await response.text();
            const container = document.getElementById('addAnnouncementContainer');
            if (container) {
                container.innerHTML = html;
                attachAnnouncementListeners();
            }
        }
    } catch (err) {
        console.error('Error loading announcement component:', err);
    }
}

function attachAnnouncementListeners() {
    const form = document.getElementById('noticeForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnNotice');
        const status = document.getElementById('noticeStatus');

        btn.disabled = true;
        btn.textContent = 'Posting...';
        status.className = 'status';

        const response = await window.api.post('announcements', {
            title: document.getElementById('noticeTitle').value,
            message: document.getElementById('noticeMessage').value,
            grade: document.getElementById('noticeGrade').value,
            posted_by: user.id
        });

        btn.disabled = false;
        btn.textContent = 'Post Announcement';

        if (response.success) {
            status.textContent = 'Announcement posted successfully!';
            status.className = 'status status--success';
            e.target.reset();
            loadAnnouncements();
        } else {
            status.textContent = response.error || 'Failed to post.';
            status.className = 'status status--error';
        }
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
