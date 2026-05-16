const user = window.auth.getUser();

let conversationHistory = [];
let lastQuestion = '';
let lastAnswer = '';
let sessionChunks = null;

function renderMarkdown(text) {
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(marked.parse(text));
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function ragQueryStream(query, subject, grade, onChunk, onDone) {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/rag-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
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

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        const data = await res.json();
        onChunk(data.answer);
        onDone({ fullText: data.answer, sources: data.sources || [], suggestions: data.suggestions || [] });
        return;
    }

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
                if (evt.text) { fullText += evt.text; onChunk(evt.text); }
                if (evt.done) {
                    if (evt.session_chunks) sessionChunks = evt.session_chunks;
                    onDone({ fullText, sources: evt.sources || [], suggestions: evt.suggestions || [] });
                }
                if (evt.error) throw new Error(evt.error);
            } catch (e) {
                if (e.message && e.message !== 'Unexpected end of JSON input') throw e;
            }
        }
    }
}

async function submitFeedback(rating) {
    try {
        await window.api.post('doubt_feedback', {
            user_id: user?.id,
            question: lastQuestion,
            answer: lastAnswer,
            subject: document.getElementById('doubtSubject').value,
            grade: window.getSelectedGrade('doubtGrade'),
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

export function init() {
    window.populateGradePills('doubtGrade', true);

    document.getElementById('btnAskDoubt')?.addEventListener('click', async () => {
        const question  = document.getElementById('doubtQuestion').value.trim();
        const subject   = document.getElementById('doubtSubject').value;
        const grade     = window.getSelectedGrade('doubtGrade');
        const btn       = document.getElementById('btnAskDoubt');
        const answerBox = document.getElementById('doubtAnswerBox');
        const answerEl  = document.getElementById('doubtAnswer');
        const sourcesEl = document.getElementById('doubtSources');
        const sourcesList   = document.getElementById('doubtSourcesList');
        const suggestionsEl = document.getElementById('doubtSuggestions');
        const suggestionBtns = document.getElementById('doubtSuggestionBtns');

        if (!question || !subject || !grade) {
            window.showStatus('doubtStatus', 'Please fill in subject, grade and your question.', 'error');
            return;
        }

        if (conversationHistory.length === 0) sessionChunks = null;

        btn.disabled    = true;
        btn.textContent = 'Thinking...';
        answerBox.style.display     = 'none';
        sourcesEl.style.display     = 'none';
        suggestionsEl.style.display = 'none';
        answerEl.innerHTML = '';
        window.showStatus('doubtStatus', '', 'success');

        const fbUp = document.getElementById('btnFeedbackUp');
        const fbDown = document.getElementById('btnFeedbackDown');
        if (fbUp)   { fbUp.disabled = false;   fbUp.style.background = '';   fbUp.style.color = ''; }
        if (fbDown) { fbDown.disabled = false; fbDown.style.background = ''; fbDown.style.color = ''; }

        let accumulated = '';

        try {
            answerBox.style.display = 'block';

            await ragQueryStream(
                question, subject, grade,
                (text) => {
                    accumulated += text;
                    answerEl.innerHTML = renderMarkdown(accumulated.split('---SUGGESTIONS---')[0]);
                },
                (result) => {
                    const mainAnswer = result.fullText.split('---SUGGESTIONS---')[0].trim();
                    conversationHistory.push({ question, answer: mainAnswer });
                    if (conversationHistory.length > 3) conversationHistory.shift();
                    lastQuestion = question;
                    lastAnswer   = mainAnswer;

                    answerEl.innerHTML = renderMarkdown(mainAnswer);

                    if (result.sources.length > 0) {
                        sourcesList.textContent = result.sources.map(s => s.title).join(', ');
                        sourcesEl.style.display = 'block';
                    }

                    if (result.suggestions.length > 0) {
                        suggestionBtns.innerHTML = '';
                        result.suggestions.forEach(q => {
                            const sBtn = document.createElement('button');
                            sBtn.className   = 'btn btn--outline btn--sm';
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

    document.getElementById('btnCopyDoubt')?.addEventListener('click', () => {
        navigator.clipboard.writeText(document.getElementById('doubtAnswer').innerText);
        const btn = document.getElementById('btnCopyDoubt');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });

    document.getElementById('btnFeedbackUp')?.addEventListener('click',   () => submitFeedback('up'));
    document.getElementById('btnFeedbackDown')?.addEventListener('click', () => submitFeedback('down'));
}

export function refresh() {}
