let user, allFiles;

export async function init() {
    user = window.auth.getUser();

    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

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
            return f.subject.split(',').map(s => s.trim()).some(s => studentSubjects.includes(s));
        });
    }

    // Build subject pill filters, default to Accounts
    const pillsEl = document.getElementById('matSubjectPills');
    if (pillsEl && studentSubjects.length) {
        const defaultSubject = studentSubjects.find(s => s.toLowerCase() === 'accounts') || studentSubjects[0];
        pillsEl.innerHTML = studentSubjects.map(s => {
            const active = s === defaultSubject ? ' pill-toggle__btn--active' : '';
            return `<button type="button" class="pill-toggle__btn${active}" data-subject="${window.esc(s)}">${window.esc(s)}</button>`;
        }).join('');
        pillsEl.querySelectorAll('.pill-toggle__btn').forEach(btn => {
            btn.addEventListener('click', () => {
                pillsEl.querySelectorAll('.pill-toggle__btn').forEach(b => b.classList.remove('pill-toggle__btn--active'));
                btn.classList.add('pill-toggle__btn--active');
                renderFiles();
            });
        });
    }

    renderFiles();
}

function renderFiles() {
    const list = document.getElementById('materialsList');
    if (!list) return;

    const activeBtn = document.querySelector('#matSubjectPills .pill-toggle__btn--active');
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
        const isPdf = f.file_url && f.file_url.toLowerCase().endsWith('.pdf');

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

        if (isPdf && typeof pdfjsLib !== 'undefined') {
            btn.textContent = 'View';
            btn.addEventListener('click', () => openPdfViewer(f.file_url, f.title));
        } else {
            btn.textContent = 'View / Download';
            btn.addEventListener('click', () => window.open(window.safeUrl(f.file_url), '_blank', 'noopener'));
        }

        item.appendChild(btn);
        list.appendChild(item);
    });
}

function showListView() {
    document.getElementById('materialsHeader').style.display = '';
    document.getElementById('matFilterBar').style.display = '';
    document.getElementById('materialsList').style.display = '';
    document.getElementById('pdfInlineViewer').style.display = 'none';
}

function showViewerView() {
    document.getElementById('materialsHeader').style.display = 'none';
    document.getElementById('matFilterBar').style.display = 'none';
    document.getElementById('materialsList').style.display = 'none';
    document.getElementById('pdfInlineViewer').style.display = '';
}

async function openPdfViewer(url, title) {
    showViewerView();

    document.getElementById('pdfInlineTitle').textContent = title || 'Document';

    const canvasWrap = document.getElementById('pdfCanvasWrap');
    const btnBack    = document.getElementById('pdfBackBtn');

    canvasWrap.innerHTML = '<div class="pdf-modal__loading">Loading PDF\u2026</div>';

    btnBack.onclick = () => {
        showListView();
        canvasWrap.innerHTML = '';
    };

    try {
        const pdfDoc = await pdfjsLib.getDocument(url).promise;
        canvasWrap.innerHTML = '';

        const availW = canvasWrap.clientWidth - 32;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page     = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1 });
            const scale    = Math.min(availW / viewport.width, 2);
            const scaled   = page.getViewport({ scale });
            const canvas   = document.createElement('canvas');
            canvas.width   = scaled.width;
            canvas.height  = scaled.height;
            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaled }).promise;
            canvasWrap.appendChild(canvas);
        }
    } catch (err) {
        canvasWrap.innerHTML = '<div class="pdf-modal__loading">Failed to load PDF. Please try again.</div>';
        console.error('[PDF viewer] load error:', err);
    }
}
