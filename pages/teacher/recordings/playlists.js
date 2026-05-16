const user = window.auth.getUser();
const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

let allPlaylists = [];

function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function thumb(videoId) {
    return `https://img.youtube.com/vi/${window.esc(videoId)}/mqdefault.jpg`;
}

function metaStr(subject, grade) {
    return [subject, grade ? `Grade ${grade}` : ''].filter(Boolean).join(' · ');
}

async function loadPlaylists() {
    const res = await window.api.get(
        'playlists', {}, '*, playlist_videos(video_id, position, class_recordings:video_id(youtube_video_id, title))',
        { order: 'created_at', ascending: false }
    );
    allPlaylists = res.success ? (res.data ?? []) : [];
}

function renderPlaylistGrid() {
    const grid  = document.getElementById('recPlaylistGrid');
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
        const count  = videos.length;
        const thumbs = videos
            .sort((a, b) => a.position - b.position)
            .slice(0, 3)
            .map(v => v.class_recordings?.youtube_video_id)
            .filter(Boolean);

        const mainThumb   = thumbs[0];
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

        return `
        <div class="rec-card" tabindex="0" role="button" aria-label="Open playlist ${window.esc(pl.name)}"
             onclick="window._openPlaylist('${pl.id}')"
             onkeydown="if(event.key==='Enter'||event.key===' ')this.click()">
            ${thumbHtml}
            <div class="rec-info">
                <p class="rec-title">${window.esc(pl.name)}</p>
                <div class="rec-meta">
                    ${metaStr(pl.subject, pl.grade) || '<span>No subject set</span>'}
                </div>
            </div>
        </div>`;
    }).join('');
}

export async function init() {
    if (isTeacher) {
        const renewBtn = document.getElementById('btnRenewWatch');
        if (renewBtn) {
            renewBtn.style.display = 'inline-flex';
            renewBtn.addEventListener('click', async () => {
                renewBtn.disabled = true;
                renewBtn.innerHTML = '<i class="ri-loader-4-line"></i> Registering...';
                try {
                    const { data: { session } } = await window.supabaseClient.auth.getSession();
                    const res = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/setup-drive-watch`, {
                        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || 'Failed');
                    const d = new Date(json.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                    renewBtn.innerHTML = `<i class="ri-checkbox-circle-line"></i> Active (until ${d})`;
                    setTimeout(() => { renewBtn.innerHTML = '<i class="ri-loop-left-line"></i> Renew Watch'; renewBtn.disabled = false; }, 3000);
                } catch {
                    renewBtn.innerHTML = '<i class="ri-error-warning-line"></i> Retry?';
                    renewBtn.disabled = false;
                }
            });
        }
        document.getElementById('btnEmptyNewPlaylist')?.addEventListener('click', () => window.loadPage('page-recordings', 'create'));
    }

    window._openPlaylist = function (playlistId) {
        window._pendingPlaylistId = playlistId;
        window.loadPage('page-recordings', 'detail');
    };

    await loadPlaylists();
    renderPlaylistGrid();
}

export async function refresh() {
    await loadPlaylists();
    renderPlaylistGrid();
}
