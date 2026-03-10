export async function loadTab(targetId, pushState = true) {
    const panelsContainer = document.getElementById('dashboard-content');

    // Deactivate all current panels
    const allPanels = panelsContainer.querySelectorAll('.tabs__panel');
    allPanels.forEach(p => p.classList.remove('tabs__panel--active'));

    // Update the browser URL
    const featureNameForUrl = targetId.replace('panel-', '');
    if (pushState) {
        if (featureNameForUrl === 'home') {
            window.history.pushState({ tab: targetId }, '', '/teacher_dashboard');
        } else {
            window.history.pushState({ tab: targetId }, '', `/teacher_dashboard/${featureNameForUrl}`);
        }
    }

    // Check if the panel already exists in the DOM
    let targetPanel = document.getElementById(targetId);

    if (!targetPanel) {
        const featureName = targetId.replace('panel-', '');
        if (featureName === 'home') return;

        try {
            targetPanel = document.createElement('section');
            targetPanel.className = 'panel tabs__panel tabs__panel--active';
            targetPanel.id = targetId;
            targetPanel.innerHTML = `<div class="loading-text" style="padding: 2rem; text-align: center;">Loading ${featureName}...</div>`;
            panelsContainer.appendChild(targetPanel);

            const response = await fetch(`/components/tabs/${featureName}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const html = await response.text();
            targetPanel.innerHTML = html;

            try {
                const module = await import(`./${featureName}.js`);
                if (module.init) module.init();
            } catch (jsError) {
                console.warn(`No specific JS module found for ${featureName} or failed to load:`, jsError);
            }

        } catch (error) {
            console.error(`Error loading tab ${featureName}:`, error);
            targetPanel.innerHTML = `<div class="status status--error">Failed to load module: ${featureName}</div>`;
        }
    } else {
        targetPanel.classList.add('tabs__panel--active');

        const featureName = targetId.replace('panel-', '');
        if (featureName === 'home') return;
        try {
            const module = await import(`./${featureName}.js`);
            if (module.refresh) module.refresh();
        } catch (e) { /* ignore */ }
    }

    // Toggle the "Back to Overview" button
    const backBtn = document.querySelector('.back-to-home-container');
    if (targetId === 'panel-home') {
        backBtn.style.display = 'none';
        document.querySelector('.welcome').style.display = 'block';
    } else {
        backBtn.style.display = 'block';
        document.querySelector('.welcome').style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (e) => {
        const tab = e.state?.tab || 'panel-home';
        loadTab(tab, false); // false = don't pushState again
    });

    // On direct URL access (e.g. /teacher_dashboard/students), load the right tab
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    const validTabs = ['students', 'attendance', 'batches', 'schedule', 'upload',
                       'test', 'announcement', 'board_results', 'testimonials'];

    if (validTabs.includes(lastSegment)) {
        loadTab(`panel-${lastSegment}`, false);
    } else {
        // Set the initial history state for the home panel so popstate works correctly
        window.history.replaceState({ tab: 'panel-home' }, '', window.location.pathname);
    }

    // Click listeners
    document.addEventListener('click', (e) => {
        const pill = e.target.closest('.landing-pill');
        if (pill) {
            const target = pill.getAttribute('data-target');
            if (target) loadTab(target);
        }
        if (e.target.id === 'btnBackToHome') loadTab('panel-home');
    });
});