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

// ══════════════════════════════════════════════════════════════
// API Calls — Real-Time Data
// ══════════════════════════════════════════════════════════════

async function apiGet<T>(path: string, cacheKey: string, ttl = DEFAULT_TTL): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const { data } = await api.get(`${PE_BASE}${path}`);
  setCache(cacheKey, data, ttl);
  return data;
}

// ── Full Dashboard (single aggregated call) ──────────────────

export async function fetchDashboard(forceRefresh = false): Promise<ProgressDashboardData> {
  if (!forceRefresh) {
    const cached = getCached<ProgressDashboardData>('dashboard');
    if (cached) return cached;
  }

  try {
    const { data } = await api.get(`${PE_BASE}/dashboard`);
    setCache('dashboard', data, 5 * 60 * 1000);
    return data;
  } catch (error) {
    console.warn('[ProgressEngine] Dashboard API failed, using mock data:', error);
    return getProgressDashboardData(true);
  }
}

// ── Individual Section API Calls ─────────────────────────────

export async function fetchContributions(year?: number): Promise<ContributionData> {
  const y = year || new Date().getFullYear();
  try {
    return await apiGet(`/contributions?year=${y}`, `contributions:${y}`, 10 * 60 * 1000);
  } catch {
    return generateContributions(y);
  }
}

export async function fetchProblemStats(): Promise<ProblemSolvingStats> {
  try {
    return await apiGet('/problems', 'problems', 5 * 60 * 1000);
  } catch {
    return generateProblemSolvingStats();
  }
}

export async function fetchActivity(): Promise<ActivitySummary> {
  try {
    return await apiGet('/activity', 'activity', 5 * 60 * 1000);
  } catch {
    return generateActivitySummary();
  }
}

export async function fetchTimeAnalytics(): Promise<TimeAnalyticsData> {
  try {
    return await apiGet('/time-analytics', 'time-analytics', 5 * 60 * 1000);
  } catch {
    return generateTimeAnalytics();
  }
}

export async function fetchTopicMap(): Promise<TopicMapData> {
  try {
    return await apiGet('/topics', 'topics', 10 * 60 * 1000);
  } catch {
    return generateTopicMap();
  }
}

export async function fetchStreak(): Promise<StreakData> {
  try {
    return await apiGet('/streak', 'streak', 60 * 1000); // shorter TTL for streak
  } catch {
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

export async function fetchBadges(): Promise<BadgeSystemData> {
  try {
    return await apiGet('/badges', 'badges', 10 * 60 * 1000);
  } catch {
    return generateBadges();
  }
}

export async function fetchIntelligence(): Promise<IntelligenceData> {
  try {
    return await apiGet('/intelligence', 'intelligence', 10 * 60 * 1000);
  } catch {
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
  // Empty — all data comes from real quiz_attempts + interview_sessions
  return {
    totalSolved: 0, totalAvailable: 100,
    acceptanceRate: 0, totalSubmissions: 0,
    difficulty: {
      easy: { solved: 0, total: 50 },      // Beginner quizzes
      medium: { solved: 0, total: 80 },    // Intermediate quizzes
      hard: { solved: 0, total: 40 },      // Advanced quizzes
    },
    recentSubmissions: [],
  };
}

function generateActivitySummary(): ActivitySummary {
  return {
    totalSessions: 0, avgSessionDuration: 0,
    totalActiveTime: 0, totalIdleTime: 0,
    mostVisitedPages: [
      { page: 'Quizzes', count: 0 },
      { page: 'Interview Simulator', count: 0 },
      { page: 'Resume Studio', count: 0 },
      { page: 'Learning Roadmaps', count: 0 },
      { page: 'English Coach', count: 0 },
      { page: 'Reasoning', count: 0 },
    ],
    mostUsedFeatures: [
      { feature: 'Quiz Solving', count: 0 },
      { feature: 'Mock Interviews', count: 0 },
      { feature: 'Resume Analysis', count: 0 },
      { feature: 'Roadmap Generation', count: 0 },
      { feature: 'AI Chat', count: 0 },
      { feature: 'English Practice', count: 0 },
    ],
    activeDays: 0,
  };
}

function generateTimeAnalytics(): TimeAnalyticsData {
  const dailyUsage = Array.from({ length: 30 }, (_, i) => ({
    date: formatDate(daysAgo(29 - i)), totalMinutes: 0, activeMinutes: 0,
  }));
  return {
    dailyUsage, weeklyTrends: [],
    featureTimeSpent: [
      { feature: 'Quizzes', minutes: 0, percentage: 25, color: '#10b981' },
      { feature: 'Mock Interviews', minutes: 0, percentage: 25, color: '#6366f1' },
      { feature: 'Resume Building', minutes: 0, percentage: 25, color: '#f59e0b' },
      { feature: 'Learning Roadmaps', minutes: 0, percentage: 25, color: '#ef4444' },
    ],
    totalHoursThisWeek: 0, totalHoursThisMonth: 0,
    avgDailyMinutes: 0, peakHour: 20, peakDay: 'Not available',
  };
}

function generateTopicMap(): TopicMapData {
  // Empty — will be populated from quiz_attempts.skill_name
  return {
    topics: [],
    totalTopics: 0,
    strongestTopic: 'Take quizzes to discover',
    weakestTopic: 'Take quizzes to discover',
  };
}

function generateStreakData(): StreakData {
  return {
    currentStreak: 0, longestStreak: 0,
    lastActiveDate: formatDate(new Date()),
    streakHistory: Array.from({ length: 30 }, (_, i) => ({
      date: formatDate(daysAgo(29 - i)), active: false,
    })),
    isAtRisk: false, hoursUntilReset: 24,
    totalActiveDays: 0, weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
  };
}

function generateBadges(): BadgeSystemData {
  // LakshyaTrack platform badges
  const allBadges: Badge[] = [
    { id: 'b1', name: 'First Flame', description: 'Maintain a 3-day login streak', icon: '🔥', category: 'streak', rarity: 'common', isUnlocked: false, unlockedAt: null, progress: 0, requirement: '3-day streak', requirementValue: 3, currentValue: 0 },
    { id: 'b2', name: 'Week Warrior', description: '7-day login streak', icon: '⚡', category: 'streak', rarity: 'common', isUnlocked: false, unlockedAt: null, progress: 0, requirement: '7-day streak', requirementValue: 7, currentValue: 0 },
    { id: 'b3', name: 'Quiz Starter', description: 'Pass your first quiz', icon: '📝', category: 'quizzes', rarity: 'common', isUnlocked: false, unlockedAt: null, progress: 0, requirement: '1 quiz passed', requirementValue: 1, currentValue: 0 },
    { id: 'b4', name: 'Quiz Apprentice', description: 'Pass 10 quizzes', icon: '🎯', category: 'quizzes', rarity: 'common', isUnlocked: false, unlockedAt: null, progress: 0, requirement: '10 quizzes passed', requirementValue: 10, currentValue: 0 },
    { id: 'b5', name: 'Interview Ready', description: 'Complete your first mock interview', icon: '🎤', category: 'interviews', rarity: 'common', isUnlocked: false, unlockedAt: null, progress: 0, requirement: '1 mock interview', requirementValue: 1, currentValue: 0 },
    { id: 'b6', name: 'Interview Pro', description: 'Complete 10 mock interviews', icon: '🏆', category: 'interviews', rarity: 'rare', isUnlocked: false, unlockedAt: null, progress: 0, requirement: '10 interviews', requirementValue: 10, currentValue: 0 },
    { id: 'b7', name: 'Resume Builder', description: 'Create your first resume', icon: '📄', category: 'career', rarity: 'common', isUnlocked: false, unlockedAt: null, progress: 0, requirement: '1 resume', requirementValue: 1, currentValue: 0 },
    { id: 'b8', name: 'Roadmap Explorer', description: 'Generate a learning roadmap', icon: '🗺️', category: 'career', rarity: 'common', isUnlocked: false, unlockedAt: null, progress: 0, requirement: '1 roadmap', requirementValue: 1, currentValue: 0 },
  ];
  return {
    badges: allBadges, totalUnlocked: 0, totalBadges: allBadges.length,
    recentlyUnlocked: [], nextToUnlock: allBadges[0],
  };
}

function generateIntelligence(): IntelligenceData {
  const activeHours = Array.from({ length: 24 }, (_, hour) => ({ hour, activity: 0 }));
  return {
    insights: [
      { id: 'i1', type: 'suggestion', title: 'Get Started with Quizzes', description: 'Take your first quiz to start tracking your learning progress on LakshyaTrack.', icon: '📝', priority: 'high', actionable: true, action: 'Go to Quizzes' },
      { id: 'i2', type: 'suggestion', title: 'Try a Mock Interview', description: 'Practice with our AI-powered interview simulator to build confidence.', icon: '🎤', priority: 'high', actionable: true, action: 'Start Interview' },
      { id: 'i3', type: 'suggestion', title: 'Build Your Resume', description: 'Head to Resume Studio and create a professional ATS-optimized resume.', icon: '📄', priority: 'medium', actionable: true, action: 'Go to Resume Studio' },
      { id: 'i4', type: 'suggestion', title: 'Create a Learning Roadmap', description: 'Generate a personalized skill roadmap based on your target role.', icon: '🗺️', priority: 'medium', actionable: true, action: 'Generate Roadmap' },
    ],
    activeHours, consistencyScore: 0, growthRate: 0,
    predictedStreakBreak: false, suggestedFocusAreas: ['Take Quizzes', 'Practice Interviews', 'Build Resume'],
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
