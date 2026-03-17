export async function loadTab(targetId) {
    const panelsContainer = document.getElementById('dashboard-content');

    // Deactivate all current panels
    const allPanels = panelsContainer.querySelectorAll('.tabs__panel');
    allPanels.forEach(p => p.classList.remove('tabs__panel--active'));

    // Update URL hash to reflect active tab
    const featureSlug = targetId.replace('panel-', '');
    history.replaceState(null, '', featureSlug === 'home' ? location.pathname : `#${featureSlug}`);

    // Check if the panel already exists in the DOM
    let targetPanel = document.getElementById(targetId);

    // If it doesn't exist, we need to fetch it
    if (!targetPanel) {
        // Map targetId to filename (e.g., panel-students -> students)
        const featureName = targetId.replace('panel-', '');

        if (featureName === 'home') return;

        try {
            // Show a loading indicator
            targetPanel = document.createElement('section');
            targetPanel.className = 'panel tabs__panel tabs__panel--active';
            targetPanel.id = targetId;
            targetPanel.innerHTML = `<div class="loading-text" style="padding: 2rem; text-align: center;">Loading ${featureName}...</div>`;
            panelsContainer.appendChild(targetPanel);

            const response = await fetch(`components/tabs/${featureName}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const html = await response.text();
            targetPanel.innerHTML = html;

            // Dynamically load the Javascript for this specific module
            try {
                const module = await import(`./${featureName}.js`);
                if (module.init) {
                    module.init();
                }
            } catch (jsError) {
                console.warn(`No specific JS module found for ${featureName} or failed to load:`, jsError);
            }

        } catch (error) {
            console.error(`Error loading tab ${featureName}:`, error);
            targetPanel.innerHTML = `<div class="status status--error">Failed to load module: ${featureName}</div>`;
        }
    } else {
        // If it already exists, just make it active
        targetPanel.classList.add('tabs__panel--active');

        // If we switch back to a tab, we might want to refresh its data
        const featureName = targetId.replace('panel-', '');
        if (featureName === 'home') return; // Do not fetch home.js
        try {
            const module = await import(`./${featureName}.js`);
            if (module.refresh) {
                module.refresh();
            }
        } catch (e) {
            // Ignore if no module or refresh method
        }
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

// Set up global event listeners for navigation pills and back buttons
document.addEventListener('DOMContentLoaded', () => {
    // Restore tab from URL hash on page load
    const initialTab = location.hash.slice(1);
    if (initialTab) {
        loadTab(`panel-${initialTab}`);
    }

    // Listen for clicks on landing pills
    document.addEventListener('click', (e) => {
        const pill = e.target.closest('.landing-pill');
        if (pill) {
            const target = pill.getAttribute('data-target');
            if (target) {
                loadTab(target);
            }
        }

        // Listen for back to home button
        if (e.target.id === 'btnBackToHome') {
            loadTab('panel-home');
        }
    });
});
