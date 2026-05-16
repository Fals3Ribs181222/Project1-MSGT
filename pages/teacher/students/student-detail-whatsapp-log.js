// js/dashboard/student-detail-whatsapp-log.js
// Renders the WhatsApp message history for a student.

export async function loadWhatsappLog(studentId) {
    const container = document.getElementById('sdWhatsappLog');
    if (!container) return;

    try {
        const { data, error } = await window.supabaseClient
            .from('whatsapp_log')
            .select('*')
            .eq('student_id', studentId)
            .order('sent_at', { ascending: false })
            .limit(15);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No messages sent to this student yet.</p>';
            return;
        }

        container.innerHTML = data.map(log => {
            const date = new Date(log.sent_at).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
            const typeLabel = log.message_type === 'report'
                ? '📊 Progress Report'
                : log.message_type === 'attendance'
                    ? '✅ Attendance'
                    : '💬 Message';
            return `
                <div style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.65rem 0;border-bottom:1px solid var(--border-light);">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:0.9rem;font-weight:600;color:var(--text-main);">${typeLabel}</div>
                        ${log.preview
                    ? `<div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${DOMPurify.sanitize(log.preview)}…</div>`
                    : ''}
                    </div>
                    <div style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap;padding-top:2px;">${date}</div>
                </div>
            `;
        }).join('');

    } catch (err) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">Could not load history.</p>';
        console.error('WA log fetch error:', err);
    }
}
