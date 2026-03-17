// Require student role
const user = auth.requireRole('student');
document.getElementById('studentName').textContent = user.name;
document.getElementById('studentClassInfo').textContent = `Grade: ${user.grade || 'N/A'} | Subjects: ${user.subjects || 'N/A'}`;

let allFiles = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    fetchRank();
    document.getElementById('filterSubject').addEventListener('change', renderFiles);
    document.getElementById('searchTitle').addEventListener('input', renderFiles);
});

async function fetchRank() {
    const rankRes = await api.get('student_rankings', { student_id: user.id }, '*', { single: true });
    if (!rankRes.success || !rankRes.data) return;

    const r = rankRes.data;
    if (!r.tests_taken || r.avg_percentage === null) return;

    // Count ranked students in the same grade for "X out of Y"
    const allRes = await api.get('student_rankings', { grade: r.grade });
    const total = allRes.success ? allRes.data.filter(s => s.tests_taken > 0).length : null;

    const rankEl = document.getElementById('statRank');
    const labelEl = document.getElementById('statRankLabel');
    const wrapEl = document.getElementById('statRankWrap');

    if (rankEl && labelEl && wrapEl) {
        rankEl.textContent = `#${r.rank}`;
        labelEl.textContent = total ? `of ${total} students` : 'Global Rank';
        wrapEl.style.display = '';
        document.getElementById('studentPerfCard').classList.add('perf-card--visible');
    }
}

async function fetchData() {
    // Fetch Files filtered by Grade
    const fileRes = await api.get('files', { grade: user.grade });
    if (fileRes.success) {
        allFiles = fileRes.data;

        const subjects = new Set();
        allFiles.forEach(f => { if (f.subject) subjects.add(f.subject); });
        const filterSubj = document.getElementById('filterSubject');
        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = s;
            filterSubj.appendChild(opt);
        });

        renderFiles();
    } else {
        document.getElementById('materialsList').innerHTML = `<div class="loading-text">Error: ${fileRes.error}</div>`;
    }

    // Fetch Announcements (Specific grade + 'All')
    // Note: Since api.get only handles basic eq, we'll fetch all and filter client side or use a custom query
    const annRes = await api.get('announcements');
    const annList = document.getElementById('announcementsList');
    if (annRes.success) {
        const arr = annRes.data.filter(a => !a.grade || a.grade === 'All' || a.grade === user.grade).reverse();
        annList.innerHTML = '';

        if (arr.length === 0) annList.innerHTML = '<div class="loading-text">No new announcements.</div>';

        arr.forEach(a => {
            const item = document.createElement('article');
            item.className = 'notice-list__item';
            item.innerHTML = `
                <h4>${a.title}</h4>
                <p class="notice-list__meta">${new Date(a.created_at).toLocaleDateString()}</p>
                <p class="notice-list__body">${a.message}</p>
            `;
            annList.appendChild(item);
        });
    } else {
        annList.innerHTML = `<div class="loading-text">Error: ${annRes.error}</div>`;
    }

    // Fetch all tests for student's grade
    const testsRes = await api.get('tests', { grade: user.grade });
    // Fetch student's marks
    const marksRes = await api.get('marks', { student_id: user.id });
    const tbody = document.getElementById('testsTableBody');

    if (testsRes.success) {
        const allTests = testsRes.data.reverse();
        const marksMap = {};

        // Build a lookup of marks by test_id
        if (marksRes.success) {
            marksRes.data.forEach(m => { marksMap[m.test_id] = m; });
        }

        // Calculate Performance Stats (only for graded tests)
        let totalPercent = 0;
        let bestPercent = 0;
        let gradedCount = 0;

        allTests.forEach(test => {
            const mark = marksMap[test.id];
            if (mark) {
                gradedCount++;
                const earned = Number(mark.marks_obtained);
                const max = Number(test.max_marks) || 100;
                const percent = (earned / max) * 100;
                totalPercent += percent;
                if (percent > bestPercent) bestPercent = percent;
            }
        });

        if (gradedCount > 0) {
            document.getElementById('statTestsTaken').textContent = gradedCount;
            document.getElementById('statAvgMarks').textContent = Math.round(totalPercent / gradedCount) + '%';
            document.getElementById('statBestScore').textContent = Math.round(bestPercent) + '%';
            document.getElementById('studentPerfCard').classList.add('perf-card--visible');
        }

        if (allTests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-text">No tests scheduled for your grade yet.</td></tr>';
        } else {
            tbody.innerHTML = allTests.map(test => {
                const mark = marksMap[test.id];
                const earnedDisplay = mark
                    ? `<span class="data-table__score">${mark.marks_obtained}</span>`
                    : `<span style="color: var(--gray-500); font-style: italic;">Not graded yet</span>`;
                const metaDate = new Date(test.date).toLocaleDateString();

                return `
                    <tr class="data-table__row">
                        <td class="data-table__td">${metaDate}</td>
                        <td class="data-table__td">${test.subject || '-'}</td>
                        <td class="data-table__td--main">${test.title || 'Untitled Test'}</td>
                        <td class="data-table__td">${test.max_marks || '-'}</td>
                        <td class="data-table__td">${earnedDisplay}</td>
                    </tr>
                `;
            }).join('');
        }
    } else {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Failed to load tests.</td></tr>';
    }
}

function renderFiles() {
    const list = document.getElementById('materialsList');
    const subj = document.getElementById('filterSubject').value;
    const search = document.getElementById('searchTitle').value.toLowerCase();

    const filtered = allFiles.filter(f => {
        const matchSubj = subj === '' || f.subject === subj;
        const matchSearch = search === '' || String(f.title).toLowerCase().includes(search);
        return matchSubj && matchSearch;
    });

    list.innerHTML = '';

    if (filtered.length === 0) {
        list.innerHTML = '<div class="loading-text">No materials found.</div>';
        return;
    }

    filtered.reverse().forEach(f => {
        const item = document.createElement('article');
        item.className = 'material-list__item';

        const metaDate = new Date(f.created_at).toLocaleDateString();

        item.innerHTML = `
            <div class="material-list__info">
                <h4>${f.title}</h4>
                <div class="material-list__meta">
                    <span>📘 ${f.subject}</span>
                    <span>📅 ${metaDate}</span>
                </div>
            </div>
            <a href="${f.file_url}" target="_blank" class="btn btn--primary btn--sm">View / Download</a>
        `;

        list.appendChild(item);
    });
}
