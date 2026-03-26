import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  Suspense,
  lazy,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Radio, RefreshCw, Sparkles, WifiOff } from 'lucide-react';
import {
  fetchDashboard,
  getProgressDashboardData,
  fetchContributions,
  subscribeToProgressUpdates,
} from './services/progressApi';
import { PROGRESS_UPDATE_EVENT } from './services/eventTracker';
import type { Badge, Insight, ProgressDashboardData } from './types';
import ErrorBoundary from '../components/ErrorBoundary';

const ContributionHeatmap = lazy(() => import('./components/ContributionHeatmap'));
const ProblemSolvingStats = lazy(() => import('./components/ProblemSolvingStats'));
const StreakDisplay = lazy(() => import('./components/StreakDisplay'));
const BadgeSystem = lazy(() => import('./components/BadgeSystem'));
const TopicBubbleMap = lazy(() => import('./components/TopicBubbleMap'));
const TimeAnalytics = lazy(() => import('./components/TimeAnalytics'));
const ActivityTracking = lazy(() => import('./components/ActivityTracking'));
const IntelligentInsights = lazy(() => import('./components/IntelligentInsights'));
const ActivityTimeline = lazy(() => import('./components/ActivityTimeline'));

type DashboardTab =
  | 'overview'
  | 'problems'
  | 'skills'
  | 'time'
  | 'activity'
  | 'badges'
  | 'insights';

const TABS: { id: DashboardTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '🏠' },
  { id: 'problems', label: 'Problems', icon: '🧩' },
  { id: 'skills', label: 'Skills', icon: '🫧' },
  { id: 'time', label: 'Time', icon: '⏱️' },
  { id: 'activity', label: 'Activity', icon: '📍' },
  { id: 'badges', label: 'Badges', icon: '🏆' },
  { id: 'insights', label: 'Insights', icon: '🧠' },
];

const SURFACE_STYLE = {
  background: 'linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.82))',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
} as const;

const HEADER_SURFACE_STYLE = {
  background: 'linear-gradient(135deg, rgba(9,16,32,0.92), rgba(16,25,44,0.8))',
  border: '1px solid rgba(255,255,255,0.06)',
  backdropFilter: 'blur(18px)',
} as const;

function SectionSkeleton() {
  return (
    <div className="animate-pulse rounded-[28px] p-6" style={{ ...SURFACE_STYLE, minHeight: 220 }}>
      <div className="mb-4 h-5 w-40 rounded bg-white/5" />
      <div className="mb-3 h-3 w-full rounded bg-white/5" />
      <div className="mb-3 h-3 w-3/4 rounded bg-white/5" />
      <div className="h-24 w-full rounded-2xl bg-white/5" />
    </div>
  );
}

function SectionFallback({ title }: { title: string }) {
  return (
    <div className="rounded-[28px] p-6" style={SURFACE_STYLE}>
      <div className="mb-2 text-sm font-semibold text-white">{title}</div>
      <div className="text-xs text-white/40">This section hit a rendering issue. Refresh to retry.</div>
    </div>
  );
}

function SectionBoundary({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ErrorBoundary moduleName={title} fallback={<SectionFallback title={title} />}>
      {children}
    </ErrorBoundary>
  );
}

function PreviewShell({
  title,
  icon,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  icon: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[28px] p-5" style={SURFACE_STYLE}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-white">
          <span className="text-lg">{icon}</span>
          {title}
        </h3>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-300 transition-colors hover:text-indigo-200"
          >
            {actionLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function formatRelativeSync(timestamp: string): string {
  const value = new Date(timestamp).getTime();
  if (Number.isNaN(value)) {
    return 'just now';
  }

  const deltaSeconds = Math.max(0, Math.round((Date.now() - value) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  if (deltaSeconds < 3600) return `${Math.round(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 86400) return `${Math.round(deltaSeconds / 3600)}h ago`;
  return `${Math.round(deltaSeconds / 86400)}d ago`;
}

function getBadgeTone(rarity: Badge['rarity']) {
  switch (rarity) {
    case 'legendary':
      return { pill: 'rgba(245,158,11,0.16)', text: '#f59e0b', border: 'rgba(245,158,11,0.24)' };
    case 'epic':
      return { pill: 'rgba(168,85,247,0.16)', text: '#c084fc', border: 'rgba(168,85,247,0.24)' };
    case 'rare':
      return { pill: 'rgba(59,130,246,0.16)', text: '#60a5fa', border: 'rgba(59,130,246,0.24)' };
    default:
      return { pill: 'rgba(148,163,184,0.14)', text: '#cbd5e1', border: 'rgba(148,163,184,0.2)' };
  }
}

function getInsightTone(insight: Insight) {
  switch (insight.type) {
    case 'warning':
      return { glow: 'rgba(239,68,68,0.12)', accent: '#f87171' };
    case 'achievement':
      return { glow: 'rgba(16,185,129,0.12)', accent: '#34d399' };
    case 'suggestion':
      return { glow: 'rgba(6,182,212,0.12)', accent: '#22d3ee' };
    case 'prediction':
      return { glow: 'rgba(168,85,247,0.12)', accent: '#c084fc' };
    default:
      return { glow: 'rgba(99,102,241,0.12)', accent: '#818cf8' };
  }
}

export default function ProgressDashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [data, setData] = useState<ProgressDashboardData>(() => getProgressDashboardData());
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  const refreshDashboard = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const freshData = await fetchDashboard(true);
      setData(freshData);
    } catch {
      setData(getProgressDashboardData(true));
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const realData = await fetchDashboard();
        if (!cancelled) {
          setData(realData);
        }
      } catch {
        if (!cancelled) {
          setData(getProgressDashboardData(true));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleYearChange = useCallback(async (year: number) => {
    try {
      const contributions = await fetchContributions(year);
      setData((previous) => ({ ...previous, contributions }));
    } catch {
      // Keep the active contribution view on transient failures.
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    await refreshDashboard(true);
  }, [refreshDashboard]);

  useEffect(() => {
    let fallbackPollId: number | null = null;
    let refreshDebounceId: number | null = null;

    const startFallbackPolling = () => {
      if (fallbackPollId !== null) {
        return;
      }

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

    const scheduleRefresh = () => {
      if (refreshDebounceId !== null) {
        window.clearTimeout(refreshDebounceId);
      }

      refreshDebounceId = window.setTimeout(() => {
        void refreshDashboard(false);
      }, 250);
    };

    const handleExternalUpdate = () => {
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

    window.addEventListener(PROGRESS_UPDATE_EVENT, handleExternalUpdate as EventListener);
    window.addEventListener('focus', handleExternalUpdate);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    const disconnectStream = subscribeToProgressUpdates({
      onOpen: () => {
        setIsLive(true);
        stopFallbackPolling();
      },
      onMessage: () => {
        setIsLive(true);
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
      window.removeEventListener(PROGRESS_UPDATE_EVENT, handleExternalUpdate as EventListener);
      window.removeEventListener('focus', handleExternalUpdate);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (refreshDebounceId !== null) {
        window.clearTimeout(refreshDebounceId);
      }
    };
  }, [refreshDashboard]);

  const headerStats = useMemo(
    () => [
      {
        label: 'Current Streak',
        value: `${data.streak.currentStreak}`,
        icon: '🔥',
        color: '#f59e0b',
        sub: 'days',
        helper: `${data.streak.longestStreak} day record`,
      },
      {
        label: 'Problems Solved',
        value: `${data.problemSolving.totalSolved}`,
        icon: '✅',
        color: '#10b981',
        sub: 'problems',
        helper: `${data.problemSolving.totalSubmissions} submissions`,
      },
      {
        label: 'Badges Unlocked',
        value: `${data.badges.totalUnlocked}`,
        icon: '🏆',
        color: '#8b5cf6',
        sub: `of ${data.badges.totalBadges}`,
        helper: data.badges.nextToUnlock ? `next: ${data.badges.nextToUnlock.name}` : 'collection complete',
      },
      {
        label: 'Active Days',
        value: `${data.activity.activeDays}`,
        icon: '📅',
        color: '#38bdf8',
        sub: 'days',
        helper: `${data.activity.totalSessions} sessions tracked`,
      },
    ],
    [data],
  );

  const previewAchievements = useMemo(
    () => data.badges.recentlyUnlocked.slice(0, 3),
    [data.badges.recentlyUnlocked],
  );

  const previewInsights = useMemo(
    () => data.intelligence.insights.slice(0, 4),
    [data.intelligence.insights],
  );

  const nextBadgeProgress = useMemo(() => {
    const nextBadge = data.badges.nextToUnlock;
    if (!nextBadge) {
      return 100;
    }

    if (nextBadge.requirementValue > 0) {
      return Math.max(0, Math.min(100, (nextBadge.currentValue / nextBadge.requirementValue) * 100));
    }

    return nextBadge.progress;
  }, [data.badges.nextToUnlock]);

  const connectionLabel = !isOnline ? 'Offline cache' : isLive ? 'Realtime synced' : 'Syncing';
  const syncLabel = formatRelativeSync(data.lastUpdated);

  const overviewContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionBoundary title="Streak Engine">
          <StreakDisplay data={data.streak} />
        </SectionBoundary>
        <SectionBoundary title="Problem Solving Stats">
          <ProblemSolvingStats data={data.problemSolving} />
        </SectionBoundary>
      </div>

      <SectionBoundary title="Activity Tracking">
        <ActivityTracking data={data.activity} />
      </SectionBoundary>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <SectionBoundary title="Time Analytics">
          <TimeAnalytics data={data.timeAnalytics} />
        </SectionBoundary>
        <SectionBoundary title="Skill Map">
          <TopicBubbleMap data={data.topicMap} />
        </SectionBoundary>
      </div>

      <PreviewShell title="Recent Achievements" icon="🏆" actionLabel="View all" onAction={() => setActiveTab('badges')}>
        <div className="space-y-4">
          {data.badges.nextToUnlock && (
            <div
              className="rounded-[22px] px-4 py-4"
              style={{
                background: 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(17,24,39,0.72))',
                border: '1px solid rgba(99,102,241,0.16)',
              }}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-2xl">
                    {data.badges.nextToUnlock.icon}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/30">Next unlock</div>
                    <div className="mt-1 text-lg font-semibold text-white">{data.badges.nextToUnlock.name}</div>
                    <div className="text-xs text-white/40">{data.badges.nextToUnlock.requirement}</div>
                  </div>
                </div>

                <div className="min-w-[180px]">
                  <div className="mb-2 flex items-center justify-between text-xs text-white/35">
                    <span>Progress</span>
                    <span>{Math.round(nextBadgeProgress)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/6">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${nextBadgeProgress}%`,
                        background: 'linear-gradient(90deg, #8b5cf6, #6366f1)',
                        boxShadow: '0 0 12px rgba(139,92,246,0.35)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {previewAchievements.length === 0 && (
              <div className="text-xs text-white/40">
                New achievements will appear here after your next milestone.
              </div>
            )}

            {previewAchievements.map((badge, index) => {
              const tone = getBadgeTone(badge.rarity);

              return (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className="rounded-[22px] p-4"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${tone.border}`,
                  }}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <span className="text-2xl">{badge.icon}</span>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{
                        background: tone.pill,
                        color: tone.text,
                        border: `1px solid ${tone.border}`,
                      }}
                    >
                      {badge.rarity}
                    </span>
                  </div>
                  <div className="text-base font-semibold text-white">{badge.name}</div>
                  <div className="mt-1 text-sm text-white/40">{badge.description}</div>
                  <div className="mt-3 text-xs font-medium text-emerald-400">
                    {badge.isUnlocked ? 'Unlocked' : 'In progress'}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </PreviewShell>

      <PreviewShell title="Quick Insights" icon={<Sparkles className="h-4 w-4 text-violet-300" />} actionLabel="View all" onAction={() => setActiveTab('insights')}>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {previewInsights.length === 0 && (
            <div className="text-xs text-white/40">
              Insights will appear once there is enough real activity to analyze.
            </div>
          )}

          {previewInsights.map((insight, index) => {
            const tone = getInsightTone(insight);

            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="relative overflow-hidden rounded-[22px] p-4"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 w-1.5 rounded-l-[22px]"
                  style={{ background: tone.accent }}
                />
                <div
                  className="absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl"
                  style={{ background: tone.glow }}
                />
                <div className="relative flex items-start gap-3">
                  <span className="mt-0.5 text-xl">{insight.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{insight.title}</div>
                    <div className="mt-1 text-xs leading-5 text-white/38">{insight.description}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </PreviewShell>
    </div>
  );

  const activityContent = (
    <div className="space-y-6">
      <SectionBoundary title="Contribution Heatmap">
        <ContributionHeatmap data={data.contributions} onYearChange={handleYearChange} />
      </SectionBoundary>
      <SectionBoundary title="Activity Tracking">
        <ActivityTracking data={data.activity} />
      </SectionBoundary>
      <SectionBoundary title="Activity Timeline">
        <ActivityTimeline />
      </SectionBoundary>
    </div>
  );

  const timeContent = (
    <div className="space-y-6">
      <SectionBoundary title="Time Analytics">
        <TimeAnalytics data={data.timeAnalytics} />
      </SectionBoundary>
      <SectionBoundary title="Contribution Heatmap">
        <ContributionHeatmap data={data.contributions} onYearChange={handleYearChange} />
      </SectionBoundary>
    </div>
  );

  return (
    <div className="relative min-h-screen pb-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-sky-500/8 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-500/6 blur-3xl" />
        <div className="absolute left-[22%] top-24 h-2 w-2 rounded-full bg-sky-400/70 shadow-[0_0_18px_rgba(56,189,248,0.7)]" />
        <div className="absolute right-[18%] top-20 h-2.5 w-2.5 rounded-full bg-indigo-300/70 shadow-[0_0_20px_rgba(129,140,248,0.7)]" />
        <div className="absolute right-[10%] top-40 h-1.5 w-1.5 rounded-full bg-white/60 shadow-[0_0_16px_rgba(255,255,255,0.4)]" />
      </div>

      <div className="relative mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/28">
              Progress Intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
              Realtime growth, practice, time, and insight tracking
            </h1>
            <div className="max-w-3xl text-sm text-white/38">
              A premium dark analytics surface built around your original design system, with cleaner hierarchy and live synced data.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium"
              style={{
                background: !isOnline ? 'rgba(239,68,68,0.14)' : isLive ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.14)',
                color: !isOnline ? '#f87171' : isLive ? '#34d399' : '#fbbf24',
                border: !isOnline ? '1px solid rgba(239,68,68,0.2)' : isLive ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(245,158,11,0.2)',
              }}
            >
              {!isOnline ? <WifiOff className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5" />}
              {connectionLabel}
            </div>

            <div className="rounded-full border border-white/8 bg-white/5 px-3 py-2 text-xs text-white/42">
              Synced {syncLabel}
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-200 transition-all hover:bg-indigo-500/16 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {headerStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.4 }}
              className="group relative overflow-hidden rounded-[24px] px-5 py-4"
              style={{
                background: `linear-gradient(135deg, ${stat.color}12, rgba(15,23,42,0.88))`,
                border: `1px solid ${stat.color}16`,
                backdropFilter: 'blur(18px)',
              }}
            >
              <div
                className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl"
                style={{ background: `${stat.color}22` }}
              />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white/36">{stat.label}</div>
                  <div className="mt-3 flex items-end gap-2">
                    <div className="text-4xl font-bold leading-none text-white">{stat.value}</div>
                    <div className="pb-1 text-sm text-white/42">{stat.sub}</div>
                  </div>
                  <div className="mt-2 text-xs text-white/26">{stat.helper}</div>
                </div>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: `${stat.color}16`,
                    border: `1px solid ${stat.color}24`,
                  }}
                >
                  {stat.icon}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="sticky top-3 z-20">
          <div className="inline-flex min-w-full rounded-[22px] p-2 sm:min-w-0" style={HEADER_SURFACE_STYLE}>
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all"
                  style={{
                    color: activeTab === tab.id ? '#f8fafc' : 'rgba(255,255,255,0.48)',
                  }}
                >
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="progress-intelligence-active-tab"
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.18))',
                        border: '1px solid rgba(129,140,248,0.3)',
                        boxShadow: '0 10px 24px rgba(76, 29, 149, 0.24)',
                      }}
                      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                    />
                  )}
                  <span className="relative z-10">{tab.icon}</span>
                  <span className="relative z-10">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24 }}
          >
            <Suspense fallback={<SectionSkeleton />}>
              {activeTab === 'overview' && overviewContent}
              {activeTab === 'problems' && (
                <SectionBoundary title="Problem Solving Stats">
                  <ProblemSolvingStats data={data.problemSolving} />
                </SectionBoundary>
              )}
              {activeTab === 'skills' && (
                <SectionBoundary title="Skill Map">
                  <TopicBubbleMap data={data.topicMap} />
                </SectionBoundary>
              )}
              {activeTab === 'time' && timeContent}
              {activeTab === 'activity' && activityContent}
              {activeTab === 'badges' && (
                <SectionBoundary title="Achievements">
                  <BadgeSystem data={data.badges} />
                </SectionBoundary>
              )}
              {activeTab === 'insights' && (
                <SectionBoundary title="Intelligence Hub">
                  <IntelligentInsights data={data.intelligence} />
                </SectionBoundary>
              )}
            </Suspense>
          </motion.div>
        </AnimatePresence>

        <div className="pt-1 text-center text-xs text-white/20">
          Last updated: {new Date(data.lastUpdated).toLocaleString()} · synced {syncLabel}
          {isLive && ' · realtime engine connected'}
        </div>
      </div>
    </div>
  );
}
