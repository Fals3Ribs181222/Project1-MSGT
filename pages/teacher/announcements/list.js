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
        const activeGrade = window.getActiveGrade();
        let anns = (response.data || []).reverse();
        if (activeGrade) anns = anns.filter(a => !a.grade || a.grade === activeGrade);

        if (anns.length > 0) {
            tbody.innerHTML = anns.map(ann => `
                <tr class="data-table__row">
                    <td class="data-table__td--main">${window.esc(ann.title) || '-'}</td>
                    <td class="data-table__td">${ann.grade || 'All'}</td>
                    <td class="data-table__td">${ann.created_at ? new Date(ann.created_at).toLocaleDateString() : '-'}</td>
                    <td class="data-table__td">${window.esc(ann.posted_by) || '-'}</td>
                </tr>`).join('');
        } else {
            window.tableLoading('announcementsTableBody', 4, 'No announcements posted yet.');
        }
    } else {
        tbody.innerHTML = '';
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
