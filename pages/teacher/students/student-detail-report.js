// js/dashboard/student-detail-report.js
// AI report generation: wires Generate / Copy / Send-WhatsApp buttons.
//
// initReport({ getStudent, getReportData }) — call once per student to (re)wire buttons.
// setReportButtonState(state) — exposed so the orchestrator can flip 'idle' → 'ready'
//   once async data fetches complete.

import { loadWhatsappLog } from './student-detail-whatsapp-log.js';

export function setReportButtonState(state) {
    const btn = document.getElementById('btnGenerateReport');
    if (!btn) return;
    if (state === 'loading') {
        btn.disabled = true;
        btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Generating...';
    } else {
        btn.disabled = (state === 'idle');
        btn.innerHTML = '<i class="ri-sparkling-line"></i> Generate Progress Report';
    }
}

function clearReportOutput() {
    const section = document.getElementById('reportOutputSection');
    const text = document.getElementById('reportOutputText');
    if (section) section.style.display = 'none';
    if (text) text.textContent = '';
}

export function initReport({ getStudent, getReportData }) {
    setReportButtonState('idle');
    clearReportOutput();

    const btnGenerate = document.getElementById('btnGenerateReport');
    if (btnGenerate) {
        const fresh = btnGenerate.cloneNode(true);
        btnGenerate.parentNode.replaceChild(fresh, btnGenerate);
        fresh.addEventListener('click', () => generateReport(getReportData()));
    }

    const btnCopy = document.getElementById('btnCopyReport');
    if (btnCopy) {
        const fresh = btnCopy.cloneNode(true);
        btnCopy.parentNode.replaceChild(fresh, btnCopy);
        fresh.addEventListener('click', copyReportToClipboard);
    }

    const btnWa = document.getElementById('btnSendWhatsappReport');
    if (btnWa) {
        const fresh = btnWa.cloneNode(true);
        btnWa.parentNode.replaceChild(fresh, btnWa);
        fresh.addEventListener('click', () => sendWhatsAppReport(getStudent()));
    }
}

async function generateReport(studentReportData) {
    if (!studentReportData) return;

    setReportButtonState('loading');

    const section = document.getElementById('reportOutputSection');
    const text = document.getElementById('reportOutputText');
    const copyBtn = document.getElementById('btnCopyReport');

    if (section) section.style.display = 'block';
    if (text) text.textContent = 'Generating report...';
    if (copyBtn) copyBtn.style.display = 'none';

    section?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
        const token = window.CONFIG.SUPABASE_ANON_KEY;
        const GENERATE_REPORT_URL = `${window.CONFIG.SUPABASE_URL}/functions/v1/generate-report`;

        const response = await fetch(GENERATE_REPORT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(studentReportData),
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(result.error || 'Failed to generate report.');
        }

        if (text) text.textContent = result.report;
        if (copyBtn) copyBtn.style.display = 'inline-flex';

        const whatsAppBtn = document.getElementById('btnSendWhatsappReport');
        if (whatsAppBtn) whatsAppBtn.style.display = 'inline-flex';

    } catch (err) {
        console.error('Report generation error:', err);
        console.dir(err);
        if (text) {
            text.textContent = '⚠ ' + (err.message || 'Something went wrong. Please try again.');
        }
    } finally {
        setReportButtonState('ready');
    }
}

async function sendWhatsAppReport(student) {
    const textEl = document.getElementById('reportOutputText');
    const reportText = textEl?.textContent || '';

    if (!reportText || !student) return;

    const recipients = window.whatsapp.resolveRecipients(student, 'parent');
    if (recipients.length === 0) {
        const fallback = window.whatsapp.resolveRecipients(student, 'student');
        if (fallback.length === 0) {
            alert("This student doesn't have a phone number registered. Please update their profile.");
            return;
        }
        recipients.push(...fallback);
    }

    const btn = document.getElementById('btnSendWhatsappReport');
    if (!btn) return;

    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Sending...';
    btn.disabled = true;

    try {
        await window.whatsapp.send({
            type: 'report',
            recipients,
            payload: { report: reportText },
        });

        btn.innerHTML = '<i class="ri-check-line"></i> Sent!';
        btn.style.backgroundColor = '#1DA954';

        if (student.id) loadWhatsappLog(student.id);

        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.style.backgroundColor = '#25D366';
            btn.disabled = false;
        }, 3000);

    } catch (err) {
        console.error('WhatsApp dispatch error:', err);
        alert('Failed to send WhatsApp message: ' + err.message);
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

function copyReportToClipboard() {
    const text = document.getElementById('reportOutputText')?.textContent || '';
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('btnCopyReport');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="ri-check-line"></i> Copied!';
            setTimeout(() => { btn.innerHTML = original; }, 2000);
        }
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
    });
}
