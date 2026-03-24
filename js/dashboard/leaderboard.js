async function loadRankings() {
    const btnRefresh = document.getElementById('btnRefreshLeaderboard');
    if (btnRefresh) { btnRefresh.disabled = true; btnRefresh.textContent = 'Refreshing...'; }

    document.getElementById('leaderboardStatus').className = 'status';
    window.tableLoading('lb11A', 5, 'Loading...');
    window.tableLoading('lb11C', 5, 'Loading...');
    window.tableLoading('lb12A', 5, 'Loading...');
    window.tableLoading('lb12C', 5, 'Loading...');

    const res = await window.api.get('student_rankings', {}, '*', { order: 'rank', ascending: true });

    if (btnRefresh) { btnRefresh.disabled = false; btnRefresh.textContent = 'Refresh'; }

    if (!res.success) {
        window.showStatus('leaderboardStatus', res.error || 'Failed to load rankings.', 'error');
        return;
    }

    const all = res.data || [];
    const byKey = {};
    all.forEach(r => {
        const key = `${r.grade}||${r.subject}`;
        if (!byKey[key]) byKey[key] = [];
        byKey[key].push(r);
    });

    const get = (grade, subject) => byKey[`${grade}||${subject}`] || [];

    renderTable(get(_Grade11, _Subject_Accounts), 'lb11A', 'avg11A');
    renderTable(get(_Grade11, _Subject_Commerce), 'lb11C', 'avg11C');
    renderTable(get(_Grade12, _Subject_Accounts), 'lb12A', 'avg12A');
    renderTable(get(_Grade12, _Subject_Commerce), 'lb12C', 'avg12C');
}

function renderTable(rows, tbodyId, avgId) {
    const tbody = document.getElementById(tbodyId);
    const avgEl = document.getElementById(avgId);

    const classAvg = rows.find(r => r.class_avg != null)?.class_avg;
    avgEl.textContent = classAvg != null
        ? `Class avg: ${classAvg}% · ${rows.filter(r => r.tests_taken > 0).length} ranked`
        : 'No data yet';

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-text">No students.</td></tr>';
        return;
    }

    const sorted = [...rows].sort((a, b) => {
        if (a.final_score === null) return 1;
        if (b.final_score === null) return -1;
        return Number(a.rank) - Number(b.rank);
    });

    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

    tbody.innerHTML = sorted.map(r => {
        const rankDisplay = r.final_score !== null
            ? `${medals[r.rank] ? medals[r.rank] + ' ' : ''}${r.rank}`
            : '—';
        const score = r.final_score !== null ? `${r.final_score}%` : '—';
        const avg = r.avg_percentage !== null ? `${r.avg_percentage}%` : '—';

        return `
            <tr class="data-table__row">
                <td class="data-table__td" style="font-weight:600;">${rankDisplay}</td>
                <td class="data-table__td--main">${r.name}</td>
                <td class="data-table__td" style="font-weight:600;">${score}</td>
                <td class="data-table__td" style="color:var(--gray-500);">${avg}</td>
                <td class="data-table__td">${r.tests_taken}</td>
            </tr>
        `;
    }).join('');
}

function applyGradeVisibility() {
    const teacherGrade = window.auth.getUser()?.grade;
    if (!teacherGrade || teacherGrade === 'All Grades') return;

    const col11 = document.getElementById('leaderboardCol11');
    const col12 = document.getElementById('leaderboardCol12');
    const grid = document.getElementById('leaderboardColumns');

    if (teacherGrade === _Grade11 && col12) col12.style.display = 'none';
    if (teacherGrade === _Grade12 && col11) col11.style.display = 'none';

    if (grid) grid.classList.add('leaderboard-grid--single');
}

export function init() {
    applyGradeVisibility();
    loadRankings();
    document.getElementById('btnRefreshLeaderboard')?.addEventListener('click', loadRankings);
}

export function refresh() {
    loadRankings();
}
