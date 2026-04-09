const user = window.auth.getUser();

// ── Module-level state for conversation history ─────────────
let conversationHistory = [];
let lastQuestion = '';
let lastAnswer = '';
let sessionChunks = null;  // context chunks from last response, reused for follow-ups

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

    // ── Shared RAG query helper (used by test mode — non-streaming) ─
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

    // ── Streaming RAG query (used by doubt mode) ────────────
    async function ragQueryStream(query, subject, grade, onChunk, onDone) {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/rag-query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                query, subject, grade, mode: 'doubt',
                conversation_history: conversationHistory.slice(-3),
                ...(sessionChunks && conversationHistory.length > 0 ? { session_chunks: sessionChunks } : {})
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Request failed');
        }

        // Cache hit returns JSON, stream returns text/event-stream
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await res.json();
            onChunk(data.answer);
            onDone({ fullText: data.answer, sources: data.sources || [], suggestions: data.suggestions || [] });
            return;
        }

        // Stream SSE
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;

                try {
                    const evt = JSON.parse(jsonStr);
                    if (evt.text) {
                        fullText += evt.text;
                        onChunk(evt.text);
                    }
                    if (evt.done) {
                        if (evt.session_chunks) sessionChunks = evt.session_chunks;
                        onDone({
                            fullText,
                            sources: evt.sources || [],
                            suggestions: evt.suggestions || []
                        });
                    }
                    if (evt.error) {
                        throw new Error(evt.error);
                    }
                } catch (e) {
                    if (e.message && e.message !== 'Unexpected end of JSON input') throw e;
                }
            }
        }
    }

    // ── Render markdown safely ──────────────────────────────
    function renderMarkdown(text) {
        if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(marked.parse(text));
        }
        // Fallback: plain text
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ── Doubt Solver ──────────────────────────────────────────
    document.getElementById('btnAskDoubt')?.addEventListener('click', async () => {
        const question = document.getElementById('doubtQuestion').value.trim();
        const subject  = document.getElementById('doubtSubject').value;
        const grade    = document.getElementById('doubtGrade').value;
        const btn      = document.getElementById('btnAskDoubt');
        const answerBox = document.getElementById('doubtAnswerBox');
        const answerEl  = document.getElementById('doubtAnswer');
        const sourcesEl = document.getElementById('doubtSources');
        const sourcesList = document.getElementById('doubtSourcesList');
        const suggestionsEl = document.getElementById('doubtSuggestions');
        const suggestionBtns = document.getElementById('doubtSuggestionBtns');

        if (!question || !subject || !grade) {
            window.showStatus('doubtStatus', 'Please fill in subject, grade and your question.', 'error');
            return;
        }

        if (conversationHistory.length === 0) sessionChunks = null;

        btn.disabled    = true;
        btn.textContent = 'Thinking...';
        answerBox.style.display = 'none';
        sourcesEl.style.display = 'none';
        suggestionsEl.style.display = 'none';
        answerEl.innerHTML = '';
        window.showStatus('doubtStatus', '', 'success');

        // Reset feedback buttons
        const fbUp = document.getElementById('btnFeedbackUp');
        const fbDown = document.getElementById('btnFeedbackDown');
        if (fbUp) { fbUp.disabled = false; fbUp.style.background = ''; fbUp.style.color = ''; }
        if (fbDown) { fbDown.disabled = false; fbDown.style.background = ''; fbDown.style.color = ''; }

        let accumulated = '';

        try {
            answerBox.style.display = 'block';

            await ragQueryStream(
                question, subject, grade,
                // onChunk: render streamed text incrementally
                (text) => {
                    accumulated += text;
                    const mainText = accumulated.split('---SUGGESTIONS---')[0];
                    answerEl.innerHTML = renderMarkdown(mainText);
                },
                // onDone: show sources, suggestions, update history
                (result) => {
                    const mainAnswer = result.fullText.split('---SUGGESTIONS---')[0].trim();
                    conversationHistory.push({ question, answer: mainAnswer });
                    if (conversationHistory.length > 3) conversationHistory.shift();
                    lastQuestion = question;
                    lastAnswer = mainAnswer;

                    // Final render
                    answerEl.innerHTML = renderMarkdown(mainAnswer);

                    // Sources
                    if (result.sources.length > 0) {
                        sourcesList.textContent = result.sources.map(s => s.title).join(', ');
                        sourcesEl.style.display = 'block';
                    }

                    // Follow-up suggestions
                    if (result.suggestions.length > 0) {
                        suggestionBtns.innerHTML = '';
                        result.suggestions.forEach(q => {
                            const sBtn = document.createElement('button');
                            sBtn.className = 'btn btn--outline btn--sm';
                            sBtn.textContent = q;
                            sBtn.addEventListener('click', () => {
                                document.getElementById('doubtQuestion').value = q;
                                document.getElementById('btnAskDoubt').click();
                            });
                            suggestionBtns.appendChild(sBtn);
                        });
                        suggestionsEl.style.display = 'block';
                    }
                }
            );
        } catch (err) {
            window.showStatus('doubtStatus', err.message || 'Something went wrong.', 'error');
            answerBox.style.display = 'none';
        } finally {
            btn.disabled    = false;
            btn.textContent = '✨ Ask AI';
        }
    });

    // ── Copy doubt answer ──────────────────────────────────
    document.getElementById('btnCopyDoubt')?.addEventListener('click', () => {
        const text = document.getElementById('doubtAnswer').innerText;
        navigator.clipboard.writeText(text);
        const btn = document.getElementById('btnCopyDoubt');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });

    // ── Feedback handlers ──────────────────────────────────
    async function submitFeedback(rating) {
        try {
            await window.api.post('doubt_feedback', {
                user_id: user?.id,
                question: lastQuestion,
                answer: lastAnswer,
                subject: document.getElementById('doubtSubject').value,
                grade: document.getElementById('doubtGrade').value,
                rating,
            });
            const fbUp = document.getElementById('btnFeedbackUp');
            const fbDown = document.getElementById('btnFeedbackDown');
            fbUp.disabled = true;
            fbDown.disabled = true;
            const activeBtn = rating === 'up' ? fbUp : fbDown;
            activeBtn.style.background = 'var(--primary)';
            activeBtn.style.color = 'white';
        } catch (e) {
            console.error('Feedback error:', e);
        }
    }

    document.getElementById('btnFeedbackUp')?.addEventListener('click', () => submitFeedback('up'));
    document.getElementById('btnFeedbackDown')?.addEventListener('click', () => submitFeedback('down'));

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

        const display = document.getElementById(`sec${key}Display`);

        if (window.innerWidth <= 768) {
            // On mobile: move panel into DOM right after the clicked section
            const wrapper = display?.closest('.form__row-item');
            if (wrapper) wrapper.after(secPanel);
            secPanel.style.marginLeft = '0';
            secPanel.style.width = '100%';
        } else {
            // On desktop: position under the clicked column
            if (key === 'A')      secPanel.style.marginLeft = '0';
            else if (key === 'B') secPanel.style.marginLeft = 'calc(33.333% + 0.33rem)';
            else                  secPanel.style.marginLeft = 'calc(66.666% + 0.67rem)';
            secPanel.style.width = 'calc(33.333% - 0.67rem)';
        }

        resetDisplayBorders();
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

    // ── Cognitive Focus pill toggle ───────────────────────────
    document.querySelectorAll('[data-cog]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-cog]').forEach(b => b.classList.remove('pill-toggle__btn--active'));
            btn.classList.add('pill-toggle__btn--active');
            document.getElementById('cogFocusValue').value = btn.dataset.cog;
        });
    });

    document.getElementById('btnGenerateTest')?.addEventListener('click', async () => {
        const topic    = document.getElementById('testTopic').value.trim();
        const subject  = document.getElementById('testSubject').value;
        const grade    = document.getElementById('testGrade').value;
        const cogFocus = document.getElementById('cogFocusValue')?.value ?? 'balanced';
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

    // ── Filter material dropdown when class/subject changes ───
    document.getElementById('testGrade')?.addEventListener('change', () => filterMaterialDropdown());
    document.getElementById('testSubject')?.addEventListener('change', () => filterMaterialDropdown());

    document.getElementById('btnCopyTest')?.addEventListener('click', () => {
        const text = document.getElementById('testOutput').innerText;
        navigator.clipboard.writeText(text);
        const btn = document.getElementById('btnCopyTest');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });

    // ── Load docx library lazily ───────────────────────────────
    function loadDocx() {
        return new Promise((resolve) => {
            if (window.docx) { resolve(); return; }
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/docx@8.5.0/build/index.umd.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // ── Generate watermark Image ArrayBuffer with low opacity ─────────────
    async function getWatermarkImage() {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const MAX_HEIGHT = 600;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.globalAlpha = 0.15; // Set watermark transparency
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(blob => {
                    if (blob) {
                        blob.arrayBuffer().then(buffer => {
                            resolve({ data: buffer, width, height });
                        }).catch(reject);
                    } else {
                        reject(new Error("Canvas toBlob failed"));
                    }
                }, 'image/png');
            };
            img.onerror = reject;
            img.src = '/logo.png';
        });
    }

    // ── Convert output text to a docx Blob ────────────────────
    async function buildDocxBlob(outputEl) {
        await loadDocx();
        const { Document, Paragraph, TextRun, AlignmentType, Packer, PageBreak, Header, ImageRun } = window.docx;

        const lines = outputEl.innerText.split('\n');
        const children = [];

        for (const line of lines) {
            const t = line.trim();
            if (!t) { children.push(new Paragraph({ text: '' })); continue; }

            // Centre-aligned titles: all-caps short lines (institution name, paper title)
            const isCentreTitle = t === t.toUpperCase() && t.length <= 60 && /[A-Z]{3}/.test(t)
                && !/^\(/.test(t) && !/^\[/.test(t) && !/^Q\d/.test(t);
            // Section headings: SECTION A / ANSWER KEY
            const isSectionHead = /^SECTION [ABC]/.test(t) || t === 'ANSWER KEY';
            // Question lines: (i), (ii), Q2, Q3 …
            const isQuestion = /^\((?:i{1,3}|iv|v|vi{1,3}|ix|x{1,2}|xi{1,2}|xiii|xiv)\)/.test(t)
                || /^Q\d+/.test(t);

            if (isSectionHead) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: t, bold: true, size: 26, font: 'Times New Roman' })],
                    spacing: { before: 280, after: 140 },
                }));
            } else if (isCentreTitle) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: t, bold: true, size: 28, font: 'Times New Roman' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 100, after: 100 },
                }));
            } else if (t === 'OR') {
                children.push(new Paragraph({
                    children: [new TextRun({ text: 'OR', bold: true, size: 24, font: 'Times New Roman' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 140, after: 140 },
                }));
            } else {
                children.push(new Paragraph({
                    children: [new TextRun({ text: line, size: 24, font: 'Times New Roman' })],
                    spacing: { after: 80 },
                    indent: isQuestion ? { left: 360 } : {},
                }));
            }
        }

        let watermarkHeader = null;
        try {
            const watermark = await getWatermarkImage();
            watermarkHeader = new Header({
                children: [
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: watermark.data,
                                transformation: {
                                    width: watermark.width,
                                    height: watermark.height,
                                },
                                floating: {
                                    horizontalPosition: { align: "center" },
                                    verticalPosition: { align: "center" },
                                    behindDocument: true,
                                },
                            }),
                        ],
                    }),
                ],
            });
        } catch (e) {
            console.error("Could not load watermark image:", e);
        }

        const sectionConfig = {
            properties: {
                page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } // 2cm margins
            },
            children,
        };

        if (watermarkHeader) {
            sectionConfig.headers = {
                default: watermarkHeader,
            };
        }

        const doc = new Document({
            sections: [sectionConfig],
        });

        return Packer.toBlob(doc);
    }

    // ── Download Word ──────────────────────────────────────────
    document.getElementById('btnDownloadWord')?.addEventListener('click', async () => {
        const outputEl = document.getElementById('testOutput');
        const topic    = document.getElementById('testTopic').value.trim() || 'test-paper';
        const filename = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '.docx';
        const btn      = document.getElementById('btnDownloadWord');

        btn.disabled    = true;
        btn.textContent = 'Generating...';

        try {
            const blob = await buildDocxBlob(outputEl);
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Word generation error:', err);
            window.showStatus('testStatus', 'Word generation failed.', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Download Word';
        }
    });

    // ── Download PDF ───────────────────────────────────────────
    function loadHtml2Pdf() {
        return new Promise((resolve) => {
            if (window.html2pdf) { resolve(); return; }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // ── Save to Materials (uploads .docx to Supabase Storage) ────
    document.getElementById('btnSaveToMaterials')?.addEventListener('click', async () => {
        const outputEl = document.getElementById('testOutput');
        const topic    = document.getElementById('testTopic').value.trim();
        const subject  = document.getElementById('testSubject').value;
        const grade    = document.getElementById('testGrade').value;
        const btn      = document.getElementById('btnSaveToMaterials');

        const title    = topic || `${subject} ${grade} Test`;
        const filename = (topic || `${subject}-${grade}-test`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '.docx';

        btn.disabled    = true;
        btn.textContent = 'Saving...';

        try {
            const docxBlob = await buildDocxBlob(outputEl);

            const filePath = `tests/${Date.now()}_${filename}`;
            const { error: storageError } = await window.supabaseClient
                .storage.from('materials').upload(filePath, docxBlob, {
                    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                });
            if (storageError) throw storageError;

            const { data: { publicUrl } } = window.supabaseClient
                .storage.from('materials').getPublicUrl(filePath);

            const res = await window.api.post('files', {
                title,
                subject,
                grade,
                file_url:    publicUrl,
                upload_type: 'test',
                uploaded_by: user.id,
            });
            if (!res.success) throw new Error(res.error);

            window.showStatus('testStatus', `✅ Saved "${title}" to Materials → Tests.`, 'success');
        } catch (err) {
            console.error('Save to Materials error:', err);
            window.showStatus('testStatus', err.message || 'Failed to save to Materials.', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Save to Materials';
        }
    });

    document.getElementById('btnDownloadPdf')?.addEventListener('click', async () => {
        const outputEl = document.getElementById('testOutput');
        const topic    = document.getElementById('testTopic').value.trim() || 'test-paper';
        const filename = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '.pdf';
        const btn      = document.getElementById('btnDownloadPdf');

        btn.disabled    = true;
        btn.textContent = 'Generating...';

        try {
            await loadHtml2Pdf();
            await window.html2pdf().set({
                margin:     [12, 12, 12, 12],
                filename,
                html2canvas: { scale: 2, useCORS: true },
                jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak:   { mode: ['avoid-all', 'css'] },
            }).from(outputEl).save();
        } catch (err) {
            console.error('PDF generation error:', err);
            window.showStatus('testStatus', 'PDF generation failed.', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Download PDF';
        }
    });
}

let allIndexedFiles = [];

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
    window.populateGradeSelect('doubtGrade');
    window.populateGradeSelect('testGrade', false);
    window.lockGradeSelect('doubtGrade', 'testGrade');
    attachAIToolListeners();
    populateMaterialDropdown();
}

export function refresh() { }
