let user;

export async function init() {
    user = window.auth.getUser();
    await loadLeaderboard();
    document.getElementById('btnRefreshStudentLB')?.addEventListener('click', loadLeaderboard);
}

export async function refresh() {
    await loadLeaderboard();
}

async function loadLeaderboard() {
    window.tableLoading('studentLBBody', 5, 'Loading rankings...');
    window.showStatus('studentLBStatus', '', 'success');

    const res = await window.api.get('student_rankings', { grade: user.grade }, '*', { order: 'rank', ascending: true });

    if (!res.success) {
        window.showStatus('studentLBStatus', res.error || 'Failed to load rankings.', 'error');
        return;
    }

    const rows = res.data || [];

    // Sort: ranked first (final_score not null), then unranked
    const sorted = [...rows].sort((a, b) => {
        if (a.final_score === null) return 1;
        if (b.final_score === null) return -1;
        return Number(a.rank) - Number(b.rank);
    });

    // My row
    const myRow = sorted.find(r => r.student_id === user.id);
    const totalRanked = sorted.filter(r => r.tests_taken > 0).length;

    if (myRow) {
        document.getElementById('myRankValue').textContent = myRow.final_score !== null ? `#${myRow.rank}` : '—';
        document.getElementById('myRankLabel').textContent = totalRanked ? `of ${totalRanked} students` : 'Your Rank';
        document.getElementById('myScoreValue').textContent = myRow.final_score !== null ? myRow.final_score + '%' : '—';
        document.getElementById('myAvgValue').textContent = myRow.avg_percentage !== null ? myRow.avg_percentage + '%' : '—';
        document.getElementById('myTestsValue').textContent = myRow.tests_taken || 0;
        const card = document.getElementById('myRankCard');
        if (card) { card.style.display = ''; card.classList.add('perf-card--visible'); }
    }

    // Class average
    const classAvg = sorted.find(r => r.class_avg != null)?.class_avg;
    const avgEl = document.getElementById('lbClassAvg');
    if (avgEl) {
        avgEl.textContent = classAvg != null
            ? `Class average: ${classAvg}% · ${totalRanked} student${totalRanked !== 1 ? 's' : ''} ranked`
            : '';
    }

    // Table
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const tbody = document.getElementById('studentLBBody');

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-text">No rankings yet.</td></tr>';
        return;
    }

    tbody.innerHTML = sorted.map(r => {
        const isMe = r.student_id === user.id;
        const rankDisplay = r.final_score !== null
            ? `${medals[r.rank] ? medals[r.rank] + ' ' : ''}${r.rank}`
            : '—';
        const score = r.final_score !== null ? r.final_score + '%' : '—';
        const avg = r.avg_percentage !== null ? r.avg_percentage + '%' : '—';
        const nameCell = isMe
            ? `<strong>${window.esc(r.name || '—')}</strong> <span style="color:var(--primary);font-size:0.8rem;">(You)</span>`
            : window.esc(r.name || '—');

        return `<tr class="data-table__row${isMe ? ' data-table__row--highlight' : ''}">
            <td class="data-table__td" style="font-weight:600;">${rankDisplay}</td>
            <td class="data-table__td--main">${nameCell}</td>
            <td class="data-table__td" style="font-weight:600;">${score}</td>
            <td class="data-table__td" style="color:var(--gray-500);">${avg}</td>
            <td class="data-table__td">${r.tests_taken || 0}</td>
        </tr>`;
    }).join('');
}
