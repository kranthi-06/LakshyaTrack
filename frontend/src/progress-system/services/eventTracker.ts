import api from '../../services/api';
import { invalidateCache } from './progressApi';

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

type StoredProgressEvent = ProgressEvent & {
  queuedAt: number;
};

export const PROGRESS_UPDATE_EVENT = 'progress-intelligence:update';

const QUEUE_STORAGE_KEY = 'lakshyatrack:progress-event-queue:v2';
const SESSION_STORAGE_KEY = 'lakshyatrack:progress-session-id';
const SESSION_ACTIVE_KEY = 'lakshyatrack:progress-session-active';
const BUFFER_FLUSH_INTERVAL_MS = 5000;
const BUFFER_FLUSH_BATCH_SIZE = 50;
const BUFFER_MAX_SIZE = 500;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
const IMMEDIATE_FLUSH_EVENTS = new Set<ProgressEventType>([
  'QUIZ_COMPLETED',
  'INTERVIEW_COMPLETED',
  'PROBLEM_SOLVED',
  'ROADMAP_GENERATED',
  'RESUME_ANALYZED',
  'CODE_EXECUTED',
  'SESSION_END',
]);

let _sessionId = '';
let _isSessionActive = false;
let _isIdle = false;
let _flushTimer: ReturnType<typeof setInterval> | null = null;
let _idleTimer: ReturnType<typeof setTimeout> | null = null;
let _flushInFlight = false;
let _activityHandler: (() => void) | null = null;
let _visibilityHandler: (() => void) | null = null;
let _pageHideHandler: (() => void) | null = null;
let _onlineHandler: (() => void) | null = null;

function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // Fall back to a timestamp-based id below.
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

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

function readQueue(): StoredProgressEvent[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((event): event is StoredProgressEvent => Boolean(event?.event_type && event?.event_id));
  } catch {
    return [];
  }
}

function writeQueue(queue: StoredProgressEvent[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue.slice(-BUFFER_MAX_SIZE)));
  } catch {
    // Ignore storage errors so tracking never breaks UX.
  }
}

function queueEvent(event: ProgressEvent): number {
  const queue = readQueue();
  queue.push({
    ...event,
    queuedAt: Date.now(),
  });
  writeQueue(queue);
  return queue.length;
}

function peekQueue(count = BUFFER_FLUSH_BATCH_SIZE): StoredProgressEvent[] {
  return readQueue().slice(0, count);
}

function removeQueuedEvents(eventIds: string[]): void {
  if (eventIds.length === 0) {
    return;
  }

  const queue = readQueue().filter((event) => !eventIds.includes(event.event_id || ''));
  writeQueue(queue);
}

function getAuthenticatedBaseUrl(): string {
  return (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');
}

function toApiEvents(queue: StoredProgressEvent[]): ProgressEvent[] {
  return queue.map(({ queuedAt: _queuedAt, ...event }) => event);
}

async function flushQueue(maxBatches = 3): Promise<void> {
  if (_flushInFlight) {
    return;
  }

  const token = localStorage.getItem('token');
  if (!token || token === 'undefined' || token === 'null') {
    return;
  }

  _flushInFlight = true;

  try {
    for (let batch = 0; batch < maxBatches; batch += 1) {
      const queued = peekQueue(BUFFER_FLUSH_BATCH_SIZE);
      if (queued.length === 0) {
        break;
      }

      await api.post('/progress-engine/events/batch', {
        events: toApiEvents(queued),
      });

      removeQueuedEvents(queued.map((event) => event.event_id || ''));
    }
  } catch {
    // Keep the queue intact and retry later.
  } finally {
    _flushInFlight = false;
  }
}

function sendQueueWithKeepalive(): void {
  const queued = readQueue();
  const token = localStorage.getItem('token');
  if (queued.length === 0 || !token || token === 'undefined' || token === 'null') {
    return;
  }

  const payload = JSON.stringify({ events: toApiEvents(queued) });

  try {
    void fetch(`${getAuthenticatedBaseUrl()}/progress-engine/events/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: payload,
      keepalive: true,
    });
  } catch {
    // The queue stays in localStorage and will be retried on the next session.
  }
}

function getOrCreateSessionId(): string {
  if (typeof sessionStorage === 'undefined') {
    return generateId();
  }

  const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = generateId();
  sessionStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}

export function getSessionId(): string {
  if (!_sessionId) {
    _sessionId = getOrCreateSessionId();
  }
  return _sessionId;
}

function resetIdleTimer(): void {
  if (_idleTimer) {
    clearTimeout(_idleTimer);
  }

  if (_isIdle) {
    _isIdle = false;
    trackEvent('ACTIVE', {});
  }

  _idleTimer = setTimeout(() => {
    _isIdle = true;
    trackEvent('IDLE', {});
  }, IDLE_TIMEOUT_MS);
}

export function notifyProgressDataChanged(reason = 'activity'): void {
  invalidateCache('dashboard');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(PROGRESS_UPDATE_EVENT, {
        detail: { reason, timestamp: Date.now() },
      }),
    );
  }
}

export function trackEvent(
  eventType: ProgressEventType,
  metadata: Record<string, unknown> = {},
): void {
  const event: ProgressEvent = {
    event_type: eventType,
    metadata,
    session_id: getSessionId(),
    device_info: getDeviceInfo(),
    timestamp: new Date().toISOString(),
    event_id: generateId(),
  };

  const queueSize = queueEvent(event);

  if (queueSize >= BUFFER_FLUSH_BATCH_SIZE || IMMEDIATE_FLUSH_EVENTS.has(eventType)) {
    void flushQueue(IMMEDIATE_FLUSH_EVENTS.has(eventType) ? 10 : 3);
  }

  if (IMMEDIATE_FLUSH_EVENTS.has(eventType)) {
    notifyProgressDataChanged(eventType);
  }
}

export function trackPageVisit(pageName: string): void {
  trackEvent('PAGE_VISIT', { page: pageName });
}

export function trackFeatureUse(featureName: string): void {
  trackEvent('FEATURE_USED', { feature: featureName });
}

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

export function trackInterviewCompleted(position: string, score?: number): void {
  trackEvent('INTERVIEW_COMPLETED', { position, score });
}

export function trackCodeExecuted(language: string): void {
  trackEvent('CODE_EXECUTED', { language });
}

export function initProgressTracking(): void {
  if (_isSessionActive) {
    return;
  }

  _isSessionActive = true;
  _sessionId = getOrCreateSessionId();

  const hasExistingSession =
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true';

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
  }

  if (!hasExistingSession) {
    trackEvent('SESSION_START', {});
  }

  _flushTimer = setInterval(() => {
    void flushQueue();
  }, BUFFER_FLUSH_INTERVAL_MS);

  if (typeof window !== 'undefined') {
    _activityHandler = () => resetIdleTimer();
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, _activityHandler!, { passive: true });
    });

    _pageHideHandler = () => {
      trackEvent('SESSION_END', {});
      sendQueueWithKeepalive();
    };
    window.addEventListener('pagehide', _pageHideHandler);

    _onlineHandler = () => {
      void flushQueue(10);
    };
    window.addEventListener('online', _onlineHandler);
  }

  if (typeof document !== 'undefined') {
    _visibilityHandler = () => {
      if (document.hidden) {
        trackEvent('IDLE', {});
      } else {
        trackEvent('ACTIVE', {});
        resetIdleTimer();
        void flushQueue();
      }
    };
    document.addEventListener('visibilitychange', _visibilityHandler);
  }

  resetIdleTimer();
  void flushQueue(10);
}

export function stopProgressTracking(): void {
  if (!_isSessionActive) {
    return;
  }

  trackEvent('SESSION_END', {});
  sendQueueWithKeepalive();
  void flushQueue(10);

  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }

  if (_idleTimer) {
    clearTimeout(_idleTimer);
    _idleTimer = null;
  }

  if (typeof window !== 'undefined') {
    if (_activityHandler) {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, _activityHandler!);
      });
    }
    if (_pageHideHandler) {
      window.removeEventListener('pagehide', _pageHideHandler);
    }
    if (_onlineHandler) {
      window.removeEventListener('online', _onlineHandler);
    }
  }

  if (typeof document !== 'undefined' && _visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler);
  }

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_ACTIVE_KEY);
  }

  _activityHandler = null;
  _visibilityHandler = null;
  _pageHideHandler = null;
  _onlineHandler = null;
  _isIdle = false;
  _isSessionActive = false;
  _sessionId = '';
}
