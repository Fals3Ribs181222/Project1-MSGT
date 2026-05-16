const user = window.auth.getUser();

let allIndexedFiles = [];

const sectionCfg = {
    A: { marks: [0, 10, 16, 25, 32], labels: ['Not Selected', '10 Marks', '16 Marks', '25 Marks', '32 Marks'], selected: 0 },
    B: { marks: [0, 16, 25, 32, 40], labels: ['Not Selected', '16 Marks', '25 Marks', '32 Marks', '40 Marks'], selected: 0 },
    C: { marks: [0, 16, 25, 32, 40], labels: ['Not Selected', '16 Marks', '25 Marks', '32 Marks', '40 Marks'], selected: 0 },
};
let activeSectionKey = null;

function renderMarkdown(text) {
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(marked.parse(text));
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function ragQuery(query, subject, grade, mode, extraParams = {}) {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/rag-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ query, subject, grade, mode, ...extraParams })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data.answer;
}

// ── Section marks picker ──────────────────────────────────────

function renderSectionPanel() {
    const secOptions = document.getElementById('sectionMarksOptions');
    if (!activeSectionKey || !secOptions) return;
    const cfg = sectionCfg[activeSectionKey];
    secOptions.innerHTML = cfg.marks.map((m, i) => {
        const sel = m === cfg.selected ? 'time-option--selected' : '';
        return `<div class="time-option ${sel}" style="flex:1 1 100%;" data-val="${m}">${cfg.labels[i]}</div>`;
    }).join('');
}

function updateSectionDisplays() {
    ['A', 'B', 'C'].forEach(key => {
        const el = document.getElementById(`sec${key}DisplayValue`);
        if (el) el.textContent = sectionCfg[key].selected > 0 ? `${sectionCfg[key].selected} Marks` : 'Not Selected';
    });
    const total = sectionCfg.A.selected + sectionCfg.B.selected + sectionCfg.C.selected;
    const totalEl = document.getElementById('testTotalMarksDisplay');
    if (totalEl) totalEl.textContent = total > 0 ? `Total: ${total} marks` : 'Total: 0 marks';
}

function resetDisplayBorders() {
    ['secADisplay', 'secBDisplay', 'secCDisplay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.borderColor = 'var(--border-color)';
    });
}

function openSectionPanel(key) {
    const secPanel  = document.getElementById('sectionMarksPanel');
    const display   = document.getElementById(`sec${key}Display`);
    if (!secPanel) return;

    if (activeSectionKey === key && secPanel.style.display !== 'none') {
        secPanel.style.display = 'none';
        activeSectionKey = null;
        resetDisplayBorders();
        return;
    }

    activeSectionKey = key;
    renderSectionPanel();
    secPanel.style.display = 'flex';

    if (window.innerWidth <= 768) {
        const wrapper = display?.closest('.form__row-item');
        if (wrapper) wrapper.after(secPanel);
        secPanel.style.marginLeft = '0';
        secPanel.style.width = '100%';
    } else {
        if (key === 'A')      secPanel.style.marginLeft = '0';
        else if (key === 'B') secPanel.style.marginLeft = 'calc(33.333% + 0.33rem)';
        else                  secPanel.style.marginLeft = 'calc(66.666% + 0.67rem)';
        secPanel.style.width = 'calc(33.333% - 0.67rem)';
    }

    resetDisplayBorders();
    if (display) display.style.borderColor = 'var(--primary)';
}

function getSectionValues() {
    const secAMarks  = sectionCfg.A.selected;
    const secBMarks  = sectionCfg.B.selected;
    const secCMarks  = sectionCfg.C.selected;
    const sections   = (secAMarks > 0 ? 'A' : '') + (secBMarks > 0 ? 'B' : '') + (secCMarks > 0 ? 'C' : '');
    const marksTarget = secAMarks + secBMarks + secCMarks;
    return { secAMarks, secBMarks, secCMarks, sections, marksTarget };
}

// ── Material dropdown ─────────────────────────────────────────

async function populateMaterialDropdown() {
    const sel = document.getElementById('testMaterial');
    if (!sel) return;
    const filesRes  = await window.api.get('files', { upload_type: 'ai' }, 'id, title, subject, grade');
    const chunksRes = await window.api.get('material_chunks', {}, 'file_id');
    const indexedIds = new Set((chunksRes.data || []).map(r => r.file_id));
    allIndexedFiles = (filesRes.data || []).filter(f => indexedIds.has(f.id));
    filterMaterialDropdown();
}

function filterMaterialDropdown() {
    const sel = document.getElementById('testMaterial');
    if (!sel) return;
    const grade   = window.getSelectedGrade('testGrade');
    const subject = document.getElementById('testSubject')?.value || '';
    const prevValue = sel.value;

    sel.innerHTML = '<option value="">All materials for selected class &amp; subject</option>';
    allIndexedFiles
        .filter(f => (!grade || f.grade === grade) && (!subject || f.subject === subject))
        .forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = `${f.title} (${f.subject || '?'} · ${f.grade || '?'})`;
            sel.appendChild(opt);
        });

    if (prevValue && sel.querySelector(`option[value="${prevValue}"]`)) sel.value = prevValue;
}

// ── Word / PDF download helpers ───────────────────────────────

function loadDocx() {
    return new Promise(resolve => {
        if (window.docx) { resolve(); return; }
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/docx@8.5.0/build/index.umd.js';
        s.onload = resolve;
        document.head.appendChild(s);
    });
}

function loadHtml2Pdf() {
    return new Promise(resolve => {
        if (window.html2pdf) { resolve(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        s.onload = resolve;
        document.head.appendChild(s);
    });
}

async function getWatermarkImage() {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const MAX = 600;
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
            else        { if (h > MAX) { w *= MAX / h; h = MAX; } }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.globalAlpha = 0.15;
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(blob => {
                if (blob) blob.arrayBuffer().then(buffer => resolve({ data: buffer, width: w, height: h })).catch(reject);
                else reject(new Error('Canvas toBlob failed'));
            }, 'image/png');
        };
        img.onerror = reject;
        img.src = '/logo.png';
    });
}

async function buildDocxBlob(outputEl) {
    await loadDocx();
    const { Document, Paragraph, TextRun, AlignmentType, Packer, Header, ImageRun } = window.docx;
    const lines = outputEl.innerText.split('\n');
    const children = [];

    for (const line of lines) {
        const t = line.trim();
        if (!t) { children.push(new Paragraph({ text: '' })); continue; }

        const isCentreTitle = t === t.toUpperCase() && t.length <= 60 && /[A-Z]{3}/.test(t)
            && !/^\(/.test(t) && !/^\[/.test(t) && !/^Q\d/.test(t);
        const isSectionHead = /^SECTION [ABC]/.test(t) || t === 'ANSWER KEY';
        const isQuestion = /^\((?:i{1,3}|iv|v|vi{1,3}|ix|x{1,2}|xi{1,2}|xiii|xiv)\)/.test(t) || /^Q\d+/.test(t);

        if (isSectionHead) {
            children.push(new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 26, font: 'Times New Roman' })], spacing: { before: 280, after: 140 } }));
        } else if (isCentreTitle) {
            children.push(new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 28, font: 'Times New Roman' })], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } }));
        } else if (t === 'OR') {
            children.push(new Paragraph({ children: [new TextRun({ text: 'OR', bold: true, size: 24, font: 'Times New Roman' })], alignment: AlignmentType.CENTER, spacing: { before: 140, after: 140 } }));
        } else {
            children.push(new Paragraph({ children: [new TextRun({ text: line, size: 24, font: 'Times New Roman' })], spacing: { after: 80 }, indent: isQuestion ? { left: 360 } : {} }));
        }
    }

    let watermarkHeader = null;
    try {
        const wm = await getWatermarkImage();
        watermarkHeader = new Header({
            children: [new Paragraph({ children: [new ImageRun({ data: wm.data, transformation: { width: wm.width, height: wm.height }, floating: { horizontalPosition: { align: 'center' }, verticalPosition: { align: 'center' }, behindDocument: true } })] })],
        });
    } catch (e) { console.error('Watermark load failed:', e); }

    const sectionDef = {
        properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
        children,
        ...(watermarkHeader ? { headers: { default: watermarkHeader } } : {}),
    };

    return Packer.toBlob(new Document({ sections: [sectionDef] }));
}

// ── Export ────────────────────────────────────────────────────

export function init() {
    window.populateGradePills('testGrade', false);
    populateMaterialDropdown();

    // Section picks panel
    ['A', 'B', 'C'].forEach(key => {
        document.getElementById(`sec${key}Display`)?.addEventListener('click', (e) => { e.stopPropagation(); openSectionPanel(key); });
    });

    document.getElementById('sectionMarksPanel')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!e.target.classList.contains('time-option') || !activeSectionKey) return;
        sectionCfg[activeSectionKey].selected = parseInt(e.target.dataset.val, 10);
        renderSectionPanel();
        updateSectionDisplays();
    });

    window.addEventListener('click', () => {
        const secPanel = document.getElementById('sectionMarksPanel');
        if (secPanel) secPanel.style.display = 'none';
        activeSectionKey = null;
        resetDisplayBorders();
    });

    // Cognitive focus pills
    document.querySelectorAll('[data-cog]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-cog]').forEach(b => b.classList.remove('tab-pill-selector__btn--active'));
            btn.classList.add('tab-pill-selector__btn--active');
            document.getElementById('cogFocusValue').value = btn.dataset.cog;
        });
    });

    // Material dropdown filtering
    document.getElementById('testGrade')?.addEventListener('change', filterMaterialDropdown);
    document.getElementById('testSubject')?.addEventListener('change', filterMaterialDropdown);

    // Generate
    document.getElementById('btnGenerateTest')?.addEventListener('click', async () => {
        const topic    = document.getElementById('testTopic').value.trim();
        const subject  = document.getElementById('testSubject').value;
        const grade    = window.getSelectedGrade('testGrade');
        const cogFocus = document.getElementById('cogFocusValue')?.value ?? 'balanced';
        const fileId   = document.getElementById('testMaterial')?.value || undefined;
        const { secAMarks, secBMarks, secCMarks, sections, marksTarget } = getSectionValues();
        const btn       = document.getElementById('btnGenerateTest');
        const outputBox = document.getElementById('testOutputBox');
        const outputEl  = document.getElementById('testOutput');

        if (!subject || !grade) { window.showStatus('testStatus', 'Please select class and subject.', 'error'); return; }
        if (!sections)          { window.showStatus('testStatus', 'Please select marks for at least one section.', 'error'); return; }

        btn.disabled    = true;
        btn.textContent = 'Generating...';
        outputBox.style.display = 'none';
        window.showStatus('testStatus', 'This may take 20–30 seconds for longer papers…', 'info');

        try {
            const result = await ragQuery(topic || `${subject} ${grade} comprehensive review`, subject, grade, 'test', {
                marks_target: marksTarget, sections,
                sec_a_marks: secAMarks, sec_b_marks: secBMarks, sec_c_marks: secCMarks,
                cog_focus: cogFocus,
                ...(fileId ? { file_id: fileId } : {}),
            });
            outputEl.innerHTML      = renderMarkdown(result);
            outputBox.style.display = 'block';
            window.showStatus('testStatus', '', 'success');
        } catch (err) {
            window.showStatus('testStatus', err.message || 'Something went wrong.', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = '✨ Generate Test Paper';
        }
    });

    // Copy
    document.getElementById('btnCopyTest')?.addEventListener('click', () => {
        navigator.clipboard.writeText(document.getElementById('testOutput').innerText);
        const btn = document.getElementById('btnCopyTest');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });

    // Download Word
    document.getElementById('btnDownloadWord')?.addEventListener('click', async () => {
        const outputEl = document.getElementById('testOutput');
        const topic    = document.getElementById('testTopic').value.trim() || 'test-paper';
        const filename = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '.docx';
        const btn = document.getElementById('btnDownloadWord');
        btn.disabled = true; btn.textContent = 'Generating...';
        try {
            const blob = await buildDocxBlob(outputEl);
            const url  = URL.createObjectURL(blob);
            Object.assign(document.createElement('a'), { href: url, download: filename }).click();
            URL.revokeObjectURL(url);
        } catch (err) {
            window.showStatus('testStatus', 'Word generation failed.', 'error');
        } finally {
            btn.disabled = false; btn.textContent = 'Download Word';
        }
    });

    // Download PDF
    document.getElementById('btnDownloadPdf')?.addEventListener('click', async () => {
        const outputEl = document.getElementById('testOutput');
        const topic    = document.getElementById('testTopic').value.trim() || 'test-paper';
        const filename = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '.pdf';
        const btn = document.getElementById('btnDownloadPdf');
        btn.disabled = true; btn.textContent = 'Generating...';
        try {
            await loadHtml2Pdf();
            await window.html2pdf().set({
                margin: [12, 12, 12, 12], filename,
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css'] },
            }).from(outputEl).save();
        } catch (err) {
            window.showStatus('testStatus', 'PDF generation failed.', 'error');
        } finally {
            btn.disabled = false; btn.textContent = 'Download PDF';
        }
    });

    // Save to Materials
    document.getElementById('btnSaveToMaterials')?.addEventListener('click', async () => {
        const outputEl = document.getElementById('testOutput');
        const topic    = document.getElementById('testTopic').value.trim();
        const subject  = document.getElementById('testSubject').value;
        const grade    = window.getSelectedGrade('testGrade');
        const title    = topic || `${subject} ${grade} Test`;
        const filename = (topic || `${subject}-${grade}-test`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '.docx';
        const btn = document.getElementById('btnSaveToMaterials');
        btn.disabled = true; btn.textContent = 'Saving...';
        try {
            const docxBlob = await buildDocxBlob(outputEl);
            const filePath = `tests/${Date.now()}_${filename}`;
            const { error: storageError } = await window.supabaseClient.storage.from('materials').upload(filePath, docxBlob, {
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            if (storageError) throw storageError;
            const { data: { publicUrl } } = window.supabaseClient.storage.from('materials').getPublicUrl(filePath);
            const res = await window.api.post('files', { title, subject, grade, file_url: publicUrl, upload_type: 'test', uploaded_by: user.id });
            if (!res.success) throw new Error(res.error);
            window.showStatus('testStatus', `Saved "${title}" to Materials → Tests.`, 'success');
        } catch (err) {
            window.showStatus('testStatus', err.message || 'Failed to save to Materials.', 'error');
        } finally {
            btn.disabled = false; btn.textContent = 'Save to Materials';
        }
    });
}

export function refresh() {}
