const user = window.auth.getUser();

function attachAIToolListeners() {

    // ── Pill toggle ───────────────────────────────────────────
    const pillDoubt = document.getElementById('pillDoubtSolver');
    const pillTest  = document.getElementById('pillTestGenerator');
    const doubtPanel = document.getElementById('doubtSolverPanel');
    const testPanel  = document.getElementById('testGeneratorPanel');

    pillDoubt?.addEventListener('click', () => {
        pillDoubt.classList.add('pill-toggle__btn--active');
        pillTest.classList.remove('pill-toggle__btn--active');
        doubtPanel.style.display = 'block';
        testPanel.style.display  = 'none';
    });

    pillTest?.addEventListener('click', () => {
        pillTest.classList.add('pill-toggle__btn--active');
        pillDoubt.classList.remove('pill-toggle__btn--active');
        testPanel.style.display  = 'block';
        doubtPanel.style.display = 'none';
    });

    // ── Shared RAG query helper ───────────────────────────────
    // extraParams is used for test mode config (marks_target, sections, cog_focus)
    async function ragQuery(query, subject, grade, mode, extraParams = {}) {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/rag-query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ query, subject, grade, mode, ...extraParams })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data.answer;
    }

    // ── Doubt Solver ──────────────────────────────────────────
    document.getElementById('btnAskDoubt')?.addEventListener('click', async () => {
        const question = document.getElementById('doubtQuestion').value.trim();
        const subject  = document.getElementById('doubtSubject').value;
        const grade    = document.getElementById('doubtGrade').value;
        const btn      = document.getElementById('btnAskDoubt');
        const answerBox = document.getElementById('doubtAnswerBox');
        const answerEl  = document.getElementById('doubtAnswer');

        if (!question || !subject || !grade) {
            window.showStatus('doubtStatus', 'Please fill in subject, grade and your question.', 'error');
            return;
        }

        btn.disabled    = true;
        btn.textContent = 'Thinking...';
        answerBox.style.display = 'none';
        window.showStatus('doubtStatus', '', 'success');

        try {
            const answer = await ragQuery(question, subject, grade, 'doubt');
            answerEl.textContent = answer;
            answerBox.style.display = 'block';
        } catch (err) {
            window.showStatus('doubtStatus', err.message || 'Something went wrong.', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = '✨ Ask AI';
        }
    });

    document.getElementById('btnCopyDoubt')?.addEventListener('click', () => {
        const text = document.getElementById('doubtAnswer').textContent;
        navigator.clipboard.writeText(text);
        const btn = document.getElementById('btnCopyDoubt');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });

    // ── Test Generator — Section Marks Picker (mirrors time-picker) ──
    const sectionConfig = {
        A: { marks: [0, 10, 16, 25, 32], labels: ['Not Selected', '10 Marks', '16 Marks', '25 Marks', '32 Marks'], selected: 0 },
        B: { marks: [0, 16, 25, 32, 40], labels: ['Not Selected', '16 Marks', '25 Marks', '32 Marks', '40 Marks'], selected: 0 },
        C: { marks: [0, 16, 25, 32, 40], labels: ['Not Selected', '16 Marks', '25 Marks', '32 Marks', '40 Marks'], selected: 0 },
    };
    let activeSectionKey = null;

    const secPanel    = document.getElementById('sectionMarksPanel');
    const secOptions  = document.getElementById('sectionMarksOptions');
    const secADisplay = document.getElementById('secADisplay');
    const secBDisplay = document.getElementById('secBDisplay');
    const secCDisplay = document.getElementById('secCDisplay');

    function renderSectionPanel() {
        if (!activeSectionKey || !secOptions) return;
        const cfg = sectionConfig[activeSectionKey];
        secOptions.innerHTML = cfg.marks.map((m, i) => {
            const sel = m === cfg.selected ? 'time-option--selected' : '';
            return `<div class="time-option ${sel}" style="flex: 1 1 100%;" data-val="${m}">${cfg.labels[i]}</div>`;
        }).join('');
    }

    function updateSectionDisplays() {
        ['A', 'B', 'C'].forEach(key => {
            const el = document.getElementById(`sec${key}DisplayValue`);
            if (el) el.textContent = sectionConfig[key].selected > 0 ? `${sectionConfig[key].selected} Marks` : 'Not Selected';
        });
        const total = sectionConfig.A.selected + sectionConfig.B.selected + sectionConfig.C.selected;
        const totalEl = document.getElementById('testTotalMarksDisplay');
        if (totalEl) totalEl.textContent = total > 0 ? `Total: ${total} marks` : 'Total: 0 marks';
    }

    function openSectionPanel(key) {
        if (activeSectionKey === key && secPanel.style.display !== 'none') {
            secPanel.style.display = 'none';
            activeSectionKey = null;
            resetDisplayBorders();
            return;
        }
        activeSectionKey = key;
        renderSectionPanel();
        secPanel.style.display = 'flex';

        // Position under the clicked column (3 columns with 1rem gap)
        if (key === 'A')      secPanel.style.marginLeft = '0';
        else if (key === 'B') secPanel.style.marginLeft = 'calc(33.333% + 0.33rem)';
        else                  secPanel.style.marginLeft = 'calc(66.666% + 0.67rem)';

        resetDisplayBorders();
        const display = document.getElementById(`sec${key}Display`);
        if (display) display.style.borderColor = 'var(--primary)';
    }

    function resetDisplayBorders() {
        [secADisplay, secBDisplay, secCDisplay].forEach(d => {
            if (d) d.style.borderColor = 'var(--border-color)';
        });
    }

    if (secADisplay) secADisplay.addEventListener('click', (e) => { e.stopPropagation(); openSectionPanel('A'); });
    if (secBDisplay) secBDisplay.addEventListener('click', (e) => { e.stopPropagation(); openSectionPanel('B'); });
    if (secCDisplay) secCDisplay.addEventListener('click', (e) => { e.stopPropagation(); openSectionPanel('C'); });

    if (secPanel) {
        secPanel.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!e.target.classList.contains('time-option') || !activeSectionKey) return;
            sectionConfig[activeSectionKey].selected = parseInt(e.target.dataset.val, 10);
            renderSectionPanel();
            updateSectionDisplays();
        });
    }

    // Click outside closes panel
    window.addEventListener('click', () => {
        if (secPanel) secPanel.style.display = 'none';
        activeSectionKey = null;
        resetDisplayBorders();
    });

    function getSectionValues() {
        const secAMarks = sectionConfig.A.selected;
        const secBMarks = sectionConfig.B.selected;
        const secCMarks = sectionConfig.C.selected;
        const sections  = (secAMarks > 0 ? 'A' : '') + (secBMarks > 0 ? 'B' : '') + (secCMarks > 0 ? 'C' : '');
        const marksTarget = secAMarks + secBMarks + secCMarks;
        return { secAMarks, secBMarks, secCMarks, sections, marksTarget };
    }

    document.getElementById('btnGenerateTest')?.addEventListener('click', async () => {
        const topic    = document.getElementById('testTopic').value.trim();
        const subject  = document.getElementById('testSubject').value;
        const grade    = document.getElementById('testGrade').value;
        const cogFocus = document.querySelector('input[name="cogFocus"]:checked')?.value ?? 'balanced';
        const fileId   = document.getElementById('testMaterial')?.value || undefined;
        const { secAMarks, secBMarks, secCMarks, sections, marksTarget } = getSectionValues();

        const btn       = document.getElementById('btnGenerateTest');
        const outputBox = document.getElementById('testOutputBox');
        const outputEl  = document.getElementById('testOutput');

        if (!subject || !grade) {
            window.showStatus('testStatus', 'Please select class and subject.', 'error');
            return;
        }
        if (!sections) {
            window.showStatus('testStatus', 'Please select marks for at least one section.', 'error');
            return;
        }

        btn.disabled    = true;
        btn.textContent = 'Generating...';
        outputBox.style.display = 'none';
        window.showStatus('testStatus', 'This may take 20–30 seconds for longer papers…', 'info');

        try {
            const queryText = topic || `${subject} ${grade} comprehensive review`;
            const result = await ragQuery(queryText, subject, grade, 'test', {
                marks_target: marksTarget,
                sections,
                sec_a_marks:  secAMarks,
                sec_b_marks:  secBMarks,
                sec_c_marks:  secCMarks,
                cog_focus:    cogFocus,
                ...(fileId ? { file_id: fileId } : {}),
            });
            outputEl.textContent    = result;
            outputBox.style.display = 'block';
            window.showStatus('testStatus', '', 'success');
        } catch (err) {
            window.showStatus('testStatus', err.message || 'Something went wrong.', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = '✨ Generate Test Paper';
        }
    });

    // ── Filter material dropdown when class/subject changes ───
    document.getElementById('testGrade')?.addEventListener('change', () => filterMaterialDropdown());
    document.getElementById('testSubject')?.addEventListener('change', () => filterMaterialDropdown());

    document.getElementById('btnCopyTest')?.addEventListener('click', () => {
        const text = document.getElementById('testOutput').textContent;
        navigator.clipboard.writeText(text);
        const btn = document.getElementById('btnCopyTest');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });

    document.getElementById('btnDownloadTest')?.addEventListener('click', () => {
        const text  = document.getElementById('testOutput').textContent;
        const topic = document.getElementById('testTopic').value.trim() || 'test-paper';
        const filename = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '.txt';
        const blob = new Blob([text], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    });
}

let allIndexedFiles = [];

async function populateMaterialDropdown() {
    const sel = document.getElementById('testMaterial');
    if (!sel) return;
    const filesRes  = await window.api.get('files', {}, 'id, title, subject, grade');
    const chunksRes = await window.api.get('material_chunks', {}, 'file_id');
    const indexedIds = new Set((chunksRes.data || []).map(r => r.file_id));
    allIndexedFiles = (filesRes.data || []).filter(f => indexedIds.has(f.id));
    filterMaterialDropdown();
}

function filterMaterialDropdown() {
    const sel = document.getElementById('testMaterial');
    if (!sel) return;
    const grade   = document.getElementById('testGrade')?.value || '';
    const subject = document.getElementById('testSubject')?.value || '';

    // Keep current selection if still valid
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

    // Restore previous selection if it still exists
    if (prevValue && sel.querySelector(`option[value="${prevValue}"]`)) {
        sel.value = prevValue;
    }
}

export function init() {
    attachAIToolListeners();
    populateMaterialDropdown();
}

export function refresh() { }
