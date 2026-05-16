let user;

export async function init() {
    user = window.auth.getUser();
    await loadProfile();
    document.getElementById('profileForm')?.addEventListener('submit', saveProfile);
}

export async function refresh() {
    await loadProfile();
}

async function loadProfile() {
    window.showStatus('profileStatus', '', 'success');

    const res = await window.api.get('profiles', { id: user.id }, '*', { single: true });
    if (!res.success || !res.data) {
        window.showStatus('profileStatus', res.error || 'Failed to load profile.', 'error');
        return;
    }

    const p = res.data;

    // Read-only fields
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
    set('profileNameDisplay', p.name);
    set('profileUsernameDisplay', p.username);
    set('profileGradeDisplay', p.grade);
    set('profileSubjectsDisplay', p.subjects);

    // Editable fields
    const fill = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    fill('profilePhone', p.phone);
    fill('profileEmail', p.email);
    fill('profileFatherName', p.father_name);
    fill('profileFatherPhone', p.father_phone);
    fill('profileMotherName', p.mother_name);
    fill('profileMotherPhone', p.mother_phone);
}

async function saveProfile(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveProfile');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    window.showStatus('profileStatus', '', 'success');

    const val = (id) => document.getElementById(id)?.value.trim() || null;

    const updates = {
        phone:        val('profilePhone'),
        email:        val('profileEmail'),
        father_name:  val('profileFatherName'),
        father_phone: val('profileFatherPhone'),
        mother_name:  val('profileMotherName'),
        mother_phone: val('profileMotherPhone'),
    };

    const res = await window.api.patch('profiles', user.id, updates);

    btn.disabled = false;
    btn.textContent = 'Save Changes';

    if (res.success) {
        window.showStatus('profileStatus', 'Profile updated successfully!', 'success');
        await window.auth.refreshProfile();
    } else {
        window.showStatus('profileStatus', res.error || 'Failed to save profile.', 'error');
    }
}
