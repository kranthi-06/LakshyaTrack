// ══════════════════════════════════════════════════════════════
// Progress Intelligence Dashboard — Type Definitions
// ══════════════════════════════════════════════════════════════

// ── Contribution Heatmap ──────────────────────────────────────
export interface DailyContribution {
  date: string;        // ISO date: "2025-03-25"
  count: number;       // number of activities
  level: 0 | 1 | 2 | 3 | 4;  // intensity level for coloring
}

export interface ContributionData {
  contributions: DailyContribution[];
  totalContributions: number;
  longestStreak: number;
  currentStreak: number;
  year: number;
}

// ── Problem Solving Analytics ─────────────────────────────────
export interface DifficultyBreakdown {
  easy: { solved: number; total: number };
  medium: { solved: number; total: number };
  hard: { solved: number; total: number };
}

export interface ProblemSolvingStats {
  totalSolved: number;
  totalAvailable: number;
  acceptanceRate: number;
  totalSubmissions: number;
  difficulty: DifficultyBreakdown;
  recentSubmissions: RecentSubmission[];
}

export interface RecentSubmission {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'accepted' | 'wrong_answer' | 'time_limit' | 'runtime_error';
  timestamp: string;
  language: string;
}

// ── Activity Tracking ─────────────────────────────────────────
export interface SessionData {
  id: string;
  loginTime: string;
  logoutTime: string | null;
  duration: number;          // minutes
  pagesVisited: string[];
  featuresUsed: string[];
  activeTime: number;        // minutes
  idleTime: number;          // minutes
}

export interface ActivityEvent {
  id: string;
  type: 'login' | 'logout' | 'page_visit' | 'feature_use' | 'problem_solved' | 'quiz_taken' | 'interview_done';
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface ActivitySummary {
  totalSessions: number;
  avgSessionDuration: number;  // minutes
  totalActiveTime: number;     // minutes
  totalIdleTime: number;       // minutes
  mostVisitedPages: { page: string; count: number }[];
  mostUsedFeatures: { feature: string; count: number }[];
  activeDays: number;
}

// ── Time Analytics ────────────────────────────────────────────
export interface DailyUsage {
  date: string;
  totalMinutes: number;
  activeMinutes: number;
}

export interface WeeklyTrend {
  week: string;            // "Week 1", "Week 2" etc.
  weekStart: string;
  totalHours: number;
  avgDailyMinutes: number;
}

export interface FeatureTimeSpent {
  feature: string;
  minutes: number;
  percentage: number;
  color: string;
}

export interface TimeAnalyticsData {
  dailyUsage: DailyUsage[];
  weeklyTrends: WeeklyTrend[];
  featureTimeSpent: FeatureTimeSpent[];
  totalHoursThisWeek: number;
  totalHoursThisMonth: number;
  avgDailyMinutes: number;
  peakHour: number;         // 0-23
  peakDay: string;          // "Monday", etc.
}

// ── Topic / Skill Bubble Map ──────────────────────────────────
export interface TopicBubble {
  id: string;
  name: string;
  category: string;
  problemsSolved: number;
  timeSpentMinutes: number;
  proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  proficiencyScore: number;   // 0-100
  color: string;
  size: number;               // calculated from problemsSolved or timeSpent
  subtopics?: TopicBubble[];
}

export interface TopicMapData {
  topics: TopicBubble[];
  totalTopics: number;
  strongestTopic: string;
  weakestTopic: string;
}

// ── Streak Engine ─────────────────────────────────────────────
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  streakHistory: { date: string; active: boolean }[];
  isAtRisk: boolean;          // true if might break today
  hoursUntilReset: number;
  totalActiveDays: number;
  weeklyActivity: number[];   // last 7 days activity count
}

// ── Badge & Achievement System ────────────────────────────────
export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'problems' | 'consistency' | 'mastery' | 'special';
  rarity: BadgeRarity;
  isUnlocked: boolean;
  unlockedAt: string | null;
  progress: number;           // 0-100
  requirement: string;
  requirementValue: number;
  currentValue: number;
}

export interface BadgeSystemData {
  badges: Badge[];
  totalUnlocked: number;
  totalBadges: number;
  recentlyUnlocked: Badge[];
  nextToUnlock: Badge | null;
}

// ── Intelligent Insights ──────────────────────────────────────
export type InsightType = 'pattern' | 'suggestion' | 'warning' | 'achievement' | 'prediction';

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  icon: string;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  action?: string;
  metadata?: Record<string, unknown>;
}

export interface IntelligenceData {
  insights: Insight[];
  activeHours: { hour: number; activity: number }[];
  consistencyScore: number;   // 0-100
  growthRate: number;          // percentage
  predictedStreakBreak: boolean;
  suggestedFocusAreas: string[];
}

// ── Combined Dashboard Data ───────────────────────────────────
export interface ProgressDashboardData {
  contributions: ContributionData;
  problemSolving: ProblemSolvingStats;
  activity: ActivitySummary;
  timeAnalytics: TimeAnalyticsData;
  topicMap: TopicMapData;
  streak: StreakData;
  badges: BadgeSystemData;
  intelligence: IntelligenceData;
  lastUpdated: string;
}

// ── API Response Wrapper ──────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: string;
}

// ── Filter/View Options ───────────────────────────────────────
export type HeatmapView = 'yearly' | 'monthly';
export type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';
export type SortOption = 'recent' | 'difficulty' | 'status';
