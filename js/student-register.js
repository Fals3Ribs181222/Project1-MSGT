window.populateGradePills('regGrade', false);

function showRegForm() {
    document.getElementById('regSuccess').style.display = 'none';
    document.getElementById('regForm').style.display = '';
    window.safeFormReset(document.getElementById('regForm'));
    window.populateGradePills('regGrade', false);
}

document.getElementById('regForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name       = document.getElementById('regName').value.trim();
    const grade      = window.getSelectedGrade('regGrade');
    const phone      = document.getElementById('regPhone').value.trim() || null;
    const email      = document.getElementById('regEmail').value.trim() || null;
    const fatherName = document.getElementById('regFatherName').value.trim() || null;
    const motherName = document.getElementById('regMotherName').value.trim() || null;
    const fatherPhone= document.getElementById('regFatherPhone').value.trim() || null;
    const motherPhone= document.getElementById('regMotherPhone').value.trim() || null;
    const subjects   = Array.from(document.querySelectorAll('input[name="regSubjects"]:checked'))
                           .map(cb => cb.value).join(', ') || null;
    const school     = document.getElementById('regSchool').value || null;

    const statusEl  = document.getElementById('regStatus');
    const btn       = document.getElementById('regSubmitBtn');
    const btnText   = document.getElementById('regSubmitText');
    const spinner   = document.getElementById('regSubmitSpinner');

    if (!name || !grade) {
        statusEl.textContent = 'Please enter your full name and select a grade.';
        statusEl.className = 'status status--error';
        statusEl.style.display = 'block';
        return;
    }

    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';
    btn.disabled = true;
    statusEl.style.display = 'none';

    try {
        const { error } = await window.supabaseClient
            .from('registration_requests')
            .insert({
                name, grade, phone, email,
                father_name: fatherName, father_phone: fatherPhone,
                mother_name: motherName, mother_phone: motherPhone,
                subjects, school,
            });

        if (error) throw new Error(error.message);

        document.getElementById('regForm').style.display = 'none';
        document.getElementById('regSuccess').style.display = '';
    } catch (err) {
        statusEl.textContent = `Submission failed: ${err.message}`;
        statusEl.className = 'status status--error';
        statusEl.style.display = 'block';
    } finally {
        btnText.style.display = 'inline-block';
        spinner.style.display = 'none';
        btn.disabled = false;
    }
});
