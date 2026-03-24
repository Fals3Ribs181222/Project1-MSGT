const user = window.auth.getUser();

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
            tbody.innerHTML = response.data.reverse().map(t => `
                <tr class="data-table__row">
                    <td class="data-table__td--main">${t.student_name || '-'}</td>
                    <td class="data-table__td">${t.subject || '-'}</td>
                    <td class="data-table__td">${t.year || '-'}</td>
                    <td class="data-table__td"><div class="text-truncate" style="max-width: 200px;">${t.testimonial_text || '-'}</div></td>
                    <td class="data-table__td">${t.media_url ? `<a href="${t.media_url}" target="_blank" class="navbar__link">View Media</a>` : 'None'}</td>
                    <td class="data-table__td">${t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}</td>
                    <td class="data-table__td">
                        <button class="btn btn--danger btn--sm" onclick="deleteTestimonial('${t.id}', '${t.media_url || ''}')">Delete</button>
                    </td>
                </tr>
            `).join('');
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

        btn.disabled = true;
        btn.textContent = 'Adding...';
        status.style.display = 'none';

        try {
            let mediaUrl = null;
            let mediaType = null;

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

            const payload = {
                student_name: document.getElementById('testimStudentName').value,
                subject: document.getElementById('testimSubject').value,
                year: document.getElementById('testimYear').value,
                testimonial_text: document.getElementById('testimText').value,
                media_url: mediaUrl,
                media_type: mediaType
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
        // 1. Delete from Storage if media exists
        if (mediaUrl) {
            const filePath = mediaUrl.split('/').pop();
            await window.supabaseClient.storage.from('testimonials').remove([`testimonials/${filePath}`]);
        }

        // 2. Delete from Database
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
