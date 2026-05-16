const user = window.auth.getUser();

async function deleteFile(fileId, fileUrl, uploadType) {
    if (!confirm('Delete this file? This cannot be undone.')) return;

    try {
        // Extract storage path from public URL
        const urlObj = new URL(fileUrl);
        const storagePath = decodeURIComponent(urlObj.pathname.split('/object/public/materials/')[1]);

        // For AI materials, delete associated chunks first
        if (uploadType === 'ai') {
            await window.api.deleteMany('material_chunks', { file_id: fileId });
        }

        // Delete from storage
        await window.supabaseClient.storage.from('materials').remove([storagePath]);

        // Delete from files table
        const result = await window.api.delete('files', fileId);
        if (!result.success) throw new Error(result.error);

        // Refresh the appropriate list
        if (uploadType === 'student') loadMaterials();
        else if (uploadType === 'ai') loadAiMaterials();
        else if (uploadType === 'test') loadTests();
    } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to delete: ' + (err.message || 'Unknown error'));
    }
}

// Generic table loader for files filtered by upload_type
async function loadFileList({ tbodyId, btnRefreshId, uploadType, emptyMsg }) {
    const tbody = document.getElementById(tbodyId);
    const btnRefresh = document.getElementById(btnRefreshId);
    if (!tbody) return;

    if (btnRefresh) { btnRefresh.disabled = true; btnRefresh.textContent = 'Refreshing...'; }
    window.tableLoading(tbodyId, 6, `Loading…`);

    const response = await window.api.get('files', { upload_type: uploadType });

    if (btnRefresh) { btnRefresh.disabled = false; btnRefresh.textContent = 'Refresh List'; }

    const activeGrade = window.getActiveGrade();
    let files = response.data || [];
    if (activeGrade) files = files.filter(f => !f.grade || f.grade === '' || f.grade === activeGrade);

    tbody.innerHTML = files.length > 0
        ? files.map(file => `
        <tr class="data-table__row" data-file-id="${window.esc(file.id)}" data-file-url="${window.esc(file.file_url)}" data-upload-type="${window.esc(file.upload_type)}">
            <td class="data-table__td--main">${window.esc(file.title) || '-'}</td>
            <td class="data-table__td">${file.subject || '-'}</td>
            <td class="data-table__td">${file.grade || 'All'}</td>
            <td class="data-table__td">${file.created_at ? new Date(file.created_at).toLocaleDateString() : '-'}</td>
            <td class="data-table__td"><a href="${window.safeUrl(file.file_url)}" target="_blank" class="btn btn--outline btn--sm" style="text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem;"><i class="ri-external-link-line"></i> View</a></td>
            <td class="data-table__td"><button class="btn btn--danger btn--sm btn-delete-file">Delete</button></td>
        </tr>`).join('')
        : `<tr><td colspan="6" class="empty-state" style="padding:2.5rem;"><i class="ri-inbox-2-line" style="font-size:2rem;display:block;margin-bottom:0.5rem;opacity:0.35;"></i>${emptyMsg}</td></tr>`;

    tbody.querySelectorAll('.btn-delete-file').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = btn.closest('tr');
            deleteFile(row.dataset.fileId, row.dataset.fileUrl, row.dataset.uploadType);
        });
    });
}

async function loadMaterials() {
    return loadFileList({
        tbodyId: 'materialsTableBody',
        btnRefreshId: 'btnRefreshMaterials',
        uploadType: 'student',
        emptyMsg: 'No notes uploaded yet.',
    });
}

async function loadAiMaterials() {
    return loadFileList({
        tbodyId: 'aiMaterialsTableBody',
        btnRefreshId: 'btnRefreshAiMaterials',
        uploadType: 'ai',
        emptyMsg: 'No AI Training Resources uploaded yet.',
    });
}

async function loadTests() {
    return loadFileList({
        tbodyId: 'testsTableBody',
        btnRefreshId: 'btnRefreshTests',
        uploadType: 'test',
        emptyMsg: 'No Tests uploaded yet.',
    });
}

async function loadMaterialComponent() {
    await window.loadComponent('modals/add_material.html', 'addMaterialContainer', attachMaterialListeners);
}

function attachMaterialListeners() {
    const form = document.getElementById('uploadForm');
    if (!form) return;

    window.populateGradePills('fileGrade', false);

    // Drag-and-drop on upload zone
    const zone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const fileNameLabel = document.getElementById('selectedFileName');
    if (zone && fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0 && fileNameLabel) {
                fileNameLabel.textContent = fileInput.files[0].name;
                fileNameLabel.style.display = 'block';
            }
        });
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('form__upload-zone--dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('form__upload-zone--dragover'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('form__upload-zone--dragover');
            if (e.dataTransfer.files.length > 0) {
                const dt = new DataTransfer();
                dt.items.add(e.dataTransfer.files[0]);
                fileInput.files = dt.files;
                if (fileNameLabel) { fileNameLabel.textContent = e.dataTransfer.files[0].name; fileNameLabel.style.display = 'block'; }
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnUpload');
        const status = document.getElementById('uploadStatus');
        const fileInput = document.getElementById('fileInput');

        if (fileInput.files.length === 0) return;
        const file = fileInput.files[0];

        const uploadType = document.querySelector('input[name="uploadType"]:checked')?.value || 'student';

        if (uploadType === 'ai') {
            const allowedExtensions = ['.pdf', '.txt', '.md'];
            const isAllowed = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
            if (!isAllowed) {
                window.showStatus('uploadStatus', 'AI Training only supports PDF, TXT, or MD files. Please choose a supported file.', 'error');
                return;
            }
        }

        btn.disabled = true;
        btn.textContent = 'Uploading...';
        status.className = 'status';

        try {
            // 1. Upload to Supabase Storage
            const filePath = `materials/${Date.now()}_${file.name}`;
            const { error: storageError } = await window.supabaseClient
                .storage
                .from('materials')
                .upload(filePath, file);

            if (storageError) throw storageError;

            // 2. Get Public URL
            const { data: { publicUrl } } = window.supabaseClient
                .storage
                .from('materials')
                .getPublicUrl(filePath);

            // 3. Insert into files table
            const subjects = document.querySelector('input[name="fileSubjects"]:checked')?.value || '';

            const payload = {
                title: document.getElementById('fileTitle').value,
                subject: subjects,
                grade: window.getSelectedGrade('fileGrade'),
                file_url: publicUrl,
                upload_type: uploadType,
                uploaded_by: user.id
            };

            const response = await window.api.post('files', payload);

            if (response.success) {
                // Trigger RAG indexing only for AI training uploads
                const fileId = response.data?.id;
                if (uploadType === 'ai' && fileId) {
                    window.showStatus('uploadStatus', 'File uploaded & indexing for AI...', 'success');
                    const { data: { session } } = await window.supabaseClient.auth.getSession();
                    fetch(`${CONFIG.SUPABASE_URL}/functions/v1/index-material`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({
                            file_id: fileId,
                            file_url: publicUrl,
                            subject: payload.subject,
                            grade: payload.grade,
                            teacher_id: user.id
                        })
                    }).then(res => res.json()).then(result => {
                        if (result.success) {
                            window.showStatus('uploadStatus', `Uploaded & indexed ${result.chunks_indexed} chunks for AI!`, 'success');
                        } else {
                            console.warn('⚠️ Indexing failed:', result.error);
                            window.showStatus('uploadStatus', 'File uploaded, but AI indexing failed.', 'error');
                        }
                    }).catch(err => {
                        console.warn('⚠️ Indexing error:', err);
                        window.showStatus('uploadStatus', 'File uploaded, but AI indexing failed.', 'error');
                    });
                } else {
                    window.showStatus('uploadStatus', 'File uploaded for students!', 'success');
                }

                window.safeFormReset(e.target);
                const fnLabel = document.getElementById('selectedFileName');
                if (fnLabel) { fnLabel.textContent = ''; fnLabel.style.display = 'none'; }
                loadMaterials();
            } else {
                throw new Error(response.error);
            }
        } catch (err) {
            console.error('Upload Error:', err);
            window.showStatus('uploadStatus', err.message || 'Failed to upload.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Upload Material';
        }
    });
}

export function init(tabSlug) {
    loadMaterials();
    loadMaterialComponent();

    const btnRefresh          = document.getElementById('btnRefreshMaterials');
    const btnRefreshAi        = document.getElementById('btnRefreshAiMaterials');
    const btnRefreshTests     = document.getElementById('btnRefreshTests');
    if (btnRefresh)      btnRefresh.addEventListener('click', loadMaterials);
    if (btnRefreshAi)    btnRefreshAi.addEventListener('click', loadAiMaterials);
    if (btnRefreshTests) btnRefreshTests.addEventListener('click', loadTests);

    // Pill Toggle Logic
    const pillView   = document.getElementById('pillViewMaterials');
    const pillAi     = document.getElementById('pillViewAiMaterials');
    const pillTests  = document.getElementById('pillViewTests');
    const pillAdd    = document.getElementById('pillAddMaterial');
    const pills      = [pillView, pillAi, pillTests, pillAdd];

    const listContainer      = document.getElementById('materialsListContainer');
    const aiListContainer    = document.getElementById('aiMaterialsListContainer');
    const testsContainer     = document.getElementById('testsListContainer');
    const addContainer       = document.getElementById('addMaterialContainer');
    const containers         = [listContainer, aiListContainer, testsContainer, addContainer];

    const tabTitle = document.getElementById('materialsTabTitle');

    function showOnly(active, visible, title, slug) {
        pills.forEach(p => p?.classList.remove('tab-pill-selector__btn--active'));
        active?.classList.add('tab-pill-selector__btn--active');
        containers.forEach((c, i) => { if (c) c.style.display = visible[i] ? 'block' : 'none'; });
        if (btnRefresh) btnRefresh.style.display = visible[0] ? 'inline-block' : 'none';
        if (tabTitle && title) tabTitle.textContent = title;
        if (slug) {
            const pageSlug = location.hash.slice(1).split('#')[0];
            history.replaceState(null, '', `${location.search}#${pageSlug}#${slug}`);
        }
    }

    pillView?.addEventListener('click',  () => showOnly(pillView,  [true,  false, false, false], 'Notes', 'student_materials'));
    pillAi?.addEventListener('click',    () => { showOnly(pillAi,  [false, true,  false, false], 'AI Training Resources', 'ai_training_files'); loadAiMaterials(); });
    pillTests?.addEventListener('click', () => { showOnly(pillTests,[false, false, true,  false], 'Tests',             'saved_tests'); loadTests(); });
    pillAdd?.addEventListener('click',   () => showOnly(pillAdd,   [false, false, false, true],  'Upload Resources',  'upload_material'));
    // Activate tab from URL slug on initial load
    if (tabSlug) activateTab(tabSlug);
}


export function activateTab(tabSlug) {
    const _map = {
        'student_materials': 'pillViewMaterials',
        'ai_training_files': 'pillViewAiMaterials', 'ai_materials': 'pillViewAiMaterials',
        'saved_tests': 'pillViewTests', 'tests_material': 'pillViewTests',
        'upload_material': 'pillAddMaterial', 'upload_new': 'pillAddMaterial',
    };
    const pillId = _map[tabSlug] || _map['student_materials'];
    const pill = document.getElementById(pillId);
    if (pill) pill.click();
}
export function refresh() {
    loadMaterials();
}
