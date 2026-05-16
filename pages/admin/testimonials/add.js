function extractYouTubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

export function init() {
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

            if (youtubeInput && youtubeInput.value.trim()) {
                youtubeVideoId = extractYouTubeId(youtubeInput.value.trim());
                if (!youtubeVideoId) throw new Error('Invalid YouTube URL. Please paste a valid YouTube link.');
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
