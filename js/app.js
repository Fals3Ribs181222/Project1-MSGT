// Core Application Logic

// API interaction wrapper
const api = {
    async get(action, params = {}) {
        const url = new URL(CONFIG.SCRIPT_URL);
        url.searchParams.append('action', action);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.append(key, value);
        }

        try {
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('API Get Error:', error);
            return { success: false, error: error.message };
        }
    },

    async post(action, data) {
        try {
            const response = await fetch(CONFIG.SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action, ...data }),
                // Headers are deliberately omitted to avoid CORS preflight issues with Google Apps Script
            });
            return await response.json();
        } catch (error) {
            console.error('API Post Error:', error);
            return { success: false, error: error.message };
        }
    }
};

// Auth State Management
const auth = {
    login(user) {
        localStorage.setItem('mitesh_tutions_user', JSON.stringify(user));
        this.redirect(user.role);
    },

    logout() {
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
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;

        if (user) {
            // Remove login links
            const loginLinks = navLinks.querySelectorAll('a[href^="login.html"]');
            loginLinks.forEach(link => link.remove());

            // Add dashboard link
            const dashLink = document.createElement('a');
            dashLink.className = 'nav-link';
            dashLink.href = user.role === 'teacher' ? 'teacher_dashboard.html' : 'student_dashboard.html';
            dashLink.textContent = 'Dashboard';
            navLinks.appendChild(dashLink);

            // Add logout link
            const logoutLink = document.createElement('a');
            logoutLink.className = 'nav-link';
            logoutLink.href = '#';
            logoutLink.textContent = 'Logout';
            logoutLink.onclick = (e) => {
                e.preventDefault();
                this.logout();
            };
            navLinks.appendChild(logoutLink);
        }
    }
};

// Initialize common UI elements
document.addEventListener('DOMContentLoaded', () => {
    auth.updateNavigation();

    // Set active link in nav
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
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
