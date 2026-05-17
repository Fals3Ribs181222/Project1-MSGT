let _allBatches = [];
let _allCounts = {};

function gradeKey(grade) {
    if (!grade) return 'other';
    if (grade.includes('11')) return '11';
    if (grade.includes('12')) return '12';
    return 'other';
}

function renderCards(batches, counts) {
    const container = document.getElementById('batchesCardsContainer');
    const countEl = document.getElementById('batchesCount');
    if (!container) return;

    if (countEl) countEl.textContent = `${batches.length} batch${batches.length !== 1 ? 'es' : ''}`;

    if (!batches.length) {
        container.innerHTML = `
            <div class="batch-empty">
                <i class="ri-team-line"></i>
                <p>No batches found.</p>
                <button class="btn btn--primary btn--sm" onclick="window.loadPage('page-batches', 'create')" style="display:inline-flex;align-items:center;gap:0.35rem;">
                    <i class="ri-add-circle-line"></i> Create First Batch
                </button>
            </div>`;
        return;
    }

    container.innerHTML = batches.map(batch => {
        let scheduleStr = '';
        if (batch.classes && batch.classes.length > 0) {
            const regularClasses = batch.classes.filter(c => c.type === 'regular');
            if (regularClasses.length > 0) {
                const schedParts = regularClasses.map(c => `${window.DAYS[c.day_of_week]} ${window.formatTime(c.start_time)}`);
                scheduleStr = [...new Set(schedParts)].join(', ');
            }
        }

        const gk = gradeKey(batch.grade);
        const count = counts[batch.id] || 0;

        return `
        <div class="batch-card" role="listitem" data-batch-id="${batch.id}" data-batch-name="${window.esc(batch.name)}">
            <div class="batch-card__header">
                <span class="batch-card__name">${window.esc(batch.name) || '—'}</span>
                <span class="batch-card__grade batch-card__grade--${gk}">${window.esc(batch.grade) || '—'}</span>
            </div>
            <div class="batch-card__subject">
                <i class="ri-book-2-line" aria-hidden="true"></i>${window.esc(batch.subject) || 'No subject'}
            </div>
            <div class="batch-card__footer">
                <span class="batch-card__stat"><i class="ri-group-line" aria-hidden="true"></i> ${count} student${count !== 1 ? 's' : ''}</span>
                <span class="batch-card__sched" title="${scheduleStr}">${scheduleStr || '—'}</span>
            </div>
        </div>`;
    }).join('');
}

async function loadBatches() {
    const container = document.getElementById('batchesCardsContainer');
    const btnRefresh = document.getElementById('btnRefreshBatches');
    const countEl = document.getElementById('batchesCount');

    if (!container) return;

    if (btnRefresh) { btnRefresh.disabled = true; btnRefresh.innerHTML = '<i class="ri-refresh-line"></i> Refreshing…'; }
    container.innerHTML = '<p class="loading-text" style="grid-column:1/-1;">Loading batches…</p>';
    if (countEl) countEl.textContent = '';

    const batchRes = await window.api.get('batches', {}, '*, classes(type, day_of_week, class_date, start_time)');

    if (btnRefresh) { btnRefresh.disabled = false; btnRefresh.innerHTML = '<i class="ri-refresh-line"></i> Refresh'; }

    if (!batchRes.success) {
        container.innerHTML = '<p class="loading-text" style="grid-column:1/-1;">Failed to load batches.</p>';
        window.showStatus('batchesListStatus', batchRes.error || 'Failed to load batches.', 'error');
        return;
    }

    const activeGrade = window.getActiveGrade();
    let batchData = activeGrade
        ? (batchRes.data || []).filter(b => b.grade === activeGrade)
        : (batchRes.data || []);
    batchData = [...batchData].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const countRes = await window.api.get('batch_students', {}, 'batch_id');
    _allCounts = {};
    if (countRes.success && countRes.data) {
        countRes.data.forEach(bs => {
            _allCounts[bs.batch_id] = (_allCounts[bs.batch_id] || 0) + 1;
        });
    }

    _allBatches = batchData;
    renderCards(_allBatches, _allCounts);

    const searchInput = document.getElementById('batchesSearch');
    if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = () => {
            const q = searchInput.value.toLowerCase();
            const filtered = q
                ? _allBatches.filter(b =>
                    (b.name || '').toLowerCase().includes(q) ||
                    (b.subject || '').toLowerCase().includes(q) ||
                    (b.grade || '').toLowerCase().includes(q))
                : _allBatches;
            renderCards(filtered, _allCounts);
        };
    }
}

export function init() {
    loadBatches();

    document.getElementById('btnRefreshBatches')?.addEventListener('click', loadBatches);

    document.getElementById('batchesCardsContainer')?.addEventListener('click', e => {
        const card = e.target.closest('.batch-card[data-batch-id]');
        if (card && !e.target.closest('button')) {
            window._pendingBatch = { id: card.dataset.batchId, name: card.dataset.batchName };
            window.loadPage('page-batches', 'detail');
        }
    });
}

export function refresh() {
    loadBatches();
}
