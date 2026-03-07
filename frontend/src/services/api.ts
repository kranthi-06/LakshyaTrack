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

// ── Flag: is the auth system still initializing? ──────────
// When true, 401s will NOT remove the token (prevents race conditions
// during slow network startup). AuthContext sets this to false
// once the full init pipeline has completed.
let _authInitializing = true;

export function setAuthInitialized() {
    _authInitializing = false;
}

export function isAuthInitializing() {
    return _authInitializing;
}

// ── Response Interceptor: handle auth errors safely ───────
// Background / non-critical endpoints that should NEVER trigger token removal
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

            // During auth initialization, do NOT clear the token.
            // The initial /users/me call can race with Supabase token
            // exchange, producing a transient 401 that resolves itself.
            if (_authInitializing) {
                console.warn('api: Ignoring 401 during auth initialization (token kept).');
                return Promise.reject(error);
            }

            // Clear the token — the ProtectedRoute / AuthContext will
            // handle the redirect to /login naturally. We do NOT do a
            // hard window.location redirect here because that causes
            // race conditions with multiple concurrent 401 responses.
            localStorage.removeItem('token');
        }

        return Promise.reject(error);
    }
);

export default api;
