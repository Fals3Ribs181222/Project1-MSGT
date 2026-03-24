// Core Application Logic

// Integrated Config
const CONFIG = {
    SUPABASE_URL: 'https://tksruuqtzxflgglnljef.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrc3J1dXF0enhmbGdnbG5samVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzY0OTIsImV4cCI6MjA4Nzk1MjQ5Mn0.eu6LwoP-9O5sG9nHhBza0UgYHCOm7Ni5flk_1Lgl4FU'
};

// Initialize Supabase Client
const { createClient } = supabase;
const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// --- Core UI Helpers ---

/**
 * Sets a table body into a loading state.
 * @param {string} tbodyId
 * @param {number} cols
 * @param {string} msg
 */
function tableLoading(tbodyId, cols, msg = 'Loading...') {
    const el = document.getElementById(tbodyId);
    if (el) el.innerHTML = `<tr><td colspan="${cols}" class="loading-text">${msg}</td></tr>`;
}

/**
 * Shows a status message element.
 * @param {string} statusId
 * @param {string} msg
 * @param {string} type
 */
function showStatus(statusId, msg, type = 'error') {
    const el = document.getElementById(statusId);
    if (!el) return;
    el.textContent = msg;
    el.className = `status status--${type}`;
    el.style.display = 'block';
}

/**
 * Unified component loader for modular HTML segments.
 * @param {string} componentName
 * @param {string} containerId
 * @param {function} onLoaded
 */
async function loadComponent(componentName, containerId, onLoaded) {
    try {
        const res = await fetch(`components/${componentName}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const el = document.getElementById(containerId);
        if (el) {
            el.innerHTML = await res.text();
            if (typeof onLoaded === 'function') onLoaded();
        }
    } catch (err) {
        console.error(`Failed to load component ${componentName}:`, err);
    }
}

// Expose Core UI Helpers globally
window.tableLoading = tableLoading;
window.showStatus = showStatus;
window.loadComponent = loadComponent;


// API interaction wrapper (Supabase implementation)
const api = {
    async get(tableName, filters = {}, select = '*', options = {}) {
        let req = supabaseClient.from(tableName).select(select);

        // Add filters
        for (const [key, value] of Object.entries(filters)) {
            if (Array.isArray(value)) {
                req = req.in(key, value);
            } else {
                req = req.eq(key, value);
            }
        }

        if (options.order) req = req.order(options.order, { ascending: options.ascending ?? true });
        if (options.single) req = req.single();


        const { data, error } = await req;
        if (error) {
            console.error(`Supabase Get Error (${tableName}):`, error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    },

    async post(tableName, data) {
        const { data: result, error } = await supabaseClient
            .from(tableName)
            .insert([data])
            .select();

        if (error) {
            console.error(`Supabase Post Error (${tableName}):`, error);
            return { success: false, error: error.message };
        }
        return { success: true, data: result[0] };
    },

    async upsert(tableName, data, onConflict = 'id') {
        const { data: result, error } = await supabaseClient
            .from(tableName)
            .upsert(data, { onConflict: onConflict })
            .select();

        if (error) {
            console.error(`Supabase Upsert Error (${tableName}):`, error);
            return { success: false, error: error.message };
        }
        return { success: true, data: result };
    },

    async delete(tableName, id) {
        const { error } = await supabaseClient
            .from(tableName)
            .delete()
            .eq('id', id);

        if (error) {
            console.error(`Supabase Delete Error (${tableName}):`, error);
            return { success: false, error: error.message };
        }
        return { success: true };
    },

    async patch(tableName, id, updates) {
        const { data: result, error } = await supabaseClient
            .from(tableName)
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            console.error(`Supabase Patch Error (${tableName}):`, error);
            return { success: false, error: error.message };
        }
        return { success: true, data: result[0] };
    },

    async deleteMany(tableName, eqConstraints) {
        let query = supabaseClient.from(tableName).delete();

        for (const [column, value] of Object.entries(eqConstraints)) {
            query = query.eq(column, value);
        }

        const { error } = await query;

        if (error) {
            console.error(`Supabase DeleteMany Error (${tableName}):`, error);
            return { success: false, error: error.message };
        }
        return { success: true };
    }
};

// Auth State Management
const auth = {
    async login(username, password) {
        const email = `${username.toLowerCase()}@msgt.internal`;
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('Login Error:', error);
            return { success: false, error: error.message };
        }

        // Fetch profile
        const { data: profile, error: profError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profError) {
            console.error('Profile Fetch Error:', profError);
            return { success: false, error: 'Could not fetch user profile.' };
        }

        const user = {
            id: data.user.id,
            username: profile.username,
            name: profile.name,
            role: profile.role,
            grade: profile.grade,
            subjects: profile.subjects
        };

        localStorage.setItem('mitesh_tutions_user', JSON.stringify(user));
        this.redirect(user.role);
        return { success: true };
    },

    async logout() {
        await supabaseClient.auth.signOut();
        localStorage.removeItem('mitesh_tutions_user');
        window.location.href = 'login';
    },

    getUser() {
        const userStr = localStorage.getItem('mitesh_tutions_user');
        return userStr ? JSON.parse(userStr) : null;
    },

    requireRole(role) {
        const user = this.getUser();
        if (!user || user.role !== role) {
            window.location.href = 'login';
        }
        return user;
    },

    async refreshProfile() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return;
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        if (error || !profile) return;
        const user = {
            id: profile.id,
            username: profile.username,
            name: profile.name,
            role: profile.role,
            grade: profile.grade,
            subjects: profile.subjects
        };
        localStorage.setItem('mitesh_tutions_user', JSON.stringify(user));
    },

    redirect(role) {
        if (role === 'teacher') {
            window.location.href = 'teacher_dashboard';
        } else if (role === 'student') {
            window.location.href = 'student_dashboard';
        } else if (role === 'admin') {
            window.location.href = 'admin_dashboard';
        }
    },

    updateNavigation() {
        const user = this.getUser();
        const navLinks = document.querySelector('.navbar__links');
        if (!navLinks) return;

        if (user) {
            // Remove login links
            const loginLinks = navLinks.querySelectorAll('li:has(a[href^="login"])');
            loginLinks.forEach(link => link.remove());

            // Add dashboard link
            const dashLi = document.createElement('li');
            const dashLink = document.createElement('a');
            dashLink.className = 'navbar__link';
            if (user.role === 'teacher') {
                dashLink.href = 'teacher_dashboard';
                dashLink.textContent = 'Dashboard';
            } else if (user.role === 'student') {
                dashLink.href = 'student_dashboard';
                dashLink.textContent = 'Dashboard';
            } else if (user.role === 'admin') {
                dashLink.href = 'admin_dashboard';
                dashLink.textContent = 'Admin Panel';
            }
            dashLi.appendChild(dashLink);
            navLinks.appendChild(dashLi);


        }
    }
};

// Initialize common UI elements
document.addEventListener('DOMContentLoaded', () => {
    auth.updateNavigation();

    // Set active link in nav
    const currentPath = window.location.pathname.split('/').pop() || 'index';
    document.querySelectorAll('.navbar__link').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('navbar__link--active');
        } else {
            link.classList.remove('navbar__link--active');
        }
    });
});

// Utility to create DOM elements safely
function createElement(tag, className, textContent = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

async function loadFeatureFlags() {
    const { data, error } = await supabaseClient.from('feature_flags').select('key, enabled');
    if (error || !data) return {};
    return Object.fromEntries(data.map(f => [f.key, f.enabled]));
}

// Global functions accessible to page scripts
window.api = api;
window.auth = auth;
window.createElement = createElement;
window.supabaseClient = supabaseClient;
window.CONFIG = CONFIG;
window.loadFeatureFlags = loadFeatureFlags;
