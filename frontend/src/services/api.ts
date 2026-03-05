import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    timeout: 30000, // 30 second timeout to prevent infinite hangs
});

// ── Request Interceptor: attach Bearer token ──────────────
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token && token !== 'undefined' && token !== 'null') {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ── Response Interceptor: handle auth errors safely ───────
// Debounce redirect — prevents multiple concurrent 401s from racing
let redirectScheduled = false;

// Background / non-critical endpoints that should NEVER trigger a redirect
const SILENT_ENDPOINTS = [
    '/progress',
    '/interview-multistage/history',
    '/interview-advanced/history',
    '/quiz/history',
    '/exam/violation-history',
    '/saved-resumes',
];

function isSilentEndpoint(url: string | undefined): boolean {
    if (!url) return false;
    return SILENT_ENDPOINTS.some((ep) => url.includes(ep));
}

api.interceptors.response.use(
    (response) => response,
    (error) => {
        // ── 1. Network error / timeout — NEVER redirect ──────────
        // These have no response object; the server was simply unreachable.
        if (!error.response) {
            return Promise.reject(error);
        }

        // ── 2. Genuine 401 — the token is truly invalid ──────────
        if (error.response.status === 401) {
            const url = error.config?.url || '';

            // For non-critical background calls, just reject silently
            if (isSilentEndpoint(url)) {
                return Promise.reject(error);
            }

            // Clear the token
            localStorage.removeItem('token');

            // Debounced redirect — wait 300ms so concurrent calls don't
            // each independently trigger a page reload.
            if (!redirectScheduled) {
                redirectScheduled = true;
                setTimeout(() => {
                    redirectScheduled = false;
                    const currentPath = window.location.pathname;
                    const PUBLIC = ['/', '/login', '/register', '/verify-email', '/auth/callback'];
                    if (!PUBLIC.includes(currentPath)) {
                        window.location.href = '/login';
                    }
                }, 300);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
