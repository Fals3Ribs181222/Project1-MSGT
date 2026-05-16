function generateUsernameFromName(name) {
    const parts = name.trim().toLowerCase().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return parts[0] + '.' + parts[parts.length - 1];
}

function attachListeners() {
    const form = document.getElementById('addStudentForm');
    if (!form) return;

    window.populateGradePills('studentGrade', false);

    const nameInput = document.getElementById('studentName');
    const usernameInput = document.getElementById('studentUsername');
    const passwordInput = document.getElementById('studentPassword');

    nameInput?.addEventListener('input', () => {
        const generated = generateUsernameFromName(nameInput.value);
        usernameInput.value = generated;
        passwordInput.value = generated;
    });

    const btnToggle = document.getElementById('btnTogglePassword');
    const eyeIcon = document.getElementById('passwordEyeIcon');
    btnToggle?.addEventListener('click', () => {
        const isHidden = passwordInput.type === 'password';
        passwordInput.type = isHidden ? 'text' : 'password';
        eyeIcon.className = isHidden ? 'ri-eye-off-line' : 'ri-eye-line';
        btnToggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const status = document.getElementById('addStudentStatus');
        const btn = document.getElementById('btnAddStudent');
        const btnText = document.getElementById('btnAddStudentText');
        const btnSpinner = document.getElementById('btnAddStudentSpinner');

        const name = document.getElementById('studentName').value.trim();
        const grade = window.getSelectedGrade('studentGrade');
        const username = document.getElementById('studentUsername').value.trim().toLowerCase();
        const password = document.getElementById('studentPassword').value;
        const phone = document.getElementById('studentPhone').value.trim();
        const email = document.getElementById('studentEmail').value.trim() || null;
        const father_name = document.getElementById('studentFatherName').value.trim() || null;
        const father_phone = document.getElementById('studentFatherPhone').value.trim() || null;
        const mother_name = document.getElementById('studentMotherName').value.trim() || null;
        const mother_phone = document.getElementById('studentMotherPhone').value.trim() || null;
        const subjectCheckboxes = document.querySelectorAll('input[name="studentSubjects"]:checked');
        const subjects = Array.from(subjectCheckboxes).map(cb => cb.value).join(', ');
        const school = document.getElementById('studentSchool').value || null;

        if (!name || !grade || !username || !password) {
            status.textContent = 'Please fill in all required fields.';
            status.className = 'status status--error';
            status.style.display = 'block';
            return;
        }

        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-block';
        btn.disabled = true;
        status.style.display = 'none';

        try {
            const { data: sessionData } = await window.supabaseClient.auth.getSession();
            const token = sessionData?.session?.access_token;
            const meta = { name, username, grade, subjects, phone, email, father_name, father_phone, mother_name, mother_phone, school, role: 'student' };
            const res = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/admin-api`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': window.CONFIG.SUPABASE_ANON_KEY },
                body: JSON.stringify({ action: 'create_student', email: `${username}@msgt.internal`, password, meta }),
            });
            const result = await res.json();
            const error = result.error ? { message: result.error } : null;

            if (error) {
                status.textContent = `Error: ${error.message}`;
                status.className = 'status status--error';
                status.style.display = 'block';
            } else {
                status.innerHTML = `<strong><i class="ri-check-line" aria-hidden="true"></i> Student registered!</strong><br>
                    Name: ${window.esc(name)}<br>Username: ${window.esc(username)}<br>Grade: ${window.esc(grade)}<br>
                    The student can now log in.`;
                status.className = 'status status--info';
                status.style.display = 'block';
                window.safeFormReset(form);
            }
        } catch (err) {
            status.textContent = `Unexpected error: ${err.message}`;
            status.className = 'status status--error';
            status.style.display = 'block';
        } finally {
            btnText.style.display = 'inline-block';
            btnSpinner.style.display = 'none';
            btn.disabled = false;
        }
    });
}

export function init() {
    attachListeners();
}
