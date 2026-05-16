// js/dashboard/student-detail-ranks.js
// Async fetch of rank data and re-render of the marks table with rank column populated.

export async function fetchAndRenderRanks(studentId, marksData, testMap) {
    if (!marksData || marksData.length === 0) return;

    const testIds = marksData.map(m => m.test_id);

    try {
        const { data: allMarks } = await window.supabaseClient
            .from('marks')
            .select('student_id, test_id, marks_obtained')
            .in('test_id', testIds);

        if (!allMarks) return;

        const rankMap = {};
        testIds.forEach(tid => {
            rankMap[tid] = allMarks
                .filter(m => m.test_id === tid)
                .map(m => Number(m.marks_obtained) || 0)
                .sort((a, b) => b - a);
        });

        marksData.sort((a, b) => {
            const dateA = testMap[a.test_id]?.date || '';
            const dateB = testMap[b.test_id]?.date || '';
            return dateA.localeCompare(dateB);
        });

        const tbody = document.getElementById('studentMarksBody');
        if (!tbody) return;

        tbody.innerHTML = marksData.map(m => {
            const test = testMap[m.test_id] || {};
            const myScore = Number(m.marks_obtained) || 0;
            const pct = test.max_marks > 0 ? Math.round((myScore / test.max_marks) * 100) : 0;
            const pctColor = pct >= 75
                ? 'color:#00A36C;font-weight:600;'
                : pct >= 50
                    ? 'color:#C48A14;font-weight:600;'
                    : 'color:#C41230;font-weight:600;';

            const scores = rankMap[m.test_id] || [];
            const rank = scores.indexOf(myScore) + 1;
            const total = scores.length;
            const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
            const rankLabel = total > 0 ? `${rank}${suffix} / ${total}` : '-';
            const rankColor = rank === 1
                ? 'color:#00A36C;font-weight:600;'
                : rank <= 3
                    ? 'color:#C48A14;font-weight:600;'
                    : 'color:var(--text-muted);';

            return `
                <tr class="data-table__row">
                    <td class="data-table__td--main">${window.esc(test.title) || '-'}</td>
                    <td class="data-table__td">${window.esc(test.subject) || '-'}</td>
                    <td class="data-table__td"><strong>${m.marks_obtained || '-'}</strong></td>
                    <td class="data-table__td">${test.max_marks || '-'}</td>
                    <td class="data-table__td" style="${pctColor}">${pct}%</td>
                    <td class="data-table__td" style="${rankColor}font-size:0.85rem;">${rankLabel}</td>
                    <td class="data-table__td">${test.date ? new Date(test.date).toLocaleDateString('en-IN') : '-'}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Rank fetch error:', err);
    }
}
