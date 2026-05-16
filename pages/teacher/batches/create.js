const user = window.auth.getUser();

export function init() {
    window.populateGradePills('batchGrade', false);

    const form = document.getElementById('batchForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnCreateBatch');
        const btnText = document.getElementById('btnCreateBatchText');
        const btnSpinner = document.getElementById('btnCreateBatchSpinner');
        const status = document.getElementById('batchFormStatus');

        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-block';
        btn.disabled = true;
        status.style.display = 'none';

        const subjectCheckboxes = document.querySelectorAll('input[name="batchSubjects"]:checked');
        const subjects = Array.from(subjectCheckboxes).map(cb => cb.value).join(', ');

        const response = await window.api.post('batches', {
            name: document.getElementById('batchName').value.trim(),
            subject: subjects,
            grade: window.getSelectedGrade('batchGrade'),
            created_by: user.id
        });

        btnText.style.display = 'inline-block';
        btnSpinner.style.display = 'none';
        btn.disabled = false;

        if (response.success) {
            window.showStatus('batchFormStatus', 'Batch created successfully!', 'success');
            window.safeFormReset(form);
        } else {
            window.showStatus('batchFormStatus', response.error || 'Failed to create batch.', 'error');
        }
    });
}
