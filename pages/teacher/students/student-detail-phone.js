// js/dashboard/student-detail-phone.js
// Father/mother phone-edit form wiring. Two near-identical functions kept separate
// for now — a future pass can consolidate into a single setupPhoneEdit({kind, ...}).

export function setupFatherPhoneEdit(studentId, currentPhone, onPhoneUpdate) {
    const editBtn = document.getElementById('btnEditFatherPhone');
    const editForm = document.getElementById('sdFatherPhoneEdit');
    const input = document.getElementById('sdFatherPhoneInput');
    const saveBtn = document.getElementById('btnSaveFatherPhone');
    const cancelBtn = document.getElementById('btnCancelFatherPhone');

    if (!editBtn || !editForm || !saveBtn) return;

    input.value = currentPhone || '';

    [editBtn, saveBtn, cancelBtn].forEach(btn => {
        const clone = btn.cloneNode(true);
        btn.parentNode.replaceChild(clone, btn);
    });

    const freshEdit = document.getElementById('btnEditFatherPhone');
    const freshSave = document.getElementById('btnSaveFatherPhone');
    const freshCancel = document.getElementById('btnCancelFatherPhone');
    const freshInput = document.getElementById('sdFatherPhoneInput');

    freshEdit.addEventListener('click', () => {
        editForm.style.display = 'block';
        freshEdit.style.display = 'none';
        freshInput.focus();
    });

    freshCancel.addEventListener('click', () => {
        editForm.style.display = 'none';
        freshEdit.style.display = 'inline-block';
    });

    freshSave.addEventListener('click', async () => {
        const phone = (freshInput.value || '').trim().replace(/\D/g, '');
        if (phone && phone.length !== 10) {
            alert('Please enter a valid 10-digit number (without country code)');
            return;
        }
        freshSave.disabled = true;
        freshSave.textContent = 'Saving...';
        try {
            const { error } = await window.supabaseClient
                .from('profiles')
                .update({ father_phone: phone || null })
                .eq('id', studentId);
            if (error) throw error;

            const display = document.getElementById('sdFatherPhone');
            const waLink = document.getElementById('sdFatherWaLink');
            if (display) display.textContent = phone || 'Not set';
            if (waLink) {
                if (phone) {
                    waLink.href = `https://wa.me/91${phone}`;
                    waLink.style.display = 'inline-block';
                } else {
                    waLink.style.display = 'none';
                }
            }
            editForm.style.display = 'none';
            freshEdit.style.display = 'inline-block';

            if (onPhoneUpdate) onPhoneUpdate(studentId, 'father_phone', phone);

        } catch (err) {
            alert('Failed to save: ' + (err.message || 'Unknown error'));
        } finally {
            freshSave.disabled = false;
            freshSave.textContent = 'Save';
        }
    });
}

export function setupMotherPhoneEdit(studentId, currentPhone, onPhoneUpdate) {
    const editBtn = document.getElementById('btnEditMotherPhone');
    const editForm = document.getElementById('sdMotherPhoneEdit');
    const input = document.getElementById('sdMotherPhoneInput');
    const saveBtn = document.getElementById('btnSaveMotherPhone');
    const cancelBtn = document.getElementById('btnCancelMotherPhone');

    if (!editBtn || !editForm || !saveBtn) return;

    input.value = currentPhone || '';

    [editBtn, saveBtn, cancelBtn].forEach(btn => {
        const clone = btn.cloneNode(true);
        btn.parentNode.replaceChild(clone, btn);
    });

    const freshEdit = document.getElementById('btnEditMotherPhone');
    const freshSave = document.getElementById('btnSaveMotherPhone');
    const freshCancel = document.getElementById('btnCancelMotherPhone');
    const freshInput = document.getElementById('sdMotherPhoneInput');

    freshEdit.addEventListener('click', () => {
        editForm.style.display = 'block';
        freshEdit.style.display = 'none';
        freshInput.focus();
    });

    freshCancel.addEventListener('click', () => {
        editForm.style.display = 'none';
        freshEdit.style.display = 'inline-block';
    });

    freshSave.addEventListener('click', async () => {
        const phone = (freshInput.value || '').trim().replace(/\D/g, '');
        if (phone && phone.length !== 10) {
            alert('Please enter a valid 10-digit number (without country code)');
            return;
        }
        freshSave.disabled = true;
        freshSave.textContent = 'Saving...';
        try {
            const { error } = await window.supabaseClient
                .from('profiles')
                .update({ mother_phone: phone || null })
                .eq('id', studentId);
            if (error) throw error;

            const display = document.getElementById('sdMotherPhone');
            const waLink = document.getElementById('sdMotherWaLink');
            if (display) display.textContent = phone || 'Not set';
            if (waLink) {
                if (phone) {
                    waLink.href = `https://wa.me/91${phone}`;
                    waLink.style.display = 'inline-block';
                } else {
                    waLink.style.display = 'none';
                }
            }
            editForm.style.display = 'none';
            freshEdit.style.display = 'inline-block';

            if (onPhoneUpdate) onPhoneUpdate(studentId, 'mother_phone', phone);

        } catch (err) {
            alert('Failed to save: ' + (err.message || 'Unknown error'));
        } finally {
            freshSave.disabled = false;
            freshSave.textContent = 'Save';
        }
    });
}
