import { callAdminApi } from './admin-utils.js';

async function loadStats() {
    const statusEl = document.getElementById('overviewStatus');
    statusEl.style.display = 'none';

    const ids = ['statTotalStudents', 'statGrade11', 'statGrade12', 'statTotalTests', 'statAttendanceRate', 'statWAMessages'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '…'; });

    try {
        const { stats } = await callAdminApi('get_stats');

        document.getElementById('statTotalStudents').textContent = stats.totalStudents;
        document.getElementById('statGrade11').textContent = stats.grade11Count;
        document.getElementById('statGrade12').textContent = stats.grade12Count;
        document.getElementById('statTotalTests').textContent = stats.totalTests;
        document.getElementById('statAttendanceRate').textContent =
            stats.attendanceRate !== null ? `${stats.attendanceRate}%` : '—';
        document.getElementById('statWAMessages').textContent = stats.waMessagesSent;
    } catch (err) {
        statusEl.textContent = `Error: ${err.message}`;
        statusEl.className = 'status status--error';
        statusEl.style.display = 'block';
    }
}

export function init() {
    loadStats();
    document.getElementById('btnRefreshOverview')?.addEventListener('click', loadStats);
}

export function refresh() {
    loadStats();
}
