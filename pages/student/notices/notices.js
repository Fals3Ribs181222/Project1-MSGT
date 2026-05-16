let user;

export async function init() {
    user = window.auth.getUser();
    await loadNotices();
    document.getElementById('btnRefreshNotices')?.addEventListener('click', loadNotices);
}

export async function refresh() {
    await loadNotices();
}

async function loadNotices() {
    const list = document.getElementById('noticesList');
    if (list) list.innerHTML = '<div class="loading-text">Loading notices...</div>';
    window.showStatus('noticesStatus', '', 'success');

    const res = await window.api.get('announcements', {}, '*', { order: 'created_at', ascending: false });
    if (!res.success) {
        window.showStatus('noticesStatus', res.error || 'Failed to load notices.', 'error');
        if (list) list.innerHTML = '';
        return;
    }

    const arr = (res.data || []).filter(a => !a.grade || a.grade === 'All' || a.grade === user.grade);

    if (!list) return;

    if (arr.length === 0) {
        list.innerHTML = '<div class="loading-text">No announcements yet.</div>';
        return;
    }

    list.innerHTML = '';
    arr.forEach(a => {
        const item = document.createElement('article');
        item.className = 'notice-list__item';
        item.innerHTML = `
            <h4>${window.esc(a.title)}</h4>
            <p class="notice-list__meta">${new Date(a.created_at).toLocaleDateString('en-IN')}</p>
            <p class="notice-list__body">${window.esc(a.message || '')}</p>
        `;
        list.appendChild(item);
    });
}
