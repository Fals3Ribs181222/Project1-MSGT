// Core Application Logic

// Initialize Supabase Client
const { createClient } = supabase;
const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// API interaction wrapper (Supabase implementation)
const api = {
    async get(tableName, filters = {}, select = '*') {
        let req = supabaseClient.from(tableName).select(select);

        // Add basic filters if needed
        for (const [key, value] of Object.entries(filters)) {
            req = req.eq(key, value);
        }

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
        window.location.href = 'login.html';
    },

    getUser() {
        const userStr = localStorage.getItem('mitesh_tutions_user');
        return userStr ? JSON.parse(userStr) : null;
    },

    requireRole(role) {
        const user = this.getUser();
        if (!user || user.role !== role) {
            window.location.href = 'login.html';
        }
        return user;
    },

    redirect(role) {
        if (role === 'teacher') {
            window.location.href = 'teacher_dashboard.html';
        } else if (role === 'student') {
            window.location.href = 'student_dashboard.html';
        }
    },

    updateNavigation() {
        const user = this.getUser();
        const navLinks = document.querySelector('.navbar__links');
        if (!navLinks) return;

        if (user) {
            // Remove login links
            const loginLinks = navLinks.querySelectorAll('li:has(a[href^="login.html"])');
            loginLinks.forEach(link => link.remove());

            // Add dashboard link
            const dashLi = document.createElement('li');
            const dashLink = document.createElement('a');
            dashLink.className = 'navbar__link';
            dashLink.href = user.role === 'teacher' ? 'teacher_dashboard.html' : 'student_dashboard.html';
            dashLink.textContent = 'Dashboard';
            dashLi.appendChild(dashLink);
            navLinks.appendChild(dashLi);

            // Add logout link
            const logoutLi = document.createElement('li');
            const logoutLink = document.createElement('a');
            logoutLink.className = 'navbar__link';
            logoutLink.href = '#';
            logoutLink.textContent = 'Logout';
            logoutLink.onclick = (e) => {
                e.preventDefault();
                this.logout();
            };
            logoutLi.appendChild(logoutLink);
            navLinks.appendChild(logoutLi);
        }
    }
};

// Initialize common UI elements
document.addEventListener('DOMContentLoaded', () => {
    auth.updateNavigation();

    // Set active link in nav
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
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

// Global functions accessible to page scripts
window.api = api;
window.auth = auth;
window.createElement = createElement;
window.supabaseClient = supabaseClient;
