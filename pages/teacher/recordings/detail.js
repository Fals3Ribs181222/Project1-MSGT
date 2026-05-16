const user = window.auth.getUser();
const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

let currentPlaylist = null;
let allRecordings   = [];
let pickerSelected  = new Set();

function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function thumb(videoId) {
    return `https://img.youtube.com/vi/${window.esc(videoId)}/mqdefault.jpg`;
}

function metaStr(subject, grade, date) {
    return [subject, grade ? `Grade ${grade}` : '', formatDate(date)].filter(Boolean).join(' · ');
}

async function reloadPlaylist() {
    if (!currentPlaylist) return;
    const res = await window.api.get(
        'playlists', { id: currentPlaylist.id },
        '*, playlist_videos(id, video_id, position, class_recordings:video_id(youtube_video_id, title, subject, grade, recorded_at))'
    );
    if (res.success && res.data?.[0]) currentPlaylist = res.data[0];
}

function renderDetailGrid() {
    const grid  = document.getElementById('recDetailGrid');
    const empty = document.getElementById('recDetailEmpty');
    if (!grid || !currentPlaylist) return;

    const videos = (currentPlaylist.playlist_videos ?? [])
        .sort((a, b) => a.position - b.position)
        .map(pv => ({ ...pv.class_recordings, _pvId: pv.id }))
        .filter(v => v?.youtube_video_id);

    if (videos.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    grid.innerHTML = videos.map(v => `
        <div class="rec-card" tabindex="0" role="button" aria-label="Play ${window.esc(v.title)}"
             onclick="window._openRecordingModal('${window.esc(v.youtube_video_id)}','${window.esc(v.title)}','${window.esc(v.subject ?? '')}','${window.esc(v.grade ?? '')}','${window.esc(v.recorded_at ?? '')}')"
             onkeydown="if(event.key==='Enter'||event.key===' ')this.click()">
            ${isTeacher ? `<button class="rec-card-remove" title="Remove from playlist" onclick="event.stopPropagation();window._removeFromPlaylist('${v._pvId}')"><i class="ri-close-line"></i></button>` : ''}
            <div class="rec-thumb">
                <img src="${thumb(v.youtube_video_id)}" alt="" loading="lazy">
                <div class="rec-play-overlay" aria-hidden="true">
                    <div class="rec-play-btn"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
                </div>
            </div>
            <div class="rec-info">
                <p class="rec-title">${window.esc(v.title)}</p>
                <div class="rec-meta">
                    ${v.subject ? `<span>${window.esc(v.subject)}</span>` : ''}
                    ${v.subject && v.recorded_at ? '<span class="rec-meta-dot"></span>' : ''}
                    ${v.recorded_at ? `<span>${formatDate(v.recorded_at)}</span>` : ''}
                </div>
            </div>
        </div>`).join('');
}

function openVideoPicker() {
    if (!currentPlaylist) return;
    pickerSelected.clear();

    const existingIds = new Set((currentPlaylist.playlist_videos ?? []).map(pv => pv.video_id));
    const available   = allRecordings.filter(r => !existingIds.has(r.id));
    const grid  = document.getElementById('recPickerGrid');
    const empty = document.getElementById('recPickerEmpty');

    if (available.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.style.display = 'block';
    } else {
        if (empty) empty.style.display = 'none';
        grid.innerHTML = available.map(r => `
            <div class="rec-picker-card" data-id="${r.id}" onclick="window._togglePickerCard(this,'${r.id}')">
                <img src="${thumb(r.youtube_video_id)}" alt="" loading="lazy">
                <p>${window.esc(r.title)}</p>
            </div>`).join('');
    }

    document.getElementById('recPickerModal').classList.add('is-open');
    document.body.style.overflow = 'hidden';
}

function closeVideoPicker() {
    document.getElementById('recPickerModal').classList.remove('is-open');
    document.body.style.overflow = '';
    pickerSelected.clear();
}

function openRecordingModal(videoId, title, subject, grade, recordedAt) {
    const overlay = document.getElementById('recordingModal');
    const iframe  = document.getElementById('recordingModalIframe');
    if (!overlay || !iframe) return;
    document.getElementById('recordingModalTitle').textContent = title;
    document.getElementById('recordingModalMeta').textContent  = metaStr(subject, grade, recordedAt);
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
}

function closeRecordingModal() {
    const overlay = document.getElementById('recordingModal');
    const iframe  = document.getElementById('recordingModalIframe');
    if (overlay) overlay.classList.remove('is-open');
    if (iframe)  iframe.src = '';
    document.body.style.overflow = '';
}

export async function init() {
    const playlistId = window._pendingPlaylistId;
    if (!playlistId) { window.loadPage('page-recordings', ''); return; }

    // Load recordings + this playlist's data
    const [recRes, plRes] = await Promise.all([
        window.api.get('class_recordings', {}, '*', { order: 'created_at', ascending: false }),
        window.api.get('playlists', { id: playlistId },
            '*, playlist_videos(id, video_id, position, class_recordings:video_id(youtube_video_id, title, subject, grade, recorded_at))')
    ]);

    allRecordings = recRes.success ? (recRes.data ?? []) : [];
    currentPlaylist = plRes.success && plRes.data?.[0] ? plRes.data[0] : null;

    if (!currentPlaylist) { window.loadPage('page-recordings', ''); return; }

    document.getElementById('recPageTitle').textContent = currentPlaylist.name;
    const descEl = document.getElementById('recDetailDesc');
    if (descEl) descEl.textContent = currentPlaylist.description || '';

    if (isTeacher) {
        const addBtn = document.getElementById('btnAddVideos');
        if (addBtn) { addBtn.style.display = 'inline-flex'; addBtn.addEventListener('click', openVideoPicker); }
    }

    renderDetailGrid();

    // Back
    document.getElementById('btnBackToPlaylists')?.addEventListener('click', () => window.loadPage('page-recordings', ''));

    // Picker confirm
    document.getElementById('btnConfirmAddVideos')?.addEventListener('click', async () => {
        if (!currentPlaylist || pickerSelected.size === 0) { closeVideoPicker(); return; }
        const btn = document.getElementById('btnConfirmAddVideos');
        btn.disabled = true; btn.textContent = 'Adding...';

        const existingCount = (currentPlaylist.playlist_videos ?? []).length;
        const inserts = [...pickerSelected].map((videoId, i) => ({
            playlist_id: currentPlaylist.id, video_id: videoId, position: existingCount + i
        }));

        const { error } = await window.supabaseClient.from('playlist_videos').insert(inserts);
        btn.disabled = false; btn.textContent = 'Add Selected';

        if (!error) {
            closeVideoPicker();
            await reloadPlaylist();
            renderDetailGrid();
        }
    });

    document.getElementById('btnClosePickerModal')?.addEventListener('click', closeVideoPicker);
    document.getElementById('btnCancelPicker')?.addEventListener('click', closeVideoPicker);
    document.getElementById('recPickerModal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeVideoPicker(); });

    document.getElementById('btnCloseRecordingModal')?.addEventListener('click', closeRecordingModal);
    document.getElementById('recordingModal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeRecordingModal(); });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeRecordingModal(); closeVideoPicker(); }
    });

    // Globals used by inline onclick in rendered HTML
    window._openRecordingModal = openRecordingModal;
    window._togglePickerCard   = (el, id) => {
        el.classList.toggle('selected');
        if (pickerSelected.has(id)) pickerSelected.delete(id);
        else pickerSelected.add(id);
    };
    window._removeFromPlaylist = async (pvId) => {
        if (!confirm('Remove this video from the playlist?')) return;
        const res = await window.api.delete('playlist_videos', pvId);
        if (res.success) { await reloadPlaylist(); renderDetailGrid(); }
    };
}

export async function refresh() {
    await reloadPlaylist();
    renderDetailGrid();
}
