import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_TABLES = new Set([
    'profiles', 'tests', 'marks', 'attendance', 'classes', 'batches',
    'batch_students', 'announcements', 'files', 'whatsapp_log',
    'board_results', 'testimonials', 'material_chunks', 'rank_history', 'feature_flags',
]);

const VALID_ROLES = new Set(['teacher', 'student', 'admin']);

// Identify caller role using their JWT (user-scoped client)
async function getCallerRole(authHeader: string | null): Promise<string | null> {
    if (!authHeader) return null;
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
    });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return null;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    return data?.role ?? null;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization');
    const callerRole = await getCallerRole(authHeader);

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const { action } = body as { action: string };

    // ── create_student (teacher or admin) ────────────────────────────────────
    if (action === 'create_student') {
        if (callerRole !== 'admin' && callerRole !== 'teacher') {
            return new Response(JSON.stringify({ error: 'Forbidden: teacher or admin role required' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        const { email, password, meta } = body as { email: string; password: string; meta: Record<string, unknown> };
        const { data, error } = await db.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: meta,
        });
        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        if (data?.user?.id) {
            await db.from('profiles').update(meta).eq('id', data.user.id);
        }
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // ── delete_student (teacher or admin) ────────────────────────────────────
    if (action === 'delete_student') {
        if (callerRole !== 'admin' && callerRole !== 'teacher') {
            return new Response(JSON.stringify({ error: 'Forbidden: teacher or admin role required' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        const { user_id } = body as { user_id: string };
        // Verify the target user is a student before deleting
        const { data: profile, error: fetchErr } = await db
            .from('profiles')
            .select('role')
            .eq('id', user_id)
            .single();
        if (fetchErr || !profile) {
            return new Response(JSON.stringify({ error: 'Student not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        if (profile.role !== 'student') {
            return new Response(JSON.stringify({ error: 'Target user is not a student' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        const { error } = await db.auth.admin.deleteUser(user_id);
        if (error) throw new Error(error.message);
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // All remaining actions require admin role
    if (callerRole !== 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        // ── get_stats ────────────────────────────────────────────────────
        if (action === 'get_stats') {
            const [profilesRes, testsRes, attendanceRes, waRes] = await Promise.all([
                db.from('profiles').select('grade, role'),
                db.from('tests').select('id', { count: 'exact', head: true }),
                db.from('attendance').select('status'),
                db.from('whatsapp_log').select('id', { count: 'exact', head: true }),
            ]);

            const students = (profilesRes.data ?? []).filter((p: { role: string }) => p.role === 'student');
            const grade11Count = students.filter((p: { grade: string }) => p.grade === '11th').length;
            const grade12Count = students.filter((p: { grade: string }) => p.grade === '12th').length;

            const attendance = attendanceRes.data ?? [];
            const totalAttendance = attendance.length;
            const presentCount = attendance.filter((a: { status: string }) => a.status === 'present').length;
            const attendanceRate = totalAttendance > 0
                ? Math.round((presentCount / totalAttendance) * 100)
                : null;

            return new Response(JSON.stringify({
                stats: {
                    totalStudents: students.length,
                    grade11Count,
                    grade12Count,
                    totalTests: testsRes.count ?? 0,
                    attendanceRate,
                    waMessagesSent: waRes.count ?? 0,
                }
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ── get_all_users ────────────────────────────────────────────────
        if (action === 'get_all_users') {
            const { data, error } = await db
                .from('profiles')
                .select('id, name, username, role, grade, subjects, created_at')
                .order('created_at', { ascending: false });
            if (error) throw new Error(error.message);
            return new Response(JSON.stringify({ users: data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ── update_user_role ─────────────────────────────────────────────
        if (action === 'update_user_role') {
            const { user_id, new_role } = body as { user_id: string; new_role: string };
            if (!VALID_ROLES.has(new_role)) {
                return new Response(JSON.stringify({ error: `Invalid role: ${new_role}` }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
            const { error } = await db.from('profiles').update({ role: new_role }).eq('id', user_id);
            if (error) throw new Error(error.message);
            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ── get_flags ────────────────────────────────────────────────────
        if (action === 'get_flags') {
            const { data, error } = await db
                .from('feature_flags')
                .select('key, label, description, enabled')
                .order('key');
            if (error) throw new Error(error.message);
            return new Response(JSON.stringify({ flags: data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ── update_flag ──────────────────────────────────────────────────
        if (action === 'update_flag') {
            const { key, enabled } = body as { key: string; enabled: boolean };
            const { error } = await db
                .from('feature_flags')
                .update({ enabled, updated_at: new Date().toISOString() })
                .eq('key', key);
            if (error) throw new Error(error.message);
            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ── bulk_delete_attendance ───────────────────────────────────────
        if (action === 'bulk_delete_attendance') {
            const { batch_id } = body as { batch_id: string };
            const { count, error } = await db
                .from('attendance')
                .delete({ count: 'exact' })
                .eq('batch_id', batch_id);
            if (error) throw new Error(error.message);
            return new Response(JSON.stringify({ deleted: count ?? 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ── bulk_delete_marks ────────────────────────────────────────────
        if (action === 'bulk_delete_marks') {
            const { test_id } = body as { test_id: string };
            const { count, error } = await db
                .from('marks')
                .delete({ count: 'exact' })
                .eq('test_id', test_id);
            if (error) throw new Error(error.message);
            return new Response(JSON.stringify({ deleted: count ?? 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ── delete_user ──────────────────────────────────────────────────
        if (action === 'delete_user') {
            const { user_id } = body as { user_id: string };
            const { error } = await db.auth.admin.deleteUser(user_id);
            if (error) throw new Error(error.message);
            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ── wipe_seed_data ───────────────────────────────────────────────
        if (action === 'wipe_seed_data') {
            const { data: students, error: fetchErr } = await db
                .from('profiles')
                .select('id')
                .eq('role', 'student');
            if (fetchErr) throw new Error(fetchErr.message);

            let deleted = 0;
            for (const s of (students ?? [])) {
                const { error } = await db.auth.admin.deleteUser(s.id);
                if (!error) deleted++;
            }
            return new Response(JSON.stringify({ deleted }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ── browse_table ─────────────────────────────────────────────────
        if (action === 'browse_table') {
            const { table, limit = 50, offset = 0 } = body as { table: string; limit: number; offset: number };
            if (!ALLOWED_TABLES.has(table)) {
                return new Response(JSON.stringify({ error: `Table "${table}" is not allowed` }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
            const { data, count, error } = await db
                .from(table)
                .select('*', { count: 'exact' })
                .range(offset, offset + limit - 1);
            if (error) throw new Error(error.message);
            return new Response(JSON.stringify({ rows: data, total: count ?? 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ── delete_row ───────────────────────────────────────────────────
        if (action === 'delete_row') {
            const { table, id } = body as { table: string; id: string };
            if (!ALLOWED_TABLES.has(table)) {
                return new Response(JSON.stringify({ error: `Table "${table}" is not allowed` }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
            const { error } = await db.from(table).delete().eq('id', id);
            if (error) throw new Error(error.message);
            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
