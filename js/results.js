let allResults = [];

const AVATAR_COLORS = [
    { bg: 'rgba(30, 58, 95, 0.13)',  color: '#1E3A5F' },
    { bg: 'rgba(176, 80, 40, 0.13)', color: '#B05028' },
    { bg: 'rgba(16, 120, 90, 0.12)', color: '#0D7858' },
    { bg: 'rgba(120, 60, 150, 0.12)',color: '#784096' },
    { bg: 'rgba(196, 138, 20, 0.12)',color: '#A07010' },
];

function nameToColorIndex(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % AVATAR_COLORS.length;
}

function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

function getRingColor(pct) {
    if (pct >= 90) return '#10b981';
    if (pct >= 75) return '#1E3A5F';
    if (pct >= 50) return '#C48A14';
    return '#B83232';
}

function getAchievementBadge(pct, maxMarks, marks) {
    if (marks === maxMarks) {
        return `<span class="achievement-badge achievement-badge--perfect">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            Perfect Score
        </span>`;
    }
    if (pct >= 90) {
        return `<span class="achievement-badge achievement-badge--distinction">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>
            Distinction
        </span>`;
    }
    if (pct >= 75) {
        return `<span class="achievement-badge achievement-badge--merit">Merit</span>`;
    }
    return '';
}

document.addEventListener('DOMContentLoaded', () => {
    renderSkeleton();
    loadResults();
    animateCounters();

    document.getElementById('filterSubject').addEventListener('change', renderResults);
    document.getElementById('filterYear').addEventListener('change', renderResults);
    document.getElementById('searchName').addEventListener('input', renderResults);
});

function animateCounters() {
    const els = document.querySelectorAll('[data-count]');
    if (!els.length) return;

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const target = parseInt(el.dataset.count);
            const suffix = el.dataset.suffix || '';
            const duration = 1100;
            const startTime = performance.now();

            function step(now) {
                const progress = Math.min((now - startTime) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                el.textContent = Math.round(eased * target).toLocaleString() + suffix;
                if (progress < 1) requestAnimationFrame(step);
            }

            requestAnimationFrame(step);
            observer.unobserve(el);
        });
    }, { threshold: 0.6 });

    els.forEach(el => observer.observe(el));
}

function renderSkeleton() {
    document.getElementById('resultsGrid').innerHTML =
        Array.from({ length: 6 }, () => `<div class="skel-card"></div>`).join('');
}

async function loadResults() {
    const response = await api.get('board_results');

    if (response.success) {
        allResults = response.data.map(br => {
            const max = Number(br.max_marks) || 100;
            const obtained = Number(br.marks_obtained);
            return {
                studentName: br.student_name || 'Anonymous',
                subject: br.subject || '-',
                marks: obtained,
                maxMarks: max,
                percent: parseFloat(((obtained / max) * 100).toFixed(1)),
                year: br.passing_year || '-',
            };
        });

        populateFilters();
        renderResults();
    } else {
        document.getElementById('resultsGrid').innerHTML = `
            <div class="results-empty">
                <i class="ri-error-warning-line results-empty__icon" aria-hidden="true"></i>
                <div class="results-empty__title">Couldn't load results</div>
                <div class="results-empty__sub">${escapeHtml(response.error || 'Unknown error')}</div>
            </div>
        `;
    }
}

function populateFilters() {
    const subjects = new Set();
    const years = new Set();

    allResults.forEach(item => {
        if (item.subject && item.subject !== '-') subjects.add(item.subject);
        if (item.year && item.year !== '-') years.add(item.year);
    });

    const subjSelect = document.getElementById('filterSubject');
    subjects.forEach(s => {
        const o = document.createElement('option');
        o.value = s; o.textContent = s;
        subjSelect.appendChild(o);
    });

    const yearSelect = document.getElementById('filterYear');
    [...years].sort((a, b) => b - a).forEach(y => {
        const o = document.createElement('option');
        o.value = y; o.textContent = y;
        yearSelect.appendChild(o);
    });
}

function renderResults() {
    const subjectFilter = document.getElementById('filterSubject').value;
    const yearFilter    = document.getElementById('filterYear').value;
    const searchFilter  = document.getElementById('searchName').value.toLowerCase().trim();

    const filtered = allResults
        .filter(item => {
            const matchSubj = !subjectFilter || item.subject === subjectFilter;
            const matchYear = !yearFilter    || String(item.year) === yearFilter;
            const matchName = !searchFilter  || item.studentName.toLowerCase().includes(searchFilter);
            return matchSubj && matchYear && matchName;
        })
        .sort((a, b) => b.percent - a.percent);

    const podiumEl   = document.getElementById('resultsPodium');
    const countBadge = document.getElementById('resultsCountBadge');
    const grid       = document.getElementById('resultsGrid');

    countBadge.textContent = filtered.length;

    const showPodium = !searchFilter && filtered.length >= 3;
    podiumEl.hidden = !showPodium;
    if (showPodium) renderPodium(filtered.slice(0, 3));

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="results-empty">
                <i class="ri-search-line results-empty__icon" aria-hidden="true"></i>
                <div class="results-empty__title">No results found</div>
                <div class="results-empty__sub">Try adjusting your filters or searching a different name.</div>
            </div>
        `;
        return;
    }

    const gridItems = showPodium ? filtered.slice(3) : filtered;
    grid.innerHTML = gridItems.map((item, i) => {
        const rank = showPodium ? i + 4 : i + 1;
        return renderCard(item, rank);
    }).join('');
}

function renderPodium(top3) {
    // Classic podium order: 2nd left, 1st centre, 3rd right
    const slots = [top3[1], top3[0], top3[2]];
    const meta  = [
        { rank: 2, cardCls: 'podium-card--2', badgeCls: 'podium-rank-badge--silver' },
        { rank: 1, cardCls: 'podium-card--1', badgeCls: 'podium-rank-badge--gold'   },
        { rank: 3, cardCls: 'podium-card--3', badgeCls: 'podium-rank-badge--bronze' },
    ];

    document.getElementById('resultsPodium').innerHTML = `
        <div class="section-divider" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            Top Performers
        </div>
        <div class="podium-grid" role="list">
            ${slots.map((item, i) => {
                if (!item) return '';
                const m = meta[i];
                const { bg, color } = AVATAR_COLORS[nameToColorIndex(item.studentName)];
                const badge = getAchievementBadge(item.percent, item.maxMarks, item.marks);
                return `
                    <div class="podium-card ${m.cardCls}" role="listitem"
                         aria-label="Rank ${m.rank}: ${escapeHtml(item.studentName)}, ${item.percent}%">
                        <div class="podium-ribbon" aria-hidden="true"></div>
                        <span class="podium-rank-badge ${m.badgeCls}" aria-hidden="true">${m.rank}</span>
                        <span class="podium-year-tag">${item.year}</span>
                        <div class="podium-avatar" style="background:${bg};color:${color};"
                             aria-hidden="true">${getInitials(item.studentName)}</div>
                        <div class="podium-name">${escapeHtml(item.studentName)}</div>
                        <span class="podium-subject">${escapeHtml(item.subject)}</span>
                        <div class="podium-score">${item.percent}%</div>
                        <div class="podium-raw">${item.marks} / ${item.maxMarks}</div>
                        ${badge ? `<div style="margin-top:0.5rem;">${badge}</div>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderCard(item, rank) {
    const { bg, color } = AVATAR_COLORS[nameToColorIndex(item.studentName)];
    const ringColor = getRingColor(item.percent);
    const badge     = getAchievementBadge(item.percent, item.maxMarks, item.marks);

    const rankDisplay = rank === 1
        ? `<span class="rank-medal rank-medal--gold"   aria-label="1st">1</span>`
        : rank === 2
        ? `<span class="rank-medal rank-medal--silver" aria-label="2nd">2</span>`
        : rank === 3
        ? `<span class="rank-medal rank-medal--bronze" aria-label="3rd">3</span>`
        : `<span class="rank-num" aria-label="Rank ${rank}">${rank}</span>`;

    return `
        <div class="result-card" aria-label="${escapeHtml(item.studentName)}, ${item.percent}%">
            <div class="result-card__header">
                ${rankDisplay}
                <span class="result-card__year">${item.year}</span>
            </div>
            <div class="result-card__body">
                <div class="result-avatar" style="background:${bg};color:${color};"
                     aria-hidden="true">${getInitials(item.studentName)}</div>
                <div class="result-card__info">
                    <div class="result-card__name">${escapeHtml(item.studentName)}</div>
                    <span class="result-subject-pill">${escapeHtml(item.subject)}</span>
                </div>
            </div>
            <div class="result-card__score-wrap">
                <div class="score-ring"
                     style="--pct:${item.percent};--ring-color:${ringColor};"
                     aria-hidden="true">
                    <div class="score-ring__inner">
                        <span class="score-ring__pct">${item.percent}%</span>
                        <span class="score-ring__raw">${item.marks}/${item.maxMarks}</span>
                    </div>
                </div>
                <div class="score-detail">
                    <div class="score-detail__marks">${item.marks}<span style="font-size:0.8em;font-weight:500;color:var(--text-muted);"> / ${item.maxMarks}</span></div>
                    <div class="score-detail__out-of">marks obtained</div>
                    ${badge}
                </div>
            </div>
        </div>
    `;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
