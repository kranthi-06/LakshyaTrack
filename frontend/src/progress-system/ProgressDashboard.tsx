import {
  Suspense,
  lazy,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock3,
  Database,
  Flame,
  Gauge,
  LayoutDashboard,
  MousePointerClick,
  Radio,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { getApiHealthStatus } from '../services/api';
import { PROGRESS_UPDATE_EVENT, getSessionId } from './services/eventTracker';
import {
  fetchDashboard,
  getProgressDashboardData,
  subscribeToProgressUpdates,
  type ProgressStreamMessage,
} from './services/progressApi';
import type { ProgressDashboardData } from './types';
import LayoutWrapper from './components/LayoutWrapper';
import Sidebar, {
  type DashboardSection,
  type DetailLevel,
  type SidebarItem,
} from './components/Sidebar';
import HeaderBar, { type HeaderSummaryItem } from './components/HeaderBar';
import StatCard from './components/StatCard';
import ChartContainer from './components/ChartContainer';
import './dashboard-theme.css';

const ActivityFeed = lazy(() => import('./components/ActivityFeed'));
const BubbleMap = lazy(() => import('./components/BubbleMap'));
const InsightPanel = lazy(() => import('./components/InsightPanel'));

const SIDEBAR_STORAGE_KEY = 'lakshyatrack:progress-intelligence-sidebar-collapsed';
const SESSION_START_PREFIX = 'lakshyatrack:progress-intelligence-session-start:';
const LIVE_MESSAGE_LIMIT = 12;

type TimeGranularity = 'daily' | 'weekly';

interface FeatureBubbleDatum {
  id: string;
  label: string;
  category: string;
  minutes: number;
  intensity: number;
  share: number;
  color: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  practice: { label: 'Practice', color: '#4f46e5' },
  learning: { label: 'Learning', color: '#0ea5e9' },
  career: { label: 'Career', color: '#14b8a6' },
  interview: { label: 'Interview', color: '#f59e0b' },
  navigation: { label: 'Navigation', color: '#f97316' },
  productivity: { label: 'Productivity', color: '#ec4899' },
};

const NAV_ICON_MAP: Record<DashboardSection, LucideIcon> = {
  overview: LayoutDashboard,
  realtime: Radio,
  time: Clock3,
  insights: Sparkles,
  reports: BarChart3,
};

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)}h`;
  }
  return `${Math.round(minutes)}m`;
}

function formatHours(hours: number): string {
  return `${hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)}h`;
}

function formatSessionDuration(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function relativeTimeLabel(timestamp: string): string {
  const value = new Date(timestamp).getTime();
  if (Number.isNaN(value)) return 'just now';
  const deltaSeconds = Math.max(0, Math.round((Date.now() - value) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  if (deltaSeconds < 3600) return `${Math.round(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 86400) return `${Math.round(deltaSeconds / 3600)}h ago`;
  return `${Math.round(deltaSeconds / 86400)}d ago`;
}

function getGreetingName(user: ReturnType<typeof useAuth>['user']): string {
  return user?.profile?.full_name || user?.full_name || user?.email?.split('@')[0] || 'there';
}

function getTodayContribution(data: ProgressDashboardData): number {
  const today = new Date().toISOString().slice(0, 10);
  const match = data.contributions.contributions.find((entry) => entry.date === today);
  return match?.count || 0;
}

function deriveCategoryName(feature: string): keyof typeof CATEGORY_CONFIG {
  const normalized = feature.toLowerCase();
  if (normalized.includes('quiz') || normalized.includes('learn')) return 'learning';
  if (normalized.includes('interview')) return 'interview';
  if (normalized.includes('resume') || normalized.includes('roadmap') || normalized.includes('career')) return 'career';
  if (normalized.includes('visit') || normalized.includes('page') || normalized.includes('dashboard')) return 'navigation';
  if (normalized.includes('solve') || normalized.includes('code') || normalized.includes('problem')) return 'practice';
  return 'productivity';
}

function computeEngagementScore(data: ProgressDashboardData): number {
  const totalTime = data.activity.totalActiveTime + data.activity.totalIdleTime;
  const activeRatio = totalTime > 0 ? data.activity.totalActiveTime / totalTime : 0;
  const streakScore = Math.min(data.streak.currentStreak / 30, 1);
  const problemScore = Math.min(data.problemSolving.totalSolved / 40, 1);
  const consistencyScore = Math.min(data.intelligence.consistencyScore / 100, 1);
  return Math.round(
    (activeRatio * 0.34 + streakScore * 0.22 + problemScore * 0.2 + consistencyScore * 0.24) * 100,
  );
}

function buildFeatureBubbles(data: ProgressDashboardData): FeatureBubbleDatum[] {
  const featureTime = data.timeAnalytics.featureTimeSpent;
  if (featureTime.length > 0) {
    return featureTime
      .map((feature) => {
        const categoryKey = deriveCategoryName(feature.feature);
        const category = CATEGORY_CONFIG[categoryKey];
        return {
          id: feature.feature.toLowerCase().replace(/\s+/g, '-'),
          label: feature.feature,
          category: category.label,
          minutes: feature.minutes,
          intensity: Math.max(feature.percentage * 1.2, feature.minutes),
          share: feature.percentage,
          color: category.color,
        };
      })
      .sort((left, right) => right.minutes - left.minutes);
  }

  const totalCount = data.activity.mostUsedFeatures.reduce((sum, entry) => sum + entry.count, 0) || 1;
  return data.activity.mostUsedFeatures
    .map((feature) => {
      const categoryKey = deriveCategoryName(feature.feature);
      const category = CATEGORY_CONFIG[categoryKey];
      return {
        id: feature.feature.toLowerCase().replace(/\s+/g, '-'),
        label: feature.feature,
        category: category.label,
        minutes: feature.count * 4,
        intensity: feature.count * 10,
        share: (feature.count / totalCount) * 100,
        color: category.color,
      };
    })
    .sort((left, right) => right.share - left.share);
}

function buildHeatmapRows(data: ProgressDashboardData): { date: string; count: number; level: number }[][] {
  const recent = data.contributions.contributions.slice(-84);
  const rows: { date: string; count: number; level: number }[][] = [];

  recent.forEach((entry, index) => {
    const rowIndex = Math.floor(index / 7);
    rows[rowIndex] ||= [];
    rows[rowIndex].push({ date: entry.date, count: entry.count, level: entry.level });
  });

  return rows;
}

function SectionSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-[28px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)]"
      style={{ minHeight: height }}
    />
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-6 text-sm text-[var(--pi-text-soft)]">
      {label}
    </div>
  );
}

export default function ProgressDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<ProgressDashboardData>(() => getProgressDashboardData());
  const deferredData = useDeferredValue(data);
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('overview');
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>('daily');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [refreshToken, setRefreshToken] = useState(0);
  const [streamMessages, setStreamMessages] = useState<ProgressStreamMessage[]>([]);
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState(() => new Date().toISOString());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  });
  const [sessionStartedAt, setSessionStartedAt] = useState(() => Date.now());
  const [sessionElapsedMs, setSessionElapsedMs] = useState(0);

  const applyFreshData = useCallback((freshData: ProgressDashboardData) => {
    startTransition(() => {
      setData(freshData);
      setLastSyncAt(freshData.lastUpdated || new Date().toISOString());
      setRefreshToken((value) => value + 1);
    });
  }, []);

  const refreshDashboard = useCallback(async (showSpinner = false) => {
    if (showSpinner) {
      setIsRefreshing(true);
    }

    try {
      const freshData = await fetchDashboard(true);
      applyFreshData(freshData);
    } catch {
      applyFreshData(getProgressDashboardData(true));
    } finally {
      setIsLoading(false);
      if (showSpinner) {
        setIsRefreshing(false);
      }
    }
  }, [applyFreshData]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const freshData = await fetchDashboard();
        if (!cancelled) {
          applyFreshData(freshData);
        }
      } catch {
        if (!cancelled) {
          applyFreshData(getProgressDashboardData(true));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [applyFreshData]);

  useEffect(() => {
    const sessionId = getSessionId();
    const storageKey = `${SESSION_START_PREFIX}${sessionId}`;
    const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(storageKey) : null;
    const createdAt = stored ? Number(stored) : Date.now();

    if (typeof sessionStorage !== 'undefined' && !stored) {
      sessionStorage.setItem(storageKey, String(createdAt));
    }

    setSessionStartedAt(createdAt);
    setSessionElapsedMs(Math.max(0, Date.now() - createdAt));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSessionElapsedMs(Math.max(0, Date.now() - sessionStartedAt));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [sessionStartedAt]);

  useEffect(() => {
    let fallbackPollId: number | null = null;
    let refreshDebounceId: number | null = null;

    const scheduleRefresh = () => {
      if (refreshDebounceId !== null) {
        window.clearTimeout(refreshDebounceId);
      }
      refreshDebounceId = window.setTimeout(() => {
        void refreshDashboard(false);
      }, 280);
    };

    const startFallbackPolling = () => {
      if (fallbackPollId !== null) return;
      fallbackPollId = window.setInterval(() => {
        if (!document.hidden && navigator.onLine) {
          void refreshDashboard(false);
        }
      }, 30000);
    };

    const stopFallbackPolling = () => {
      if (fallbackPollId !== null) {
        window.clearInterval(fallbackPollId);
        fallbackPollId = null;
      }
    };

    const handleProgressUpdate = () => {
      scheduleRefresh();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        scheduleRefresh();
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      scheduleRefresh();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsLive(false);
      startFallbackPolling();
    };

    window.addEventListener(PROGRESS_UPDATE_EVENT, handleProgressUpdate as EventListener);
    window.addEventListener('focus', handleProgressUpdate);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    const disconnectStream = subscribeToProgressUpdates({
      onOpen: () => {
        setIsLive(true);
        stopFallbackPolling();
      },
      onMessage: (message) => {
        setIsLive(true);
        setStreamMessages((previous) => [message, ...previous].slice(0, LIVE_MESSAGE_LIMIT));
        scheduleRefresh();
      },
      onError: () => {
        setIsLive(false);
        startFallbackPolling();
      },
    });

    startFallbackPolling();

    return () => {
      disconnectStream();
      stopFallbackPolling();
      window.removeEventListener(PROGRESS_UPDATE_EVENT, handleProgressUpdate as EventListener);
      window.removeEventListener('focus', handleProgressUpdate);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (refreshDebounceId !== null) {
        window.clearTimeout(refreshDebounceId);
      }
    };
  }, [refreshDashboard]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const featureBubbles = useMemo(() => buildFeatureBubbles(deferredData), [deferredData]);

  useEffect(() => {
    if (featureBubbles.length === 0) {
      setSelectedBubbleId(null);
      return;
    }

    setSelectedBubbleId((current) => {
      if (current && featureBubbles.some((item) => item.id === current)) {
        return current;
      }
      return featureBubbles[0].id;
    });
  }, [featureBubbles]);

  const selectedBubble = useMemo(
    () => featureBubbles.find((item) => item.id === selectedBubbleId) ?? featureBubbles[0],
    [featureBubbles, selectedBubbleId],
  );

  const timeSeries = useMemo(() => {
    if (timeGranularity === 'weekly') {
      return deferredData.timeAnalytics.weeklyTrends.slice(-8).map((entry) => ({
        label: entry.week,
        total: Number(entry.totalHours.toFixed(2)),
        active: Number((entry.avgDailyMinutes / 60).toFixed(2)),
      }));
    }

    return deferredData.timeAnalytics.dailyUsage.slice(-14).map((entry) => ({
      label: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      total: Number((entry.totalMinutes / 60).toFixed(2)),
      active: Number((entry.activeMinutes / 60).toFixed(2)),
    }));
  }, [deferredData.timeAnalytics.dailyUsage, deferredData.timeAnalytics.weeklyTrends, timeGranularity]);

  const featureUsageBars = useMemo(
    () =>
      featureBubbles.slice(0, detailLevel === 'deep' ? 8 : 6).map((feature) => ({
        label: feature.label,
        minutes: feature.minutes,
        share: Number(feature.share.toFixed(1)),
        color: feature.color,
      })),
    [detailLevel, featureBubbles],
  );

  const sessionHealthData = useMemo(
    () => [
      { label: 'Active', value: deferredData.activity.totalActiveTime, color: '#10b981' },
      { label: 'Idle', value: deferredData.activity.totalIdleTime, color: '#f59e0b' },
    ],
    [deferredData.activity.totalActiveTime, deferredData.activity.totalIdleTime],
  );

  const insightScoreBars = useMemo(
    () => [
      { label: 'Engagement', value: computeEngagementScore(deferredData), color: '#4f46e5' },
      { label: 'Consistency', value: deferredData.intelligence.consistencyScore, color: '#0ea5e9' },
      { label: 'Growth', value: Math.max(0, Math.min(100, deferredData.intelligence.growthRate + 50)), color: '#14b8a6' },
      { label: 'Streak strength', value: Math.min(100, deferredData.streak.currentStreak * 4), color: '#f59e0b' },
    ],
    [deferredData],
  );

  const heatmapRows = useMemo(() => buildHeatmapRows(deferredData), [deferredData]);
  const engagementScore = useMemo(() => computeEngagementScore(deferredData), [deferredData]);
  const todayMinutes = deferredData.timeAnalytics.dailyUsage[deferredData.timeAnalytics.dailyUsage.length - 1]?.activeMinutes || 0;
  const todayActivity = getTodayContribution(deferredData);
  const mostUsedFeature = featureBubbles[0]?.label || deferredData.activity.mostUsedFeatures[0]?.feature || 'No feature data yet';
  const apiHealth = getApiHealthStatus();

  const statusTone = !isOnline ? 'offline' : isLoading || isRefreshing || !isLive ? 'syncing' : 'active';
  const statusLabel = !isOnline ? 'Offline' : statusTone === 'active' ? 'Active' : 'Syncing';
  const statusDetail = !isOnline
    ? 'Working from the latest synchronized snapshot'
    : isLive
      ? 'Realtime stream healthy and reconciling instantly'
      : 'Fallback refresh is keeping analytics current';

  const headerSummary = useMemo<HeaderSummaryItem[]>(
    () => [
      { label: "Today's activity", value: `${todayActivity} events`, helper: `${formatMinutes(todayMinutes)} active focus time` },
      { label: 'Engagement score', value: `${engagementScore}`, helper: 'Composite realtime quality score' },
      { label: 'Current streak', value: `${deferredData.streak.currentStreak} days`, helper: `${deferredData.streak.longestStreak} days personal best` },
      { label: 'Focus feature', value: mostUsedFeature, helper: `${featureBubbles[0]?.share.toFixed(0) || 0}% share of tracked usage` },
    ],
    [deferredData.streak.currentStreak, deferredData.streak.longestStreak, engagementScore, featureBubbles, mostUsedFeature, todayActivity, todayMinutes],
  );

  const sidebarItems = useMemo<SidebarItem[]>(
    () => [
      { id: 'overview', label: 'Overview', description: 'Executive view of progress health', icon: NAV_ICON_MAP.overview },
      { id: 'realtime', label: 'Real-Time Activity', description: 'Live events, navigation, and session quality', icon: NAV_ICON_MAP.realtime, badge: statusLabel },
      { id: 'time', label: 'Time Analytics', description: 'Usage trends, active minutes, and feature depth', icon: NAV_ICON_MAP.time },
      { id: 'insights', label: 'Engagement Insights', description: 'Feature adoption, focus areas, and anomalies', icon: NAV_ICON_MAP.insights },
      { id: 'reports', label: 'Reports', description: 'Contribution heatmap, milestones, and exports', icon: NAV_ICON_MAP.reports, badge: `${deferredData.badges.totalUnlocked}` },
    ],
    [deferredData.badges.totalUnlocked, statusLabel],
  );

  const statsRow = (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      <StatCard
        title="Total tracked time"
        value={formatMinutes(deferredData.activity.totalActiveTime)}
        subtitle="Active engagement time across the current intelligence window"
        helper={`${formatMinutes(deferredData.activity.totalIdleTime)} idle time observed`}
        icon={<Gauge className="h-5 w-5" />}
        tone="accent"
      />
      <StatCard
        title="Most used feature"
        value={mostUsedFeature}
        subtitle="Current top feature by share of tracked engagement"
        helper={`${featureBubbles[0]?.share.toFixed(0) || 0}% of total feature usage`}
        icon={<Target className="h-5 w-5" />}
        tone="success"
      />
      <StatCard
        title="Engagement score"
        value={`${engagementScore}/100`}
        subtitle="Realtime blended score for quality, depth, and consistency"
        helper={`Consistency score ${deferredData.intelligence.consistencyScore}/100`}
        icon={<Zap className="h-5 w-5" />}
        tone="warning"
      />
      <StatCard
        title="Streak resilience"
        value={`${deferredData.streak.currentStreak} days`}
        subtitle={deferredData.streak.isAtRisk ? 'At risk before reset' : 'Healthy learning cadence'}
        helper={`${deferredData.streak.hoursUntilReset}h until daily reset`}
        icon={<Flame className="h-5 w-5" />}
        tone={deferredData.streak.isAtRisk ? 'danger' : 'accent'}
      />
    </div>
  );

  const chartModeToggle = (
    <div className="flex rounded-full border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-1">
      {(['daily', 'weekly'] as TimeGranularity[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => setTimeGranularity(mode)}
          className={`rounded-full px-3 py-2 text-xs font-semibold ${
            timeGranularity === mode
              ? 'bg-[var(--pi-accent-soft)] text-[var(--pi-text)]'
              : 'text-[var(--pi-text-soft)]'
          }`}
        >
          {mode === 'daily' ? 'Daily' : 'Weekly'}
        </button>
      ))}
    </div>
  );

  const sharedTooltipStyle = {
    backgroundColor: 'var(--pi-surface-strong)',
    borderColor: 'var(--pi-border)',
    borderRadius: 16,
    color: 'var(--pi-text)',
  };

  const renderOverview = () => (
    <div className="space-y-4 lg:space-y-6">
      {statsRow}

      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <ChartContainer
          eyebrow="Realtime"
          title="Activity command stream"
          description="Live feed of user actions, pipeline reconciliation, and session telemetry."
        >
          <Suspense fallback={<SectionSkeleton height={360} />}>
            <ActivityFeed
              detailLevel={detailLevel}
              refreshToken={refreshToken}
              streamMessages={streamMessages}
              status={statusTone}
              variant="compact"
            />
          </Suspense>
        </ChartContainer>

        <ChartContainer
          eyebrow="Feature intelligence"
          title="Engagement bubble map"
          description="Each bubble represents feature usage, engagement share, and interaction intensity."
        >
          <Suspense fallback={<SectionSkeleton height={360} />}>
            <BubbleMap
              detailLevel={detailLevel}
              items={featureBubbles}
              selectedId={selectedBubbleId}
              onSelect={setSelectedBubbleId}
            />
          </Suspense>
        </ChartContainer>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <ChartContainer
          eyebrow="Usage trend"
          title="Realtime time analytics"
          description="Live usage trend with active time separated from total tracked time."
          action={chartModeToggle}
        >
          {timeSeries.length > 0 ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeries}>
                  <defs>
                    <linearGradient id="overview-total" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.42} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="overview-active" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--pi-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="var(--pi-text-soft)" tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--pi-text-soft)" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={sharedTooltipStyle} />
                  <Area type="monotone" dataKey="total" stroke="#4f46e5" fill="url(#overview-total)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="active" stroke="#14b8a6" fill="url(#overview-active)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState label="Time analytics will start rendering here once tracked usage data arrives." />
          )}
        </ChartContainer>

        <ChartContainer
          eyebrow="Feature comparison"
          title="Interaction intensity"
          description="Top features ranked by minutes tracked and usage share."
        >
          {featureUsageBars.length > 0 ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureUsageBars}>
                  <CartesianGrid stroke="var(--pi-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="var(--pi-text-soft)" tickLine={false} axisLine={false} hide />
                  <YAxis stroke="var(--pi-text-soft)" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={sharedTooltipStyle} />
                  <Bar dataKey="minutes" radius={[12, 12, 0, 0]}>
                    {featureUsageBars.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState label="Feature comparison cards will light up once the system has enough interaction history." />
          )}
        </ChartContainer>
      </div>
    </div>
  );

  const renderRealtime = () => (
    <div className="space-y-4 lg:space-y-6">
      {statsRow}

      <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <ChartContainer
          eyebrow="Realtime feed"
          title="Live activity telemetry"
          description="High-fidelity event updates with stream-aware reconciliation."
        >
          <Suspense fallback={<SectionSkeleton height={480} />}>
            <ActivityFeed
              detailLevel={detailLevel}
              refreshToken={refreshToken}
              streamMessages={streamMessages}
              status={statusTone}
            />
          </Suspense>
        </ChartContainer>

        <div className="space-y-4">
          <ChartContainer
            eyebrow="Session quality"
            title="Active vs idle profile"
            description="Track focus quality and idle pressure for the current analytics window."
          >
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionHealthData}>
                  <CartesianGrid stroke="var(--pi-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="var(--pi-text-soft)" tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--pi-text-soft)" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={sharedTooltipStyle} />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                    {sessionHealthData.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartContainer>

          <ChartContainer
            eyebrow="Navigation flow"
            title="Most visited surfaces"
            description="High-volume navigation destinations ranked by revisit frequency."
          >
            <div className="space-y-3">
              {deferredData.activity.mostVisitedPages.slice(0, detailLevel === 'deep' ? 6 : 4).map((page, index) => (
                <div key={page.page} className="flex items-center justify-between gap-3 rounded-[20px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--pi-text)]">{page.page}</div>
                    <div className="text-xs text-[var(--pi-text-soft)]">Navigation hotspot #{index + 1}</div>
                  </div>
                  <div className="rounded-full bg-[var(--pi-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--pi-accent)]">
                    {page.count} visits
                  </div>
                </div>
              ))}
              {deferredData.activity.mostVisitedPages.length === 0 && (
                <EmptyState label="Navigation flow will appear after the tracker observes page movement." />
              )}
            </div>
          </ChartContainer>
        </div>
      </div>

      <ChartContainer
        eyebrow="Interaction pulse"
        title="Feature interaction frequency"
        description="Top interaction surfaces and how often users engage with them."
      >
        {deferredData.activity.mostUsedFeatures.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {deferredData.activity.mostUsedFeatures.slice(0, detailLevel === 'deep' ? 8 : 4).map((feature) => (
              <div key={feature.feature} className="rounded-[22px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--pi-text)]">{feature.feature}</div>
                    <div className="mt-1 text-xs text-[var(--pi-text-soft)]">Tracked interactions</div>
                  </div>
                  <MousePointerClick className="h-4 w-4 text-[var(--pi-accent)]" />
                </div>
                <div className="mt-4 text-2xl font-semibold text-[var(--pi-text)]">{feature.count}</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState label="Interaction frequency panels will populate once feature-level events are tracked." />
        )}
      </ChartContainer>
    </div>
  );

  const renderTimeAnalytics = () => (
    <div className="space-y-4 lg:space-y-6">
      {statsRow}

      <ChartContainer
        eyebrow="Time analytics"
        title="Usage trend explorer"
        description="Switch between daily and weekly resolution without resetting the live view."
        action={chartModeToggle}
      >
        {timeSeries.length > 0 ? (
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeries}>
                <CartesianGrid stroke="var(--pi-border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="var(--pi-text-soft)" tickLine={false} axisLine={false} />
                <YAxis stroke="var(--pi-text-soft)" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={sharedTooltipStyle} />
                <Line type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="active" stroke="#14b8a6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState label="Time trend lines are waiting for live usage to arrive." />
        )}
      </ChartContainer>

      <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
        <ChartContainer
          eyebrow="Time quality"
          title="Tracked hours and peak window"
          description="This is where exact page and feature dwell time becomes visible."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[22px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pi-text-soft)]">This week</div>
              <div className="mt-3 text-2xl font-semibold text-[var(--pi-text)]">
                {formatHours(deferredData.timeAnalytics.totalHoursThisWeek)}
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pi-text-soft)]">This month</div>
              <div className="mt-3 text-2xl font-semibold text-[var(--pi-text)]">
                {formatHours(deferredData.timeAnalytics.totalHoursThisMonth)}
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pi-text-soft)]">Average day</div>
              <div className="mt-3 text-2xl font-semibold text-[var(--pi-text)]">
                {formatMinutes(deferredData.timeAnalytics.avgDailyMinutes)}
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pi-text-soft)]">Peak activity</div>
              <div className="mt-3 text-2xl font-semibold text-[var(--pi-text)]">
                {deferredData.timeAnalytics.peakDay}
              </div>
              <div className="mt-1 text-xs text-[var(--pi-text-soft)]">{deferredData.timeAnalytics.peakHour}:00 local time</div>
            </div>
          </div>
        </ChartContainer>

        <ChartContainer
          eyebrow="Feature depth"
          title="Feature time allocation"
          description="Minutes spent per feature, normalized for fast comparison."
        >
          {featureUsageBars.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureUsageBars} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid stroke="var(--pi-border)" strokeDasharray="3 3" />
                  <XAxis type="number" stroke="var(--pi-text-soft)" tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" stroke="var(--pi-text-soft)" tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={sharedTooltipStyle} />
                  <Bar dataKey="minutes" radius={[0, 12, 12, 0]}>
                    {featureUsageBars.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState label="Feature depth analytics will appear when the tracker records feature-level dwell time." />
          )}
        </ChartContainer>
      </div>

      {detailLevel === 'deep' && deferredData.timeAnalytics.dailyUsage.length > 0 && (
        <ChartContainer
          eyebrow="Deep analysis"
          title="Recent usage ledger"
          description="Inspect day-level totals to validate tracking integrity and realtime accuracy."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-[var(--pi-text-soft)]">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Tracked</th>
                  <th className="px-3 py-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {deferredData.timeAnalytics.dailyUsage.slice(-10).reverse().map((entry) => (
                  <tr key={entry.date} className="border-t border-[var(--pi-border)]">
                    <td className="px-3 py-3 text-[var(--pi-text)]">
                      {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-3 py-3 text-[var(--pi-text-soft)]">{formatMinutes(entry.totalMinutes)}</td>
                    <td className="px-3 py-3 text-[var(--pi-text-soft)]">{formatMinutes(entry.activeMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartContainer>
      )}
    </div>
  );

  const renderInsights = () => (
    <div className="space-y-4 lg:space-y-6">
      {statsRow}

      <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
        <ChartContainer
          eyebrow="Engagement map"
          title="Feature bubble intelligence"
          description="Bubble size reflects engagement level, color reflects feature category, and selection drills deeper."
        >
          <Suspense fallback={<SectionSkeleton height={420} />}>
            <BubbleMap
              detailLevel={detailLevel}
              items={featureBubbles}
              selectedId={selectedBubbleId}
              onSelect={setSelectedBubbleId}
            />
          </Suspense>
        </ChartContainer>

        <ChartContainer
          eyebrow="Scoring model"
          title="Engagement and consistency profile"
          description="High-level scores that explain how realtime behavior translates into progress intelligence."
        >
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={insightScoreBars}>
                <CartesianGrid stroke="var(--pi-border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="var(--pi-text-soft)" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} stroke="var(--pi-text-soft)" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={sharedTooltipStyle} />
                <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                  {insightScoreBars.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <StatCard
          title="Consistency score"
          value={`${deferredData.intelligence.consistencyScore}/100`}
          subtitle="How stable the engagement rhythm is across sessions"
          icon={<Activity className="h-5 w-5" />}
          tone="accent"
        />
        <StatCard
          title="Growth rate"
          value={`${deferredData.intelligence.growthRate.toFixed(1)}%`}
          subtitle="Measured improvement over the previous activity baseline"
          icon={<TrendingUp className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          title="Anomaly watch"
          value={deferredData.intelligence.predictedStreakBreak ? 'Risk detected' : 'Stable'}
          subtitle="Behavioral anomaly detection driven by recent activity patterns"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={deferredData.intelligence.predictedStreakBreak ? 'danger' : 'warning'}
        />
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-4 lg:space-y-6">
      {statsRow}

      <ChartContainer
        eyebrow="Contribution report"
        title="Recent contribution intensity"
        description="Compact heatmap of the latest contribution streak, built from tracked activity only."
      >
        {heatmapRows.length > 0 ? (
          <div className="space-y-2">
            {heatmapRows.map((row, index) => (
              <div key={`heatmap-row-${index}`} className="flex gap-2">
                {row.map((cell) => (
                  <div
                    key={cell.date}
                    title={`${cell.date}: ${cell.count} events`}
                    className="h-6 w-6 rounded-lg border border-[var(--pi-border)]"
                    style={{
                      background:
                        cell.level === 0
                          ? 'var(--pi-surface-soft)'
                          : `rgba(79, 70, 229, ${0.12 + cell.level * 0.14})`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState label="Contribution reports will appear once the engine records sustained activity history." />
        )}
      </ChartContainer>

      <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
        <ChartContainer
          eyebrow="Achievements"
          title="Milestone ledger"
          description="Unlocked badges and next milestone on deck."
        >
          <div className="space-y-3">
            {deferredData.badges.recentlyUnlocked.slice(0, detailLevel === 'deep' ? 6 : 3).map((badge) => (
              <div key={badge.id} className="flex items-center gap-3 rounded-[22px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--pi-accent-soft)] text-xl">
                  {badge.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--pi-text)]">{badge.name}</div>
                  <div className="mt-1 text-xs text-[var(--pi-text-soft)]">{badge.description}</div>
                </div>
              </div>
            ))}
            {deferredData.badges.recentlyUnlocked.length === 0 && (
              <EmptyState label="New achievements will be listed here as soon as milestones are unlocked." />
            )}
            {deferredData.badges.nextToUnlock && (
              <div className="rounded-[22px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4 text-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pi-text-soft)]">Next unlock</div>
                <div className="mt-2 font-semibold text-[var(--pi-text)]">{deferredData.badges.nextToUnlock.name}</div>
                <div className="mt-1 text-xs text-[var(--pi-text-soft)]">{deferredData.badges.nextToUnlock.requirement}</div>
              </div>
            )}
          </div>
        </ChartContainer>

        <ChartContainer
          eyebrow="Recent outcomes"
          title="Submission and execution report"
          description="Latest tracked problem outcomes surfaced in a compact report table."
        >
          {deferredData.problemSolving.recentSubmissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.2em] text-[var(--pi-text-soft)]">
                  <tr>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Difficulty</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Language</th>
                  </tr>
                </thead>
                <tbody>
                  {deferredData.problemSolving.recentSubmissions.slice(0, detailLevel === 'deep' ? 8 : 5).map((submission) => (
                    <tr key={submission.id} className="border-t border-[var(--pi-border)]">
                      <td className="px-3 py-3 text-[var(--pi-text)]">{submission.title}</td>
                      <td className="px-3 py-3 text-[var(--pi-text-soft)]">{submission.difficulty}</td>
                      <td className="px-3 py-3 text-[var(--pi-text-soft)]">{submission.status.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-3 text-[var(--pi-text-soft)]">{submission.language}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="Submission reports will show up here after tracked attempts or solved problems." />
          )}
        </ChartContainer>
      </div>

      {detailLevel === 'deep' && (
        <ChartContainer
          eyebrow="Reliability report"
          title="System integrity snapshot"
          description="Operational facts about the analytics pipeline that support confidence in the displayed data."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pi-text-soft)]">API health</div>
              <div className="mt-3 flex items-center gap-2 text-lg font-semibold text-[var(--pi-text)]">
                <CheckCircle2 className="h-4 w-4 text-[var(--pi-success)]" />
                {apiHealth.circuitOpen ? 'Degraded' : 'Healthy'}
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pi-text-soft)]">Last sync</div>
              <div className="mt-3 text-lg font-semibold text-[var(--pi-text)]">{relativeTimeLabel(lastSyncAt)}</div>
            </div>
            <div className="rounded-[22px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pi-text-soft)]">Tracked sessions</div>
              <div className="mt-3 text-lg font-semibold text-[var(--pi-text)]">{deferredData.activity.totalSessions}</div>
            </div>
            <div className="rounded-[22px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pi-text-soft)]">Live updates</div>
              <div className="mt-3 text-lg font-semibold text-[var(--pi-text)]">{streamMessages.length}</div>
            </div>
          </div>
        </ChartContainer>
      )}
    </div>
  );

  const activeContent = (() => {
    switch (activeSection) {
      case 'realtime':
        return renderRealtime();
      case 'time':
        return renderTimeAnalytics();
      case 'insights':
        return renderInsights();
      case 'reports':
        return renderReports();
      default:
        return renderOverview();
    }
  })();

  const footer = (
    <div className="pi-surface-strong pi-status-bar rounded-[24px] px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--pi-text-soft)]">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] px-3 py-1.5">
            <Database className="h-4 w-4" />
            System health {apiHealth.circuitOpen ? 'degraded' : 'healthy'}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] px-3 py-1.5">
            <Calendar className="h-4 w-4" />
            Last sync {relativeTimeLabel(lastSyncAt)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] px-3 py-1.5">
            <Radio className="h-4 w-4" />
            Data status {statusLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--pi-text-soft)]">
          <span>{deferredData.activity.totalSessions} sessions tracked</span>
          <span>{deferredData.activity.activeDays} active days</span>
          <span>{streamMessages.length} live stream updates buffered</span>
        </div>
      </div>
    </div>
  );

  return (
    <LayoutWrapper
      sidebarCollapsed={sidebarCollapsed}
      header={
        <HeaderBar
          greeting={`Welcome back, ${getGreetingName(user)}`}
          subtitle="This space now operates as a multi-layer, realtime progress intelligence dashboard with synchronized analytics, session telemetry, and production-grade theme-aware surfaces."
          statusTone={statusTone}
          statusLabel={statusLabel}
          statusDetail={statusDetail}
          sessionLabel={formatSessionDuration(sessionElapsedMs)}
          summary={headerSummary}
          refreshing={isRefreshing}
          onRefresh={() => void refreshDashboard(true)}
        />
      }
      sidebar={
        <Sidebar
          items={sidebarItems}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
          detailLevel={detailLevel}
          onDetailLevelChange={setDetailLevel}
        />
      }
      insights={
        <Suspense fallback={<SectionSkeleton height={420} />}>
          <InsightPanel
            intelligence={deferredData.intelligence}
            activity={deferredData.activity}
            streamMessages={streamMessages}
            detailLevel={detailLevel}
            activeSection={activeSection}
            selectedBubbleLabel={selectedBubble?.label}
            statusLabel={statusLabel}
          />
        </Suspense>
      }
      footer={footer}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeSection}-${detailLevel}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.24 }}
        >
          {activeContent}
        </motion.div>
      </AnimatePresence>
    </LayoutWrapper>
  );
}
