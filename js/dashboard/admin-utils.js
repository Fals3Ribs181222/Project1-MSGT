export async function callAdminApi(action, payload = {}) {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const res = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/admin-api`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action, ...payload })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Admin API error');
    return json;
}
