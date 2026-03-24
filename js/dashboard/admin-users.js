async function callAdminApi(action, payload = {}) {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const res = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/admin-api`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action, ...payload })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Admin API error');
    return json;
}

let allUsers = [];

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    const statusEl = document.getElementById('usersStatus');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Loading users...</td></tr>';
    statusEl.style.display = 'none';

    try {
        const { users } = await callAdminApi('get_all_users');
        allUsers = users;
        applyFilters();
    } catch (err) {
        statusEl.textContent = `Error: ${err.message}`;
        statusEl.className = 'status status--error';
        statusEl.style.display = 'block';
        tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Failed to load users.</td></tr>';
    }
}

function applyFilters() {
    const search = document.getElementById('userSearch')?.value?.toLowerCase() || '';
    const roleFilter = document.getElementById('userRoleFilter')?.value || '';

    const filtered = allUsers.filter(u => {
        const matchSearch = !search || u.name?.toLowerCase().includes(search) || u.username?.toLowerCase().includes(search);
        const matchRole = !roleFilter || u.role === roleFilter;
        return matchSearch && matchRole;
    });

    const countEl = document.getElementById('usersCount');
    if (countEl) countEl.textContent = `Showing ${filtered.length} of ${allUsers.length} users`;

    renderUsers(filtered);
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-text">No users found.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.name || '—'}</td>
            <td>${u.username || '—'}</td>
            <td><span class="badge">${u.role || '—'}</span></td>
            <td>${u.grade || '—'}</td>
            <td></td>
        `;

        const actionTd = tr.querySelector('td:last-child');
        const select = document.createElement('select');
        select.className = 'filter-bar__control';
        select.style.cssText = 'padding:0.25rem 0.5rem;font-size:0.8rem;width:auto;display:inline-block;margin-right:0.5rem;';
        ['student', 'teacher', 'admin'].forEach(role => {
            const opt = document.createElement('option');
            opt.value = role;
            opt.textContent = role;
            if (role === u.role) opt.selected = true;
            select.appendChild(opt);
        });

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn--sm btn--outline';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () => {
            const newRole = select.value;
            if (newRole === u.role) return;
            window.showConfirmModal(
                'Change Role',
                `Change ${u.name}'s role from "${u.role}" to "${newRole}"?`,
                async () => {
                    const statusEl = document.getElementById('usersStatus');
                    statusEl.style.display = 'none';
                    try {
                        await callAdminApi('update_user_role', { user_id: u.id, new_role: newRole });
                        await loadUsers();
                    } catch (err) {
                        statusEl.textContent = `Error: ${err.message}`;
                        statusEl.className = 'status status--error';
                        statusEl.style.display = 'block';
                    }
                }
            );
        });

        actionTd.appendChild(select);
        actionTd.appendChild(saveBtn);
        tbody.appendChild(tr);
    });
}

export function init() {
    loadUsers();

    document.getElementById('btnRefreshUsers')?.addEventListener('click', loadUsers);
    document.getElementById('userSearch')?.addEventListener('input', applyFilters);
    document.getElementById('userRoleFilter')?.addEventListener('change', applyFilters);
}

export function refresh() {
    loadUsers();
}
