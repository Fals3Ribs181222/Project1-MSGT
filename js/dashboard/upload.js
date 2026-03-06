const user = window.auth.getUser();

// Load Materials List handler
async function loadMaterials() {
    const tbody = document.getElementById('materialsTableBody');
    const status = document.getElementById('materialsListStatus');
    const btnRefresh = document.getElementById('btnRefreshMaterials');

    if (!tbody || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Refreshing...';
    status.style.display = 'none';
    tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Loading materials...</td></tr>';

    const response = await window.api.get('files');

    btnRefresh.disabled = false;
    btnRefresh.textContent = 'Refresh List';

    if (response.success) {
        if (response.data && response.data.length > 0) {
            tbody.innerHTML = response.data.map(file => `
                <tr class="data-table__row">
                    <td class="data-table__td--main">${file.title || '-'}</td>
                    <td class="data-table__td">${file.subject || '-'}</td>
                    <td class="data-table__td">${file.grade || 'All'}</td>
                    <td class="data-table__td">${file.created_at ? new Date(file.created_at).toLocaleDateString() : '-'}</td>
                    <td class="data-table__td">${file.uploaded_by || '-'}</td>
                    <td class="data-table__td"><a href="${file.file_url || '#'}" target="_blank" class="navbar__link">View</a></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="loading-text">No materials uploaded yet.</td></tr>';
        }
    } else {
        tbody.innerHTML = '';
        status.textContent = response.error || 'Failed to load materials.';
        status.className = 'status status--error';
        status.style.display = 'block';
    }
}

// Load Upload Component HTML
async function loadUploadComponent() {
    try {
        const response = await fetch('components/add_upload.html');
        if (response.ok) {
            const html = await response.text();
            const container = document.getElementById('addUploadContainer');
            if (container) {
                container.innerHTML = html;
                attachUploadListeners();
            }
        } else {
            console.error('Failed to load upload component: HTTP Status', response.status);
        }
    } catch (err) {
        console.error('Error loading upload component:', err);
    }
}

function attachUploadListeners() {
    const form = document.getElementById('uploadForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnUpload');
        const status = document.getElementById('uploadStatus');
        const fileInput = document.getElementById('fileInput');

        if (fileInput.files.length === 0) return;
        const file = fileInput.files[0];

        btn.disabled = true;
        btn.textContent = 'Uploading...';
        status.className = 'status';

        try {
            // 1. Upload to Supabase Storage
            const filePath = `materials/${Date.now()}_${file.name}`;
            const { data: storageData, error: storageError } = await window.supabaseClient
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
                uploaded_by: user.id
            };

            const response = await window.api.post('files', payload);

            if (response.success) {
                status.textContent = 'File uploaded successfully!';
                status.className = 'status status--success';
                e.target.reset();
                loadMaterials();
            } else {
                throw new Error(response.error);
            }
        } catch (err) {
            console.error('Upload Error:', err);
            status.textContent = err.message || 'Failed to upload.';
            status.className = 'status status--error';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Upload Material';
        }
    });
}

export function init() {
    loadMaterials();
    loadUploadComponent();

    const btnRefresh = document.getElementById('btnRefreshMaterials');
    if (btnRefresh) btnRefresh.addEventListener('click', loadMaterials);

    // Pill Toggle Logic for Upload Tab
    const pillView = document.getElementById('pillViewMaterials');
    const pillAdd = document.getElementById('pillAddUpload');
    const listContainer = document.getElementById('materialsListContainer');
    const addContainer = document.getElementById('addUploadContainer');

    if (pillView && pillAdd) {
        pillView.addEventListener('click', () => {
            pillView.classList.add('pill-toggle__btn--active');
            pillAdd.classList.remove('pill-toggle__btn--active');
            if (listContainer) listContainer.style.display = 'block';
            if (addContainer) addContainer.style.display = 'none';
            if (btnRefresh) btnRefresh.style.display = 'inline-block';
        });

        pillAdd.addEventListener('click', () => {
            pillAdd.classList.add('pill-toggle__btn--active');
            pillView.classList.remove('pill-toggle__btn--active');
            if (addContainer) addContainer.style.display = 'block';
            if (listContainer) listContainer.style.display = 'none';
            if (btnRefresh) btnRefresh.style.display = 'none';
        });
    }
}

export function refresh() {
    loadMaterials();
}
