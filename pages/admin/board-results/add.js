const user = window.auth.getUser();

export function init() {
    const form = document.getElementById('boardResultForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnAddBoardResult');
        const status = document.getElementById('boardResultStatus');

        btn.disabled = true;
        btn.textContent = 'Adding...';
        status.className = 'status';

        const response = await window.api.post('board_results', {
            student_name: document.getElementById('brStudentName').value.trim(),
            subject: document.getElementById('brSubject').value,
            marks_obtained: parseInt(document.getElementById('brMarksObtained').value),
            max_marks: parseInt(document.getElementById('brMaxMarks').value),
            passing_year: parseInt(document.getElementById('brPassingYear').value),
            created_by: user.id
        });

        btn.disabled = false;
        btn.textContent = 'Add Board Result';

        if (response.success) {
            window.showStatus('boardResultStatus', 'Board result added successfully!', 'success');
            window.safeFormReset(e.target);
            document.getElementById('brMaxMarks').value = '100';
        } else {
            window.showStatus('boardResultStatus', response.error || 'Failed to add board result.', 'error');
        }
    });
}
