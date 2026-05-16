// js/dashboard/messages.js — Conversation-centric Messages tab

const user = window.auth.getUser();

let allStudentsCache = [];
let conversations = [];
let activePhone = null;

// ── Load student profiles ────────────────────────────────────
async function loadProfiles() {
    const res = await window.api.get('profiles', { role: 'student' }, 'id, name, grade, phone, father_name, father_phone, mother_name, mother_phone');
    if (res.success && res.data) {
        let students = res.data;
        const activeGrade = window.getActiveGrade();
        if (activeGrade) students = students.filter(s => s.grade === activeGrade);
        allStudentsCache = students;
    }
    return allStudentsCache;
}

// ── Load & render conversations ──────────────────────────────
async function loadConversations() {
    const list = document.getElementById('msgContactList');
    if (list) list.innerHTML = '<p style="padding:2rem 1rem;text-align:center;color:var(--text-muted);">Loading...</p>';

    try {
        const all = await window.whatsapp.getConversations(allStudentsCache);
        // Only show contacts linked to this teacher's grade; drop unknown numbers from other grades
        conversations = all.filter(c => c.studentId !== null);
        renderContactList(conversations);
    } catch (err) {
        if (list) list.innerHTML = `<p style="padding:2rem 1rem;text-align:center;color:var(--text-muted);">Error: ${window.esc(err.message)}</p>`;
    }
}

// ── 24h window dot helper ────────────────────────────────────
function windowAvatarColor(ts) {
    if (!ts) return 'var(--primary)';
    const hoursLeft = (ts.getTime() + 24 * 3600 * 1000 - Date.now()) / 3600000;
    if (hoursLeft > 10) return 'var(--secondary)';
    if (hoursLeft > 2)  return 'var(--amber)';
    if (hoursLeft > 0)  return 'var(--cadmium-red)';
    return 'var(--text-main)';
}

// ── Render a single contact card ────────────────────────────
function renderContactCard(c) {
    const lastMsg = c.messages.length > 0 ? c.messages[c.messages.length - 1] : null;
    const preview = lastMsg
        ? (lastMsg.direction === 'out' ? 'You: ' : '') + (lastMsg.text || '').substring(0, 45)
        : '';
    const time = c.lastTimestamp ? formatRelativeTime(c.lastTimestamp) : '';
    const isActive = c.phone === activePhone ? ' msg-contact-card--active' : '';

    return `
        <div class="msg-contact-card${isActive}" data-phone="${window.esc(c.phone)}">
            <div class="msg-contact-card__avatar" style="background:${windowAvatarColor(c.lastIncomingTimestamp)};"></div>
            <div class="msg-contact-card__body">
                <div class="msg-contact-card__name">${window.esc(c.displayName)}</div>
                <div class="msg-contact-card__preview">${window.esc(preview)}</div>
            </div>
            <div class="msg-contact-card__meta">
                <div class="msg-contact-card__time">${time}</div>
            </div>
        </div>
    `;
}

// ── Render contact list (grouped by student) ─────────────────
function renderContactList(convos) {
    const list = document.getElementById('msgContactList');
    if (!list) return;

    if (convos.length === 0) {
        list.innerHTML = '<p style="padding:2rem 1rem;text-align:center;color:var(--text-muted);">No conversations yet</p>';
        return;
    }

    // Group conversations by studentId
    const groups = new Map();
    const unknowns = [];

    for (const c of convos) {
        if (c.studentId) {
            if (!groups.has(c.studentId)) {
                const student = allStudentsCache.find(s => s.id === c.studentId);
                groups.set(c.studentId, { name: student?.name || c.displayName, convos: [] });
            }
            groups.get(c.studentId).convos.push(c);
        } else {
            unknowns.push(c);
        }
    }

    // Sort groups by most recent activity across all contacts in the group
    const sortedGroups = [...groups.entries()].map(([studentId, group]) => {
        const lastTs = Math.max(...group.convos.map(c => c.lastTimestamp?.getTime() || 0));
        return { studentId, name: group.name, convos: group.convos, lastTs };
    }).sort((a, b) => b.lastTs - a.lastTs);

    let html = '';

    for (const group of sortedGroups) {
        const lastTs = group.lastTs > 0 ? new Date(group.lastTs) : null;
        const time = lastTs ? formatRelativeTime(lastTs) : '';
        const isExpanded = group.convos.some(c => c.phone === activePhone);
        const expandedClass = isExpanded ? ' msg-student-group--expanded' : '';

        html += `
            <div class="msg-student-group${expandedClass}" data-student-id="${window.esc(group.studentId)}">
                <div class="msg-student-group__header">
                    <div class="msg-student-group__name">${window.esc(group.name)}</div>
                    <span class="msg-student-group__count">${group.convos.length}</span>
                    <span class="msg-student-group__time">${time}</span>
                    <i class="ri-arrow-down-s-line msg-student-group__chevron"></i>
                </div>
                <div class="msg-student-group__contacts">
                    ${group.convos.map(renderContactCard).join('')}
                </div>
            </div>
        `;
    }

    // Unknown numbers (no studentId) as flat cards at the bottom
    html += unknowns.map(renderContactCard).join('');

    list.innerHTML = html;

    // Group header toggle
    list.querySelectorAll('.msg-student-group__header').forEach(header => {
        header.addEventListener('click', () => {
            header.closest('.msg-student-group').classList.toggle('msg-student-group--expanded');
        });
    });

    // Contact card click → open thread
    list.querySelectorAll('.msg-contact-card').forEach(card => {
        card.addEventListener('click', () => {
            openThread(card.dataset.phone);
        });
    });
}

// ── Open a conversation thread ───────────────────────────────
function openThread(phone) {
    activePhone = phone;
    const convo = conversations.find(c => c.phone === phone);
    if (!convo) return;

    // Update active card styling
    document.querySelectorAll('.msg-contact-card').forEach(c => {
        c.classList.toggle('msg-contact-card--active', c.dataset.phone === phone);
    });

    // Auto-expand the parent group if this card is inside one
    const activeCard = document.querySelector(`.msg-contact-card[data-phone="${phone}"]`);
    activeCard?.closest('.msg-student-group')?.classList.add('msg-student-group--expanded');

    // Mobile: show thread, hide contacts
    document.getElementById('msgLayout')?.classList.add('msg-layout--thread-open');

    renderThread(convo);
}

// ── Render thread ────────────────────────────────────────────
function renderThread(convo) {
    const threadEl = document.getElementById('msgThread');
    if (!threadEl) return;

    const windowBadge = convo.hasRecentIncoming
        ? '<span class="msg-window-badge msg-window-badge--open">24h window open</span>'
        : '<span class="msg-window-badge msg-window-badge--closed">24h window closed</span>';

    let messagesHtml = '';
    let lastDateStr = '';

    for (const msg of convo.messages) {
        const dateStr = msg.timestamp.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        if (dateStr !== lastDateStr) {
            messagesHtml += `<div class="msg-date-divider">${dateStr}</div>`;
            lastDateStr = dateStr;
        }

        const timeStr = msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const dirClass = msg.direction === 'in' ? 'msg-bubble--in' : 'msg-bubble--out';
        const typeLabel = msg.type && msg.type !== 'custom'
            ? `<div class="msg-bubble__type">${window.esc(msg.type)}</div>`
            : '';

        messagesHtml += `<div class="msg-bubble ${dirClass}">${typeLabel}${DOMPurify.sanitize(msg.text || '')}</div>`;
    }

    if (convo.messages.length === 0) {
        messagesHtml = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No messages yet</p>';
    }

    threadEl.innerHTML = `
        <div class="msg-thread__header">
            <button class="msg-thread__back" id="msgThreadBack">
                <i class="ri-arrow-left-line"></i>
            </button>
            <div class="msg-thread__header-info">
                <div class="msg-thread__header-name">${window.esc(convo.displayName)}</div>
                <div class="msg-thread__header-phone">+91 ${window.esc(convo.phone)} ${convo.label ? `&middot; ${window.esc(convo.label)}` : ''}</div>
            </div>
            ${windowBadge}
        </div>
        <div class="msg-thread__messages" id="msgThreadMessages">
            ${messagesHtml}
        </div>
        <div class="msg-reply">
            <textarea class="msg-reply__input" id="msgReplyInput"
                      placeholder="Type a message..." rows="1" maxlength="1000"></textarea>
            <button class="msg-reply__send" id="msgReplySend" title="Send">
                <i class="ri-send-plane-fill"></i>
            </button>
        </div>
        <div id="msgReplyStatus" style="display:none;"></div>
    `;

    // Scroll to bottom
    const msgContainer = document.getElementById('msgThreadMessages');
    if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;

    // Event listeners
    document.getElementById('msgThreadBack')?.addEventListener('click', closeThread);
    document.getElementById('msgReplySend')?.addEventListener('click', handleSendReply);

    const replyInput = document.getElementById('msgReplyInput');
    replyInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendReply();
        }
    });

    // Auto-resize textarea
    replyInput?.addEventListener('input', () => {
        replyInput.style.height = 'auto';
        replyInput.style.height = Math.min(replyInput.scrollHeight, 120) + 'px';
    });
}

// ── Close thread (mobile back) ───────────────────────────────
function closeThread() {
    activePhone = null;
    document.getElementById('msgLayout')?.classList.remove('msg-layout--thread-open');

    const threadEl = document.getElementById('msgThread');
    if (threadEl) {
        threadEl.innerHTML = '<div class="msg-thread__empty"><p>Select a conversation<br>or start a new message</p></div>';
    }

    document.querySelectorAll('.msg-contact-card').forEach(c => {
        c.classList.remove('msg-contact-card--active');
    });
}

// ── Send reply from thread ───────────────────────────────────
async function handleSendReply() {
    const input = document.getElementById('msgReplyInput');
    const btn = document.getElementById('msgReplySend');
    const text = input?.value?.trim();
    if (!btn || !text || !activePhone) return;

    const convo = conversations.find(c => c.phone === activePhone);
    if (!convo) return;

    btn.disabled = true;

    try {
        const recipient = {
            phone: activePhone,
            name: convo.displayName,
            role: convo.label === 'Student' ? 'student' : convo.label === 'Parent' ? 'parent' : 'other',
            student_id: convo.studentId || null,
        };

        await window.whatsapp.send({
            type: 'custom',
            recipients: [recipient],
            payload: { message: text },
            sentBy: user?.id,
        });

        // Append to in-memory conversation
        const now = new Date();
        convo.messages.push({ direction: 'out', text, timestamp: now, type: 'custom' });
        convo.lastTimestamp = now;

        // Append bubble to thread
        const msgContainer = document.getElementById('msgThreadMessages');
        if (msgContainer) {
            const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const bubble = document.createElement('div');
            bubble.className = 'msg-bubble msg-bubble--out';
            bubble.innerHTML = window.esc(text);
            msgContainer.appendChild(bubble);
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }

        // Clear input
        input.value = '';
        input.style.height = 'auto';

        // Update contact list preview
        renderContactList(conversations);

    } catch (err) {
        const statusEl = document.getElementById('msgReplyStatus');
        if (statusEl) {
            statusEl.className = 'msg-reply-status msg-reply-status--error';
            statusEl.textContent = 'Failed: ' + err.message;
            statusEl.style.display = 'block';
            setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
        }
    } finally {
        btn.disabled = false;
    }
}

// ── New message modal ────────────────────────────────────────
function openNewMessageModal() {
    const overlay = document.getElementById('newMsgOverlay');
    if (!overlay) return;

    // Populate student dropdown
    const select = document.getElementById('newMsgStudentSelect');
    if (select) {
        select.innerHTML = '<option value="">Select a student...</option>' +
            allStudentsCache.map(s => `<option value="${s.id}">${window.esc(s.name)}</option>`).join('');
    }

    // Reset fields
    const textEl = document.getElementById('newMsgText');
    if (textEl) textEl.value = '';
    const phoneEl = document.getElementById('newMsgPhoneInput');
    if (phoneEl) phoneEl.value = '';
    const statusEl = document.getElementById('newMsgStatus');
    if (statusEl) statusEl.style.display = 'none';

    switchNewMsgTab('student');
    overlay.style.display = 'flex';
}

function closeNewMessageModal() {
    const overlay = document.getElementById('newMsgOverlay');
    if (overlay) overlay.style.display = 'none';
}

function switchNewMsgTab(mode) {
    const tabStudent = document.getElementById('newMsgTabStudent');
    const tabPhone = document.getElementById('newMsgTabPhone');
    const studentMode = document.getElementById('newMsgStudentMode');
    const phoneMode = document.getElementById('newMsgPhoneMode');

    if (mode === 'student') {
        tabStudent?.classList.add('msg-new-modal__tab--active');
        tabPhone?.classList.remove('msg-new-modal__tab--active');
        if (studentMode) studentMode.style.display = 'block';
        if (phoneMode) phoneMode.style.display = 'none';
    } else {
        tabPhone?.classList.add('msg-new-modal__tab--active');
        tabStudent?.classList.remove('msg-new-modal__tab--active');
        if (studentMode) studentMode.style.display = 'none';
        if (phoneMode) phoneMode.style.display = 'block';
    }
}

async function handleNewMessageSend() {
    const tabIsStudent = document.getElementById('newMsgTabStudent')?.classList.contains('msg-new-modal__tab--active');
    const text = document.getElementById('newMsgText')?.value?.trim();
    const sendBtn = document.getElementById('newMsgSend');
    if (!sendBtn) return;

    if (!text) {
        window.showStatus('newMsgStatus', 'Please type a message.', 'error');
        return;
    }

    let recipients = [];

    if (tabIsStudent) {
        const studentId = document.getElementById('newMsgStudentSelect')?.value;
        if (!studentId) {
            window.showStatus('newMsgStatus', 'Please select a student.', 'error');
            return;
        }
        const student = allStudentsCache.find(s => s.id === studentId);
        if (!student) return;

        const target = document.querySelector('input[name="newMsgRecipientRadio"]:checked')?.value || 'parent';
        recipients = window.whatsapp.resolveRecipients(student, target);

        if (recipients.length === 0) {
            window.showStatus('newMsgStatus', 'No phone number available for the selected recipient.', 'error');
            return;
        }
    } else {
        const phone = document.getElementById('newMsgPhoneInput')?.value?.trim();
        if (!phone || phone.length < 10) {
            window.showStatus('newMsgStatus', 'Please enter a valid 10-digit phone number.', 'error');
            return;
        }
        recipients = [{
            phone: phone,
            name: `+91 ${phone}`,
            role: 'other',
            student_id: null,
        }];
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    try {
        await window.whatsapp.send({
            type: 'custom',
            recipients,
            payload: { message: text },
            sentBy: user?.id,
        });

        closeNewMessageModal();

        // Refresh conversations and open the thread for the first recipient
        await loadConversations();
        const sentPhone = recipients[0].phone.slice(-10);
        openThread(sentPhone);

    } catch (err) {
        window.showStatus('newMsgStatus', 'Failed: ' + err.message, 'error');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="ri-send-plane-fill"></i> Send';
    }
}

// ── Contact search filter ────────────────────────────────────
function filterContacts(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
        renderContactList(conversations);
        return;
    }
    const filtered = conversations.filter(c =>
        c.displayName.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
    renderContactList(filtered);
    // Auto-expand all groups when a search is active so results are visible
    document.querySelectorAll('.msg-student-group').forEach(g => {
        g.classList.add('msg-student-group--expanded');
    });
}

// ── Relative time formatting ─────────────────────────────────
function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ── Init & Refresh ───────────────────────────────────────────
export async function init() {
    await loadProfiles();
    await loadConversations();

    // Search
    document.getElementById('msgContactSearch')?.addEventListener('input', (e) => {
        filterContacts(e.target.value);
    });

    // New message button
    document.getElementById('btnNewMessage')?.addEventListener('click', openNewMessageModal);

    // New message modal events
    document.getElementById('newMsgTabStudent')?.addEventListener('click', () => switchNewMsgTab('student'));
    document.getElementById('newMsgTabPhone')?.addEventListener('click', () => switchNewMsgTab('phone'));
    document.getElementById('newMsgCancel')?.addEventListener('click', closeNewMessageModal);
    document.getElementById('newMsgSend')?.addEventListener('click', handleNewMessageSend);

    // Close modal on overlay click
    document.getElementById('newMsgOverlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'newMsgOverlay') closeNewMessageModal();
    });
}

export function refresh() {
    loadProfiles().then(() => loadConversations());
}
