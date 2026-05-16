let user;
let conversationHistory = [];
let lastQuestion = '';
let lastAnswer = '';

export function init() {
    user = window.auth.getUser();
    attachListeners();

    // Consume quick-ask from home panel
    const quickAskRaw = sessionStorage.getItem('aiQuickAsk');
    if (quickAskRaw) {
        sessionStorage.removeItem('aiQuickAsk');
        try {
            const { subject, question } = JSON.parse(quickAskRaw);
            const subjectEl  = document.getElementById('aiSubject');
            const questionEl = document.getElementById('aiQuestion');
            if (subjectEl && subject)   subjectEl.value  = subject;
            if (questionEl && question) questionEl.value = question;
            if (question) setTimeout(handleAsk, 150);
        } catch (e) { /* ignore */ }
    }
}

export function refresh() {}

function attachListeners() {
    document.getElementById('btnStudentAsk')?.addEventListener('click', handleAsk);
    document.getElementById('btnCopyAI')?.addEventListener('click', copyAnswer);
    document.getElementById('btnFeedbackUp')?.addEventListener('click', () => submitFeedback('up'));
    document.getElementById('btnFeedbackDown')?.addEventListener('click', () => submitFeedback('down'));
    document.getElementById('btnClearAI')?.addEventListener('click', clearAll);

    // Allow Enter (without Shift) to submit
    document.getElementById('aiQuestion')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAsk();
        }
    });
}

async function handleAsk() {
    const question = document.getElementById('aiQuestion')?.value.trim();
    const subject  = document.getElementById('aiSubject')?.value;
    const grade    = user.grade;

    if (!question) {
        window.showStatus('aiStatus', 'Please enter a question.', 'error');
        return;
    }
    if (!subject) {
        window.showStatus('aiStatus', 'Please select a subject.', 'error');
        return;
    }

    const btn = document.getElementById('btnStudentAsk');
    const answerBox = document.getElementById('aiAnswerBox');
    const answerEl  = document.getElementById('aiAnswer');
    const sourcesEl = document.getElementById('aiSources');
    const suggestionsEl = document.getElementById('aiSuggestions');
    const suggestionBtns = document.getElementById('aiSuggestionBtns');

    btn.disabled = true;
    btn.textContent = 'Thinking...';
    answerBox.style.display = 'none';
    sourcesEl.style.display = 'none';
    suggestionsEl.style.display = 'none';
    answerEl.innerHTML = '';
    window.showStatus('aiStatus', '', 'success');

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
            (text) => {
                accumulated += text;
                const mainText = accumulated.split('---SUGGESTIONS---')[0];
                answerEl.innerHTML = renderMarkdown(mainText);
            },
            (result) => {
                const mainAnswer = result.fullText.split('---SUGGESTIONS---')[0].trim();
                conversationHistory.push({ question, answer: mainAnswer });
                if (conversationHistory.length > 3) conversationHistory.shift();
                lastQuestion = question;
                lastAnswer = mainAnswer;

                answerEl.innerHTML = renderMarkdown(mainAnswer);

                const sourcesList = document.getElementById('aiSourcesList');
                if (result.sources && result.sources.length > 0 && sourcesList) {
                    sourcesList.textContent = result.sources.map(s => s.title).join(', ');
                    sourcesEl.style.display = 'block';
                }

                if (result.suggestions && result.suggestions.length > 0 && suggestionBtns) {
                    suggestionBtns.innerHTML = '';
                    result.suggestions.forEach(q => {
                        const sBtn = document.createElement('button');
                        sBtn.className = 'btn btn--outline btn--sm';
                        sBtn.textContent = q;
                        sBtn.addEventListener('click', () => {
                            document.getElementById('aiQuestion').value = q;
                            handleAsk();
                        });
                        suggestionBtns.appendChild(sBtn);
                    });
                    suggestionsEl.style.display = 'block';
                }

                document.getElementById('btnClearAI').style.display = '';
            }
        );
    } catch (err) {
        window.showStatus('aiStatus', err.message || 'Something went wrong. Please try again.', 'error');
        answerBox.style.display = 'none';
    } finally {
        btn.disabled = false;
        btn.textContent = '✨ Ask AI';
    }
}

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
            conversation_history: conversationHistory.slice(-3)
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Request failed');
    }

    // Cache hit returns JSON; stream returns text/event-stream
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
                if (evt.text) {
                    fullText += evt.text;
                    onChunk(evt.text);
                }
                if (evt.done) {
                    onDone({ fullText, sources: evt.sources || [], suggestions: evt.suggestions || [] });
                }
                if (evt.error) throw new Error(evt.error);
            } catch (e) {
                if (e.message && e.message !== 'Unexpected end of JSON input') throw e;
            }
        }
    }
}

function renderMarkdown(text) {
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(marked.parse(text));
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copyAnswer() {
    const text = document.getElementById('aiAnswer')?.innerText;
    if (!text) return;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById('btnCopyAI');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
}

async function submitFeedback(rating) {
    try {
        await window.api.post('doubt_feedback', {
            user_id: user?.id,
            question: lastQuestion,
            answer: lastAnswer,
            subject: document.getElementById('aiSubject')?.value,
            grade: user?.grade,
            rating,
        });
        const fbUp = document.getElementById('btnFeedbackUp');
        const fbDown = document.getElementById('btnFeedbackDown');
        if (fbUp) fbUp.disabled = true;
        if (fbDown) fbDown.disabled = true;
        const activeBtn = rating === 'up' ? fbUp : fbDown;
        if (activeBtn) { activeBtn.style.background = 'var(--primary)'; activeBtn.style.color = 'white'; }
    } catch (e) {
        console.error('Feedback error:', e);
    }
}

function clearAll() {
    document.getElementById('aiQuestion').value = '';
    document.getElementById('aiAnswer').innerHTML = '';
    document.getElementById('aiAnswerBox').style.display = 'none';
    document.getElementById('aiSources').style.display = 'none';
    document.getElementById('aiSuggestions').style.display = 'none';
    document.getElementById('btnClearAI').style.display = 'none';
    window.showStatus('aiStatus', '', 'success');
    conversationHistory = [];
    lastQuestion = '';
    lastAnswer = '';
}
