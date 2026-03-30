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

// ── Meta Cloud API sender ──────────────────────────────────────
async function sendViaMetaAPI(to: string, message: string) {
    // Normalise to E.164 — strip leading 0, prepend 91 if not already there
    const normalised = to.startsWith('91') ? to : `91${to.replace(/^0/, '')}`;

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
    sentBy: string | null
) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    await supabase.from('whatsapp_log').insert([{
        message_type: type,
        student_id: studentId,
        recipient_phone: recipientPhone,
        recipient_name: recipientName,
        recipient_type: recipientType,
        preview: preview.substring(0, 120),
        sent_by: sentBy,
    }]);
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
        const { type, recipients, payload, sent_by } = body;

        if (!type || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return new Response(JSON.stringify({ error: 'Missing type or recipients' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const message = buildMessage(type, payload || {});
        const results: Array<{ phone: string; success: boolean; error?: string }> = [];

        for (const recipient of recipients) {
            const phone = recipient.phone;
            if (!phone) {
                results.push({ phone: 'missing', success: false, error: 'No phone number' });
                continue;
            }

            try {
                await sendViaMetaAPI(phone, message);

                await logMessage(
                    type,
                    recipient.student_id || null,
                    phone,
                    recipient.name || 'Unknown',
                    recipient.role || 'student',
                    message,
                    sent_by || null,
                );

                results.push({ phone, success: true });
            } catch (err) {
                console.error(`Failed to send to ${phone}:`, err.message);
                results.push({ phone, success: false, error: err.message });
            }
        }

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
