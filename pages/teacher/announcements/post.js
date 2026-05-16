const user = window.auth.getUser();

function updateWaPreview() {
    const titleInput = document.getElementById('noticeTitle');
    const textarea   = document.getElementById('noticeMessage');
    const waHint     = document.getElementById('waMessageHint');
    const waCount    = document.getElementById('waCharCount');
    const waPreviewBubble = document.getElementById('waPreviewBubble');

    const rawMsg = textarea?.value || '';
    const title  = titleInput?.value?.trim() || '';
    const body   = title ? `*${title}* — ${rawMsg.replace(/[\n\r]/g, ' ')}` : rawMsg.replace(/[\n\r]/g, ' ');
    const len    = rawMsg.length;

    if (waPreviewBubble) {
        waPreviewBubble.textContent =
            `Dear [Recipient Name],\n\nDo note:\n\n${body}\n\nPlease save this notice for your reference.\nDo reach out if you need any clarification.\n\n— Mitesh Sir's Study Circle`;
    }
    if (waHint)  waHint.style.display = /[\n\r]/.test(rawMsg) ? 'block' : 'none';
    if (waCount) {
        waCount.style.display = 'block';
        waCount.textContent   = `${len} / 900`;
        waCount.style.color   = len > 900 ? 'var(--color-error, #dc2626)' : 'var(--text-muted)';
    }
}

export function init() {
    window.populateGradePills('noticeGrade', true);

    document.getElementById('noticeMessage')?.addEventListener('input', updateWaPreview);
    document.getElementById('noticeTitle')?.addEventListener('input', updateWaPreview);
    updateWaPreview();

    const form = document.getElementById('noticeForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn      = document.getElementById('btnNotice');
        const waStatus = document.getElementById('noticeWhatsAppStatus');

        btn.disabled    = true;
        btn.textContent = 'Posting...';
        if (waStatus) waStatus.style.display = 'none';

        const title   = document.getElementById('noticeTitle').value;
        const message = document.getElementById('noticeMessage').value;
        const grade   = window.getSelectedGrade('noticeGrade') || null;

        const response = await window.api.post('announcements', { title, message, grade, posted_by: user.id });

        if (response.success) {
            window.showStatus('noticeStatus', 'Announcement posted successfully!', 'success');

            if (window.whatsapp) {
                try {
                    if (waStatus) {
                        waStatus.textContent = 'Sending WhatsApp messages...';
                        waStatus.className   = 'status status--info';
                        waStatus.style.display = 'block';
                    }

                    let query = window.supabaseClient.from('profiles').select('id, name, phone, father_phone, mother_phone').eq('role', 'student');
                    if (grade) query = query.eq('grade', grade);
                    const { data: students } = await query;

                    if (students && students.length > 0) {
                        const seen = new Set();
                        const recipients = [];
                        students.forEach(s => {
                            window.whatsapp.resolveRecipients(s, 'both').forEach(r => {
                                if (r.phone && !seen.has(r.phone)) { seen.add(r.phone); recipients.push(r); }
                            });
                        });

                        if (recipients.length > 0) {
                            const result = await window.whatsapp.send({ type: 'announcement', recipients, payload: { title, message }, sentBy: user.id });
                            if (waStatus) {
                                waStatus.textContent = `WhatsApp: ${result.sent} sent, ${result.failed} failed`;
                                waStatus.className   = result.failed > 0 ? 'status status--error' : 'status status--success';
                                waStatus.style.display = 'block';
                            }
                        } else if (waStatus) {
                            waStatus.textContent   = 'No phone numbers found.';
                            waStatus.className     = 'status status--error';
                            waStatus.style.display = 'block';
                        }
                    }
                } catch (waErr) {
                    if (waStatus) {
                        waStatus.textContent   = 'WhatsApp failed: ' + waErr.message;
                        waStatus.className     = 'status status--error';
                        waStatus.style.display = 'block';
                    }
                }
            }

            window.safeFormReset(e.target);
            updateWaPreview();
        } else {
            window.showStatus('noticeStatus', response.error || 'Failed to post.', 'error');
        }

        btn.disabled    = false;
        btn.textContent = 'Post Announcement';
    });
}
