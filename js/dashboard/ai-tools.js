const user = window.auth.getUser();

function attachAIToolListeners() {

    // ── Pill toggle ───────────────────────────────────────────
    const pillDoubt = document.getElementById('pillDoubtSolver');
    const pillTest = document.getElementById('pillTestGenerator');
    const doubtPanel = document.getElementById('doubtSolverPanel');
    const testPanel = document.getElementById('testGeneratorPanel');

    pillDoubt?.addEventListener('click', () => {
        pillDoubt.classList.add('pill-toggle__btn--active');
        pillTest.classList.remove('pill-toggle__btn--active');
        doubtPanel.style.display = 'block';
        testPanel.style.display = 'none';
    });

    pillTest?.addEventListener('click', () => {
        pillTest.classList.add('pill-toggle__btn--active');
        pillDoubt.classList.remove('pill-toggle__btn--active');
        testPanel.style.display = 'block';
        doubtPanel.style.display = 'none';
    });

    // ── Shared RAG query helper ───────────────────────────────
    async function ragQuery(query, subject, grade, mode) {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/rag-query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ query, subject, grade, mode })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data.answer;
    }

    // ── Doubt Solver ──────────────────────────────────────────
    document.getElementById('btnAskDoubt')?.addEventListener('click', async () => {
        const question = document.getElementById('doubtQuestion').value.trim();
        const subject = document.getElementById('doubtSubject').value;
        const grade = document.getElementById('doubtGrade').value;
        const btn = document.getElementById('btnAskDoubt');
        const answerBox = document.getElementById('doubtAnswerBox');
        const answerEl = document.getElementById('doubtAnswer');

        if (!question || !subject || !grade) {
            window.showStatus('doubtStatus', 'Please fill in subject, grade and your question.', 'error');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Thinking...';
        answerBox.style.display = 'none';
        window.showStatus('doubtStatus', '', 'success');

        try {
            const answer = await ragQuery(question, subject, grade, 'doubt');
            answerEl.textContent = answer;
            answerBox.style.display = 'block';
            window.showStatus('doubtStatus', '', 'success');
        } catch (err) {
            window.showStatus('doubtStatus', err.message || 'Something went wrong.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '✨ Ask AI';
        }
    });

    document.getElementById('btnCopyDoubt')?.addEventListener('click', () => {
        const text = document.getElementById('doubtAnswer').textContent;
        navigator.clipboard.writeText(text);
        document.getElementById('btnCopyDoubt').textContent = 'Copied!';
        setTimeout(() => document.getElementById('btnCopyDoubt').textContent = 'Copy', 2000);
    });

    // ── Test Generator ────────────────────────────────────────
    document.getElementById('btnGenerateTest')?.addEventListener('click', async () => {
        const topic = document.getElementById('testTopic').value.trim();
        const subject = document.getElementById('testSubject').value;
        const grade = document.getElementById('testGrade').value;
        const btn = document.getElementById('btnGenerateTest');
        const outputBox = document.getElementById('testOutputBox');
        const outputEl = document.getElementById('testOutput');

        if (!topic || !subject || !grade) {
            window.showStatus('testStatus', 'Please fill in subject, grade and topic.', 'error');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Generating...';
        outputBox.style.display = 'none';

        try {
            const result = await ragQuery(topic, subject, grade, 'test');
            outputEl.textContent = result;
            outputBox.style.display = 'block';
            window.showStatus('testStatus', '', 'success');
        } catch (err) {
            window.showStatus('testStatus', err.message || 'Something went wrong.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '✨ Generate Test Paper';
        }
    });

    document.getElementById('btnCopyTest')?.addEventListener('click', () => {
        const text = document.getElementById('testOutput').textContent;
        navigator.clipboard.writeText(text);
        document.getElementById('btnCopyTest').textContent = 'Copied!';
        setTimeout(() => document.getElementById('btnCopyTest').textContent = 'Copy', 2000);
    });
}

export function init() {
    attachAIToolListeners();
}

export function refresh() { }