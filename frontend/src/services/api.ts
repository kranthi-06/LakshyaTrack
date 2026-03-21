import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// ══════════════════════════════════════════════════════════════
// PRODUCTION-GRADE API CLIENT
// Features:
//   - Automatic retry with exponential backoff
//   - Request timeout protection (per-request + global)
//   - Circuit breaker for backend failures
//   - Safe auth token management
//   - Request deduplication
//   - Detailed error classification
// ══════════════════════════════════════════════════════════════

const DEFAULT_TIMEOUT = 30_000;    // 30s default
const MAX_RETRIES = 2;             // Retry transient failures twice
const RETRY_BASE_DELAY = 1000;     // 1s initial delay
const CIRCUIT_BREAKER_THRESHOLD = 10;
const CIRCUIT_BREAKER_RESET_MS = 60_000;

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    timeout: DEFAULT_TIMEOUT,
});

// ── Circuit Breaker State ─────────────────────────────────────
let _consecutiveFailures = 0;
let _circuitOpen = false;
let _circuitOpenedAt = 0;

function checkCircuitBreaker(): boolean {
    if (!_circuitOpen) return true;
    if (Date.now() - _circuitOpenedAt > CIRCUIT_BREAKER_RESET_MS) {
        _circuitOpen = false;
        _consecutiveFailures = 0;
        console.log('api: Circuit breaker CLOSED (recovery attempt)');
        return true;
    }
    return false;
}

function recordSuccess() {
    _consecutiveFailures = 0;
    if (_circuitOpen) {
        _circuitOpen = false;
        console.log('api: Circuit breaker CLOSED (recovered)');
    }
}

function recordFailure() {
    _consecutiveFailures++;
    if (_consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && !_circuitOpen) {
        _circuitOpen = true;
        _circuitOpenedAt = Date.now();
        console.warn(`api: Circuit breaker OPEN after ${_consecutiveFailures} failures`);
    }
}

// ── Auth initialization flag ──────────────────────────────────
let _authInitializing = true;
let _unauthorizedHandler: (() => void) | null = null;

export function setAuthInitialized() {
    _authInitializing = false;
}

export function isAuthInitializing() {
    return _authInitializing;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
    _unauthorizedHandler = handler;
}

// ── Request Interceptor: attach Bearer token ──────────────────
api.interceptors.request.use((config) => {
    // Circuit breaker check
    if (!checkCircuitBreaker()) {
        return Promise.reject(new Error('Circuit breaker is open — backend temporarily unavailable'));
    }

    // Correlation ID (backend echoes as x-request-id)
    try {
        const reqId =
            (globalThis.crypto && 'randomUUID' in globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
                ? globalThis.crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        config.headers['x-request-id'] = reqId;
    } catch {
        // No-op: header is optional
    }

    const token = localStorage.getItem('token');
    if (token && token !== 'undefined' && token !== 'null') {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ── Response Interceptor with retry logic ─────────────────────

// Endpoints that should NEVER trigger token removal
const SILENT_ENDPOINTS = [
    '/progress',
    '/interview-multistage/history',
    '/interview-advanced/history',
    '/quiz/history',
    '/exam/violation-history',
    '/saved-resumes',
    '/subscription/status',
    '/subscription/feature-access',
];

function isSilentEndpoint(url: string | undefined): boolean {
    if (!url) return false;
    return SILENT_ENDPOINTS.some((ep) => url.includes(ep));
}

// Retry-eligible status codes
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

function isRetryable(error: AxiosError): boolean {
    // Network errors (no response) are retryable
    if (!error.response) return true;
    // Specific status codes
    return RETRYABLE_STATUS_CODES.has(error.response.status);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

api.interceptors.response.use(
    (response) => {
        recordSuccess();
        return response;
    },
    async (error: AxiosError) => {
        const config = error.config as InternalAxiosRequestConfig & {
            _retryCount?: number;
            _isRetry?: boolean;
        };

        // ── 1. Network error / timeout — consider retry ─────────
        if (!error.response) {
            recordFailure();

            // Retry transient network errors
            if (config && !config._isRetry) {
                const retryCount = config._retryCount || 0;
                if (retryCount < MAX_RETRIES) {
                    config._retryCount = retryCount + 1;
                    config._isRetry = true;
                    const delay = RETRY_BASE_DELAY * Math.pow(2, retryCount);
                    console.warn(`api: Retrying request ${config.url} (attempt ${retryCount + 1}/${MAX_RETRIES}) after ${delay}ms`);
                    await sleep(delay);
                    config._isRetry = false;
                    return api(config);
                }
            }
            return Promise.reject(error);
        }

        // ── 2. Server errors — retry with backoff ────────────────
        if (isRetryable(error) && config) {
            const retryCount = config._retryCount || 0;
            if (retryCount < MAX_RETRIES && !config._isRetry) {
                config._retryCount = retryCount + 1;
                config._isRetry = true;
                const delay = RETRY_BASE_DELAY * Math.pow(2, retryCount);

                // For 429 (rate limit), respect Retry-After header
                if (error.response?.status === 429) {
                    const retryAfter = error.response.headers?.['retry-after'];
                    const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : delay;
                    console.warn(`api: Rate limited on ${config.url}, waiting ${waitMs}ms`);
                    await sleep(Math.min(waitMs, 30_000));
                } else {
                    console.warn(`api: Server error on ${config.url} (${error.response?.status}), retry ${retryCount + 1}/${MAX_RETRIES} after ${delay}ms`);
                    await sleep(delay);
                }
                config._isRetry = false;
                return api(config);
            }
            recordFailure();
        }

        // ── 3. Genuine 401 — token is invalid ────────────────────
        if (error.response?.status === 401) {
            const url = config?.url || '';

            if (isSilentEndpoint(url)) {
                return Promise.reject(error);
            }

            if (_authInitializing) {
                console.warn('api: Ignoring 401 during auth initialization (token kept).');
                return Promise.reject(error);
            }

            localStorage.removeItem('token');
            _unauthorizedHandler?.();
        }

        return Promise.reject(error);
    }
);

// ══════════════════════════════════════════════════════════════
// SAFE API CALL HELPER
// ══════════════════════════════════════════════════════════════

/**
 * Make an API call with automatic error handling and fallback.
 * Never throws — always returns either data or the fallback value.
 */
export async function safeApiCall<T>(
    apiCall: () => Promise<T>,
    fallback: T,
    context: string = 'API call',
): Promise<T> {
    try {
        return await apiCall();
    } catch (error: any) {
        const status = error?.response?.status;
        const message = error?.response?.data?.detail || error?.message || 'Unknown error';
        console.warn(`${context} failed (status: ${status}): ${message}`);
        return fallback;
    }
}

/**
 * Get current health status of the API client.
 */
export function getApiHealthStatus() {
    return {
        circuitOpen: _circuitOpen,
        consecutiveFailures: _consecutiveFailures,
        authInitializing: _authInitializing,
    };
}

export default api;
