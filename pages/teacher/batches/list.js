async function loadBatches() {
    const tbody = document.getElementById('batchesTableBody');
    const status = document.getElementById('batchesListStatus');
    const btnRefresh = document.getElementById('btnRefreshBatches');

    if (!tbody || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Refreshing...';
    window.tableLoading('batchesTableBody', 6, 'Loading batches...');

    const batchRes = await window.api.get('batches', {}, '*, classes(type, day_of_week, class_date, start_time)');

    btnRefresh.disabled = false;
    btnRefresh.textContent = 'Refresh List';

    if (batchRes.success) {
        const activeGrade = window.getActiveGrade();
        const batchData = activeGrade
            ? (batchRes.data || []).filter(b => b.grade === activeGrade)
            : (batchRes.data || []);

        if (batchData.length > 0) {
            const countRes = await window.api.get('batch_students', {}, 'batch_id');
            const counts = {};
            if (countRes.success && countRes.data) {
                countRes.data.forEach(bs => {
                    counts[bs.batch_id] = (counts[bs.batch_id] || 0) + 1;
                });
            }

            tbody.innerHTML = [...batchData].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(batch => {
                let scheduleStr = 'No schedule';
                if (batch.classes && batch.classes.length > 0) {
                    const regularClasses = batch.classes.filter(c => c.type === 'regular');
                    if (regularClasses.length > 0) {
                        const schedParts = regularClasses.map(c => `${window.DAYS[c.day_of_week]} ${window.formatTime(c.start_time)}`);
                        scheduleStr = [...new Set(schedParts)].join(', ');
                    }
                }

                return `
                <tr class="data-table__row">
                    <td class="data-table__td--main">${window.esc(batch.name) || '-'}</td>
                    <td class="data-table__td">${batch.subject || '-'}</td>
                    <td class="data-table__td">${batch.grade || '-'}</td>
                    <td class="data-table__td"><div class="text-truncate" style="max-width:200px;" title="${scheduleStr}">${scheduleStr}</div></td>
                    <td class="data-table__td"><span class="badge">${counts[batch.id] || 0}</span></td>
                    <td class="data-table__td">
                        <button class="btn btn--primary btn--sm" data-action="manage" data-id="${batch.id}" data-name="${window.esc(batch.name) || ''}">Manage</button>
                    </td>
                </tr>`;
            }).join('');
        } else {
            window.tableLoading('batchesTableBody', 6, 'No batches created yet.');
        }
    } else {
        document.getElementById('batchesTableBody').innerHTML = '';
        window.showStatus('batchesListStatus', batchRes.error || 'Failed to load batches.', 'error');
    }
}

export function init() {
    loadBatches();

    const btnRefresh = document.getElementById('btnRefreshBatches');
    if (btnRefresh) btnRefresh.addEventListener('click', loadBatches);

    const tbody = document.getElementById('batchesTableBody');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action="manage"]');
            if (btn) {
                window._pendingBatch = { id: btn.dataset.id, name: btn.dataset.name };
                window.loadPage('page-batches', 'detail');
            }
        });
    }
}

export function refresh() {
    loadBatches();
}
