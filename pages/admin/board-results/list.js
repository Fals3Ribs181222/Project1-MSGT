async function loadBoardResults() {
    const tbody = document.getElementById('boardResultsTableBody');
    const status = document.getElementById('boardResultsListStatus');
    const btnRefresh = document.getElementById('btnRefreshBoardResults');
    if (!tbody || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Refreshing...';
    window.tableLoading('boardResultsTableBody', 6, 'Loading board results...');

    const response = await window.api.get('board_results');

    btnRefresh.disabled = false;
    btnRefresh.textContent = 'Refresh List';

    if (response.success) {
        if (response.data && response.data.length > 0) {
            tbody.innerHTML = response.data.reverse().map(br => `
                <tr class="data-table__row">
                    <td class="data-table__td--main">${window.esc(br.student_name) || '-'}</td>
                    <td class="data-table__td">${window.esc(br.subject) || '-'}</td>
                    <td class="data-table__td">${br.marks_obtained}</td>
                    <td class="data-table__td">${br.max_marks}</td>
                    <td class="data-table__td">${br.passing_year}</td>
                    <td class="data-table__td">
                        <button class="btn btn--danger btn--sm" onclick="deleteBoardResult('${br.id}')">Delete</button>
                    </td>
                </tr>
            `).join('');
        } else {
            window.tableLoading('boardResultsTableBody', 6, 'No board results found.');
        }
    } else {
        tbody.innerHTML = '';
        window.showStatus('boardResultsListStatus', response.error || 'Failed to load board results.', 'error');
    }
}

window.deleteBoardResult = async function (id) {
    if (!confirm('Are you sure you want to delete this board result?')) return;
    const { error } = await window.supabaseClient.from('board_results').delete().eq('id', id);
    if (error) {
        alert('Failed to delete: ' + error.message);
    } else {
        loadBoardResults();
    }
};

export function init() {
    loadBoardResults();
    document.getElementById('btnRefreshBoardResults')?.addEventListener('click', loadBoardResults);
}

export function refresh() {
    loadBoardResults();
}
