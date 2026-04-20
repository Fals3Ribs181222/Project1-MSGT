import { callAdminApi } from './admin-utils.js';

async function loadFlags() {
    const listEl = document.getElementById('flagsList');
    const statusEl = document.getElementById('flagsStatus');
    statusEl.style.display = 'none';
    listEl.innerHTML = '<div class="loading-text" style="padding:1rem;">Loading flags...</div>';

    try {
        const { flags } = await callAdminApi('get_flags');
        renderFlags(flags);
    } catch (err) {
        statusEl.textContent = `Error: ${err.message}`;
        statusEl.className = 'status status--error';
        statusEl.style.display = 'block';
        listEl.innerHTML = '';
    }
}

function renderFlags(flags) {
    const listEl = document.getElementById('flagsList');
    listEl.innerHTML = '';

    flags.forEach(flag => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem;background:var(--surface,#fff);border-radius:8px;border:1px solid var(--border-color,#e5e7eb);flex-wrap:wrap;';

        const info = document.createElement('div');
        info.innerHTML = `
            <strong style="display:block;margin-bottom:0.2rem;">${window.esc(flag.label)}</strong>
            <span style="color:var(--text-muted);font-size:0.85rem;">${DOMPurify.sanitize(flag.description) || ''}</span>
        `;

        const btn = document.createElement('button');
        btn.textContent = flag.enabled ? 'Enabled' : 'Disabled';
        btn.className = `btn btn--sm ${flag.enabled ? 'btn--primary' : 'btn--outline'}`;
        btn.style.minWidth = '90px';
        btn.dataset.key = flag.key;
        btn.dataset.enabled = flag.enabled ? '1' : '0';

        btn.addEventListener('click', async () => {
            const newEnabled = btn.dataset.enabled !== '1';
            btn.disabled = true;
            btn.textContent = '…';
            const statusEl = document.getElementById('flagsStatus');
            statusEl.style.display = 'none';
            try {
                await callAdminApi('update_flag', { key: flag.key, enabled: newEnabled });
                await loadFlags();
            } catch (err) {
                statusEl.textContent = `Error: ${err.message}`;
                statusEl.className = 'status status--error';
                statusEl.style.display = 'block';
                btn.disabled = false;
                btn.textContent = flag.enabled ? 'Enabled' : 'Disabled';
            }
        });

        row.appendChild(info);
        row.appendChild(btn);
        listEl.appendChild(row);
    });
}

export function init() {
    loadFlags();
}

export function refresh() {
    loadFlags();
}
