import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Meta Cloud API sender — free-form text ────────────────────
async function sendViaMetaAPI(to: string, message: string) {
    // Normalise to E.164: strip non-digits, then prepend 91 if not already a 12-digit Indian number
    const digits = to.replace(/\D/g, '');
    const normalised = digits.startsWith('91') && digits.length === 12 ? digits : `91${digits.replace(/^0/, '')}`;

    const response = await fetch(
        `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: normalised,
                type: 'text',
                text: { body: message },
            }),
        }
    );

    if (!response.ok) {
        const err = await response.json();
        throw new Error(`Meta API error: ${err?.error?.message ?? response.statusText}`);
    }

    return response.json();
}

// ── Meta Cloud API sender — approved template ─────────────────
async function sendTemplateViaMetaAPI(to: string, templateName: string, params: string[]) {
    const digits = to.replace(/\D/g, '');
    const normalised = digits.startsWith('91') && digits.length === 12 ? digits : `91${digits.replace(/^0/, '')}`;

    const response = await fetch(
        `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: normalised,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: 'en' },
                    components: [
                        {
                            type: 'body',
                            parameters: params.map(p => ({ type: 'text', text: p })),
                        },
                    ],
                },
            }),
        }
    );

    if (!response.ok) {
        const err = await response.json();
        throw new Error(`Meta API error: ${err?.error?.message ?? response.statusText}`);
    }

    return response.json();
}

// ── Message templates ─────────────────────────────────────────
function buildMessage(type: string, payload: Record<string, string>): string {
    const footer = '\n\n— Mitesh Sir via TuteFlow';

    switch (type) {
        case 'attendance': {
            const status = payload.status || 'absent';
            const name = payload.student_name || 'Student';
            const subject = payload.subject || '';
            const date = payload.date || new Date().toISOString().split('T')[0];
            const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long',
            });
            if (status === 'absent') {
                return `❌ *Absence Alert*\n\nHi, ${name} was marked *absent* for ${subject} class on ${formattedDate}.\n\nIf this is incorrect, please contact Mitesh Sir.${footer}`;
            }
            return `⏰ *Late Arrival*\n\nHi, ${name} was marked *late* for ${subject} class on ${formattedDate}.${footer}`;
        }

        case 'score': {
            const name = payload.student_name || 'Student';
            const test = payload.test_title || 'Test';
            const score = payload.score || '';
            const subject = payload.subject || '';
            return `📝 *Test Result*\n\n${name} scored *${score}* in ${test} (${subject}).${footer}`;
        }

        case 'announcement': {
            const batch = payload.batch_name || '';
            const msg = payload.message || '';
            const title = payload.title || 'Announcement';
            return `📢 *${title}*${batch ? ` — ${batch}` : ''}\n\n${msg}${footer}`;
        }

        case 'report': {
            const report = payload.report || '';
            return `✨ *Student Progress Report*\n\n${report}${footer}`;
        }

        case 'custom': {
            const msg = payload.message || '';
            return `${msg}${footer}`;
        }

        default:
            return `${payload.message || ''}${footer}`;
    }
}

// ── Log to whatsapp_log ───────────────────────────────────────
async function logMessage(
    type: string,
    studentId: string | null,
    recipientPhone: string,
    recipientName: string,
    recipientType: string,
    preview: string,
    sentBy: string | null,
    sessionId: string | null = null,
    testId: string | null = null,
) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    await supabase.from('whatsapp_log').insert([{
        message_type: type,
        student_id: studentId,
        recipient_phone: recipientPhone,
        recipient_name: recipientName,
        recipient_type: recipientType,
        preview: preview,
        sent_by: sentBy,
        session_id: sessionId,
        test_id: testId,
    }]);
}

// ── Render template preview (mirrors Meta template bodies) ───
function renderTemplatePreview(name: string, params: string[]): string {
    const p = (i: number) => params[i] ?? '';
    const footer = '\n\n— Mitesh Sir\'s Study Circle';

    switch (name) {
        case 'mssc_attendance_absent_parent':
            return `Dear ${p(0)},\n\n${p(1)} did not attend class on ${p(2)}.\n\nBatch: ${p(3)}\nClass time: ${p(4)}\n\nPlease ensure ${p(5)} is present next class.${footer}`;
        case 'mssc_attendance_absent_student':
            return `Dear ${p(0)},\n\nYou did not attend class on ${p(1)}.\n\nBatch: ${p(2)}\nClass time: ${p(3)}\n\nPlease make sure to attend next class.${footer}`;
        case 'mssc_attendance_late_parent':
            return `Dear ${p(0)},\n\n${p(1)} arrived late to class on ${p(2)}.\n\nBatch: ${p(3)}\nClass time: ${p(4)}\nArrived at: ${p(5)}\n\nPlease ensure ${p(6)} arrives on time.${footer}`;
        case 'mssc_attendance_late_student':
            return `Dear ${p(0)},\n\nYou arrived late to class on ${p(1)}.\n\nBatch: ${p(2)}\nClass time: ${p(3)}\nArrived at: ${p(4)}\n\nPlease try to arrive on time next class.${footer}`;
        case 'mssc_attendance_present_parent':
            return `Dear ${p(0)},\n\n${p(1)} attended class on ${p(2)}.\n\nBatch: ${p(3)}\nClass time: ${p(4)}\nArrived at: ${p(5)}\n\nThank you and have a great day!${footer}`;
        case 'mssc_attendance_present_student':
            return `Dear ${p(0)},\n\nYou attended class on ${p(1)}.\n\nBatch: ${p(2)}\nClass time: ${p(3)}\nArrived at: ${p(4)}\n\nSee you next class!${footer}`;
        case 'mssc_test_result_parent':
            return `Dear ${p(0)},\n\nWe are writing to share the latest test result for your child ${p(1)}.\n\nTest: ${p(2)}\nSubject: ${p(3)}\nMarks: ${p(4)}/${p(5)}\nClass Average: ${p(6)}\n\nThank you for your continued support in ${p(7)}'s learning journey.${footer}`;
        case 'mssc_test_result_student':
            return `Dear ${p(0)},\n\nYour latest test result is now available.\n\nTest: ${p(1)}\nSubject: ${p(2)}\nMarks: ${p(3)}/${p(4)}\nClass Average: ${p(5)}\n\nKeep working hard and giving your best in every class!${footer}`;
        case 'mssc_test_missed_parent':
            return `Dear ${p(0)},\n\nWe wish to inform you that ${p(1)} did not appear for the following test.\n\nTest: ${p(2)}\nSubject: ${p(3)}\nDate: ${p(4)}\n\nKindly ensure ${p(5)} attempts this test at the earliest.${footer}`;
        case 'mssc_test_missed_student':
            return `Dear ${p(0)},\n\nWe wish to inform you that you did not appear for the following test.\n\nTest: ${p(1)}\nSubject: ${p(2)}\nDate: ${p(3)}\n\nKindly attempt this test at the earliest.${footer}`;
        case 'mssc_welcome_student':
            return `Dear ${p(0)},\n\nWelcome to Mitesh Sir's Study Circle!\n\nUsername: ${p(1)}\nPassword: ${p(2)}${footer}`;
        case 'mssc_announcement':
            return `Dear ${p(0)},\n\nDo note:\n\n${p(1)}\n\nThank you for your support.\nDo reach out if you need any clarification.${footer}`;
        case 'mssc_class_update':
            return `Dear ${p(0)},\n\nDo note:\n\n${p(1)}\n\nPlease save this notice for your reference.\nDo reach out if you need any clarification.${footer}`;
        default:
            return `[${name}] ${params.join(' | ')}`;
    }
}

// ── Attendance template resolver ──────────────────────────────
function resolveAttendanceTemplate(payload: Record<string, string>, recipientName?: string): { name: string; params: string[] } {
    const studentName  = payload.student_name  || 'Student';
    const batchName    = payload.batch_name    || 'Class';
    const classTime    = payload.class_time    || '';          // "HH:MM" 24h
    const punchInTime  = payload.punch_in_time || '';          // "HH:MM" 24h — empty until biometric
    const status       = payload.status        || 'absent';
    // parent_name: per-recipient override takes priority, then payload field, then fallback
    payload = { ...payload, parent_name: recipientName || payload.parent_name || 'Parent' };

    // Day + Date: "Tuesday, 8 April 2026"
    const date = payload.date || new Date().toISOString().split('T')[0];
    const dayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    // Format class start time for display: "12.30"
    const classTimeDisplay = classTime ? classTime.replace(':', '.') : 'N/A';

    // ── Grace period logic (active once biometric is connected) ──
    // Rules: punch-in before or ≤10 min after class start → present (no notification)
    //        punch-in >10 min after class start → late
    // When punchInTime is empty (manual / no biometric), status comes from the teacher's manual selection.
    let minsLate = 'N/A';
    let punchDisplay = 'Not recorded';

    if (punchInTime && classTime) {
        const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
        const diff = toMins(punchInTime) - toMins(classTime);
        punchDisplay = new Date(`1970-01-01T${punchInTime}:00`).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        // Override status based on grace period: ≤10 min → present, >10 min → late
        if (diff <= 10) return { name: '', params: [] }; // present — no notification
        minsLate = String(diff);
    }

    const parentName = payload.parent_name || 'Parent';
    const isParent = (payload.recipient_role || 'parent') === 'parent';

    if (status === 'present') {
        return isParent ? {
            name: 'mssc_attendance_present_parent',
            // {{1}} parent_name  {{2}} student_name  {{3}} day_date  {{4}} batch_name  {{5}} class_time  {{6}} punch_in
            params: [parentName, studentName, dayDate, batchName, classTimeDisplay, punchDisplay],
        } : {
            name: 'mssc_attendance_present_student',
            // {{1}} student_name  {{2}} day_date  {{3}} batch_name  {{4}} class_time  {{5}} punch_in
            params: [studentName, dayDate, batchName, classTimeDisplay, punchDisplay],
        };
    }

    if (status === 'absent') {
        return isParent ? {
            name: 'mssc_attendance_absent_parent',
            // {{1}} parent_name  {{2}} student_name  {{3}} day_date  {{4}} batch_name  {{5}} class_time  {{6}} student_name
            params: [parentName, studentName, dayDate, batchName, classTimeDisplay, studentName],
        } : {
            name: 'mssc_attendance_absent_student',
            // {{1}} student_name  {{2}} day_date  {{3}} batch_name  {{4}} class_time
            params: [studentName, dayDate, batchName, classTimeDisplay],
        };
    }

    // late
    return isParent ? {
        name: 'mssc_attendance_late_parent',
        // {{1}} parent_name  {{2}} student_name  {{3}} day_date  {{4}} batch_name  {{5}} class_time  {{6}} punch_in  {{7}} student_name
        params: [parentName, studentName, dayDate, batchName, classTimeDisplay, punchDisplay, studentName],
    } : {
        name: 'mssc_attendance_late_student',
        // {{1}} student_name  {{2}} day_date  {{3}} batch_name  {{4}} class_time  {{5}} punch_in
        params: [studentName, dayDate, batchName, classTimeDisplay, punchDisplay],
    };
}

// ── Main handler ──────────────────────────────────────────────
Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await req.json();
        const { type, recipients, payload, sent_by, session_id, test_id } = body;

        if (!type || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return new Response(JSON.stringify({ error: 'Missing type or recipients' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const message = buildMessage(type, payload || {});

        async function sendToRecipient(recipient: typeof recipients[number]): Promise<{ phone: string; success: boolean; error?: string }> {
            const phone = recipient.phone;
            if (!phone) return { phone: 'missing', success: false, error: 'No phone number' };

            try {
                let logPreview: string;

                if (type === 'attendance') {
                    const attendanceTemplate = resolveAttendanceTemplate(
                        { ...(payload || {}), recipient_role: recipient.role || 'parent' },
                        recipient.name,
                    );
                    if (!attendanceTemplate.name) return { phone, success: true };
                    await sendTemplateViaMetaAPI(phone, attendanceTemplate.name, attendanceTemplate.params);
                    logPreview = renderTemplatePreview(attendanceTemplate.name, attendanceTemplate.params);
                } else if (type === 'score') {
                    const p = payload || {};
                    const isParent = (recipient.role || 'parent') === 'parent';
                    const studentName = p.student_name || 'Student';
                    const testTitle  = p.test_title   || 'Test';
                    const subject    = p.subject       || '';
                    const score      = p.score         || '0';
                    const total      = p.total         || '100';
                    const average    = p.class_average || 'N/A';
                    if (isParent) {
                        const parentName = recipient.name || 'Parent';
                        await sendTemplateViaMetaAPI(phone, 'mssc_test_result_parent', [parentName, studentName, testTitle, subject, score, total, average, studentName]);
                        logPreview = renderTemplatePreview('mssc_test_result_parent', [parentName, studentName, testTitle, subject, score, total, average, studentName]);
                    } else {
                        await sendTemplateViaMetaAPI(phone, 'mssc_test_result_student', [studentName, testTitle, subject, score, total, average]);
                        logPreview = renderTemplatePreview('mssc_test_result_student', [studentName, testTitle, subject, score, total, average]);
                    }
                } else if (type === 'test_missed') {
                    const p = payload || {};
                    const isParent = (recipient.role || 'parent') === 'parent';
                    const studentName = p.student_name || 'Student';
                    const testTitle   = p.test_title   || 'Test';
                    const subject     = p.subject       || '';
                    const date        = p.date          || '';
                    if (isParent) {
                        const parentName = recipient.name || 'Parent';
                        await sendTemplateViaMetaAPI(phone, 'mssc_test_missed_parent', [parentName, studentName, testTitle, subject, date, studentName]);
                        logPreview = renderTemplatePreview('mssc_test_missed_parent', [parentName, studentName, testTitle, subject, date, studentName]);
                    } else {
                        await sendTemplateViaMetaAPI(phone, 'mssc_test_missed_student', [studentName, testTitle, subject, date]);
                        logPreview = renderTemplatePreview('mssc_test_missed_student', [studentName, testTitle, subject, date]);
                    }
                } else if (type === 'announcement') {
                    const recipientName = recipient.name || 'Parent';
                    const title = payload?.title;
                    const msg   = (payload?.message || '').replace(/[\n\r\t]/g, ' ');
                    const body  = title ? `*${title}* — ${msg}` : msg;
                    await sendTemplateViaMetaAPI(phone, 'mssc_class_update', [recipientName, body]);
                    logPreview = renderTemplatePreview('mssc_class_update', [recipientName, body]);
                } else if (type === 'login') {
                    const p = payload || {};
                    await sendTemplateViaMetaAPI(phone, 'mssc_welcome_student', [
                        p.student_name || 'Student',
                        p.username     || '',
                        p.password     || '',
                    ]);
                    logPreview = renderTemplatePreview('mssc_welcome_student', [p.student_name || 'Student', p.username || '', p.password || '']);
                } else {
                    await sendViaMetaAPI(phone, message);
                    logPreview = message;
                }

                await logMessage(
                    type,
                    recipient.student_id || null,
                    phone,
                    recipient.name || 'Unknown',
                    recipient.role || 'student',
                    logPreview,
                    sent_by || null,
                    session_id || null,
                    test_id || null,
                );

                return { phone, success: true };
            } catch (err) {
                console.error(`Failed to send to ${phone}:`, err.message);
                return { phone, success: false, error: err.message };
            }
        }

        const settled = await Promise.allSettled(recipients.map(sendToRecipient));
        const results = settled.map(r =>
            r.status === 'fulfilled' ? r.value : { phone: 'unknown', success: false, error: (r as PromiseRejectedResult).reason?.message }
        );

        const sent = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        return new Response(
            JSON.stringify({ success: true, sent, failed, results }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        console.error('send-whatsapp error:', err);
        return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
