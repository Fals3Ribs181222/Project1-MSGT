// js/whatsapp.js — Shared WhatsApp messaging helper
// Loaded globally in teacher_dashboard.html

(function () {
    'use strict';

    const SEND_WA_URL = `${window.CONFIG.SUPABASE_URL}/functions/v1/send-whatsapp`;

    /**
     * Send a WhatsApp message via the unified Edge Function.
     *
     * @param {Object} opts
     * @param {string} opts.type - 'report' | 'attendance' | 'score' | 'announcement' | 'custom'
     * @param {Array<{phone:string, name:string, role:string, student_id?:string}>} opts.recipients
     * @param {Object} opts.payload - type-specific data (message, score, subject, etc.)
     * @param {string} [opts.sentBy] - teacher user ID
     * @returns {Promise<{success:boolean, sent:number, failed:number, results:Array}>}
     */
    async function send({ type, recipients, payload, sentBy }) {
        const token = window.CONFIG.SUPABASE_ANON_KEY;

        const response = await fetch(SEND_WA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                type,
                recipients,
                payload,
                sent_by: sentBy || window.auth?.getUser()?.id || null,
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to send WhatsApp message');
        }

        return result;
    }

    /**
     * Fetch WhatsApp message history for a student.
     *
     * @param {string} studentId
     * @param {number} [limit=20]
     * @returns {Promise<Array>}
     */
    async function getLog(studentId, limit = 20) {
        const { data, error } = await window.supabaseClient
            .from('whatsapp_log')
            .select('*')
            .eq('student_id', studentId)
            .order('sent_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    /**
     * Fetch full message history (all students), for the Messages tab.
     *
     * @param {Object} [filters]
     * @param {string} [filters.type] - filter by message_type
     * @param {number} [filters.limit=50]
     * @returns {Promise<Array>}
     */
    async function getAllLogs(filters = {}) {
        let query = window.supabaseClient
            .from('whatsapp_log')
            .select('*')
            .order('sent_at', { ascending: false })
            .limit(filters.limit || 50);

        if (filters.type) {
            query = query.eq('message_type', filters.type);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    /**
     * Fetch incoming WhatsApp messages from the webhook table.
     *
     * @param {number} [limit=500]
     * @returns {Promise<Array>}
     */
    async function getInbox(limit = 500) {
        const { data, error } = await window.supabaseClient
            .from('whatsapp_incoming')
            .select('*')
            .eq('event_type', 'message')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    /**
     * Build a phone → contact info lookup map from student profiles.
     * Keys are last 10 digits; values are { name, label, studentId }.
     *
     * @param {Array} profiles - student profiles with phone, father_phone, mother_phone
     * @returns {Map<string, {name:string, label:string, studentId:string}>}
     */
    function buildPhoneMap(profiles) {
        const map = new Map();
        for (const s of profiles) {
            if (s.phone) map.set(s.phone.slice(-10), { name: s.name, label: 'Student', studentId: s.id });
            if (s.father_phone) map.set(s.father_phone.slice(-10), { name: s.father_name || `${s.name}'s Father`, label: 'Parent', studentId: s.id });
            if (s.mother_phone) map.set(s.mother_phone.slice(-10), { name: s.mother_name || `${s.name}'s Mother`, label: 'Parent', studentId: s.id });
        }
        return map;
    }

    /**
     * Merge incoming + sent messages into conversation objects grouped by phone.
     *
     * @param {Array} profiles - student profiles for name resolution
     * @param {number} [limit=500] - max messages to fetch from each table
     * @returns {Promise<Array<{phone:string, displayName:string, studentId:string|null, label:string|null, messages:Array, lastTimestamp:Date|null, hasRecentIncoming:boolean}>>}
     */
    async function getConversations(profiles, limit = 500) {
        const [incoming, sent] = await Promise.all([
            getInbox(limit),
            getAllLogs({ limit }),
        ]);

        const phoneMap = buildPhoneMap(profiles);
        const convos = new Map();

        function getConvo(rawPhone) {
            const key = rawPhone.slice(-10);
            if (!convos.has(key)) {
                const resolved = phoneMap.get(key);
                convos.set(key, {
                    phone: key,
                    displayName: resolved?.name || `+91 ${key}`,
                    studentId: resolved?.studentId || null,
                    label: resolved?.label || null,
                    messages: [],
                    lastTimestamp: null,
                    hasRecentIncoming: false,
                });
            }
            return convos.get(key);
        }

        for (const msg of incoming) {
            if (!msg.from_number) continue;
            const convo = getConvo(msg.from_number);
            convo.messages.push({
                direction: 'in',
                text: msg.message_text || '',
                timestamp: new Date(msg.created_at),
            });
        }

        for (const msg of sent) {
            if (!msg.recipient_phone) continue;
            const convo = getConvo(msg.recipient_phone);
            convo.messages.push({
                direction: 'out',
                text: msg.preview || '',
                timestamp: new Date(msg.sent_at),
                type: msg.message_type,
            });
        }

        const now = Date.now();
        for (const convo of convos.values()) {
            convo.messages.sort((a, b) => a.timestamp - b.timestamp);
            if (convo.messages.length > 0) {
                convo.lastTimestamp = convo.messages[convo.messages.length - 1].timestamp;
            }
            const lastIncoming = [...convo.messages].reverse().find(m => m.direction === 'in');
            if (lastIncoming) {
                convo.lastIncomingTimestamp = lastIncoming.timestamp;
                if ((now - lastIncoming.timestamp.getTime()) < 24 * 60 * 60 * 1000) {
                    convo.hasRecentIncoming = true;
                }
            }
        }

        return [...convos.values()].sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
    }

    /**
     * Build recipient objects from a student profile.
     * Resolves which phone numbers are available.
     *
     * @param {Object} student - { id, name, phone, father_phone, mother_phone }
     * @param {string} target - 'student' | 'parent' | 'both'
     * @returns {Array<{phone:string, name:string, role:string, student_id:string}>}
     */
    function resolveRecipients(student, target = 'parent') {
        const recipients = [];

        if ((target === 'student' || target === 'both') && student.phone) {
            recipients.push({
                phone: student.phone,
                name: student.name,
                role: 'student',
                student_id: student.id,
            });
        }

        if ((target === 'parent' || target === 'both')) {
            if (student.father_phone) {
                recipients.push({
                    phone: student.father_phone,
                    name: student.father_name || `${student.name}'s Father`,
                    role: 'parent',
                    student_id: student.id,
                });
            }
            if (student.mother_phone) {
                recipients.push({
                    phone: student.mother_phone,
                    name: student.mother_name || `${student.name}'s Mother`,
                    role: 'parent',
                    student_id: student.id,
                });
            }
        }

        return recipients;
    }

    // Expose globally
    window.whatsapp = { send, getLog, getAllLogs, getInbox, buildPhoneMap, getConversations, resolveRecipients };
})();
