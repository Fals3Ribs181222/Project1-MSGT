const user = window.auth.getUser();
const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

let allRecordings = [];   // all class_recordings
let allPlaylists = [];    // playlists with video counts
let currentPlaylist = null;
let pickerSelected = new Set(); // video IDs selected in picker

// ── Helpers ───────────────────────────────────────────────────

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

// ── Load data ─────────────────────────────────────────────────

async function loadAllRecordings() {
    const res = await window.api.get('class_recordings', {}, '*', { order: 'created_at', ascending: false });
    allRecordings = res.success ? (res.data ?? []) : [];
}

async function loadPlaylists() {
    const res = await window.api.get(
        'playlists', {}, '*, playlist_videos(video_id, position, class_recordings:video_id(youtube_video_id, title))',
        { order: 'created_at', ascending: false }
    );
    allPlaylists = res.success ? (res.data ?? []) : [];
}

// ── Playlist grid ─────────────────────────────────────────────

function renderPlaylistGrid() {
    const grid = document.getElementById('recPlaylistGrid');
    const empty = document.getElementById('recPlaylistEmpty');
    const emptyBtn = document.getElementById('btnEmptyNewPlaylist');
    if (!grid) return;

    if (allPlaylists.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.style.display = 'block';
        if (emptyBtn && isTeacher) emptyBtn.style.display = 'inline-flex';
        return;
    }
    if (empty) empty.style.display = 'none';

    grid.innerHTML = allPlaylists.map(pl => {
        const videos = pl.playlist_videos ?? [];
        const count = videos.length;
        const thumbs = videos
            .sort((a, b) => a.position - b.position)
            .slice(0, 3)
            .map(v => v.class_recordings?.youtube_video_id)
            .filter(Boolean);

        const mainThumb = thumbs[0];
        const stripThumbs = thumbs.slice(1);

        const thumbHtml = mainThumb ? `
            <div class="rec-pl-thumb">
                <img class="rec-pl-main" src="${thumb(mainThumb)}" alt="" loading="lazy">
                ${stripThumbs.length ? `<div class="rec-pl-strip">${stripThumbs.map(t => `<img src="${thumb(t)}" alt="" loading="lazy">`).join('')}</div>` : ''}
                <span class="rec-count-badge">${count} video${count !== 1 ? 's' : ''}</span>
            </div>` : `
            <div class="rec-pl-thumb">
                <div class="rec-pl-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/></svg>
                    <span>Empty playlist</span>
                </div>
            </div>`;

        const tags = metaStr(pl.subject, pl.grade, null);

        return `
        <div class="rec-card" tabindex="0" role="button" aria-label="Open playlist ${window.esc(pl.name)}"
             onclick="window.openPlaylist('${pl.id}')"
             onkeydown="if(event.key==='Enter'||event.key===' ')this.click()">
            ${thumbHtml}
            <div class="rec-info">
                <p class="rec-title">${window.esc(pl.name)}</p>
                <div class="rec-meta">
                    ${tags ? `<span>${tags}</span>` : '<span>No subject set</span>'}
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── Playlist detail ───────────────────────────────────────────

window.openPlaylist = function (playlistId) {
    currentPlaylist = allPlaylists.find(p => p.id === playlistId);
    if (!currentPlaylist) return;

    document.getElementById('recPlaylistView').style.display = 'none';
    document.getElementById('recDetailView').style.display = 'block';
    document.getElementById('recPageTitle').textContent = currentPlaylist.name;
    document.getElementById('recDetailDesc').textContent = currentPlaylist.description || '';
    setDetailView();

    renderDetailGrid();
};

function renderDetailGrid() {
    const grid = document.getElementById('recDetailGrid');
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
             onclick="window.openRecordingModal('${window.esc(v.youtube_video_id)}','${window.esc(v.title)}','${window.esc(v.subject ?? '')}','${window.esc(v.grade ?? '')}','${window.esc(v.recorded_at ?? '')}')"
             onkeydown="if(event.key==='Enter'||event.key===' ')this.click()">
            ${isTeacher ? `<button class="rec-card-remove" title="Remove from playlist" onclick="event.stopPropagation();window.removeFromPlaylist('${v._pvId}')"><i class="ri-close-line"></i></button>` : ''}
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

window.removeFromPlaylist = async function (pvId) {
    if (!confirm('Remove this video from the playlist?')) return;
    const res = await window.api.delete('playlist_videos', pvId);
    if (res.success) {
        await reloadCurrentPlaylist();
        renderDetailGrid();
    }
};

async function reloadCurrentPlaylist() {
    if (!currentPlaylist) return;
    await loadPlaylists();
    currentPlaylist = allPlaylists.find(p => p.id === currentPlaylist.id) ?? currentPlaylist;
}

// ── Back to playlists ─────────────────────────────────────────

function goBackToPlaylists() {
    currentPlaylist = null;
    document.getElementById('recDetailView').style.display = 'none';
    document.getElementById('recPlaylistView').style.display = 'block';
    document.getElementById('recPageTitle').textContent = 'Class Recordings';
    setPlaylistView();
}

// ── Create playlist ───────────────────────────────────────────

function showCreateForm() {
    document.getElementById('recCreateForm').style.display = 'block';
    document.getElementById('recPlaylistView').style.display = 'none';
    document.getElementById('plName').focus();
    setCreateView();
}

function hideCreateForm() {
    document.getElementById('recCreateForm').style.display = 'none';
    document.getElementById('recPlaylistView').style.display = 'block';
    setPlaylistView();
    document.getElementById('plName').value = '';
    document.getElementById('plDesc').value = '';
    document.querySelectorAll('input[name="plSubjectRadio"], input[name="plGradeRadio"]').forEach(r => r.checked = false);
}

async function savePlaylist() {
    const name = document.getElementById('plName').value.trim();
    if (!name) { document.getElementById('plName').focus(); return; }

    const btn = document.getElementById('btnSavePlaylist');
    btn.disabled = true; btn.textContent = 'Creating...';

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const payload = {
        name,
        description: document.getElementById('plDesc').value.trim() || null,
        subject: document.querySelector('input[name="plSubjectRadio"]:checked')?.value || null,
        grade: document.querySelector('input[name="plGradeRadio"]:checked')?.value || null,
        created_by: session.user.id,
    };

    const res = await window.api.post('playlists', payload);
    btn.disabled = false; btn.textContent = 'Create Playlist';

    if (res.success) {
        hideCreateForm();
        await loadPlaylists();
        renderPlaylistGrid();
    } else {
        const status = document.getElementById('recordingsStatus');
        status.textContent = res.error || 'Failed to create playlist.';
        status.className = 'status status--error';
        status.style.display = 'block';
    }
}

// ── Video picker ──────────────────────────────────────────────

window.openVideoPicker = function () {
    if (!currentPlaylist) return;
    pickerSelected.clear();

    const existingIds = new Set(
        (currentPlaylist.playlist_videos ?? []).map(pv => pv.video_id)
    );
    const available = allRecordings.filter(r => !existingIds.has(r.id));

    const grid = document.getElementById('recPickerGrid');
    const empty = document.getElementById('recPickerEmpty');

    if (available.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.style.display = 'block';
    } else {
        if (empty) empty.style.display = 'none';
        grid.innerHTML = available.map(r => `
            <div class="rec-picker-card" data-id="${r.id}" onclick="window.togglePickerCard(this,'${r.id}')">
                <img src="${thumb(r.youtube_video_id)}" alt="" loading="lazy">
                <p>${window.esc(r.title)}</p>
            </div>`).join('');
    }

    document.getElementById('recPickerModal').classList.add('is-open');
    document.body.style.overflow = 'hidden';
};

window.togglePickerCard = function (el, id) {
    el.classList.toggle('selected');
    if (pickerSelected.has(id)) pickerSelected.delete(id);
    else pickerSelected.add(id);
};

window.closeVideoPicker = function () {
    document.getElementById('recPickerModal').classList.remove('is-open');
    document.body.style.overflow = '';
    pickerSelected.clear();
};

async function confirmAddVideos() {
    if (!currentPlaylist || pickerSelected.size === 0) {
        window.closeVideoPicker(); return;
    }

    const btn = document.getElementById('btnConfirmAddVideos');
    btn.disabled = true; btn.textContent = 'Adding...';

    const existingCount = (currentPlaylist.playlist_videos ?? []).length;
    const inserts = [...pickerSelected].map((videoId, i) => ({
        playlist_id: currentPlaylist.id,
        video_id: videoId,
        position: existingCount + i,
    }));

    const { error } = await window.supabaseClient.from('playlist_videos').insert(inserts);

    btn.disabled = false; btn.textContent = 'Add Selected';

    if (!error) {
        window.closeVideoPicker();
        await reloadCurrentPlaylist();
        renderDetailGrid();
    }
}

// ── Drive Watch renewal ───────────────────────────────────────

async function renewDriveWatch() {
    const btn = document.getElementById('btnRenewWatch');
    const expiry = document.getElementById('recordingsWatchExpiry');
    if (!btn) return;
    btn.disabled = true; btn.innerHTML = '<i class="ri-loader-4-line"></i> Registering...';
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const res = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/setup-drive-watch`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed');
        const d = new Date(json.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        if (expiry) expiry.textContent = `Watch until ${d}`;
        btn.innerHTML = '<i class="ri-checkbox-circle-line"></i> Active';
        setTimeout(() => { btn.innerHTML = '<i class="ri-loop-left-line"></i> Renew Watch'; btn.disabled = false; }, 3000);
    } catch (err) {
        btn.innerHTML = '<i class="ri-error-warning-line"></i> Retry?';
        btn.disabled = false;
    }
}

// ── Video modal ───────────────────────────────────────────────

window.openRecordingModal = function (videoId, title, subject, grade, recordedAt) {
    const overlay = document.getElementById('recordingModal');
    const iframe = document.getElementById('recordingModalIframe');
    if (!overlay || !iframe) return;
    document.getElementById('recordingModalTitle').textContent = title;
    document.getElementById('recordingModalMeta').textContent = metaStr(subject, grade, recordedAt);
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
};

window.closeRecordingModal = function () {
    const overlay = document.getElementById('recordingModal');
    const iframe = document.getElementById('recordingModalIframe');
    if (overlay) overlay.classList.remove('is-open');
    if (iframe) iframe.src = '';
    document.body.style.overflow = '';
};

// ── Init / Refresh ────────────────────────────────────────────

function setPlaylistView() {
    document.getElementById('btnViewPlaylists').style.display = 'inline-flex';
    document.getElementById('btnViewPlaylists').classList.add('tab-pill-selector__btn--active');
    document.getElementById('btnBackToPlaylists').style.display = 'none';
    document.getElementById('btnAddVideos').style.display = 'none';
    if (isTeacher) {
        document.getElementById('btnNewPlaylist').style.display = 'inline-flex';
        document.getElementById('btnNewPlaylist').classList.remove('tab-pill-selector__btn--active');
        document.getElementById('btnRenewWatch').style.display = 'inline-flex';
    }
}

function setDetailView() {
    document.getElementById('btnViewPlaylists').classList.remove('tab-pill-selector__btn--active');
    document.getElementById('btnBackToPlaylists').style.display = 'inline-flex';
    document.getElementById('btnNewPlaylist').style.display = 'none';
    if (isTeacher) document.getElementById('btnAddVideos').style.display = 'inline-flex';
}

function setCreateView() {
    document.getElementById('btnNewPlaylist').classList.add('tab-pill-selector__btn--active');
    document.getElementById('btnViewPlaylists').classList.remove('tab-pill-selector__btn--active');
}

export async function init() {
    // Move modals to <body> so position:fixed works correctly regardless of
    // any CSS transform on the dashboard panel ancestor.
    ['recordingModal', 'recPickerModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.parentElement !== document.body) document.body.appendChild(el);
    });

    if (isTeacher) {
        document.getElementById('btnEmptyNewPlaylist')?.addEventListener('click', showCreateForm);
    }

    // Populate subject pills (radio — single select)
    const pillsContainer = document.getElementById('plSubjectPills');
    if (pillsContainer) {
        pillsContainer.innerHTML = window._Subjects.map(s => `
            <label class="subject-pill">
                <input type="radio" name="plSubjectRadio" value="${s}">
                <span class="subject-pill__label">${s}</span>
            </label>`).join('');
    }
    // Populate grade pills (radio — single select)
    const gradePills = document.getElementById('plGradePills');
    if (gradePills) {
        gradePills.innerHTML = [window._Grade11, window._Grade12].map(g => `
            <label class="subject-pill">
                <input type="radio" name="plGradeRadio" value="${g}">
                <span class="subject-pill__label">${g}</span>
            </label>`).join('');
    }

    // Create playlist
    document.getElementById('btnViewPlaylists')?.addEventListener('click', () => {
        if (document.getElementById('recCreateForm').style.display !== 'none') hideCreateForm();
        else if (currentPlaylist) goBackToPlaylists();
    });
    document.getElementById('btnNewPlaylist')?.addEventListener('click', showCreateForm);
    document.getElementById('btnCancelCreate')?.addEventListener('click', hideCreateForm);
    document.getElementById('btnSavePlaylist')?.addEventListener('click', savePlaylist);

    // Add videos
    document.getElementById('btnBackToPlaylists')?.addEventListener('click', goBackToPlaylists);
    document.getElementById('btnAddVideos')?.addEventListener('click', window.openVideoPicker);
    document.getElementById('btnConfirmAddVideos')?.addEventListener('click', confirmAddVideos);

    // Drive watch
    document.getElementById('btnRenewWatch')?.addEventListener('click', renewDriveWatch);

    // Renew watch button
    document.getElementById('btnRenewWatch')?.addEventListener('click', renewDriveWatch);

    // Close modals on overlay click / Escape
    document.getElementById('recPickerModal')?.addEventListener('click', e => { if (e.target === e.currentTarget) window.closeVideoPicker(); });
    document.getElementById('recordingModal')?.addEventListener('click', e => { if (e.target === e.currentTarget) window.closeRecordingModal(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { window.closeRecordingModal(); window.closeVideoPicker(); }
    });

    // Load data
    await Promise.all([loadAllRecordings(), loadPlaylists()]);
    setPlaylistView();
    renderPlaylistGrid();
}

export async function refresh() {
    await Promise.all([loadAllRecordings(), loadPlaylists()]);
    if (currentPlaylist) {
        currentPlaylist = allPlaylists.find(p => p.id === currentPlaylist.id) ?? currentPlaylist;
        renderDetailGrid();
    } else {
        renderPlaylistGrid();
    }
}
