export function init() {
    // Subject pills (radio)
    const subjectPills = document.getElementById('plSubjectPills');
    if (subjectPills) {
        subjectPills.innerHTML = window._Subjects.map(s => `
            <label class="subject-pill">
                <input type="radio" name="plSubjectRadio" value="${s}">
                <span class="subject-pill__label">${s}</span>
            </label>`).join('');
    }

    // Grade pills (radio)
    const gradePills = document.getElementById('plGradePills');
    if (gradePills) {
        gradePills.innerHTML = [window._Grade11, window._Grade12].map(g => `
            <label class="subject-pill">
                <input type="radio" name="plGradeRadio" value="${g}">
                <span class="subject-pill__label">${g}</span>
            </label>`).join('');
    }

    document.getElementById('plName')?.focus();

    document.getElementById('btnCancelCreate')?.addEventListener('click', () => window.loadPage('page-recordings', ''));

    document.getElementById('btnSavePlaylist')?.addEventListener('click', async () => {
        const name = document.getElementById('plName').value.trim();
        if (!name) { document.getElementById('plName').focus(); return; }

        const btn = document.getElementById('btnSavePlaylist');
        btn.disabled = true; btn.textContent = 'Creating...';

        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const res = await window.api.post('playlists', {
            name,
            description: document.getElementById('plDesc').value.trim() || null,
            subject: document.querySelector('input[name="plSubjectRadio"]:checked')?.value || null,
            grade:   document.querySelector('input[name="plGradeRadio"]:checked')?.value   || null,
            created_by: session.user.id,
        });

        btn.disabled = false; btn.textContent = 'Create Playlist';

        if (res.success) {
            window.loadPage('page-recordings', '');
        } else {
            window.showStatus('createStatus', res.error || 'Failed to create playlist.', 'error');
        }
    });
}
