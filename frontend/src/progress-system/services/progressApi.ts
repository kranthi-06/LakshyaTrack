// ══════════════════════════════════════════════════════════════
// Progress Intelligence Dashboard — Data Service
// Generates realistic mock data & provides API integration layer
// ══════════════════════════════════════════════════════════════

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

// ── Helper Utilities ──────────────────────────────────────────

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

// ── Contribution Heatmap Data ─────────────────────────────────

function generateContributions(year: number): ContributionData {
  const contributions: DailyContribution[] = [];
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const now = new Date();
  let total = 0;
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  for (let d = new Date(startDate); d <= endDate && d <= now; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    // Realistic pattern: more active on weekdays, occasional weekends
    let count = 0;
    const rand = Math.random();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Weekdays: 70% chance of activity
      if (rand < 0.7) {
        count = randomInt(1, 12);
      }
    } else {
      // Weekends: 35% chance of activity
      if (rand < 0.35) {
        count = randomInt(1, 6);
      }
    }

    // Add seasonal patterns (more active in certain months)
    const month = d.getMonth();
    if (month >= 1 && month <= 3) count = Math.ceil(count * 1.2); // Feb-Apr boost
    if (month >= 9 && month <= 11) count = Math.ceil(count * 1.3); // Oct-Dec boost

    total += count;

    if (count > 0) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }

    contributions.push({
      date: formatDate(new Date(d)),
      count,
      level: getContributionLevel(count),
    });
  }

  // Calculate current streak from today backwards
  currentStreak = 0;
  for (let i = contributions.length - 1; i >= 0; i--) {
    if (contributions[i].count > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    contributions,
    totalContributions: total,
    longestStreak,
    currentStreak,
    year,
  };
}

// ── Problem Solving Stats ─────────────────────────────────────

function generateProblemSolvingStats(): ProblemSolvingStats {
  const easySolved = randomInt(120, 200);
  const mediumSolved = randomInt(60, 140);
  const hardSolved = randomInt(15, 50);
  const totalSolved = easySolved + mediumSolved + hardSolved;
  const totalSubmissions = totalSolved + randomInt(100, 300);

  const difficulties = ['easy', 'medium', 'hard'] as const;
  const statuses = ['accepted', 'wrong_answer', 'time_limit', 'runtime_error'] as const;
  const languages = ['Python', 'JavaScript', 'Java', 'C++', 'TypeScript'];
  const problemNames = [
    'Two Sum', 'Valid Parentheses', 'Merge Intervals', 'LRU Cache',
    'Binary Tree Level Order', 'Longest Substring', 'Median of Two Arrays',
    'Regular Expression Matching', 'Container With Most Water', 'Three Sum',
    'Reverse Linked List', 'Course Schedule', 'Word Break', 'Maximum Subarray',
    'Climbing Stairs', 'Coin Change', 'House Robber', 'Valid Anagram',
  ];

  const recentSubmissions = Array.from({ length: 15 }, (_, i) => ({
    id: `sub-${i}`,
    title: problemNames[randomInt(0, problemNames.length - 1)],
    difficulty: difficulties[randomInt(0, 2)],
    status: i < 10 ? statuses[0] : statuses[randomInt(0, 3)],
    timestamp: daysAgo(randomInt(0, 14)).toISOString(),
    language: languages[randomInt(0, languages.length - 1)],
  }));

  return {
    totalSolved,
    totalAvailable: 2850,
    acceptanceRate: Math.round((totalSolved / totalSubmissions) * 100 * 10) / 10,
    totalSubmissions,
    difficulty: {
      easy: { solved: easySolved, total: 750 },
      medium: { solved: mediumSolved, total: 1500 },
      hard: { solved: hardSolved, total: 600 },
    },
    recentSubmissions,
  };
}

// ── Activity Summary ──────────────────────────────────────────

function generateActivitySummary(): ActivitySummary {
  return {
    totalSessions: randomInt(150, 400),
    avgSessionDuration: randomInt(25, 90),
    totalActiveTime: randomInt(5000, 15000),
    totalIdleTime: randomInt(500, 2000),
    mostVisitedPages: [
      { page: 'Quiz', count: randomInt(80, 200) },
      { page: 'Interview', count: randomInt(60, 150) },
      { page: 'Resume Builder', count: randomInt(40, 120) },
      { page: 'Career Intelligence', count: randomInt(30, 100) },
      { page: 'Learning Hub', count: randomInt(20, 80) },
      { page: 'Reasoning', count: randomInt(15, 60) },
    ],
    mostUsedFeatures: [
      { feature: 'Quiz Solving', count: randomInt(100, 300) },
      { feature: 'Mock Interview', count: randomInt(50, 150) },
      { feature: 'Resume Analysis', count: randomInt(30, 100) },
      { feature: 'Code Execution', count: randomInt(40, 120) },
      { feature: 'AI Chat', count: randomInt(60, 200) },
      { feature: 'Roadmap', count: randomInt(20, 80) },
    ],
    activeDays: randomInt(80, 250),
  };
}

// ── Time Analytics ────────────────────────────────────────────

function generateTimeAnalytics(): TimeAnalyticsData {
  const dailyUsage = Array.from({ length: 30 }, (_, i) => {
    const totalMinutes = randomInt(10, 180);
    return {
      date: formatDate(daysAgo(29 - i)),
      totalMinutes,
      activeMinutes: Math.round(totalMinutes * (0.6 + Math.random() * 0.3)),
    };
  });

  const weeklyTrends = Array.from({ length: 12 }, (_, i) => ({
    week: `W${i + 1}`,
    weekStart: formatDate(daysAgo((11 - i) * 7)),
    totalHours: Math.round((randomInt(5, 25) + Math.random()) * 10) / 10,
    avgDailyMinutes: randomInt(20, 120),
  }));

  const featureColors = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const features = ['Quiz & Problems', 'Interviews', 'Resume Building', 'Learning', 'Code Practice', 'AI Tools'];
  const totalMins = randomInt(3000, 8000);
  let remaining = 100;
  
  const featureTimeSpent = features.map((feature, i) => {
    const pct = i === features.length - 1 ? remaining : randomInt(8, Math.min(35, remaining - (features.length - i - 1) * 5));
    remaining -= pct;
    return {
      feature,
      minutes: Math.round(totalMins * pct / 100),
      percentage: pct,
      color: featureColors[i],
    };
  });

  return {
    dailyUsage,
    weeklyTrends,
    featureTimeSpent,
    totalHoursThisWeek: Math.round((randomInt(8, 25) + Math.random()) * 10) / 10,
    totalHoursThisMonth: Math.round((randomInt(40, 120) + Math.random()) * 10) / 10,
    avgDailyMinutes: randomInt(30, 120),
    peakHour: randomInt(19, 23),
    peakDay: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][randomInt(0, 4)],
  };
}

// ── Topic / Skill Bubble Map ──────────────────────────────────

function generateTopicMap(): TopicMapData {
  const topicsData: { name: string; category: string; color: string }[] = [
    { name: 'Arrays', category: 'DSA', color: '#6366f1' },
    { name: 'Linked Lists', category: 'DSA', color: '#8b5cf6' },
    { name: 'Trees', category: 'DSA', color: '#a855f7' },
    { name: 'Graphs', category: 'DSA', color: '#7c3aed' },
    { name: 'Dynamic Programming', category: 'DSA', color: '#6d28d9' },
    { name: 'Sorting', category: 'DSA', color: '#5b21b6' },
    { name: 'Binary Search', category: 'DSA', color: '#4c1d95' },
    { name: 'React', category: 'Web', color: '#06b6d4' },
    { name: 'Node.js', category: 'Web', color: '#0891b2' },
    { name: 'TypeScript', category: 'Web', color: '#0e7490' },
    { name: 'Python', category: 'AI/ML', color: '#10b981' },
    { name: 'Machine Learning', category: 'AI/ML', color: '#059669' },
    { name: 'Deep Learning', category: 'AI/ML', color: '#047857' },
    { name: 'SQL', category: 'Database', color: '#f59e0b' },
    { name: 'System Design', category: 'Architecture', color: '#ef4444' },
    { name: 'OOP', category: 'Fundamentals', color: '#ec4899' },
    { name: 'Recursion', category: 'DSA', color: '#9333ea' },
    { name: 'Hashing', category: 'DSA', color: '#7e22ce' },
  ];

  const levels: TopicBubble['proficiencyLevel'][] = ['beginner', 'intermediate', 'advanced', 'expert'];

  const topics: TopicBubble[] = topicsData.map((t, i) => {
    const problemsSolved = randomInt(5, 80);
    const timeSpentMinutes = randomInt(60, 1200);
    const proficiencyScore = randomInt(20, 95);
    const proficiencyLevel = proficiencyScore < 30 ? 'beginner' : proficiencyScore < 55 ? 'intermediate' : proficiencyScore < 80 ? 'advanced' : 'expert';

    return {
      id: `topic-${i}`,
      name: t.name,
      category: t.category,
      problemsSolved,
      timeSpentMinutes,
      proficiencyLevel,
      proficiencyScore,
      color: t.color,
      size: Math.max(30, Math.min(100, problemsSolved * 1.2)),
    };
  });

  const sorted = [...topics].sort((a, b) => b.proficiencyScore - a.proficiencyScore);

  return {
    topics,
    totalTopics: topics.length,
    strongestTopic: sorted[0].name,
    weakestTopic: sorted[sorted.length - 1].name,
  };
}

// ── Streak Data ───────────────────────────────────────────────

function generateStreakData(): StreakData {
  const currentStreak = randomInt(5, 45);
  const longestStreak = Math.max(currentStreak, randomInt(30, 90));
  const now = new Date();
  const hoursLeft = 24 - now.getHours() + (now.getMinutes() > 0 ? -1 : 0);

  const streakHistory = Array.from({ length: 30 }, (_, i) => ({
    date: formatDate(daysAgo(29 - i)),
    active: i >= (30 - currentStreak) ? true : Math.random() > 0.3,
  }));

  const weeklyActivity = Array.from({ length: 7 }, () => randomInt(1, 15));

  return {
    currentStreak,
    longestStreak,
    lastActiveDate: formatDate(new Date()),
    streakHistory,
    isAtRisk: hoursLeft < 6,
    hoursUntilReset: Math.max(0, hoursLeft),
    totalActiveDays: randomInt(120, 300),
    weeklyActivity,
  };
}

// ── Badge & Achievement System ────────────────────────────────

function generateBadges(): BadgeSystemData {
  const allBadges: Badge[] = [
    // Streak badges
    { id: 'b1', name: 'First Flame', description: 'Maintain a 3-day streak', icon: '🔥', category: 'streak', rarity: 'common', isUnlocked: true, unlockedAt: daysAgo(60).toISOString(), progress: 100, requirement: '3-day streak', requirementValue: 3, currentValue: 3 },
    { id: 'b2', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '⚡', category: 'streak', rarity: 'common', isUnlocked: true, unlockedAt: daysAgo(45).toISOString(), progress: 100, requirement: '7-day streak', requirementValue: 7, currentValue: 7 },
    { id: 'b3', name: 'Fortnight Fighter', description: 'Maintain a 14-day streak', icon: '💫', category: 'streak', rarity: 'rare', isUnlocked: true, unlockedAt: daysAgo(30).toISOString(), progress: 100, requirement: '14-day streak', requirementValue: 14, currentValue: 14 },
    { id: 'b4', name: 'Monthly Master', description: 'Maintain a 30-day streak', icon: '🌟', category: 'streak', rarity: 'epic', isUnlocked: true, unlockedAt: daysAgo(10).toISOString(), progress: 100, requirement: '30-day streak', requirementValue: 30, currentValue: 30 },
    { id: 'b5', name: 'Century Legend', description: 'Maintain a 100-day streak', icon: '👑', category: 'streak', rarity: 'legendary', isUnlocked: false, unlockedAt: null, progress: 42, requirement: '100-day streak', requirementValue: 100, currentValue: 42 },

    // Problem badges
    { id: 'b6', name: 'Problem Starter', description: 'Solve 10 problems', icon: '🎯', category: 'problems', rarity: 'common', isUnlocked: true, unlockedAt: daysAgo(90).toISOString(), progress: 100, requirement: '10 problems', requirementValue: 10, currentValue: 10 },
    { id: 'b7', name: 'Half Century', description: 'Solve 50 problems', icon: '🏅', category: 'problems', rarity: 'common', isUnlocked: true, unlockedAt: daysAgo(70).toISOString(), progress: 100, requirement: '50 problems', requirementValue: 50, currentValue: 50 },
    { id: 'b8', name: 'Century Club', description: 'Solve 100 problems', icon: '💎', category: 'problems', rarity: 'rare', isUnlocked: true, unlockedAt: daysAgo(40).toISOString(), progress: 100, requirement: '100 problems', requirementValue: 100, currentValue: 100 },
    { id: 'b9', name: 'Problem Slayer', description: 'Solve 250 problems', icon: '⚔️', category: 'problems', rarity: 'epic', isUnlocked: false, unlockedAt: null, progress: 72, requirement: '250 problems', requirementValue: 250, currentValue: 180 },
    { id: 'b10', name: 'Grandmaster', description: 'Solve 500 problems', icon: '🏆', category: 'problems', rarity: 'legendary', isUnlocked: false, unlockedAt: null, progress: 36, requirement: '500 problems', requirementValue: 500, currentValue: 180 },

    // Consistency badges
    { id: 'b11', name: 'Early Bird', description: 'Log in before 7 AM', icon: '🌅', category: 'consistency', rarity: 'common', isUnlocked: true, unlockedAt: daysAgo(55).toISOString(), progress: 100, requirement: 'Login before 7AM', requirementValue: 1, currentValue: 1 },
    { id: 'b12', name: 'Night Owl', description: 'Active past midnight', icon: '🦉', category: 'consistency', rarity: 'common', isUnlocked: true, unlockedAt: daysAgo(50).toISOString(), progress: 100, requirement: 'Active after midnight', requirementValue: 1, currentValue: 1 },
    { id: 'b13', name: 'Weekend Warrior', description: 'Active on 10 weekends', icon: '🎮', category: 'consistency', rarity: 'rare', isUnlocked: false, unlockedAt: null, progress: 80, requirement: '10 active weekends', requirementValue: 10, currentValue: 8 },

    // Mastery badges
    { id: 'b14', name: 'DSA Apprentice', description: 'Solve 30 DSA problems', icon: '🧩', category: 'mastery', rarity: 'rare', isUnlocked: true, unlockedAt: daysAgo(25).toISOString(), progress: 100, requirement: '30 DSA problems', requirementValue: 30, currentValue: 30 },
    { id: 'b15', name: 'Hard Mode Hero', description: 'Solve 10 hard problems', icon: '🔴', category: 'mastery', rarity: 'epic', isUnlocked: false, unlockedAt: null, progress: 60, requirement: '10 hard problems', requirementValue: 10, currentValue: 6 },
    { id: 'b16', name: 'Speed Demon', description: 'Solve 5 problems in one session', icon: '⏱️', category: 'mastery', rarity: 'epic', isUnlocked: true, unlockedAt: daysAgo(15).toISOString(), progress: 100, requirement: '5 problems in 1 session', requirementValue: 5, currentValue: 5 },

    // Special badges
    { id: 'b17', name: 'Comeback Kid', description: 'Return after 7+ days away', icon: '🔄', category: 'special', rarity: 'rare', isUnlocked: true, unlockedAt: daysAgo(80).toISOString(), progress: 100, requirement: 'Return after break', requirementValue: 1, currentValue: 1 },
    { id: 'b18', name: 'Polyglot', description: 'Solve problems in 3+ languages', icon: '🌐', category: 'special', rarity: 'epic', isUnlocked: false, unlockedAt: null, progress: 66, requirement: '3 languages used', requirementValue: 3, currentValue: 2 },
  ];

  const unlocked = allBadges.filter(b => b.isUnlocked);
  const locked = allBadges.filter(b => !b.isUnlocked).sort((a, b) => b.progress - a.progress);
  const recentlyUnlocked = unlocked.sort((a, b) => 
    new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime()
  ).slice(0, 3);

  return {
    badges: allBadges,
    totalUnlocked: unlocked.length,
    totalBadges: allBadges.length,
    recentlyUnlocked,
    nextToUnlock: locked[0] || null,
  };
}

// ── Intelligent Insights ──────────────────────────────────────

function generateIntelligence(): IntelligenceData {
  const activeHours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    activity: hour >= 9 && hour <= 23
      ? randomInt(10, 100) * (hour >= 19 && hour <= 22 ? 2 : 1)
      : randomInt(0, 15),
  }));

  return {
    insights: [
      {
        id: 'i1', type: 'pattern', title: 'Night Owl Pattern Detected',
        description: 'You are most productive between 8 PM and 11 PM. Your problem-solving accuracy peaks during these hours.',
        icon: '🦉', priority: 'medium', actionable: false,
      },
      {
        id: 'i2', type: 'suggestion', title: 'Focus on Hard Problems',
        description: 'You\'ve mastered easy problems (95% acceptance). Challenge yourself with more hard-level problems to accelerate growth.',
        icon: '🎯', priority: 'high', actionable: true, action: 'Start a Hard Problem',
      },
      {
        id: 'i3', type: 'achievement', title: 'Consistency Streak Rising!',
        description: 'You\'ve been active for 14+ consecutive days. You\'re in the top 5% of consistent learners.',
        icon: '🔥', priority: 'medium', actionable: false,
      },
      {
        id: 'i4', type: 'warning', title: 'Streak at Risk',
        description: 'You haven\'t logged any activity today yet. Complete at least one task to maintain your streak!',
        icon: '⚠️', priority: 'high', actionable: true, action: 'Solve a Problem',
      },
      {
        id: 'i5', type: 'prediction', title: 'Growth Trajectory',
        description: 'At your current pace, you\'ll reach 250 solved problems in approximately 3 weeks. Keep pushing!',
        icon: '📈', priority: 'low', actionable: false,
      },
      {
        id: 'i6', type: 'suggestion', title: 'Explore Graph Algorithms',
        description: 'Graph problems are your weakest area. Spending 30 mins/day on graphs could boost your overall score by 15%.',
        icon: '🧠', priority: 'high', actionable: true, action: 'Start Graph Practice',
      },
    ],
    activeHours,
    consistencyScore: randomInt(65, 92),
    growthRate: Math.round((randomInt(5, 25) + Math.random()) * 10) / 10,
    predictedStreakBreak: Math.random() > 0.7,
    suggestedFocusAreas: ['Graph Algorithms', 'Dynamic Programming', 'System Design'],
  };
}

// ══════════════════════════════════════════════════════════════
// Public API — Single entry point for all dashboard data
// ══════════════════════════════════════════════════════════════

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

// ── Future: Real API integration ──────────────────────────────
// Replace mock generators with actual API calls:
//
// import axios from 'axios';
// const API_BASE = import.meta.env.VITE_API_URL || '';
//
// export async function fetchProgressDashboard(): Promise<ProgressDashboardData> {
//   const { data } = await axios.get(`${API_BASE}/api/v1/progress-intelligence/dashboard`);
//   return data;
// }
