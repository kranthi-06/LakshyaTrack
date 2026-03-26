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
import { Radio, RefreshCw, WifiOff } from 'lucide-react';
import {
  fetchDashboard,
  getProgressDashboardData,
  fetchContributions,
  subscribeToProgressUpdates,
} from './services/progressApi';
import { PROGRESS_UPDATE_EVENT } from './services/eventTracker';
import type { ProgressDashboardData } from './types';
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

function SectionLead({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1 px-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/28">
        {eyebrow}
      </div>
      <div className="text-xl font-semibold tracking-tight text-white">{title}</div>
      <div className="max-w-3xl text-sm leading-6 text-white/40">{description}</div>
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

  const connectionLabel = !isOnline ? 'Offline cache' : isLive ? 'Realtime synced' : 'Syncing';
  const syncLabel = formatRelativeSync(data.lastUpdated);

  const overviewContent = (
    <div className="space-y-7">
      <section className="space-y-4">
        <SectionLead
          eyebrow="Analytics"
          title="Streak momentum and practice performance"
          description="The first layer keeps your streak engine and problem-solving depth side by side so the dashboard opens with the clearest signal."
        />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionBoundary title="Streak Engine">
            <StreakDisplay data={data.streak} />
          </SectionBoundary>
          <SectionBoundary title="Problem Solving Stats">
            <ProblemSolvingStats data={data.problemSolving} />
          </SectionBoundary>
        </div>
      </section>

      <section className="space-y-4">
        <SectionLead
          eyebrow="Visuals"
          title="Calendar activity, hour-of-day rhythm, and live behavior"
          description="Heatmap, hourly usage rhythm, and engagement tracking are grouped together to make your learning tempo easier to read without hunting through tabs."
        />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionBoundary title="Contribution Heatmap">
            <ContributionHeatmap data={data.contributions} onYearChange={handleYearChange} />
          </SectionBoundary>
          <SectionBoundary title="Time Analytics">
            <TimeAnalytics data={data.timeAnalytics} hourlyActivity={data.intelligence.activeHours} />
          </SectionBoundary>
          <div className="xl:col-span-2">
            <SectionBoundary title="Activity Tracking">
              <ActivityTracking data={data.activity} />
            </SectionBoundary>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionLead
          eyebrow="Skills"
          title="Topic mastery map with cleaner bubble behavior"
          description="The skill map keeps your existing visual identity, but the bubble spacing, label fitting, and hover states are tuned so it feels premium instead of crowded."
        />
        <SectionBoundary title="Skill Map">
          <TopicBubbleMap data={data.topicMap} />
        </SectionBoundary>
      </section>

      <section className="space-y-4">
        <SectionLead
          eyebrow="Insights"
          title="Predictions, suggestions, and focus guidance"
          description="AI insights remain intact, but the reading flow is cleaner so warnings, recommendations, and high-value patterns surface faster."
        />
        <SectionBoundary title="Intelligence Hub">
          <IntelligentInsights data={data.intelligence} />
        </SectionBoundary>
      </section>

      <section className="space-y-4">
        <SectionLead
          eyebrow="Achievements"
          title="Milestones, progress, and unlock momentum"
          description="Your badge system stays at the end of the journey, where wins, next unlocks, and completion progress read like a proper finish to the analytics story."
        />
        <SectionBoundary title="Achievements">
          <BadgeSystem data={data.badges} />
        </SectionBoundary>
      </section>
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
        <TimeAnalytics data={data.timeAnalytics} hourlyActivity={data.intelligence.activeHours} />
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
            <div className="max-w-3xl text-sm leading-6 text-white/38">
              Your original dashboard architecture is intact, now refined with a stronger reading flow, cleaner grouping, and tighter visual polish.
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
              whileHover={{ y: -4, scale: 1.01 }}
              className="group relative overflow-hidden rounded-[24px] px-5 py-5 transition-all duration-300 hover:shadow-[0_24px_60px_rgba(2,6,23,0.36)]"
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

        <div className="sticky top-4 z-20">
          <div className="inline-flex w-full min-w-0 rounded-[22px] p-2 sm:w-auto sm:min-w-0" style={HEADER_SURFACE_STYLE}>
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
