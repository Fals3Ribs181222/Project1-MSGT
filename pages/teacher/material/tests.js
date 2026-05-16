async function deleteFile(fileId, fileUrl) {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    try {
        const urlObj = new URL(fileUrl);
        const storagePath = decodeURIComponent(urlObj.pathname.split('/object/public/materials/')[1]);
        await window.supabaseClient.storage.from('materials').remove([storagePath]);
        const result = await window.api.delete('files', fileId);
        if (!result.success) throw new Error(result.error);
        loadTests();
    } catch (err) {
        alert('Failed to delete: ' + (err.message || 'Unknown error'));
    }
}

async function loadTests() {
    const tbody = document.getElementById('testsTableBody');
    const btnRefresh = document.getElementById('btnRefreshTests');
    if (!tbody) return;

    if (btnRefresh) { btnRefresh.disabled = true; btnRefresh.textContent = 'Refreshing...'; }
    window.tableLoading('testsTableBody', 6, 'Loading…');

    const response = await window.api.get('files', { upload_type: 'test' });

    if (btnRefresh) { btnRefresh.disabled = false; btnRefresh.textContent = 'Refresh List'; }

    const activeGrade = window.getActiveGrade();
    let files = response.data || [];
    if (activeGrade) files = files.filter(f => !f.grade || f.grade === '' || f.grade === activeGrade);

    tbody.innerHTML = files.length > 0
        ? files.map(file => `
        <tr class="data-table__row" data-file-id="${window.esc(file.id)}" data-file-url="${window.esc(file.file_url)}">
            <td class="data-table__td--main">${window.esc(file.title) || '-'}</td>
            <td class="data-table__td">${file.subject || '-'}</td>
            <td class="data-table__td">${file.grade || 'All'}</td>
            <td class="data-table__td">${file.created_at ? new Date(file.created_at).toLocaleDateString() : '-'}</td>
            <td class="data-table__td"><a href="${window.safeUrl(file.file_url)}" target="_blank" class="btn btn--outline btn--sm" style="text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem;"><i class="ri-external-link-line"></i> View</a></td>
            <td class="data-table__td"><button class="btn btn--danger btn--sm btn-delete-file">Delete</button></td>
        </tr>`).join('')
        : `<tr><td colspan="6" class="empty-state" style="padding:2.5rem;"><i class="ri-inbox-2-line" style="font-size:2rem;display:block;margin-bottom:0.5rem;opacity:0.35;"></i>No Tests uploaded yet.</td></tr>`;

    tbody.querySelectorAll('.btn-delete-file').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = btn.closest('tr');
            deleteFile(row.dataset.fileId, row.dataset.fileUrl);
        });
    });
}

export function init() {
    loadTests();
    const btnRefresh = document.getElementById('btnRefreshTests');
    if (btnRefresh) btnRefresh.addEventListener('click', loadTests);
}

export function refresh() {
    loadTests();
}
