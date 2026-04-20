import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // ── GET: Meta webhook verification ────────────────────────────
    if (req.method === 'GET') {
        const url = new URL(req.url);
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('Webhook verified successfully');
            return new Response(challenge, { status: 200 });
        }

        console.error('Webhook verification failed — token mismatch');
        return new Response('Forbidden', { status: 403 });
    }

    // ── POST: Incoming messages and status updates ─────────────────
    if (req.method === 'POST') {
        try {
            const body = await req.json();
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

            // Walk the payload to extract message/status entries
            const entries = body?.entry ?? [];
            for (const entry of entries) {
                for (const change of entry?.changes ?? []) {
                    const value = change?.value;

                    // Incoming messages
                    for (const message of value?.messages ?? []) {
                        let messageText: string | null = null;
                        if (message.type === 'text') {
                            messageText = message?.text?.body ?? null;
                        } else if (message.type === 'reaction') {
                            messageText = message?.reaction?.emoji ?? '👍';
                        } else if (message.type === 'image') {
                            messageText = '📷 Image';
                        } else if (message.type === 'audio') {
                            messageText = '🎤 Voice message';
                        } else if (message.type === 'document') {
                            messageText = '📄 Document';
                        } else if (message.type === 'video') {
                            messageText = '🎥 Video';
                        }
                        await supabase.from('whatsapp_incoming').insert({
                            event_type: 'message',
                            from_number: message.from,
                            message_text: messageText,
                            raw_payload: body,
                        });
                    }

                    // Delivery status updates
                    for (const status of value?.statuses ?? []) {
                        await supabase.from('whatsapp_incoming').insert({
                            event_type: 'status',
                            from_number: status.recipient_id,
                            message_text: status.status, // e.g. "delivered", "read"
                            raw_payload: body,
                        });
                    }
                }
            }

            // Meta expects a 200 quickly — always return OK
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });

        } catch (err) {
            console.error('whatsapp-webhook POST error:', err);
            // Still return 200 so Meta doesn't retry indefinitely
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
    }

    return new Response('Method not allowed', { status: 405 });
});
