let allRequests = [];
let activeFilter = 'pending';
let pendingApprovalId = null;

function generateUsername(name) {
    const parts = name.trim().toLowerCase().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return parts[0] + '.' + parts[parts.length - 1];
}

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderTable() {
    const tbody = document.getElementById('reqTableBody');
    const filtered = allRequests.filter(r => r.status === activeFilter);

    if (!filtered.length) {
        const icons   = { pending: 'ri-inbox-line', approved: 'ri-checkbox-circle-line', rejected: 'ri-close-circle-line' };
        const labels  = { pending: 'No pending requests', approved: 'No approved requests', rejected: 'No rejected requests' };
        const hints   = { pending: 'Share the registration link with new students.', approved: 'Approved students can now log in.', rejected: 'Rejected requests are kept here for reference.' };
        tbody.innerHTML = `<tr><td colspan="8"><div class="req-empty"><i class="${icons[activeFilter]}"></i><p>${labels[activeFilter]}</p><p style="font-size:0.8rem;margin-top:0.25rem;opacity:0.7;">${hints[activeFilter]}</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(r => {
        const badge = `<span class="req-badge req-badge--${r.status}">${r.status}</span>`;
        const actions = r.status === 'pending'
            ? `<div style="display:inline-flex;gap:0.4rem;justify-content:flex-end;">
                   <button class="btn btn--primary btn--sm" style="display:inline-flex;align-items:center;gap:0.3rem;" onclick="openApproveModal('${r.id}')"><i class="ri-user-add-line"></i> Approve</button>
                   <button class="btn btn--outline btn--sm" style="color:var(--danger);border-color:var(--danger);display:inline-flex;align-items:center;gap:0.3rem;" onclick="rejectRequest('${r.id}')"><i class="ri-close-line"></i> Reject</button>
               </div>`
            : '—';
        return `<tr class="--row">
            <td class="--main">${window.esc(r.name)}</td>
            <td>${window.esc(r.grade)}</td>
            <td>${r.phone ? window.esc(r.phone) : '—'}</td>
            <td>${r.school ? window.esc(r.school) : '—'}</td>
            <td>${r.subjects ? window.esc(r.subjects) : '—'}</td>
            <td style="white-space:nowrap;">${formatDate(r.submitted_at)}</td>
            <td>${badge}</td>
            <td style="text-align:right;">${actions}</td>
        </tr>`;
    }).join('');
}

function updateCounts() {
    const pending  = allRequests.filter(r => r.status === 'pending').length;
    const approved = allRequests.filter(r => r.status === 'approved').length;
    const rejected = allRequests.filter(r => r.status === 'rejected').length;

    document.getElementById('reqCountPending').textContent  = pending  ? `(${pending})`  : '';
    document.getElementById('reqCountApproved').textContent = approved ? `(${approved})` : '';
    document.getElementById('reqCountRejected').textContent = rejected ? `(${rejected})` : '';

    const badge = document.getElementById('reqPendingBadge');
    if (badge) {
        badge.textContent = pending || '';
        badge.style.display = pending ? 'inline-flex' : 'none';
    }
}

async function loadRequests() {
    const tbody = document.getElementById('reqTableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading-text">Loading…</td></tr>';
    document.getElementById('reqStatus').style.display = 'none';

    const { data, error } = await window.supabaseClient
        .from('registration_requests')
        .select('*')
        .order('submitted_at', { ascending: false });

    if (error) {
        document.getElementById('reqStatus').textContent = `Failed to load: ${error.message}`;
        document.getElementById('reqStatus').className = 'status status--error';
        document.getElementById('reqStatus').style.display = 'block';
        tbody.innerHTML = '';
        return;
    }

    allRequests = data || [];
    updateCounts();
    renderTable();
}

function setFilter(filter) {
    activeFilter = filter;
    document.querySelectorAll('.req-filter-btn').forEach(btn => {
        btn.classList.toggle('req-filter-btn--active', btn.dataset.filter === filter);
    });
    renderTable();
}

// ── Approve flow ─────────────────────────────────────────────────────────────

window.openApproveModal = function (requestId) {
    const req = allRequests.find(r => r.id === requestId);
    if (!req) return;
    pendingApprovalId = requestId;

    const username = generateUsername(req.name);
    document.getElementById('approveUsername').value = username;
    document.getElementById('approvePassword').value = username;
    document.getElementById('approveStatus').style.display = 'none';

    // Build detail summary
    const rows = [
        ['Name',    req.name],
        ['Grade',   req.grade],
        req.phone        && ['Phone',   req.phone],
        req.email        && ['Email',   req.email],
        req.subjects     && ['Subjects',req.subjects],
        req.school       && ['School',  req.school],
        req.father_name  && ['Father',  req.father_name + (req.father_phone ? ` · ${req.father_phone}` : '')],
        req.mother_name  && ['Mother',  req.mother_name + (req.mother_phone ? ` · ${req.mother_phone}` : '')],
    ].filter(Boolean);

    document.getElementById('approveModalDetails').innerHTML = rows.map(([label, val]) =>
        `<span class="req-detail-label">${window.esc(label)}</span><span class="req-detail-value">${window.esc(val)}</span>`
    ).join('');

    document.getElementById('approveModal').style.display = 'flex';
};

window.closeApproveModal = function () {
    document.getElementById('approveModal').style.display = 'none';
    pendingApprovalId = null;
};

// Toggle password visibility in modal
document.getElementById('approvePwToggle')?.addEventListener('click', () => {
    const input = document.getElementById('approvePassword');
    const icon  = document.getElementById('approvePwIcon');
    const hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    icon.className = hidden ? 'ri-eye-off-line' : 'ri-eye-line';
});

// Close modal on backdrop click
document.getElementById('approveModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('approveModal')) closeApproveModal();
});

document.getElementById('approveConfirmBtn')?.addEventListener('click', async () => {
    if (!pendingApprovalId) return;

    const req = allRequests.find(r => r.id === pendingApprovalId);
    if (!req) return;

    const username = document.getElementById('approveUsername').value.trim().toLowerCase();
    const password = document.getElementById('approvePassword').value;
    const statusEl = document.getElementById('approveStatus');
    const confirmBtn = document.getElementById('approveConfirmBtn');
    const confirmText = document.getElementById('approveConfirmText');
    const spinner = document.getElementById('approveConfirmSpinner');

    if (!username || !password || password.length < 6) {
        statusEl.textContent = 'Username and password (min 6 characters) are required.';
        statusEl.className = 'status status--error';
        statusEl.style.display = 'block';
        return;
    }

    confirmText.style.display = 'none';
    spinner.style.display = 'inline-block';
    confirmBtn.disabled = true;
    statusEl.style.display = 'none';

    try {
        const { data: sessionData } = await window.supabaseClient.auth.getSession();
        const token = sessionData?.session?.access_token;

        const meta = {
            name:          req.name,
            username,
            grade:         req.grade,
            subjects:      req.subjects || '',
            phone:         req.phone || '',
            email:         req.email || null,
            father_name:   req.father_name || null,
            father_phone:  req.father_phone || null,
            mother_name:   req.mother_name || null,
            mother_phone:  req.mother_phone || null,
            school:        req.school || null,
            role:          'student',
        };

        const res = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/admin-api`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': window.CONFIG.SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ action: 'create_student', email: `${username}@msgt.internal`, password, meta }),
        });

        const result = await res.json();
        if (result.error) throw new Error(result.error);

        // Mark request as approved in Supabase
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        await window.supabaseClient
            .from('registration_requests')
            .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
            .eq('id', pendingApprovalId);

        // Update local state and close
        const idx = allRequests.findIndex(r => r.id === pendingApprovalId);
        if (idx !== -1) allRequests[idx].status = 'approved';
        closeApproveModal();
        updateCounts();
        renderTable();

    } catch (err) {
        statusEl.textContent = `Error: ${err.message}`;
        statusEl.className = 'status status--error';
        statusEl.style.display = 'block';
    } finally {
        confirmText.style.display = 'inline-block';
        spinner.style.display = 'none';
        confirmBtn.disabled = false;
    }
});

// ── Reject flow ───────────────────────────────────────────────────────────────

window.rejectRequest = async function (requestId) {
    if (!confirm('Reject this registration request?')) return;

    const { data: { user } } = await window.supabaseClient.auth.getUser();
    const { error } = await window.supabaseClient
        .from('registration_requests')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq('id', requestId);

    if (error) {
        document.getElementById('reqStatus').textContent = `Failed to reject: ${error.message}`;
        document.getElementById('reqStatus').className = 'status status--error';
        document.getElementById('reqStatus').style.display = 'block';
        return;
    }

    const idx = allRequests.findIndex(r => r.id === requestId);
    if (idx !== -1) allRequests[idx].status = 'rejected';
    updateCounts();
    renderTable();
};

// ── Init ──────────────────────────────────────────────────────────────────────

export function init() {
    document.querySelectorAll('.req-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => setFilter(btn.dataset.filter));
    });
    document.getElementById('reqRefreshBtn')?.addEventListener('click', loadRequests);
    loadRequests();
}

export function refresh() {
    loadRequests();
}
