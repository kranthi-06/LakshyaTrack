// ══════════════════════════════════════════════════════════════
// Progress Intelligence Dashboard — Real-Time Data Service
// Replaces mock data with live API calls to Progress Engine.
// Falls back to mock data when API is unavailable.
// ══════════════════════════════════════════════════════════════

import api from '../../services/api';
import type {
  ContributionData,
  DailyContribution,
  ProblemSolvingStats,
  ActivitySummary,
  TimeAnalyticsData,
  TopicMapData,
  StreakData,
  BadgeSystemData,
  IntelligenceData,
  ProgressDashboardData,
  Badge,
  BadgeRarity,
  TopicBubble,
} from '../types';

// ── API Base Path ────────────────────────────────────────────

const PE_BASE = '/progress-engine';

// ── Cache Layer (in-memory, TTL-based) ───────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const _cache = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const DASHBOARD_TTL = 10 * 1000;

function getCached<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data as T;
  }
  _cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  _cache.set(key, { data, expiresAt: Date.now() + ttl });
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    _cache.clear();
    return;
  }
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

const DEFAULT_ACTIVE_HOURS = Array.from({ length: 24 }, (_, hour) => ({ hour, activity: 0 }));
const DEFAULT_WEEKLY_ACTIVITY = Array.from({ length: 7 }, () => 0);
const BADGE_REQUIREMENT_LABELS: Record<string, string> = {
  first_flame: '3-day streak',
  week_warrior: '7-day streak',
  fortnight_fighter: '14-day streak',
  monthly_master: '30-day streak',
  century_legend: '100-day streak',
  quiz_starter: '1 quiz passed',
  quiz_apprentice: '10 quizzes passed',
  quiz_master: '50 quizzes passed',
  first_interview: '1 mock interview',
  interview_pro: '10 mock interviews',
  interview_expert: '25 mock interviews',
  resume_builder: '1 resume built',
  roadmap_explorer: '1 roadmap generated',
  career_strategist: '5 roadmaps generated',
};

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeContributionData(raw: Partial<ContributionData> | Record<string, unknown> | undefined): ContributionData {
  const year = asNumber((raw as any)?.year, new Date().getFullYear());
  const contributions = Array.isArray((raw as any)?.contributions)
    ? (raw as any).contributions.map((entry: any) => ({
      date: asString(entry?.date),
      count: asNumber(entry?.count),
      level: Math.max(0, Math.min(4, asNumber(entry?.level))) as DailyContribution['level'],
    }))
    : [];

  return {
    contributions,
    totalContributions: asNumber((raw as any)?.totalContributions),
    longestStreak: asNumber((raw as any)?.longestStreak),
    currentStreak: asNumber((raw as any)?.currentStreak),
    year,
  };
}

function normalizeProblemStats(raw: Partial<ProblemSolvingStats> | Record<string, unknown> | undefined): ProblemSolvingStats {
  const difficulty = (raw as any)?.difficulty ?? {};
  const makeBucket = (key: 'easy' | 'medium' | 'hard') => ({
    solved: asNumber(difficulty?.[key]?.solved),
    total: asNumber(difficulty?.[key]?.total),
  });

  return {
    totalSolved: asNumber((raw as any)?.totalSolved),
    totalAvailable: asNumber((raw as any)?.totalAvailable),
    acceptanceRate: asNumber((raw as any)?.acceptanceRate),
    totalSubmissions: asNumber((raw as any)?.totalSubmissions),
    difficulty: {
      easy: makeBucket('easy'),
      medium: makeBucket('medium'),
      hard: makeBucket('hard'),
    },
    recentSubmissions: Array.isArray((raw as any)?.recentSubmissions)
      ? (raw as any).recentSubmissions.map((entry: any) => ({
        id: asString(entry?.id),
        title: asString(entry?.title, 'Untitled Submission'),
        difficulty: (['easy', 'medium', 'hard'].includes(entry?.difficulty) ? entry.difficulty : 'medium') as 'easy' | 'medium' | 'hard',
        status: (['accepted', 'wrong_answer', 'time_limit', 'runtime_error'].includes(entry?.status) ? entry.status : 'accepted') as 'accepted' | 'wrong_answer' | 'time_limit' | 'runtime_error',
        timestamp: asString(entry?.timestamp, new Date(0).toISOString()),
        language: asString(entry?.language, 'N/A'),
      }))
      : [],
  };
}

function normalizeActivitySummary(raw: Partial<ActivitySummary> | Record<string, unknown> | undefined): ActivitySummary {
  return {
    totalSessions: asNumber((raw as any)?.totalSessions),
    avgSessionDuration: asNumber((raw as any)?.avgSessionDuration),
    totalActiveTime: asNumber((raw as any)?.totalActiveTime),
    totalIdleTime: asNumber((raw as any)?.totalIdleTime),
    mostVisitedPages: Array.isArray((raw as any)?.mostVisitedPages)
      ? (raw as any).mostVisitedPages.map((entry: any) => ({
        page: asString(entry?.page, 'Unknown'),
        count: asNumber(entry?.count),
      }))
      : [],
    mostUsedFeatures: Array.isArray((raw as any)?.mostUsedFeatures)
      ? (raw as any).mostUsedFeatures.map((entry: any) => ({
        feature: asString(entry?.feature, 'Unknown'),
        count: asNumber(entry?.count),
      }))
      : [],
    activeDays: asNumber((raw as any)?.activeDays),
  };
}

function normalizeTimeAnalytics(raw: Partial<TimeAnalyticsData> | Record<string, unknown> | undefined): TimeAnalyticsData {
  return {
    dailyUsage: Array.isArray((raw as any)?.dailyUsage)
      ? (raw as any).dailyUsage.map((entry: any) => ({
        date: asString(entry?.date),
        totalMinutes: asNumber(entry?.totalMinutes),
        activeMinutes: asNumber(entry?.activeMinutes),
      }))
      : [],
    weeklyTrends: Array.isArray((raw as any)?.weeklyTrends)
      ? (raw as any).weeklyTrends.map((entry: any) => ({
        week: asString(entry?.week),
        weekStart: asString(entry?.weekStart),
        totalHours: asNumber(entry?.totalHours),
        avgDailyMinutes: asNumber(entry?.avgDailyMinutes),
      }))
      : [],
    featureTimeSpent: Array.isArray((raw as any)?.featureTimeSpent)
      ? (raw as any).featureTimeSpent.map((entry: any) => ({
        feature: asString(entry?.feature),
        minutes: asNumber(entry?.minutes),
        percentage: asNumber(entry?.percentage),
        color: asString(entry?.color, '#94a3b8'),
      }))
      : [],
    totalHoursThisWeek: asNumber((raw as any)?.totalHoursThisWeek),
    totalHoursThisMonth: asNumber((raw as any)?.totalHoursThisMonth),
    avgDailyMinutes: asNumber((raw as any)?.avgDailyMinutes),
    peakHour: asNumber((raw as any)?.peakHour),
    peakDay: asString((raw as any)?.peakDay, 'No activity yet'),
  };
}

function normalizeTopicMap(raw: Partial<TopicMapData> | Record<string, unknown> | undefined): TopicMapData {
  const topics = Array.isArray((raw as any)?.topics)
    ? (raw as any).topics.map((entry: any, index: number) => ({
      id: asString(entry?.id, `topic-${index}`),
      name: asString(entry?.name, 'Untitled Topic'),
      category: asString(entry?.category, 'General'),
      problemsSolved: asNumber(entry?.problemsSolved ?? entry?.problems_solved),
      timeSpentMinutes: asNumber(entry?.timeSpentMinutes ?? entry?.time_spent_minutes),
      proficiencyLevel: (['beginner', 'intermediate', 'advanced', 'expert'].includes(entry?.proficiencyLevel ?? entry?.proficiency_level)
        ? (entry?.proficiencyLevel ?? entry?.proficiency_level)
        : 'beginner') as TopicBubble['proficiencyLevel'],
      proficiencyScore: asNumber(entry?.proficiencyScore ?? entry?.proficiency_score),
      color: asString(entry?.color, '#6366f1'),
      size: asNumber(entry?.size, 30),
    }))
    : [];

  return {
    topics,
    totalTopics: asNumber((raw as any)?.totalTopics, topics.length),
    strongestTopic: asString((raw as any)?.strongestTopic),
    weakestTopic: asString((raw as any)?.weakestTopic),
  };
}

function normalizeStreak(raw: Partial<StreakData> | Record<string, unknown> | undefined): StreakData {
  const weeklyActivity = Array.isArray((raw as any)?.weeklyActivity)
    ? (raw as any).weeklyActivity.map((entry: any) => asNumber(entry))
    : [];
  const streakHistory = Array.isArray((raw as any)?.streakHistory)
    ? (raw as any).streakHistory.map((entry: any) => ({
      date: asString(entry?.date),
      active: Boolean(entry?.active),
    }))
    : [];

  return {
    currentStreak: asNumber((raw as any)?.currentStreak ?? (raw as any)?.current_streak),
    longestStreak: asNumber((raw as any)?.longestStreak ?? (raw as any)?.longest_streak),
    lastActiveDate: asString((raw as any)?.lastActiveDate ?? (raw as any)?.last_active_date) || null,
    streakHistory: streakHistory.length > 0 ? streakHistory : Array.from({ length: 30 }, () => ({ date: '', active: false })),
    isAtRisk: Boolean((raw as any)?.isAtRisk ?? (raw as any)?.is_at_risk),
    hoursUntilReset: asNumber((raw as any)?.hoursUntilReset ?? (raw as any)?.hours_until_reset, 24),
    totalActiveDays: asNumber((raw as any)?.totalActiveDays ?? (raw as any)?.total_active_days),
    weeklyActivity: weeklyActivity.length > 0 ? [...weeklyActivity, ...DEFAULT_WEEKLY_ACTIVITY].slice(0, 7) : DEFAULT_WEEKLY_ACTIVITY,
  };
}

function normalizeBadge(raw: Record<string, unknown>, fallbackIndex: number): Badge {
  const id = asString((raw as any)?.id ?? (raw as any)?.badge_id, `badge-${fallbackIndex}`);
  return {
    id,
    name: asString((raw as any)?.name, 'Badge'),
    description: asString((raw as any)?.description, 'Achievement in progress'),
    icon: asString((raw as any)?.icon, '🏆'),
    category: (['streak', 'problems', 'quizzes', 'interviews', 'career', 'consistency', 'mastery', 'special'].includes((raw as any)?.category)
      ? (raw as any)?.category
      : 'special') as Badge['category'],
    rarity: (['common', 'rare', 'epic', 'legendary'].includes((raw as any)?.rarity)
      ? (raw as any)?.rarity
      : 'common') as BadgeRarity,
    isUnlocked: Boolean((raw as any)?.isUnlocked ?? (raw as any)?.is_unlocked),
    unlockedAt: asString((raw as any)?.unlockedAt ?? (raw as any)?.unlocked_at) || null,
    progress: asNumber((raw as any)?.progress),
    requirement: asString((raw as any)?.requirement, BADGE_REQUIREMENT_LABELS[id] ?? asString((raw as any)?.description, 'Keep going')),
    requirementValue: asNumber((raw as any)?.requirementValue ?? (raw as any)?.requirement_value, 1),
    currentValue: asNumber((raw as any)?.currentValue ?? (raw as any)?.current_value),
  };
}

function normalizeBadges(raw: Partial<BadgeSystemData> | Record<string, unknown> | undefined): BadgeSystemData {
  const badges = Array.isArray((raw as any)?.badges)
    ? (raw as any).badges.map((entry: any, index: number) => normalizeBadge(entry, index))
    : [];
  const recentlyUnlockedRaw = Array.isArray((raw as any)?.recentlyUnlocked ?? (raw as any)?.recently_unlocked)
    ? ((raw as any)?.recentlyUnlocked ?? (raw as any)?.recently_unlocked)
    : [];
  const nextToUnlockRaw = (raw as any)?.nextToUnlock ?? (raw as any)?.next_to_unlock;

  return {
    badges,
    totalUnlocked: asNumber((raw as any)?.totalUnlocked ?? (raw as any)?.total_unlocked, badges.filter((badge) => badge.isUnlocked).length),
    totalBadges: asNumber((raw as any)?.totalBadges ?? (raw as any)?.total_badges, badges.length),
    recentlyUnlocked: recentlyUnlockedRaw.map((entry: any, index: number) => normalizeBadge(entry, index)),
    nextToUnlock: nextToUnlockRaw ? normalizeBadge(nextToUnlockRaw, 0) : null,
  };
}

function normalizeIntelligence(raw: Partial<IntelligenceData> | Record<string, unknown> | undefined): IntelligenceData {
  const activeHours = Array.isArray((raw as any)?.activeHours)
    ? (raw as any).activeHours.map((entry: any, hour: number) => ({
      hour: asNumber(entry?.hour, hour),
      activity: asNumber(entry?.activity),
    }))
    : [];

  return {
    insights: Array.isArray((raw as any)?.insights)
      ? (raw as any).insights.map((entry: any, index: number) => ({
        id: asString(entry?.id, `insight-${index}`),
        type: (['pattern', 'suggestion', 'warning', 'achievement', 'prediction'].includes(entry?.type)
          ? entry.type
          : 'pattern') as IntelligenceData['insights'][number]['type'],
        title: asString(entry?.title, 'Insight'),
        description: asString(entry?.description),
        icon: asString(entry?.icon, '🧠'),
        priority: (['low', 'medium', 'high'].includes(entry?.priority) ? entry.priority : 'medium') as IntelligenceData['insights'][number]['priority'],
        actionable: Boolean(entry?.actionable),
        action: asString(entry?.action) || undefined,
        metadata: entry?.metadata,
      }))
      : [],
    activeHours: activeHours.length > 0 ? activeHours : DEFAULT_ACTIVE_HOURS,
    consistencyScore: asNumber((raw as any)?.consistencyScore),
    growthRate: asNumber((raw as any)?.growthRate),
    predictedStreakBreak: Boolean((raw as any)?.predictedStreakBreak),
    suggestedFocusAreas: Array.isArray((raw as any)?.suggestedFocusAreas)
      ? (raw as any).suggestedFocusAreas.map((entry: any) => asString(entry)).filter(Boolean)
      : [],
  };
}

export function normalizeDashboardData(raw: Partial<ProgressDashboardData> | Record<string, unknown> | undefined): ProgressDashboardData {
  return {
    contributions: normalizeContributionData((raw as any)?.contributions),
    problemSolving: normalizeProblemStats((raw as any)?.problemSolving),
    activity: normalizeActivitySummary((raw as any)?.activity),
    timeAnalytics: normalizeTimeAnalytics((raw as any)?.timeAnalytics),
    topicMap: normalizeTopicMap((raw as any)?.topicMap),
    streak: normalizeStreak((raw as any)?.streak),
    badges: normalizeBadges((raw as any)?.badges),
    intelligence: normalizeIntelligence((raw as any)?.intelligence),
    lastUpdated: asString((raw as any)?.lastUpdated, new Date().toISOString()),
  };
}

// ══════════════════════════════════════════════════════════════
// API Calls — Real-Time Data
// ══════════════════════════════════════════════════════════════

async function apiGet<T>(path: string, cacheKey: string, ttl = DEFAULT_TTL, forceRefresh = false): Promise<T> {
  if (!forceRefresh) {
    const cached = getCached<T>(cacheKey);
    if (cached) return cached;
  }

  const { data } = await api.get(`${PE_BASE}${path}`);
  setCache(cacheKey, data, ttl);
  return data;
}

// ── Full Dashboard (single aggregated call) ──────────────────

export async function fetchDashboard(forceRefresh = false, fallbackToMock = true): Promise<ProgressDashboardData> {
  if (!forceRefresh) {
    const cached = getCached<ProgressDashboardData>('dashboard');
    if (cached) return cached;
  }

  try {
    const { data } = await api.get(`${PE_BASE}/dashboard`);
    const normalized = normalizeDashboardData(data);
    setCache('dashboard', normalized, DASHBOARD_TTL);
    return normalized;
  } catch (error) {
    if (!fallbackToMock) {
      throw error;
    }
    console.warn('[ProgressEngine] Dashboard API failed, using empty fallback data:', error);
    return getProgressDashboardData(true);
  }
}

// ── Individual Section API Calls ─────────────────────────────

export async function fetchContributions(
  year?: number,
  forceRefresh = false,
  fallbackToMock = true,
): Promise<ContributionData> {
  const y = year || new Date().getFullYear();
  try {
    return normalizeContributionData(
      await apiGet(`/contributions?year=${y}`, `contributions:${y}`, 10 * 60 * 1000, forceRefresh),
    );
  } catch {
    if (!fallbackToMock) {
      throw new Error('Failed to fetch contributions');
    }
    return generateContributions(y);
  }
}

export async function fetchProblemStats(forceRefresh = false, fallbackToMock = true): Promise<ProblemSolvingStats> {
  try {
    return normalizeProblemStats(await apiGet('/problems', 'problems', 5 * 60 * 1000, forceRefresh));
  } catch {
    if (!fallbackToMock) {
      throw new Error('Failed to fetch problem stats');
    }
    return generateProblemSolvingStats();
  }
}

export async function fetchActivity(forceRefresh = false, fallbackToMock = true): Promise<ActivitySummary> {
  try {
    return normalizeActivitySummary(await apiGet('/activity', 'activity', 5 * 60 * 1000, forceRefresh));
  } catch {
    if (!fallbackToMock) {
      throw new Error('Failed to fetch activity summary');
    }
    return generateActivitySummary();
  }
}

export async function fetchTimeAnalytics(forceRefresh = false, fallbackToMock = true): Promise<TimeAnalyticsData> {
  try {
    return normalizeTimeAnalytics(
      await apiGet('/time-analytics', 'time-analytics', 5 * 60 * 1000, forceRefresh),
    );
  } catch {
    if (!fallbackToMock) {
      throw new Error('Failed to fetch time analytics');
    }
    return generateTimeAnalytics();
  }
}

export async function fetchTopicMap(forceRefresh = false, fallbackToMock = true): Promise<TopicMapData> {
  try {
    return normalizeTopicMap(await apiGet('/topics', 'topics', 10 * 60 * 1000, forceRefresh));
  } catch {
    if (!fallbackToMock) {
      throw new Error('Failed to fetch topic map');
    }
    return generateTopicMap();
  }
}

export async function fetchStreak(forceRefresh = false, fallbackToMock = true): Promise<StreakData> {
  try {
    return normalizeStreak(await apiGet('/streak', 'streak', 60 * 1000, forceRefresh));
  } catch {
    if (!fallbackToMock) {
      throw new Error('Failed to fetch streak data');
    }
    return generateStreakData();
  }
}

export async function touchStreak(): Promise<StreakData> {
  try {
    const { data } = await api.post(`${PE_BASE}/streak/touch`);
    invalidateCache('streak');
    return data;
  } catch {
    return generateStreakData();
  }
}

export async function fetchBadges(forceRefresh = false, fallbackToMock = true): Promise<BadgeSystemData> {
  try {
    return normalizeBadges(await apiGet('/badges', 'badges', 10 * 60 * 1000, forceRefresh));
  } catch {
    if (!fallbackToMock) {
      throw new Error('Failed to fetch badges');
    }
    return generateBadges();
  }
}

export async function fetchIntelligence(forceRefresh = false, fallbackToMock = true): Promise<IntelligenceData> {
  try {
    return normalizeIntelligence(await apiGet('/intelligence', 'intelligence', 10 * 60 * 1000, forceRefresh));
  } catch {
    if (!fallbackToMock) {
      throw new Error('Failed to fetch intelligence');
    }
    return generateIntelligence();
  }
}

// ── Activity Timeline (NEW) ─────────────────────────────────

export interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  description: string;
  icon: string;
}

export interface TimelineResponse {
  events: TimelineEvent[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export async function fetchTimeline(
  filter: 'today' | 'week' | 'month' | 'all' = 'today',
  page = 1,
  perPage = 20,
): Promise<TimelineResponse> {
  try {
    const { data } = await api.get(
      `${PE_BASE}/timeline?filter=${filter}&page=${page}&per_page=${perPage}`,
    );
    return data;
  } catch {
    return { events: [], total: 0, page, per_page: perPage, has_more: false };
  }
}

export interface ProgressStreamMessage {
  kind: string;
  userId?: string;
  eventCount?: number;
  eventTypes?: string[];
  timestamp?: string;
  persistence?: {
    mongo?: number;
    sql?: number;
    buffered?: number;
  };
}

interface ProgressStreamOptions {
  onOpen?: () => void;
  onMessage?: (message: ProgressStreamMessage) => void;
  onError?: (error: unknown) => void;
}

function getProgressStreamUrl(): string {
  const baseUrl = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');
  return `${baseUrl}${PE_BASE}/stream`;
}

function parseSseChunk(
  chunk: string,
  onMessage?: (message: ProgressStreamMessage) => void,
): void {
  const normalized = chunk.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let eventName = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (eventName === 'ping' || dataLines.length === 0) {
    return;
  }

  try {
    const payload = JSON.parse(dataLines.join('\n')) as ProgressStreamMessage;
    onMessage?.(payload);
  } catch {
    // Ignore malformed SSE payloads and keep the stream alive.
  }
}

export function subscribeToProgressUpdates(options: ProgressStreamOptions = {}): () => void {
  const controller = new AbortController();
  const decoder = new TextDecoder();
  let disposed = false;
  let reconnectDelayMs = 1000;
  let reconnectTimer: number | null = null;

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer !== null) {
      return;
    }

    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, reconnectDelayMs);
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 15000);
  };

  const connect = async () => {
    const token = localStorage.getItem('token');
    if (!token || token === 'undefined' || token === 'null') {
      options.onError?.(new Error('Missing auth token for progress stream'));
      scheduleReconnect();
      return;
    }

    try {
      const response = await fetch(getProgressStreamUrl(), {
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Progress stream failed with status ${response.status}`);
      }

      options.onOpen?.();
      reconnectDelayMs = 1000;

      const reader = response.body.getReader();
      let buffer = '';

      while (!disposed) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n');

        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          parseSseChunk(chunk, options.onMessage);
          boundary = buffer.indexOf('\n\n');
        }
      }

      if (!disposed) {
        options.onError?.(new Error('Progress stream closed'));
        scheduleReconnect();
      }
    } catch (error) {
      if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) {
        options.onError?.(error);
        scheduleReconnect();
      }
    }
  };

  void connect();

  return () => {
    disposed = true;
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
    }
    controller.abort();
  };
}

// ══════════════════════════════════════════════════════════════
// FALLBACK DATA — Shown when backend API is unavailable
// All content is LakshyaTrack-specific (no generic DSA/LeetCode)
// ══════════════════════════════════════════════════════════════

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function generateContributions(year: number): ContributionData {
  // Empty heatmap — shows actual activity will fill this in
  const contributions: DailyContribution[] = [];
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const now = new Date();

  for (let d = new Date(startDate); d <= endDate && d <= now; d.setDate(d.getDate() + 1)) {
    contributions.push({ date: formatDate(new Date(d)), count: 0, level: 0 });
  }

  return { contributions, totalContributions: 0, longestStreak: 0, currentStreak: 0, year };
}

function generateProblemSolvingStats(): ProblemSolvingStats {
  return {
    totalSolved: 0, totalAvailable: 0,
    acceptanceRate: 0, totalSubmissions: 0,
    difficulty: {
      easy: { solved: 0, total: 0 },
      medium: { solved: 0, total: 0 },
      hard: { solved: 0, total: 0 },
    },
    recentSubmissions: [],
  };
}

function generateActivitySummary(): ActivitySummary {
  return {
    totalSessions: 0, avgSessionDuration: 0,
    totalActiveTime: 0, totalIdleTime: 0,
    mostVisitedPages: [],
    mostUsedFeatures: [],
    activeDays: 0,
  };
}

function generateTimeAnalytics(): TimeAnalyticsData {
  const dailyUsage = Array.from({ length: 30 }, (_, i) => ({
    date: formatDate(daysAgo(29 - i)), totalMinutes: 0, activeMinutes: 0,
  }));
  return {
    dailyUsage, weeklyTrends: [],
    featureTimeSpent: [],
    totalHoursThisWeek: 0, totalHoursThisMonth: 0,
    avgDailyMinutes: 0, peakHour: 0, peakDay: 'No activity yet',
  };
}

function generateTopicMap(): TopicMapData {
  return {
    topics: [],
    totalTopics: 0,
    strongestTopic: '',
    weakestTopic: '',
  };
}

function generateStreakData(): StreakData {
  return {
    currentStreak: 0, longestStreak: 0,
    lastActiveDate: null,
    streakHistory: Array.from({ length: 30 }, (_, i) => ({
      date: formatDate(daysAgo(29 - i)), active: false,
    })),
    isAtRisk: false, hoursUntilReset: 24,
    totalActiveDays: 0, weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
  };
}

function generateBadges(): BadgeSystemData {
  return {
    badges: [],
    totalUnlocked: 0,
    totalBadges: 0,
    recentlyUnlocked: [],
    nextToUnlock: null,
  };
}

function generateIntelligence(): IntelligenceData {
  const activeHours = Array.from({ length: 24 }, (_, hour) => ({ hour, activity: 0 }));
  return {
    insights: [],
    activeHours, consistencyScore: 0, growthRate: 0,
    predictedStreakBreak: false, suggestedFocusAreas: [],
  };
}

// ── Unified sync accessor (backwards compatible) ─────────────

let cachedData: ProgressDashboardData | null = null;

export function getProgressDashboardData(forceRefresh = false): ProgressDashboardData {
  if (cachedData && !forceRefresh) return cachedData;
  const currentYear = new Date().getFullYear();
  cachedData = {
    contributions: generateContributions(currentYear),
    problemSolving: generateProblemSolvingStats(),
    activity: generateActivitySummary(),
    timeAnalytics: generateTimeAnalytics(),
    topicMap: generateTopicMap(),
    streak: generateStreakData(),
    badges: generateBadges(),
    intelligence: generateIntelligence(),
    lastUpdated: new Date().toISOString(),
  };
  return cachedData;
}

export function getContributionsByYear(year: number): ContributionData {
  return generateContributions(year);
}
