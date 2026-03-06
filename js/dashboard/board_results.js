const user = window.auth.getUser();

async function loadBoardResults() {
    const tbody = document.getElementById('boardResultsTableBody');
    const status = document.getElementById('boardResultsListStatus');
    const btnRefresh = document.getElementById('btnRefreshBoardResults');

    if (!tbody || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Refreshing...';
    status.style.display = 'none';
    tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Loading board results...</td></tr>';

    const response = await window.api.get('board_results');

    btnRefresh.disabled = false;
    btnRefresh.textContent = 'Refresh List';

    if (response.success) {
        if (response.data && response.data.length > 0) {
            tbody.innerHTML = response.data.reverse().map(br => `
                <tr class="data-table__row">
                    <td class="data-table__td--main">${br.student_name || '-'}</td>
                    <td class="data-table__td">${br.subject || '-'}</td>
                    <td class="data-table__td">${br.marks_obtained}</td>
                    <td class="data-table__td">${br.max_marks}</td>
                    <td class="data-table__td">${br.passing_year}</td>
                    <td class="data-table__td">
                        <button class="btn btn--danger btn--sm" onclick="deleteBoardResult('${br.id}')">Delete</button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="loading-text">No board results added yet.</td></tr>';
        }
    } else {
        tbody.innerHTML = '';
        status.textContent = response.error || 'Failed to load board results.';
        status.className = 'status status--error';
        status.style.display = 'block';
    }
}

async function loadBoardResultComponent() {
    try {
        const response = await fetch('components/add_board_result.html');
        if (response.ok) {
            const html = await response.text();
            const container = document.getElementById('addBoardResultContainer');
            if (container) {
                container.innerHTML = html;
                attachBoardResultListeners();
            }
        }
    } catch (err) {
        console.error('Error loading board result component:', err);
    }
}

function attachBoardResultListeners() {
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
            status.textContent = 'Board result added successfully!';
            status.className = 'status status--success';
            e.target.reset();
            document.getElementById('brMaxMarks').value = '100';
            loadBoardResults();
        } else {
            status.textContent = response.error || 'Failed to add board result.';
            status.className = 'status status--error';
        }
    });
}

window.deleteBoardResult = async function (id) {
    if (!confirm('Are you sure you want to delete this board result?')) return;
    const { error } = await window.supabaseClient.from('board_results').delete().eq('id', id);
    if (error) {
        alert('Failed to delete: ' + error.message);
    } else {
        loadBoardResults();
    }
};

export function init() {
    loadBoardResults();
    loadBoardResultComponent();

    const btnRefresh = document.getElementById('btnRefreshBoardResults');
    if (btnRefresh) btnRefresh.addEventListener('click', loadBoardResults);

    const pillView = document.getElementById('pillViewBoardResults');
    const pillAdd = document.getElementById('pillAddBoardResult');
    const listContainer = document.getElementById('boardResultsListContainer');
    const addContainer = document.getElementById('addBoardResultContainer');

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
    loadBoardResults();
}
