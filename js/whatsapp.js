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
     * Build recipient objects from a student profile.
     * Resolves which phone numbers are available.
     *
     * @param {Object} student - { id, name, phone, parent_phone }
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

        if ((target === 'parent' || target === 'both') && student.parent_phone) {
            recipients.push({
                phone: student.parent_phone,
                name: `${student.name}'s Parent`,
                role: 'parent',
                student_id: student.id,
            });
        }

        return recipients;
    }

    // Expose globally
    window.whatsapp = { send, getLog, getAllLogs, resolveRecipients };
})();
