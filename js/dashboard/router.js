export async function loadPage(targetId, tabSlug) {
    const panelsContainer = document.getElementById('dashboard-content');

    // Deactivate all current pages
    const allPages = panelsContainer.querySelectorAll('.pages__panel');
    allPages.forEach(p => p.classList.remove('pages__panel--active'));

    // Update URL hash to reflect active page (and tab if provided), preserving query params
    const pageSlug = targetId.replace('page-', '');
    const hashSuffix = tabSlug ? `${pageSlug}#${tabSlug}` : pageSlug;
    history.replaceState(null, '', `${location.search}#${hashSuffix}`);

    // Update active sidebar item
    document.querySelectorAll('.dash-sidebar__item').forEach(btn => {
        btn.classList.toggle('dash-sidebar__item--active', btn.dataset.target === targetId);
    });

    // Check if the page already exists in the DOM
    let targetPage = document.getElementById(targetId);

    // If it doesn't exist, fetch and initialise it
    if (!targetPage) {
        // Map targetId to filename (e.g., page-students -> students)
        const featureName = targetId.replace('page-', '');

        try {
            targetPage = document.createElement('section');
            targetPage.className = 'panel pages__panel pages__panel--active';
            targetPage.id = targetId;
            targetPage.innerHTML = `<div class="loading-text" style="padding: 2rem; text-align: center;">Loading ${featureName}...</div>`;
            panelsContainer.appendChild(targetPage);

            const response = await fetch(`components/tabs/${featureName}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const html = await response.text();
            targetPage.innerHTML = html;

            try {
                const module = await import(`./${featureName}.js`);
                if (module.init) {
                    try {
                        await module.init(tabSlug);
                    } catch (initError) {
                        console.error(`Error initializing ${featureName}:`, initError);
                        targetPage.innerHTML = `<div class="status status--error">Error loading ${featureName}: ${initError.message || 'Unknown error'}</div>`;
                    }
                }
            } catch (jsError) {
                console.warn(`No specific JS module found for ${featureName} or failed to load:`, jsError);
            }

        } catch (error) {
            console.error(`Error loading page ${featureName}:`, error);
            targetPage.innerHTML = `<div class="status status--error">Failed to load module: ${featureName}</div>`;
        }
    } else {
        // Already in DOM — activate and refresh
        targetPage.classList.add('pages__panel--active');

        const featureName = targetId.replace('page-', '');
        try {
            const module = await import(`./${featureName}.js`);
            if (tabSlug && module.activateTab) {
                module.activateTab(tabSlug);
            } else if (module.refresh) {
                try {
                    await module.refresh();
                } catch (refreshError) {
                    console.error(`Error refreshing ${featureName}:`, refreshError);
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'status status--error';
                    errorDiv.textContent = `Error refreshing ${featureName}: ${refreshError.message || 'Unknown error'}`;
                    targetPage.prepend(errorDiv);
                }
            }
        } catch (e) {
            // Ignore if no module or refresh method
        }
    }

}

export async function prefetchPages(pageNames) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    for (const name of pageNames) {
        fetch(`components/tabs/${name}`).catch(() => {});
        import(`./${name}.js`).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

export function initRouter(defaultPage) {
    const run = () => {
        const hashParts = location.hash.slice(1).split('#');
        const initialPage = hashParts[0];
        const initialTab = hashParts[1] || '';
        loadPage(initialPage ? `page-${initialPage}` : defaultPage, initialTab || undefined);

        document.addEventListener('click', (e) => {
            const pill = e.target.closest('.landing-pill');
            if (pill) {
                const target = pill.getAttribute('data-target');
                if (target) loadPage(target);
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
