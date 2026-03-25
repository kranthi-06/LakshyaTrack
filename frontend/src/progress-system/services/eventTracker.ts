// ══════════════════════════════════════════════════════════════
// Progress Engine — Frontend Event Tracker
// Captures and sends user events to the Progress Engine API.
// Batch-buffers events to minimize network calls.
// ══════════════════════════════════════════════════════════════

import api from '../../services/api';

// ── Event Types ──────────────────────────────────────────────

export type ProgressEventType =
  | 'PAGE_VISIT'
  | 'PROBLEM_SOLVED'
  | 'QUIZ_COMPLETED'
  | 'FEATURE_USED'
  | 'SESSION_START'
  | 'SESSION_END'
  | 'IDLE'
  | 'ACTIVE'
  | 'RESUME_ANALYZED'
  | 'INTERVIEW_COMPLETED'
  | 'ROADMAP_GENERATED'
  | 'CODE_EXECUTED';

export interface ProgressEvent {
  event_type: ProgressEventType;
  metadata?: Record<string, unknown>;
  session_id?: string;
  device_info?: Record<string, string>;
  timestamp?: string;
  event_id?: string;
}

// ── UUID generator (no external dep) ─────────────────────────

function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
  } catch { /* fallback */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ── Device Info ──────────────────────────────────────────────

function getDeviceInfo(): Record<string, string> {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  return {
    userAgent: nav?.userAgent || 'unknown',
    platform: nav?.platform || 'unknown',
    language: nav?.language || 'en',
    screenWidth: typeof screen !== 'undefined' ? String(screen.width) : '0',
    screenHeight: typeof screen !== 'undefined' ? String(screen.height) : '0',
  };
}

// ── Session Management ───────────────────────────────────────

let _sessionId: string = generateId();
let _isSessionActive = false;
let _idleTimer: ReturnType<typeof setTimeout> | null = null;
let _isIdle = false;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function getSessionId(): string {
  return _sessionId;
}

// ── Event Buffer ─────────────────────────────────────────────

const _eventBuffer: ProgressEvent[] = [];
const BUFFER_MAX_SIZE = 20;
const BUFFER_FLUSH_INTERVAL_MS = 30_000; // 30 seconds
let _flushTimer: ReturnType<typeof setInterval> | null = null;

async function _flushBuffer(): Promise<void> {
  if (_eventBuffer.length === 0) return;

  const eventsToSend = [..._eventBuffer];
  _eventBuffer.length = 0;

  try {
    await api.post('/progress-engine/events/batch', {
      events: eventsToSend,
    });
  } catch (error) {
    // Re-queue failed events (up to limit)
    if (_eventBuffer.length + eventsToSend.length <= BUFFER_MAX_SIZE * 2) {
      _eventBuffer.push(...eventsToSend);
    }
    // Silent fail — tracking should never break the UX
    console.debug('[ProgressEngine] Batch send failed, events re-queued');
  }
}

// ══════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════

/**
 * Track a user event. Non-blocking, buffered.
 */
export function trackEvent(
  eventType: ProgressEventType,
  metadata: Record<string, unknown> = {},
): void {
  const event: ProgressEvent = {
    event_type: eventType,
    metadata,
    session_id: _sessionId,
    device_info: getDeviceInfo(),
    timestamp: new Date().toISOString(),
    event_id: generateId(),
  };

  _eventBuffer.push(event);

  // Auto-flush when buffer is full
  if (_eventBuffer.length >= BUFFER_MAX_SIZE) {
    _flushBuffer();
  }
}

/**
 * Track a page visit.
 */
export function trackPageVisit(pageName: string): void {
  trackEvent('PAGE_VISIT', { page: pageName });
}

/**
 * Track a feature use.
 */
export function trackFeatureUse(featureName: string): void {
  trackEvent('FEATURE_USED', { feature: featureName });
}

/**
 * Track a problem solved.
 */
export function trackProblemSolved(
  title: string,
  difficulty: 'easy' | 'medium' | 'hard',
  topic?: string,
  language?: string,
  timeTakenSeconds?: number,
): void {
  trackEvent('PROBLEM_SOLVED', {
    title,
    difficulty,
    topic: topic || 'General',
    language: language || 'Python',
    time_taken_seconds: timeTakenSeconds || 300,
    status: 'accepted',
  });
}

/**
 * Track a quiz completion.
 */
export function trackQuizCompleted(
  quizName: string,
  score: number,
  totalQuestions: number,
): void {
  trackEvent('QUIZ_COMPLETED', {
    quiz_name: quizName,
    score,
    total_questions: totalQuestions,
  });
}

/**
 * Track an interview completion.
 */
export function trackInterviewCompleted(position: string, score?: number): void {
  trackEvent('INTERVIEW_COMPLETED', { position, score });
}

/**
 * Track code execution.
 */
export function trackCodeExecuted(language: string): void {
  trackEvent('CODE_EXECUTED', { language });
}

// ── Session Lifecycle ────────────────────────────────────────

function _resetIdleTimer(): void {
  if (_idleTimer) clearTimeout(_idleTimer);

  if (_isIdle) {
    _isIdle = false;
    trackEvent('ACTIVE', {});
  }

  _idleTimer = setTimeout(() => {
    _isIdle = true;
    trackEvent('IDLE', {});
  }, IDLE_TIMEOUT_MS);
}

/**
 * Initialize event tracking. Call once at app startup.
 */
export function initProgressTracking(): void {
  if (_isSessionActive) return;
  _isSessionActive = true;

  // Start session
  _sessionId = generateId();
  trackEvent('SESSION_START', {});

  // Start buffer flusher
  _flushTimer = setInterval(_flushBuffer, BUFFER_FLUSH_INTERVAL_MS);

  // Track idle/active
  if (typeof window !== 'undefined') {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((ev) => window.addEventListener(ev, _resetIdleTimer, { passive: true }));
    _resetIdleTimer();

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      trackEvent('SESSION_END', {});
      // Sync flush on unload (navigator.sendBeacon for reliability)
      const token = localStorage.getItem('token');
      if (token && _eventBuffer.length > 0) {
        const baseUrl = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');
        const blob = new Blob(
          [JSON.stringify({ events: _eventBuffer })],
          { type: 'application/json' },
        );
        // sendBeacon does not support auth headers, so we use keepalive fetch
        try {
          fetch(`${baseUrl}/progress-engine/events/batch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ events: _eventBuffer }),
            keepalive: true,
          });
        } catch {
          // Last resort
          navigator.sendBeacon?.(`${baseUrl}/progress-engine/events/batch`, blob);
        }
        _eventBuffer.length = 0;
      }
    });

    // Track visibility changes (tab switch = idle)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        trackEvent('IDLE', {});
      } else {
        trackEvent('ACTIVE', {});
        _resetIdleTimer();
      }
    });
  }
}

/**
 * Stop event tracking. Call on logout or cleanup.
 */
export function stopProgressTracking(): void {
  if (!_isSessionActive) return;

  trackEvent('SESSION_END', {});
  _flushBuffer();

  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
  if (_idleTimer) {
    clearTimeout(_idleTimer);
    _idleTimer = null;
  }
  _isSessionActive = false;
}
