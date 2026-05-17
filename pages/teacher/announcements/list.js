async function loadAnnouncements() {
    const list = document.getElementById('announcementsList');
    const status = document.getElementById('announcementsListStatus');
    const btnRefresh = document.getElementById('btnRefreshAnnouncements');
    if (!list || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Refreshing...';
    list.innerHTML = '<p class="bulletin-empty">Loading announcements...</p>';

    const response = await window.api.get('announcements');

    btnRefresh.disabled = false;
    btnRefresh.textContent = 'Refresh';

    if (response.success) {
        const activeGrade = window.getActiveGrade();
        let anns = (response.data || []).reverse();
        if (activeGrade) anns = anns.filter(a => !a.grade || a.grade === activeGrade);

        if (anns.length > 0) {
            list.innerHTML = anns.map(ann => `
                <div class="bulletin-card">
                    <div class="bulletin-card__pin"><i class="ri-pushpin-2-fill"></i></div>
                    <h3 class="bulletin-card__title">${window.esc(ann.title) || 'Untitled'}</h3>
                    <p class="bulletin-card__body">${window.esc(ann.message) || ''}</p>
                    <div class="bulletin-card__footer">
                        <span class="bulletin-card__date">${ann.created_at ? new Date(ann.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                        <span class="badge${ann.grade ? '' : ' badge--green'}">${ann.grade || 'All'}</span>
                    </div>
                </div>`).join('');
        } else {
            list.innerHTML = '<p class="bulletin-empty">No announcements posted yet.</p>';
        }
    } else {
        list.innerHTML = '';
        window.showStatus('announcementsListStatus', response.error || 'Failed to load announcements.', 'error');
    }
}

export function init() {
    loadAnnouncements();
    document.getElementById('btnRefreshAnnouncements')?.addEventListener('click', loadAnnouncements);
}

export function refresh() {
    loadAnnouncements();
}
