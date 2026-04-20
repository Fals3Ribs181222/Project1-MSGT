const user = window.auth.getUser();

// Generic table loader for files filtered by upload_type
async function loadFileList({ tbodyId, btnRefreshId, uploadType, emptyMsg }) {
    const tbody = document.getElementById(tbodyId);
    const btnRefresh = document.getElementById(btnRefreshId);
    if (!tbody) return;

    if (btnRefresh) { btnRefresh.disabled = true; btnRefresh.textContent = 'Refreshing...'; }
    window.tableLoading(tbodyId, 5, `Loading…`);

    const response = await window.api.get('files', { upload_type: uploadType });

    if (btnRefresh) { btnRefresh.disabled = false; btnRefresh.textContent = 'Refresh List'; }

    const teacherGrade = user.grade;
    let files = response.data || [];
    if (teacherGrade && teacherGrade !== 'All Grades') {
        files = files.filter(f => !f.grade || f.grade === '' || f.grade === teacherGrade);
    }

    tbody.innerHTML = files.length > 0
        ? files.map(file => `
        <tr class="data-table__row">
            <td class="data-table__td--main">${window.esc(file.title) || '-'}</td>
            <td class="data-table__td">${file.subject || '-'}</td>
            <td class="data-table__td">${file.grade || 'All'}</td>
            <td class="data-table__td">${file.created_at ? new Date(file.created_at).toLocaleDateString() : '-'}</td>
            <td class="data-table__td"><a href="${window.safeUrl(file.file_url)}" target="_blank" class="navbar__link">View</a></td>
        </tr>`).join('')
        : `<tr><td colspan="5" class="loading-text">${emptyMsg}</td></tr>`;
}

async function loadMaterials() {
    return loadFileList({
        tbodyId: 'materialsTableBody',
        btnRefreshId: 'btnRefreshMaterials',
        uploadType: 'student',
        emptyMsg: 'No student materials uploaded yet.',
    });
}

async function loadAiMaterials() {
    return loadFileList({
        tbodyId: 'aiMaterialsTableBody',
        btnRefreshId: 'btnRefreshAiMaterials',
        uploadType: 'ai',
        emptyMsg: 'No AI training materials uploaded yet.',
    });
}

async function loadTests() {
    return loadFileList({
        tbodyId: 'testsTableBody',
        btnRefreshId: 'btnRefreshTests',
        uploadType: 'test',
        emptyMsg: 'No tests saved yet. Generate a test in AI Tools and click "Save to Materials".',
    });
}

async function loadMaterialComponent() {
    await window.loadComponent('modals/add_material.html', 'addMaterialContainer', attachMaterialListeners);
}

function attachMaterialListeners() {
    const form = document.getElementById('uploadForm');
    if (!form) return;

    window.populateGradeSelect('fileGrade');
    window.lockGradeSelect('fileGrade');

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
            const subjectCheckboxes = document.querySelectorAll('input[name="fileSubjects"]:checked');
            const subjects = Array.from(subjectCheckboxes).map(cb => cb.value).join(', ');

            const payload = {
                title: document.getElementById('fileTitle').value,
                subject: subjects,
                grade: document.getElementById('fileGrade').value,
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
                            window.showStatus('uploadStatus', `✅ Uploaded & indexed ${result.chunks_indexed} chunks for AI!`, 'success');
                        } else {
                            console.warn('⚠️ Indexing failed:', result.error);
                            window.showStatus('uploadStatus', 'File uploaded, but AI indexing failed.', 'error');
                        }
                    }).catch(err => {
                        console.warn('⚠️ Indexing error:', err);
                        window.showStatus('uploadStatus', 'File uploaded, but AI indexing failed.', 'error');
                    });
                } else {
                    window.showStatus('uploadStatus', '✅ File uploaded for students!', 'success');
                }

                window.safeFormReset(e.target);
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

export function init() {
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

    function showOnly(active, visible) {
        pills.forEach(p => p?.classList.remove('pill-toggle__btn--active'));
        active?.classList.add('pill-toggle__btn--active');
        containers.forEach((c, i) => { if (c) c.style.display = visible[i] ? 'block' : 'none'; });
        if (btnRefresh) btnRefresh.style.display = visible[0] ? 'inline-block' : 'none';
    }

    pillView?.addEventListener('click',  () => showOnly(pillView,  [true,  false, false, false]));
    pillAi?.addEventListener('click',    () => { showOnly(pillAi,  [false, true,  false, false]); loadAiMaterials(); });
    pillTests?.addEventListener('click', () => { showOnly(pillTests,[false, false, true,  false]); loadTests(); });
    pillAdd?.addEventListener('click',   () => showOnly(pillAdd,   [false, false, false, true]));
}

export function refresh() {
    loadMaterials();
}
