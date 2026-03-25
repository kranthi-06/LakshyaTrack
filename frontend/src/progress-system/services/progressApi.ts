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
// MOCK DATA FALLBACKS (kept for graceful degradation)
// ══════════════════════════════════════════════════════════════

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getContributionLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 8) return 3;
  return 4;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function generateContributions(year: number): ContributionData {
  const contributions: DailyContribution[] = [];
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const now = new Date();
  let total = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  for (let d = new Date(startDate); d <= endDate && d <= now; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    let count = 0;
    const rand = Math.random();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if (rand < 0.7) count = randomInt(1, 12);
    } else {
      if (rand < 0.35) count = randomInt(1, 6);
    }
    const month = d.getMonth();
    if (month >= 1 && month <= 3) count = Math.ceil(count * 1.2);
    if (month >= 9 && month <= 11) count = Math.ceil(count * 1.3);
    total += count;
    if (count > 0) { tempStreak++; longestStreak = Math.max(longestStreak, tempStreak); }
    else { tempStreak = 0; }
    contributions.push({ date: formatDate(new Date(d)), count, level: getContributionLevel(count) });
  }

  let currentStreak = 0;
  for (let i = contributions.length - 1; i >= 0; i--) {
    if (contributions[i].count > 0) currentStreak++; else break;
  }

  return { contributions, totalContributions: total, longestStreak, currentStreak, year };
}

function generateProblemSolvingStats(): ProblemSolvingStats {
  const easySolved = randomInt(120, 200);
  const mediumSolved = randomInt(60, 140);
  const hardSolved = randomInt(15, 50);
  const totalSolved = easySolved + mediumSolved + hardSolved;
  const totalSubmissions = totalSolved + randomInt(100, 300);
  const difficulties = ['easy', 'medium', 'hard'] as const;
  const problemNames = ['Two Sum', 'Valid Parentheses', 'Merge Intervals', 'LRU Cache', 'Binary Tree Level Order', 'Longest Substring', 'Container With Most Water', 'Three Sum', 'Reverse Linked List', 'Maximum Subarray'];
  const languages = ['Python', 'JavaScript', 'Java', 'C++', 'TypeScript'];
  const recentSubmissions = Array.from({ length: 15 }, (_, i) => ({
    id: `sub-${i}`, title: problemNames[randomInt(0, problemNames.length - 1)],
    difficulty: difficulties[randomInt(0, 2)], status: (i < 10 ? 'accepted' : ['accepted', 'wrong_answer', 'time_limit', 'runtime_error'][randomInt(0, 3)]) as any,
    timestamp: daysAgo(randomInt(0, 14)).toISOString(), language: languages[randomInt(0, languages.length - 1)],
  }));
  return {
    totalSolved, totalAvailable: 2850, acceptanceRate: Math.round((totalSolved / totalSubmissions) * 100 * 10) / 10,
    totalSubmissions, difficulty: { easy: { solved: easySolved, total: 750 }, medium: { solved: mediumSolved, total: 1500 }, hard: { solved: hardSolved, total: 600 } },
    recentSubmissions,
  };
}

function generateActivitySummary(): ActivitySummary {
  return {
    totalSessions: randomInt(150, 400), avgSessionDuration: randomInt(25, 90),
    totalActiveTime: randomInt(5000, 15000), totalIdleTime: randomInt(500, 2000),
    mostVisitedPages: [{ page: 'Quiz', count: randomInt(80, 200) }, { page: 'Interview', count: randomInt(60, 150) }, { page: 'Resume Builder', count: randomInt(40, 120) }, { page: 'Career Intelligence', count: randomInt(30, 100) }, { page: 'Learning Hub', count: randomInt(20, 80) }, { page: 'Reasoning', count: randomInt(15, 60) }],
    mostUsedFeatures: [{ feature: 'Quiz Solving', count: randomInt(100, 300) }, { feature: 'Mock Interview', count: randomInt(50, 150) }, { feature: 'Resume Analysis', count: randomInt(30, 100) }, { feature: 'Code Execution', count: randomInt(40, 120) }, { feature: 'AI Chat', count: randomInt(60, 200) }, { feature: 'Roadmap', count: randomInt(20, 80) }],
    activeDays: randomInt(80, 250),
  };
}

function generateTimeAnalytics(): TimeAnalyticsData {
  const dailyUsage = Array.from({ length: 30 }, (_, i) => {
    const totalMinutes = randomInt(10, 180);
    return { date: formatDate(daysAgo(29 - i)), totalMinutes, activeMinutes: Math.round(totalMinutes * (0.6 + Math.random() * 0.3)) };
  });
  const weeklyTrends = Array.from({ length: 12 }, (_, i) => ({
    week: `W${i + 1}`, weekStart: formatDate(daysAgo((11 - i) * 7)),
    totalHours: Math.round((randomInt(5, 25) + Math.random()) * 10) / 10, avgDailyMinutes: randomInt(20, 120),
  }));
  const featureColors = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const features = ['Quiz & Problems', 'Interviews', 'Resume Building', 'Learning', 'Code Practice', 'AI Tools'];
  const totalMins = randomInt(3000, 8000);
  let remaining = 100;
  const featureTimeSpent = features.map((feature, i) => {
    const pct = i === features.length - 1 ? remaining : randomInt(8, Math.min(35, remaining - (features.length - i - 1) * 5));
    remaining -= pct;
    return { feature, minutes: Math.round(totalMins * pct / 100), percentage: pct, color: featureColors[i] };
  });
  return {
    dailyUsage, weeklyTrends, featureTimeSpent,
    totalHoursThisWeek: Math.round((randomInt(8, 25) + Math.random()) * 10) / 10,
    totalHoursThisMonth: Math.round((randomInt(40, 120) + Math.random()) * 10) / 10,
    avgDailyMinutes: randomInt(30, 120), peakHour: randomInt(19, 23),
    peakDay: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][randomInt(0, 4)],
  };
}

function generateTopicMap(): TopicMapData {
  const topicsData = [
    { name: 'Arrays', category: 'DSA', color: '#6366f1' }, { name: 'Trees', category: 'DSA', color: '#a855f7' },
    { name: 'Graphs', category: 'DSA', color: '#7c3aed' }, { name: 'Dynamic Programming', category: 'DSA', color: '#6d28d9' },
    { name: 'React', category: 'Web', color: '#06b6d4' }, { name: 'Node.js', category: 'Web', color: '#0891b2' },
    { name: 'Python', category: 'AI/ML', color: '#10b981' }, { name: 'SQL', category: 'Database', color: '#f59e0b' },
    { name: 'System Design', category: 'Architecture', color: '#ef4444' },
  ];
  const topics: TopicBubble[] = topicsData.map((t, i) => {
    const problemsSolved = randomInt(5, 80);
    const proficiencyScore = randomInt(20, 95);
    return {
      id: `topic-${i}`, name: t.name, category: t.category, problemsSolved,
      timeSpentMinutes: randomInt(60, 1200),
      proficiencyLevel: (proficiencyScore < 30 ? 'beginner' : proficiencyScore < 55 ? 'intermediate' : proficiencyScore < 80 ? 'advanced' : 'expert') as TopicBubble['proficiencyLevel'],
      proficiencyScore, color: t.color, size: Math.max(30, Math.min(100, problemsSolved * 1.2)),
    };
  });
  const sorted = [...topics].sort((a, b) => b.proficiencyScore - a.proficiencyScore);
  return { topics, totalTopics: topics.length, strongestTopic: sorted[0].name, weakestTopic: sorted[sorted.length - 1].name };
}

function generateStreakData(): StreakData {
  const currentStreak = randomInt(5, 45);
  const longestStreak = Math.max(currentStreak, randomInt(30, 90));
  const now = new Date();
  const hoursLeft = 24 - now.getHours() + (now.getMinutes() > 0 ? -1 : 0);
  return {
    currentStreak, longestStreak, lastActiveDate: formatDate(new Date()),
    streakHistory: Array.from({ length: 30 }, (_, i) => ({ date: formatDate(daysAgo(29 - i)), active: i >= (30 - currentStreak) ? true : Math.random() > 0.3 })),
    isAtRisk: hoursLeft < 6, hoursUntilReset: Math.max(0, hoursLeft),
    totalActiveDays: randomInt(120, 300), weeklyActivity: Array.from({ length: 7 }, () => randomInt(1, 15)),
  };
}

function generateBadges(): BadgeSystemData {
  const allBadges: Badge[] = [
    { id: 'b1', name: 'First Flame', description: 'Maintain a 3-day streak', icon: '🔥', category: 'streak', rarity: 'common', isUnlocked: true, unlockedAt: daysAgo(60).toISOString(), progress: 100, requirement: '3-day streak', requirementValue: 3, currentValue: 3 },
    { id: 'b2', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '⚡', category: 'streak', rarity: 'common', isUnlocked: true, unlockedAt: daysAgo(45).toISOString(), progress: 100, requirement: '7-day streak', requirementValue: 7, currentValue: 7 },
    { id: 'b3', name: 'Fortnight Fighter', description: 'Maintain a 14-day streak', icon: '💫', category: 'streak', rarity: 'rare', isUnlocked: true, unlockedAt: daysAgo(30).toISOString(), progress: 100, requirement: '14-day streak', requirementValue: 14, currentValue: 14 },
    { id: 'b4', name: 'Monthly Master', description: 'Maintain a 30-day streak', icon: '🌟', category: 'streak', rarity: 'epic', isUnlocked: true, unlockedAt: daysAgo(10).toISOString(), progress: 100, requirement: '30-day streak', requirementValue: 30, currentValue: 30 },
    { id: 'b5', name: 'Century Legend', description: 'Maintain a 100-day streak', icon: '👑', category: 'streak', rarity: 'legendary', isUnlocked: false, unlockedAt: null, progress: 42, requirement: '100-day streak', requirementValue: 100, currentValue: 42 },
    { id: 'b6', name: 'Problem Starter', description: 'Solve 10 problems', icon: '🎯', category: 'problems', rarity: 'common', isUnlocked: true, unlockedAt: daysAgo(90).toISOString(), progress: 100, requirement: '10 problems', requirementValue: 10, currentValue: 10 },
    { id: 'b7', name: 'Century Club', description: 'Solve 100 problems', icon: '💎', category: 'problems', rarity: 'rare', isUnlocked: true, unlockedAt: daysAgo(40).toISOString(), progress: 100, requirement: '100 problems', requirementValue: 100, currentValue: 100 },
    { id: 'b8', name: 'Grandmaster', description: 'Solve 500 problems', icon: '🏆', category: 'problems', rarity: 'legendary', isUnlocked: false, unlockedAt: null, progress: 36, requirement: '500 problems', requirementValue: 500, currentValue: 180 },
  ];
  const unlocked = allBadges.filter(b => b.isUnlocked);
  const locked = allBadges.filter(b => !b.isUnlocked).sort((a, b) => b.progress - a.progress);
  return {
    badges: allBadges, totalUnlocked: unlocked.length, totalBadges: allBadges.length,
    recentlyUnlocked: unlocked.slice(0, 3), nextToUnlock: locked[0] || null,
  };
}

function generateIntelligence(): IntelligenceData {
  const activeHours = Array.from({ length: 24 }, (_, hour) => ({
    hour, activity: hour >= 9 && hour <= 23 ? randomInt(10, 100) * (hour >= 19 && hour <= 22 ? 2 : 1) : randomInt(0, 15),
  }));
  return {
    insights: [
      { id: 'i1', type: 'pattern', title: 'Night Owl Pattern', description: 'You are most productive between 8 PM and 11 PM.', icon: '🦉', priority: 'medium', actionable: false },
      { id: 'i2', type: 'suggestion', title: 'Focus on Hard Problems', description: "You've mastered easy problems. Challenge yourself with hard-level problems.", icon: '🎯', priority: 'high', actionable: true, action: 'Start a Hard Problem' },
      { id: 'i3', type: 'achievement', title: 'Consistency Rising!', description: "You've been active for 14+ consecutive days. Top 5% of learners.", icon: '🔥', priority: 'medium', actionable: false },
      { id: 'i4', type: 'warning', title: 'Streak at Risk', description: "Complete at least one task to maintain your streak!", icon: '⚠️', priority: 'high', actionable: true, action: 'Solve a Problem' },
    ],
    activeHours, consistencyScore: randomInt(65, 92), growthRate: Math.round((randomInt(5, 25) + Math.random()) * 10) / 10,
    predictedStreakBreak: Math.random() > 0.7, suggestedFocusAreas: ['Graph Algorithms', 'Dynamic Programming', 'System Design'],
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
