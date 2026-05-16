// js/dashboard/student-detail-charts.js
// Pure render helpers for the student detail attendance calendar and trend chart.

export function renderAttendanceCalendar(attendanceData) {
    const container = document.getElementById('sdAttendanceCalendar');
    if (!container) return;

    if (!attendanceData || attendanceData.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No attendance records yet.</p>';
        return;
    }

    const datedRecords = attendanceData.filter(a => a.date);
    if (datedRecords.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No dated records found.</p>';
        return;
    }

    const statusMap = {};
    datedRecords.forEach(a => { statusMap[a.date] = a.status; });

    const classDays = Object.keys(statusMap).sort();

    const colorMap = {
        present: '#00A36C',
        late: '#C48A14',
        absent: '#C41230',
    };

    const dots = classDays.map(d => {
        const status = statusMap[d];
        const color = colorMap[status] || '#ccc';
        const label = new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return `<div title="${label} · ${status}"
            style="width:14px;height:14px;border-radius:3px;background:${color};cursor:default;flex-shrink:0;"></div>`;
    }).join('');

    container.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:0.25rem 0;">
            ${dots}
        </div>
        <div style="display:flex;gap:1.25rem;margin-top:0.75rem;font-size:0.78rem;color:var(--text-muted);">
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#00A36C;margin-right:3px;vertical-align:middle;"></span>Present</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#C48A14;margin-right:3px;vertical-align:middle;"></span>Late</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#C41230;margin-right:3px;vertical-align:middle;"></span>Absent</span>
        </div>
    `;
}

export function renderTrendChart(marks) {
    const container = document.getElementById('sdTrendChart');
    if (!container) return;

    if (!marks || marks.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No test data to plot yet.</p>';
        return;
    }

    const sorted = [...marks].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const BAR_MAX_H = 80;

    const bars = sorted.map(m => {
        const pct = m.max_marks > 0 ? Math.round((m.marks_obtained / m.max_marks) * 100) : 0;
        const height = Math.max(4, Math.round((pct / 100) * BAR_MAX_H));
        const color = pct >= 75 ? '#00A36C' : pct >= 50 ? '#C48A14' : '#C41230';
        const label = (m.title || '').length > 10 ? m.title.substring(0, 10) + '…' : (m.title || '-');
        return `
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:44px;max-width:80px;">
                <span style="font-size:0.75rem;font-weight:600;color:${color};">${pct}%</span>
                <div style="width:100%;height:${BAR_MAX_H}px;display:flex;align-items:flex-end;">
                    <div style="width:100%;height:${height}px;background:${color};border-radius:4px 4px 0 0;"></div>
                </div>
                <span style="font-size:0.68rem;color:var(--text-muted);text-align:center;line-height:1.3;word-break:break-word;">${window.esc(label)}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="display:flex;align-items:flex-end;gap:6px;padding:0.5rem 0 0;overflow-x:auto;">
            ${bars}
        </div>
        <p style="font-size:0.78rem;color:var(--text-muted);margin-top:0.5rem;">Each bar = one test · left to right by date</p>
    `;
}
