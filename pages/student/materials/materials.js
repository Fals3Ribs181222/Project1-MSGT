let user, allFiles;

export async function init() {
    user = window.auth.getUser();
    await loadMaterials();
    document.getElementById('btnRefreshMaterials')?.addEventListener('click', loadMaterials);
    document.getElementById('matSearchInput')?.addEventListener('input', renderFiles);
}

export async function refresh() {
    await loadMaterials();
}

async function loadMaterials() {
    const list = document.getElementById('materialsList');
    if (list) list.innerHTML = '<div class="loading-text">Loading materials...</div>';
    window.showStatus('materialsStatus', '', 'success');

    const res = await window.api.get('files', { grade: user.grade, upload_type: 'student' });
    if (!res.success) {
        window.showStatus('materialsStatus', res.error || 'Failed to load materials.', 'error');
        return;
    }

    allFiles = res.data || [];

    const studentSubjects = (user.subjects || '').split(',').map(s => s.trim()).filter(Boolean);
    if (studentSubjects.length > 0) {
        allFiles = allFiles.filter(f => {
            if (!f.subject) return true;
            const fileSubjs = f.subject.split(',').map(s => s.trim());
            if (fileSubjs.some(s => s.toLowerCase() === 'commerce')) return true;
            return fileSubjs.some(s => studentSubjects.includes(s));
        });
    }

    // Build subject pill filters — include Commerce for all students if Commerce files exist
    const pillsEl = document.getElementById('matSubjectPills');
    if (pillsEl && studentSubjects.length) {
        const pillSubjects = [...studentSubjects];
        const hasCommerce = allFiles.some(f => f.subject &&
            f.subject.split(',').map(s => s.trim()).some(s => s.toLowerCase() === 'commerce'));
        if (hasCommerce && !pillSubjects.some(s => s.toLowerCase() === 'commerce')) {
            pillSubjects.push('Commerce');
        }

        const defaultSubject = pillSubjects.find(s => s.toLowerCase() === 'accounts') || pillSubjects[0];
        pillsEl.innerHTML = pillSubjects.map(s => {
            const active = s === defaultSubject ? ' tab-pill-selector__btn--active' : '';
            return `<button type="button" class="tab-pill-selector__btn${active}" data-subject="${window.esc(s)}">${window.esc(s)}</button>`;
        }).join('');
        pillsEl.querySelectorAll('.tab-pill-selector__btn').forEach(btn => {
            btn.addEventListener('click', () => {
                pillsEl.querySelectorAll('.tab-pill-selector__btn').forEach(b => b.classList.remove('tab-pill-selector__btn--active'));
                btn.classList.add('tab-pill-selector__btn--active');
                renderFiles();
            });
        });
    }

    renderFiles();
}

function renderFiles() {
    const list = document.getElementById('materialsList');
    if (!list) return;

    const activeBtn = document.querySelector('#matSubjectPills .tab-pill-selector__btn--active');
    const subj = activeBtn?.dataset.subject || '';
    const search = (document.getElementById('matSearchInput')?.value || '').toLowerCase();

    const filtered = allFiles.filter(f => {
        const matchSubj = !subj || f.subject === subj;
        const matchSearch = !search || String(f.title).toLowerCase().includes(search);
        return matchSubj && matchSearch;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div class="loading-text">No materials found.</div>';
        return;
    }

    list.innerHTML = '';
    [...filtered].reverse().forEach(f => {
        const item = document.createElement('article');
        item.className = 'material-list__item';

        const metaDate = new Date(f.created_at).toLocaleDateString('en-IN');

        item.innerHTML = `
            <div class="material-list__info">
                <h4>${window.esc(f.title)}</h4>
                <div class="material-list__meta">
                    <span>📘 ${window.esc(f.subject || '—')}</span>
                    <span>📅 ${metaDate}</span>
                </div>
            </div>
        `;

        const btn = document.createElement('button');
        btn.className = 'btn btn--primary btn--sm';
        btn.textContent = 'View / Download';
        btn.addEventListener('click', () => window.open(window.safeUrl(f.file_url), '_blank', 'noopener'));

        item.appendChild(btn);
        list.appendChild(item);
    });
}
