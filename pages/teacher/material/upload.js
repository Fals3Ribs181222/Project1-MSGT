const user = window.auth.getUser();

export function init() {
    window.populateGradePills('fileGrade', false);

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

    const form = document.getElementById('uploadForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnUpload');
        const file = document.getElementById('fileInput').files[0];
        if (!file) return;

        const uploadType = document.querySelector('input[name="uploadType"]:checked')?.value || 'student';

        if (uploadType === 'ai') {
            const allowed = ['.pdf', '.txt', '.md'];
            if (!allowed.some(ext => file.name.toLowerCase().endsWith(ext))) {
                window.showStatus('uploadStatus', 'AI Training only supports PDF, TXT, or MD files.', 'error');
                return;
            }
        }

        btn.disabled = true;
        btn.textContent = 'Uploading...';

        try {
            const filePath = `materials/${Date.now()}_${file.name}`;
            const { error: storageError } = await window.supabaseClient.storage.from('materials').upload(filePath, file);
            if (storageError) throw storageError;

            const { data: { publicUrl } } = window.supabaseClient.storage.from('materials').getPublicUrl(filePath);

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
            if (!response.success) throw new Error(response.error);

            const fileId = response.data?.id;
            if (uploadType === 'ai' && fileId) {
                window.showStatus('uploadStatus', 'File uploaded & indexing for AI...', 'success');
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                fetch(`${CONFIG.SUPABASE_URL}/functions/v1/index-material`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                    body: JSON.stringify({ file_id: fileId, file_url: publicUrl, subject: payload.subject, grade: payload.grade, teacher_id: user.id })
                }).then(res => res.json()).then(result => {
                    if (result.success) {
                        window.showStatus('uploadStatus', `Uploaded & indexed ${result.chunks_indexed} chunks for AI!`, 'success');
                    } else {
                        window.showStatus('uploadStatus', 'File uploaded, but AI indexing failed.', 'error');
                    }
                }).catch(() => {
                    window.showStatus('uploadStatus', 'File uploaded, but AI indexing failed.', 'error');
                });
            } else {
                window.showStatus('uploadStatus', 'File uploaded for students!', 'success');
            }

            window.safeFormReset(e.target);
            if (fileNameLabel) { fileNameLabel.textContent = ''; fileNameLabel.style.display = 'none'; }
        } catch (err) {
            window.showStatus('uploadStatus', err.message || 'Failed to upload.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Upload Material';
        }
    });
}
