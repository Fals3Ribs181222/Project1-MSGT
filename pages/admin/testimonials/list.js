async function loadTestimonials() {
    const tbody = document.getElementById('testimonialsTableBody');
    const status = document.getElementById('testimonialsListStatus');
    const btnRefresh = document.getElementById('btnRefreshTestimonials');
    if (!tbody || !status || !btnRefresh) return;

    btnRefresh.disabled = true;
    btnRefresh.textContent = 'Refreshing...';
    status.style.display = 'none';
    tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Loading testimonials...</td></tr>';

    const response = await window.api.get('testimonials');

    btnRefresh.disabled = false;
    btnRefresh.textContent = 'Refresh List';

    if (response.success) {
        if (response.data && response.data.length > 0) {
            tbody.innerHTML = response.data.reverse().map(t => {
                let mediaCell;
                if (t.youtube_video_id) {
                    mediaCell = `<a href="https://www.youtube.com/watch?v=${window.esc(t.youtube_video_id)}" target="_blank" class="navbar__link">Watch Video</a>`;
                } else if (t.media_url) {
                    mediaCell = `<a href="${window.safeUrl(t.media_url)}" target="_blank" class="navbar__link">View Photo</a>`;
                } else {
                    mediaCell = 'None';
                }
                return `
                <tr class="data-table__row">
                    <td class="data-table__td--main">${window.esc(t.student_name) || '-'}</td>
                    <td class="data-table__td">${window.esc(t.subject) || '-'}</td>
                    <td class="data-table__td">${window.esc(t.year) || '-'}</td>
                    <td class="data-table__td"><div class="text-truncate" style="max-width:200px;">${DOMPurify.sanitize(t.testimonial_text) || '-'}</div></td>
                    <td class="data-table__td">${mediaCell}</td>
                    <td class="data-table__td">${t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}</td>
                    <td class="data-table__td">
                        <button class="btn btn--danger btn--sm" onclick="deleteTestimonial('${t.id}', '${t.media_url || ''}')">Delete</button>
                    </td>
                </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="loading-text">No testimonials found.</td></tr>';
        }
    } else {
        tbody.innerHTML = '';
        status.textContent = response.error || 'Failed to load testimonials.';
        status.className = 'status status--error';
        status.style.display = 'block';
    }
}

window.deleteTestimonial = async function (id, mediaUrl) {
    if (!confirm('Are you sure you want to delete this testimonial?')) return;
    try {
        if (mediaUrl) {
            const filePath = mediaUrl.split('/').pop();
            await window.supabaseClient.storage.from('testimonials').remove([`testimonials/${filePath}`]);
        }
        const { error } = await window.supabaseClient.from('testimonials').delete().eq('id', id);
        if (error) throw error;
        loadTestimonials();
    } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to delete: ' + err.message);
    }
};

export function init() {
    loadTestimonials();
    document.getElementById('btnRefreshTestimonials')?.addEventListener('click', loadTestimonials);
}

export function refresh() {
    loadTestimonials();
}
