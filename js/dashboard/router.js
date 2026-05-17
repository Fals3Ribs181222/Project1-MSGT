const PAGE_REGISTRY = {
    // Teacher - students
    'students':                  { html: 'pages/teacher/students/list.html',              js: '../../pages/teacher/students/list.js',               defaultTab: 'list' },
    'students#enroll':           { html: 'pages/teacher/students/enroll.html',            js: '../../pages/teacher/students/enroll.js' },
    'students#import':           { html: 'pages/teacher/students/import.html',            js: '../../pages/teacher/students/import.js' },
    'students#profile':          { html: 'pages/teacher/students/profile.html',           js: '../../pages/teacher/students/profile.js' },
    // Teacher - tests
    'test':                      { html: 'pages/teacher/tests/list.html',                 js: '../../pages/teacher/tests/list.js',                  defaultTab: 'list' },
    'test#assign':               { html: 'pages/teacher/tests/assign.html',               js: '../../pages/teacher/tests/assign.js' },
    'test#marks':                { html: 'pages/teacher/tests/marks.html',                js: '../../pages/teacher/tests/marks.js' },
    // Teacher - batches
    'batches':                   { html: 'pages/teacher/batches/list.html',               js: '../../pages/teacher/batches/list.js',                defaultTab: 'list' },
    'batches#create':            { html: 'pages/teacher/batches/create.html',             js: '../../pages/teacher/batches/create.js' },
    'batches#detail':            { html: 'pages/teacher/batches/detail.html',             js: '../../pages/teacher/batches/detail.js' },
    // Teacher - material
    'material':                  { html: 'pages/teacher/material/resources.html',         js: '../../pages/teacher/material/resources.js',          defaultTab: 'resources' },
    'material#ai-training':      { html: 'pages/teacher/material/ai-training.html',       js: '../../pages/teacher/material/ai-training.js' },
    'material#tests':            { html: 'pages/teacher/material/tests.html',             js: '../../pages/teacher/material/tests.js' },
    'material#upload':           { html: 'pages/teacher/material/upload.html',            js: '../../pages/teacher/material/upload.js' },
    // Teacher - schedule
    'schedule':                  { html: 'pages/teacher/schedule/calendar.html',          js: '../../pages/teacher/schedule/calendar.js',           defaultTab: 'calendar' },
    'schedule#new-class':        { html: 'pages/teacher/schedule/new-class.html',         js: '../../pages/teacher/schedule/new-class.js' },
    // Teacher - announcements
    'announcement':              { html: 'pages/teacher/announcements/list.html',         js: '../../pages/teacher/announcements/list.js',          defaultTab: 'list' },
    'announcement#post':         { html: 'pages/teacher/announcements/post.html',         js: '../../pages/teacher/announcements/post.js' },
    // Teacher - ai-tools
    'ai-tools':                  { html: 'pages/teacher/ai-tools/doubt-solver.html',      js: '../../pages/teacher/ai-tools/doubt-solver.js',       defaultTab: 'doubt-solver' },
    'ai-tools#test-generator':   { html: 'pages/teacher/ai-tools/test-generator.html',   js: '../../pages/teacher/ai-tools/test-generator.js' },
    // Teacher - recordings
    'recordings':                { html: 'pages/teacher/recordings/playlists.html',       js: '../../pages/teacher/recordings/playlists.js',        defaultTab: 'playlists' },
    'recordings#detail':         { html: 'pages/teacher/recordings/detail.html',          js: '../../pages/teacher/recordings/detail.js' },
    'recordings#create':         { html: 'pages/teacher/recordings/create.html',          js: '../../pages/teacher/recordings/create.js' },
    // Teacher - single view
    'attendance':                { html: 'pages/teacher/attendance/attendance.html',      js: '../../pages/teacher/attendance/attendance.js' },
    'messages':                  { html: 'pages/teacher/messages/messages.html',          js: '../../pages/teacher/messages/messages.js' },
    'leaderboard':               { html: 'pages/teacher/leaderboard/leaderboard.html',    js: '../../pages/teacher/leaderboard/leaderboard.js' },
    // Admin - board results
    'board_results':             { html: 'pages/admin/board-results/list.html',           js: '../../pages/admin/board-results/list.js',            defaultTab: 'list' },
    'board_results#add':         { html: 'pages/admin/board-results/add.html',            js: '../../pages/admin/board-results/add.js' },
    // Admin - testimonials
    'testimonials':              { html: 'pages/admin/testimonials/list.html',            js: '../../pages/admin/testimonials/list.js',             defaultTab: 'list' },
    'testimonials#add':          { html: 'pages/admin/testimonials/add.html',             js: '../../pages/admin/testimonials/add.js' },
    // Admin - single view
    'admin-overview':            { html: 'pages/admin/overview/overview.html',            js: '../../pages/admin/overview/overview.js' },
    'admin-flags':               { html: 'pages/admin/flags/flags.html',                  js: '../../pages/admin/flags/flags.js' },
    'admin-users':               { html: 'pages/admin/users/users.html',                  js: '../../pages/admin/users/users.js' },
    'admin-bulk':                { html: 'pages/admin/bulk/bulk.html',                    js: '../../pages/admin/bulk/bulk.js' },
    'admin-browse':              { html: 'pages/admin/browse/browse.html',                js: '../../pages/admin/browse/browse.js' },
    'teachers':                  { html: 'pages/admin/teachers/teachers.html',            js: '../../pages/admin/teachers/teachers.js' },
    // Student - all single view
    'student-ask-ai':            { html: 'pages/student/ask-ai/ask-ai.html',              js: '../../pages/student/ask-ai/ask-ai.js' },
    'student-attendance':        { html: 'pages/student/attendance/attendance.html',      js: '../../pages/student/attendance/attendance.js' },
    'student-leaderboard':       { html: 'pages/student/leaderboard/leaderboard.html',   js: '../../pages/student/leaderboard/leaderboard.js' },
    'student-marks':             { html: 'pages/student/marks/marks.html',                js: '../../pages/student/marks/marks.js' },
    'student-materials':         { html: 'pages/student/materials/materials.html',        js: '../../pages/student/materials/materials.js' },
    'student-notices':           { html: 'pages/student/notices/notices.html',            js: '../../pages/student/notices/notices.js' },
    'student-profile':           { html: 'pages/student/profile/profile.html',            js: '../../pages/student/profile/profile.js' },
    'student-schedule':          { html: 'pages/student/schedule/schedule.html',          js: '../../pages/student/schedule/schedule.js' },
};

export async function loadPage(targetId, tabSlug) {
    const panelsContainer = document.getElementById('dashboard-content');

    // Deactivate all current pages
    panelsContainer.querySelectorAll('.pages__panel').forEach(p => p.classList.remove('pages__panel--active'));

    // Update active sidebar item
    document.querySelectorAll('.dash-sidebar__item').forEach(btn => {
        btn.classList.toggle('dash-sidebar__item--active', btn.dataset.target === targetId);
    });

    const featureName = targetId.replace('page-', '');

    // Resolve page entry — explicit tab first, fall back to bare feature
    const page = (tabSlug ? PAGE_REGISTRY[`${featureName}#${tabSlug}`] : null)
        || PAGE_REGISTRY[featureName];

    // Normalize: treat empty tabSlug or defaultTab match as the default state
    const isDefault = !tabSlug || tabSlug === page?.defaultTab;
    const registryKey = isDefault ? featureName : `${featureName}#${tabSlug}`;

    // URL uses the explicit defaultTab slug when landing on the default tab
    const pageSlug = featureName;
    const effectiveTab = isDefault ? (page?.defaultTab || '') : tabSlug;
    const hashSuffix = effectiveTab ? `${pageSlug}#${effectiveTab}` : pageSlug;
    history.replaceState(null, '', `${location.search}#${hashSuffix}`);

    let targetPage = document.getElementById(targetId);
    const alreadyLoaded = targetPage && targetPage.dataset.loadedKey === registryKey;

    if (!targetPage) {
        targetPage = document.createElement('section');
        targetPage.className = 'panel pages__panel pages__panel--active';
        targetPage.id = targetId;
        panelsContainer.appendChild(targetPage);
    } else {
        targetPage.classList.add('pages__panel--active');
    }

    if (!alreadyLoaded) {
        if (!page) {
            // Pre-rendered static section (e.g. home) — just activate, no fetch needed
            return;
        }

        targetPage.innerHTML = `<div class="loading-text" style="padding:2rem;text-align:center;">Loading ${featureName}...</div>`;

        try {
            const response = await fetch(page.html);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            targetPage.innerHTML = await response.text();
            targetPage.dataset.loadedKey = registryKey;

            try {
                const module = await import(page.js);
                if (module.init) await module.init(tabSlug);
            } catch (jsError) {
                console.error(`Error initializing ${registryKey}:`, jsError);
                targetPage.innerHTML = `<div class="status status--error">Error loading ${featureName}: ${jsError.message || 'Unknown error'}</div>`;
            }
        } catch (error) {
            console.error(`Error loading page ${featureName}:`, error);
            targetPage.innerHTML = `<div class="status status--error">Failed to load module: ${featureName}</div>`;
        }
    } else {
        // Same tab already loaded — just refresh
        try {
            const module = await import(page.js);
            if (module.refresh) await module.refresh();
        } catch (e) {
            // Ignore if no refresh method
        }
    }
}

export async function prefetchPages(pageNames) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    for (const name of pageNames) {
        const page = PAGE_REGISTRY[name];
        if (page) {
            fetch(page.html).catch(() => {});
            import(page.js).catch(() => {});
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

export function initRouter(defaultPage) {
    const run = () => {
        const hashParts = location.hash.slice(1).split('#');
        const initialPage = hashParts[0];
        const rawTab = hashParts[1] || '';
        const atIdx = rawTab.indexOf('@');
        const initialTab = atIdx >= 0 ? rawTab.slice(0, atIdx) : rawTab;
        const initialIdentifier = atIdx >= 0 ? rawTab.slice(atIdx + 1) : null;
        window._pendingIdentifier = initialIdentifier || null;
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
