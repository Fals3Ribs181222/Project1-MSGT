import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM')!; // e.g. whatsapp:+14155238886
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Fetch student phone + name from profiles ──────────────────
async function getStudentProfile(studentId: string) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
        .from('profiles')
        .select('name, phone')
        .eq('id', studentId)
        .single();

    if (error) throw new Error(`Profile fetch failed: ${error.message}`);
    return data;
}

// ── Fetch class + batch info ──────────────────────────────────
async function getClassInfo(classId: string) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
        .from('classes')
        .select('class_date, batches(name, subject)')
        .eq('id', classId)
        .single();

    if (error) throw new Error(`Class fetch failed: ${error.message}`);
    return data;
}

// ── Send WhatsApp via Twilio ──────────────────────────────────
async function sendWhatsApp(to: string, message: string) {
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const body = new URLSearchParams({
        From: TWILIO_WHATSAPP_FROM,
        To: `whatsapp:+91${to}`,  // assumes Indian numbers
        Body: message
    });

    const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        }
    );

    if (!response.ok) {
        const err = await response.json();
        throw new Error(`Twilio error: ${err.message}`);
    }

    return response.json();
}

// ── Build the message ─────────────────────────────────────────
function buildMessage(
    studentName: string,
    status: string,
    subject: string,
    batchName: string,
    classDate: string
) {
    const dateStr = classDate || new Date().toISOString().split('T')[0];
    const date = new Date(dateStr).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long'
    });

    if (status === 'present') {
        return `✅ *Attendance Marked*\n\nHi ${studentName},\n\nYou were marked *present* for today's ${subject} class (${batchName}) on ${date}.\n\n— Mitesh Sir via TuteFlow`;
    } else if (status === 'absent') {
        return `❌ *Absence Alert*\n\nHi ${studentName},\n\nYou were marked *absent* for today's ${subject} class (${batchName}) on ${date}.\n\nIf this is incorrect, please contact Mitesh Sir.\n\n— TuteFlow`;
    } else {
        return `⏰ *Late Arrival*\n\nHi ${studentName},\n\nYou were marked *late* for today's ${subject} class (${batchName}) on ${date}.\n\n— Mitesh Sir via TuteFlow`;
    }
}

// ── Main handler ──────────────────────────────────────────────
Deno.serve(async (req) => {
    try {
        const { record } = await req.json();
        // record = the new row inserted into attendance table
        // { id, student_id, class_id, status, created_at }

        const [student, classInfo] = await Promise.all([
            getStudentProfile(record.student_id),
            getClassInfo(record.class_id)
        ]);

        // Skip if no phone number on file
        if (!student.phone) {
            return new Response(
                JSON.stringify({ skipped: true, reason: 'No phone number' }),
                { status: 200 }
            );
        }

        const message = buildMessage(
            student.name,
            record.status,
            classInfo.batches.subject,
            classInfo.batches.name,
            classInfo.class_date || record.date
        );

        await sendWhatsApp(student.phone, message);

        return new Response(
            JSON.stringify({ success: true, sent_to: student.phone }),
            { status: 200 }
        );

    } catch (err) {
        console.error('Error:', err.message);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500 }
        );
    }
});
