const user = window.auth.getUser();

async function loadTestsList() {
    const tbody = document.getElementById('testsListTableBody');
    const status = document.getElementById('testsListStatus');
    const btnRefresh = document.getElementById('btnRefreshTestsList');

    if (!tbody || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Refreshing...';
    window.tableLoading('testsListTableBody', 6, 'Loading tests...');

    const response = await window.api.get('tests', {}, '*', { order: 'date', ascending: true });

    btnRefresh.disabled = false;
    btnRefresh.textContent = 'Refresh List';

    if (response.success) {
        if (response.data && response.data.length > 0) {
            tbody.innerHTML = response.data.map(test => {
                const schools = Array.isArray(test.schools) && test.schools.length > 0
                    ? test.schools.join(', ')
                    : 'All';
                return `
                <tr class="data-table__row">
                    <td class="data-table__td--main">${window.esc(test.title) || '-'}</td>
                    <td class="data-table__td">${test.subject || '-'}</td>
                    <td class="data-table__td">${test.grade || '-'}</td>
                    <td class="data-table__td">${window.esc(schools)}</td>
                    <td class="data-table__td">${test.date || '-'}</td>
                    <td class="data-table__td">
                        <a href="manage_marks?testId=${test.id}" class="btn btn--primary btn--sm">Manage Marks</a>
                    </td>
                </tr>
            `}).join('');
        } else {
            window.tableLoading('testsListTableBody', 6, 'No tests scheduled yet.');
        }
    } else {
        document.getElementById('testsListTableBody').innerHTML = '';
        window.showStatus('testsListStatus', response.error || 'Failed to load tests.', 'error');
    }
}

async function loadTestComponent() {
    await window.loadComponent('modals/add_test.html', 'addTestContainer', attachTestListeners);
}

function attachTestListeners() {
    const form = document.getElementById('testForm');
    if (!form) return;

    window.populateGradeSelect('schedTestGrade', false);
    window.lockGradeSelect('schedTestGrade');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnScheduleTest');
        const status = document.getElementById('testStatus');

        btn.disabled = true;
        btn.textContent = 'Scheduling...';
        status.className = 'status';

        const subjectCheckboxes = document.querySelectorAll('input[name="testSubjects"]:checked');
        const subjects = Array.from(subjectCheckboxes).map(cb => cb.value).join(', ');

        const schoolCheckboxes = document.querySelectorAll('input[name="testSchools"]:checked');
        const schools = Array.from(schoolCheckboxes).map(cb => cb.value);

        const response = await window.api.post('tests', {
            title: document.getElementById('testTitle').value,
            subject: subjects,
            grade: document.getElementById('schedTestGrade').value,
            date: document.getElementById('testDate').value,
            max_marks: document.getElementById('testMaxMarks').value,
            scheduled_by: user.id,
            schools,
        });

        btn.disabled = false;
        btn.textContent = 'Schedule Test';

        if (response.success) {
            window.showStatus('testStatus', 'Test scheduled successfully!', 'success');
            window.safeFormReset(e.target);
            loadTestsList();
        } else {
            window.showStatus('testStatus', response.error || 'Failed to schedule.', 'error');
        }
    });
}

export function init() {
    loadTestsList();
    loadTestComponent();

    const btnRefresh = document.getElementById('btnRefreshTestsList');
    if (btnRefresh) btnRefresh.addEventListener('click', loadTestsList);

    const pillView = document.getElementById('pillViewTests');
    const pillAdd = document.getElementById('pillAddTest');
    const testsListContainer = document.getElementById('testsListContainer');
    const addTestContainer = document.getElementById('addTestContainer');

    if (pillView && pillAdd) {
        pillView.addEventListener('click', () => {
            pillView.classList.add('pill-toggle__btn--active');
            pillAdd.classList.remove('pill-toggle__btn--active');
            if (testsListContainer) testsListContainer.style.display = 'block';
            if (addTestContainer) addTestContainer.style.display = 'none';
            if (btnRefresh) btnRefresh.style.display = 'inline-block';
        });

        pillAdd.addEventListener('click', () => {
            pillAdd.classList.add('pill-toggle__btn--active');
            pillView.classList.remove('pill-toggle__btn--active');
            if (addTestContainer) addTestContainer.style.display = 'block';
            if (testsListContainer) testsListContainer.style.display = 'none';
            if (btnRefresh) btnRefresh.style.display = 'none';
        });
    }
}

export function refresh() {
    loadTestsList();
}
