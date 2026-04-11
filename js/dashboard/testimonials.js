const user = window.auth.getUser();

function extractYouTubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

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
                    <td class="data-table__td"><div class="text-truncate" style="max-width: 200px;">${DOMPurify.sanitize(t.testimonial_text) || '-'}</div></td>
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

async function loadTestimonialComponent() {
    try {
        const response = await fetch('components/add_testimonial');
        if (response.ok) {
            const html = await response.text();
            const container = document.getElementById('addTestimonialContainer');
            if (container) {
                container.innerHTML = html;
                attachTestimonialListeners();
            }
        }
    } catch (err) {
        console.error('Error loading testimonial component:', err);
    }
}

function attachTestimonialListeners() {
    const form = document.getElementById('testimonialForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnAddTestimonial');
        const status = document.getElementById('testimonialStatus');
        const mediaInput = document.getElementById('testimMedia');
        const youtubeInput = document.getElementById('testimYouTube');

        btn.disabled = true;
        btn.textContent = 'Adding...';
        status.style.display = 'none';

        try {
            let mediaUrl = null;
            let mediaType = null;
            let youtubeVideoId = null;

            // Handle photo upload (images only)
            if (mediaInput.files.length > 0) {
                const file = mediaInput.files[0];
                mediaType = file.type;
                const fileName = `${Date.now()}_${file.name}`;
                const { data: storageData, error: storageError } = await window.supabaseClient
                    .storage
                    .from('testimonials')
                    .upload(`testimonials/${fileName}`, file);

                if (storageError) throw storageError;

                const { data: { publicUrl } } = window.supabaseClient
                    .storage
                    .from('testimonials')
                    .getPublicUrl(`testimonials/${fileName}`);

                mediaUrl = publicUrl;
            }

            // Handle YouTube URL
            if (youtubeInput && youtubeInput.value.trim()) {
                youtubeVideoId = extractYouTubeId(youtubeInput.value.trim());
                if (!youtubeVideoId) {
                    throw new Error('Invalid YouTube URL. Please paste a valid YouTube link.');
                }
            }

            const payload = {
                student_name: document.getElementById('testimStudentName').value,
                subject: document.getElementById('testimSubject').value,
                year: document.getElementById('testimYear').value,
                testimonial_text: document.getElementById('testimText').value.trim() || null,
                media_url: mediaUrl,
                media_type: mediaType,
                youtube_video_id: youtubeVideoId
            };

            const response = await window.api.post('testimonials', payload);
            if (response.success) {
                status.textContent = 'Testimonial added successfully!';
                status.className = 'status status--success';
                status.style.display = 'block';
                window.safeFormReset(e.target);
                loadTestimonials();
            } else {
                throw new Error(response.error);
            }
        } catch (err) {
            console.error('Testimonial error:', err);
            status.textContent = 'Error: ' + err.message;
            status.className = 'status status--error';
            status.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Add Testimonial';
        }
    });
}

window.deleteTestimonial = async function (id, mediaUrl) {
    if (!confirm('Are you sure you want to delete this testimonial?')) return;

    try {
        // Delete from Storage only if a photo was uploaded
        if (mediaUrl) {
            const filePath = mediaUrl.split('/').pop();
            await window.supabaseClient.storage.from('testimonials').remove([`testimonials/${filePath}`]);
        }

        // Delete from Database
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
    loadTestimonialComponent();

    const btnRefresh = document.getElementById('btnRefreshTestimonials');
    if (btnRefresh) btnRefresh.addEventListener('click', loadTestimonials);

    const pillView = document.getElementById('pillViewTestimonials');
    const pillAdd = document.getElementById('pillAddTestimonial');
    const listContainer = document.getElementById('testimonialsListContainer');
    const addContainer = document.getElementById('addTestimonialContainer');

    if (pillView && pillAdd) {
        pillView.addEventListener('click', () => {
            pillView.classList.add('pill-toggle__btn--active');
            pillAdd.classList.remove('pill-toggle__btn--active');
            if (listContainer) listContainer.style.display = 'block';
            if (addContainer) addContainer.style.display = 'none';
            if (btnRefresh) btnRefresh.style.display = 'inline-block';
        });

        pillAdd.addEventListener('click', () => {
            pillAdd.classList.add('pill-toggle__btn--active');
            pillView.classList.remove('pill-toggle__btn--active');
            if (addContainer) addContainer.style.display = 'block';
            if (listContainer) listContainer.style.display = 'none';
            if (btnRefresh) btnRefresh.style.display = 'none';
        });
    }
}

export function refresh() {
    loadTestimonials();
}
