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

const PAGE_SIZE = 50;
let currentTable = '';
let currentOffset = 0;
let currentTotal = 0;

async function browseTable(table, offset = 0) {
    const statusEl = document.getElementById('browseStatus');
    const infoEl = document.getElementById('browseInfo');
    const tableWrap = document.getElementById('browseTableWrap');
    const pagination = document.getElementById('browsePagination');

    statusEl.style.display = 'none';
    tableWrap.style.display = 'none';
    pagination.style.display = 'none';
    infoEl.textContent = 'Loading…';

    try {
        const { rows, total } = await callAdminApi('browse_table', { table, limit: PAGE_SIZE, offset });
        currentTable = table;
        currentOffset = offset;
        currentTotal = total;

        if (!rows.length) {
            infoEl.textContent = 'No rows found.';
            return;
        }

        infoEl.textContent = `Showing ${offset + 1}–${Math.min(offset + rows.length, total)} of ${total} rows`;

        const thead = document.getElementById('browseTableHead');
        const tbody = document.getElementById('browseTableBody');
        const cols = Object.keys(rows[0]);

        thead.innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '<th>Action</th></tr>';
        tbody.innerHTML = '';

        rows.forEach(row => {
            const tr = document.createElement('tr');
            cols.forEach(col => {
                const td = document.createElement('td');
                let val = row[col];
                if (val === null || val === undefined) val = '';
                const str = String(val);
                td.textContent = str.length > 60 ? str.slice(0, 60) + '…' : str;
                td.title = str;
                tr.appendChild(td);
            });

            const actionTd = document.createElement('td');
            if (row.id) {
                const delBtn = document.createElement('button');
                delBtn.className = 'btn btn--danger btn--sm';
                delBtn.textContent = 'Delete';
                delBtn.addEventListener('click', () => {
                    window.showConfirmModal(
                        'Delete Row',
                        `Delete row with id "${row.id}" from "${table}"? This cannot be undone.`,
                        async () => {
                            try {
                                await callAdminApi('delete_row', { table, id: row.id });
                                await browseTable(currentTable, currentOffset);
                            } catch (err) {
                                statusEl.textContent = `Error: ${err.message}`;
                                statusEl.className = 'status status--error';
                                statusEl.style.display = 'block';
                            }
                        }
                    );
                });
                actionTd.appendChild(delBtn);
            } else {
                actionTd.textContent = '—';
            }
            tr.appendChild(actionTd);
            tbody.appendChild(tr);
        });

        tableWrap.style.display = 'block';

        // Pagination
        const prevBtn = document.getElementById('btnBrowsePrev');
        const nextBtn = document.getElementById('btnBrowseNext');
        prevBtn.disabled = offset === 0;
        nextBtn.disabled = offset + PAGE_SIZE >= total;
        pagination.style.display = 'flex';

    } catch (err) {
        statusEl.textContent = `Error: ${err.message}`;
        statusEl.className = 'status status--error';
        statusEl.style.display = 'block';
        infoEl.textContent = '';
    }
}

export function init() {
    document.getElementById('btnBrowseLoad')?.addEventListener('click', () => {
        const table = document.getElementById('browseTableSelect')?.value;
        if (!table) return;
        browseTable(table, 0);
    });

    document.getElementById('btnBrowsePrev')?.addEventListener('click', () => {
        browseTable(currentTable, Math.max(0, currentOffset - PAGE_SIZE));
    });

    document.getElementById('btnBrowseNext')?.addEventListener('click', () => {
        browseTable(currentTable, currentOffset + PAGE_SIZE);
    });
}

export function refresh() {}
