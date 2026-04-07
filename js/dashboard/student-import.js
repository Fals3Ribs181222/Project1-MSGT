// js/dashboard/student-import.js
// CSV import workflow for the Students tab.
// Exported: initImportSection(getAllStudents, onImportComplete)

let importRows = [];

export function initImportSection(getAllStudents, onImportComplete) {
    document.getElementById('btnDownloadCsvTemplate')?.addEventListener('click', downloadCsvTemplate);
    document.getElementById('btnPreviewCsv')?.addEventListener('click', () => previewCsvImport(getAllStudents));
    document.getElementById('btnImportAll')?.addEventListener('click', () => importAllStudents(getAllStudents, onImportComplete));
}

function downloadCsvTemplate() {
    const csv = 'Student Name,Email Address,Student Phone,Address,Father\'s Name,Father\'s Phone,Mother\'s Name,Mother\'s Phone,Grade\nRahul Sharma,rahul@email.com,9876543210,Mumbai,Suresh Sharma,9876500001,Anita Sharma,9876500002,11\nPriya Patel,priya@email.com,9123456789,Pune,Rajesh Patel,9123400001,Meena Patel,9123400002,12';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'students_template.csv';
    a.click();
}

function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return { headers: [], rows: [] };

    const parseRow = (line) => {
        const fields = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                fields.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        fields.push(cur.trim());
        return fields;
    };

    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).filter(l => l.trim()).map(l => parseRow(l));
    return { headers, rows };
}

function normalizeGrade(raw) {
    const s = (raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (s === '11' || s === '11th' || s === 'standard 11' || s === 'std 11' || s === 'class 11' || s === 'grade 11') return window._Grade11;
    if (s === '12' || s === '12th' || s === 'standard 12' || s === 'std 12' || s === 'class 12' || s === 'grade 12') return window._Grade12;
    return raw; // pass through unknown values as-is
}

function detectColumns(headers) {
    const map = {};
    headers.forEach((h, i) => {
        const lh = h.toLowerCase().replace(/['''`]/g, "'");
        if (!map.name && lh.includes('student name')) map.name = i;
        else if (!map.name && !lh.includes('father') && !lh.includes('mother') && lh.includes('name')) map.name = i;
        if (!map.email && (lh.includes('email') || lh.includes('e-mail'))) map.email = i;
        if (!map.grade && (lh.includes('grade') || lh.includes('class') || lh.includes('std'))) map.grade = i;
        if (!map.subjects && lh.includes('subject')) map.subjects = i;
        // address — detected but intentionally not stored
        if (!map.address && lh.includes('address')) map.address = i;
        if (!map.father_name && (lh.includes("father") && lh.includes('name'))) map.father_name = i;
        if (!map.father_phone && (lh.includes("father") && (lh.includes('phone') || lh.includes('mobile')))) map.father_phone = i;
        if (!map.mother_name && (lh.includes("mother") && lh.includes('name'))) map.mother_name = i;
        if (!map.mother_phone && (lh.includes("mother") && (lh.includes('phone') || lh.includes('mobile')))) map.mother_phone = i;
        // generic phone — only if no specific student phone matched yet
        if (!map.phone && (lh === 'phone' || lh === 'student phone' || lh.includes('mobile') || lh.includes('whatsapp') || lh.includes('contact'))) map.phone = i;
        else if (!map.phone && lh.includes('phone') && !lh.includes('father') && !lh.includes('mother')) map.phone = i;
    });
    return map;
}

function generateUsername(name, taken) {
    const base = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '.');
    let username = base;
    let n = 2;
    while (taken.has(username)) { username = base + n; n++; }
    taken.add(username);
    return username;
}

function previewCsvImport(getAllStudents) {
    const file = document.getElementById('importCsvFile')?.files[0];
    const statusEl = document.getElementById('importStatus');
    const previewSection = document.getElementById('importPreviewSection');

    if (!file) {
        window.showStatus('importStatus', 'Please select a CSV file first.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const { headers, rows } = parseCSV(e.target.result);
        const colMap = detectColumns(headers);

        if (colMap.name === undefined) {
            window.showStatus('importStatus', 'Could not find a "name" column. Check your CSV headers.', 'error');
            previewSection.style.display = 'none';
            return;
        }

        const taken = new Set(getAllStudents().map(s => s.username).filter(Boolean));
        importRows = rows.map(row => ({
            name: row[colMap.name] || '',
            email: colMap.email !== undefined ? row[colMap.email] : '',
            grade: normalizeGrade(colMap.grade !== undefined ? row[colMap.grade] : ''),
            subjects: colMap.subjects !== undefined ? row[colMap.subjects] : '',
            phone: colMap.phone !== undefined ? row[colMap.phone] : '',
            father_name: colMap.father_name !== undefined ? row[colMap.father_name] : '',
            father_phone: colMap.father_phone !== undefined ? row[colMap.father_phone] : '',
            mother_name: colMap.mother_name !== undefined ? row[colMap.mother_name] : '',
            mother_phone: colMap.mother_phone !== undefined ? row[colMap.mother_phone] : '',
            // address is parsed but not stored
            username: generateUsername(row[colMap.name] || 'student', taken),
            status: 'pending',
        })).filter(r => r.name);

        if (importRows.length === 0) {
            window.showStatus('importStatus', 'No valid rows found in the CSV.', 'error');
            previewSection.style.display = 'none';
            return;
        }

        document.getElementById('importPreviewCount').textContent = `${importRows.length} student${importRows.length !== 1 ? 's' : ''} ready to import`;
        renderImportPreview();
        previewSection.style.display = 'block';
        statusEl.style.display = 'none';
    };
    reader.readAsText(file);
}

function renderImportPreview() {
    const tbody = document.getElementById('importPreviewBody');
    tbody.innerHTML = importRows.map((r, i) => {
        const statusBadge = r.status === 'done'
            ? '<span style="color:var(--success-color,green);font-weight:600;">✓ Done</span>'
            : r.status === 'error'
            ? `<span style="color:var(--danger-color,red);font-size:0.8rem;">${window.esc(r.errorMsg || 'Error')}</span>`
            : '<span style="color:var(--text-muted);">Pending</span>';

        return `<tr>
            <td class="data-table__td">${i + 1}</td>
            <td class="data-table__td--main">${window.esc(r.name)}</td>
            <td class="data-table__td">${window.esc(r.grade)}</td>
            <td class="data-table__td">${window.esc(r.phone)}</td>
            <td class="data-table__td">${window.esc(r.email)}</td>
            <td class="data-table__td">
                <input type="text" value="${window.esc(r.username)}" data-row="${i}"
                    style="padding:3px 8px;border:1px solid var(--border-color);border-radius:var(--radius-md);font-size:0.85rem;width:130px;background:var(--bg-surface);color:var(--text-main);"
                    ${r.status === 'done' ? 'disabled' : ''}>
            </td>
            <td class="data-table__td">${statusBadge}</td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('input[data-row]').forEach(input => {
        input.addEventListener('change', e => {
            importRows[parseInt(e.target.dataset.row)].username = e.target.value.trim().toLowerCase();
        });
    });
}

async function importAllStudents(getAllStudents, onImportComplete) {
    const btn = document.getElementById('btnImportAll');
    btn.disabled = true;
    btn.textContent = 'Importing...';
    document.getElementById('importStatus').style.display = 'none';

    let done = 0, failed = 0;

    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;

    for (let i = 0; i < importRows.length; i++) {
        const r = importRows[i];
        if (r.status === 'done') { done++; continue; }

        const email = r.email || `${r.username}@msgt.internal`;
        const meta = {
            name: r.name, username: r.username, grade: r.grade, subjects: r.subjects,
            phone: r.phone, email: r.email || null,
            father_name: r.father_name || null, father_phone: r.father_phone || null,
            mother_name: r.mother_name || null, mother_phone: r.mother_phone || null,
            role: 'student',
        };

        const res = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/admin-api`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': window.CONFIG.SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ action: 'create_student', email, password: r.username, meta }),
        });
        const result = await res.json();

        if (!res.ok || result.error) {
            importRows[i].status = 'error';
            importRows[i].errorMsg = result.error || 'Unknown error';
            failed++;
        } else {
            importRows[i].status = 'done';
            done++;
        }

        renderImportPreview();
    }

    btn.disabled = false;
    btn.textContent = 'Import All Students';

    const msg = `Import complete: ${done} succeeded${failed ? `, ${failed} failed` : ''}.`;
    window.showStatus('importStatus', msg, failed ? 'error' : 'success');
    document.getElementById('importPreviewCount').textContent = `${importRows.length} students — ${done} imported`;
    if (!failed) onImportComplete();
}
