export async function loadTab(targetId) {
    const panelsContainer = document.getElementById('dashboard-content');

    // Deactivate all current panels
    const allPanels = panelsContainer.querySelectorAll('.tabs__panel');
    allPanels.forEach(p => p.classList.remove('tabs__panel--active'));

    // Update URL hash to reflect active tab
    const featureSlug = targetId.replace('panel-', '');
    history.replaceState(null, '', `#${featureSlug}`);

    // Update active sidebar item
    document.querySelectorAll('.dash-sidebar__item').forEach(btn => {
        btn.classList.toggle('dash-sidebar__item--active', btn.dataset.target === targetId);
    });

    // Check if the panel already exists in the DOM
    let targetPanel = document.getElementById(targetId);

    // If it doesn't exist, we need to fetch it
    if (!targetPanel) {
        // Map targetId to filename (e.g., panel-students -> students)
        const featureName = targetId.replace('panel-', '');

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
                    try {
                        await module.init();
                    } catch (initError) {
                        console.error(`Error initializing ${featureName}:`, initError);
                        targetPanel.innerHTML = `<div class="status status--error">Error loading ${featureName}: ${initError.message || 'Unknown error'}</div>`;
                    }
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
        try {
            const module = await import(`./${featureName}.js`);
            if (module.refresh) {
                try {
                    await module.refresh();
                } catch (refreshError) {
                    console.error(`Error refreshing ${featureName}:`, refreshError);
                    // Show error toast or message to user
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'status status--error';
                    errorDiv.textContent = `Error refreshing ${featureName}: ${refreshError.message || 'Unknown error'}`;
                    targetPanel.prepend(errorDiv);
                }
            }
        } catch (e) {
            // Ignore if no module or refresh method
        }
    }

}

export async function prefetchTabs(tabNames) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    for (const name of tabNames) {
        fetch(`components/tabs/${name}`).catch(() => {});
        import(`./${name}.js`).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

export function initRouter(defaultTab) {
    const run = () => {
        const initialTab = location.hash.slice(1);
        loadTab(initialTab ? `panel-${initialTab}` : defaultTab);

        document.addEventListener('click', (e) => {
            const pill = e.target.closest('.landing-pill');
            if (pill) {
                const target = pill.getAttribute('data-target');
                if (target) loadTab(target);
            }
        });
    };

    // ES modules are deferred — DOMContentLoaded may have already fired
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
}
