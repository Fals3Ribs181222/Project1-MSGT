// js/dashboard/student-detail-notes.js
// Teacher notes textarea + save button wiring.

export function loadTeacherNotes(studentId, existingNotes, onNotesUpdate) {
    const textarea = document.getElementById('sdNotesInput');
    const statusEl = document.getElementById('sdNotesSaveStatus');
    const saveBtn = document.getElementById('btnSaveNotes');

    if (textarea) textarea.value = existingNotes || '';
    if (statusEl) statusEl.textContent = '';

    if (saveBtn) {
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

        newSaveBtn.addEventListener('click', async () => {
            const notes = document.getElementById('sdNotesInput')?.value || '';
            newSaveBtn.disabled = true;
            newSaveBtn.textContent = 'Saving...';
            try {
                const { error } = await window.supabaseClient
                    .from('profiles')
                    .update({ teacher_notes: notes })
                    .eq('id', studentId);
                if (error) throw error;

                if (statusEl) {
                    statusEl.textContent = '✓ Saved';
                    statusEl.style.color = '#00A36C';
                }
                if (onNotesUpdate) onNotesUpdate(studentId, notes);

            } catch (err) {
                if (statusEl) {
                    statusEl.textContent = 'Error saving';
                    statusEl.style.color = '#C41230';
                }
                console.error('Notes save error:', err);
            } finally {
                newSaveBtn.disabled = false;
                newSaveBtn.textContent = 'Save Notes';
                setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
            }
        });
    }
}
