import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  lazy,
  Suspense,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, Sun, Moon, WifiOff, Radio } from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary';
import { useTheme } from '../context/ThemeContext';

import {
  fetchContributions,
  fetchDashboard,
  getProgressDashboardData,
  subscribeToProgressUpdates,
} from '../progress-system/services/progressApi';
import { PROGRESS_UPDATE_EVENT } from '../progress-system/services/eventTracker';
import type { ProgressDashboardData, TopicBubble } from '../progress-system/types';

const ContributionHeatmap = lazy(() => import('../progress-system/components/ContributionHeatmap'));
const ProblemSolvingStats = lazy(() => import('../progress-system/components/ProblemSolvingStats'));
const BadgeSystem = lazy(() => import('../progress-system/components/BadgeSystem'));
const TopicBubbleMap = lazy(() => import('../progress-system/components/TopicBubbleMap'));
const TimeAnalytics = lazy(() => import('../progress-system/components/TimeAnalytics'));
const IntelligentInsights = lazy(() => import('../progress-system/components/IntelligentInsights'));
const StreakDisplay = lazy(() => import('../progress-system/components/StreakDisplay'));

const SURFACE_STYLE = {
  background: 'linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.82))',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(18px)',
} as const;

function SectionSkeleton({ minHeight = 220 }: { minHeight?: number }) {
  return (
    <div className="animate-pulse rounded-[24px] p-5" style={{ ...SURFACE_STYLE, minHeight }}>
      <div className="mb-4 h-5 w-44 rounded bg-white/5" />
      <div className="mb-3 h-3 w-full rounded bg-white/5" />
      <div className="mb-3 h-3 w-3/4 rounded bg-white/5" />
      <div className="h-24 w-full rounded-2xl bg-white/5" />
    </div>
  );
}

function SectionFallback({ title }: { title: string }) {
  return (
    <div className="rounded-[24px] p-5" style={SURFACE_STYLE}>
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

function formatRelativeSync(timestamp: string): string {
  const value = new Date(timestamp).getTime();
  if (Number.isNaN(value)) return 'just now';
  const deltaSeconds = Math.max(0, Math.round((Date.now() - value) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  if (deltaSeconds < 3600) return `${Math.round(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 86400) return `${Math.round(deltaSeconds / 3600)}h ago`;
  return `${Math.round(deltaSeconds / 86400)}d ago`;
}

function buildCategoryStats(topics: TopicBubble[]) {
  const totals = new Map<string, { problemsSolved: number; timeSpentMinutes: number; count: number }>();
  topics.forEach((topic) => {
    const key = topic.category || 'Other';
    const current = totals.get(key) ?? { problemsSolved: 0, timeSpentMinutes: 0, count: 0 };
    current.problemsSolved += topic.problemsSolved;
    current.timeSpentMinutes += topic.timeSpentMinutes;
    current.count += 1;
    totals.set(key, current);
  });

  return Array.from(totals.entries())
    .map(([category, value]) => ({ category, ...value }))
    .sort((a, b) => b.problemsSolved - a.problemsSolved || b.timeSpentMinutes - a.timeSpentMinutes);
}

function CategoryWiseStatsCard({
  topics,
}: {
  topics: TopicBubble[];
}) {
  const rows = useMemo(() => buildCategoryStats(topics), [topics]);
  const maxSolved = Math.max(1, ...rows.map((r) => r.problemsSolved));
  const maxMinutes = Math.max(1, ...rows.map((r) => r.timeSpentMinutes));

  return (
    <div
      className="rounded-[24px] p-5 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(2,6,23,0.35)]"
      style={SURFACE_STYLE}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
            <span className="text-xl">🗂️</span>
            Category-wise Stats
          </h3>
          <p className="mt-1 text-xs text-white/40">Where your practice time and wins are concentrating.</p>
        </div>
        <div className="rounded-full border border-white/8 bg-white/5 px-3 py-2 text-xs text-white/45">
          {rows.length} categories
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[18px] border border-white/6 bg-slate-950/30 p-5 text-sm text-white/35">
          No category activity yet. Start solving quizzes/problems to populate this view.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 8).map((row) => {
            const solvedPct = Math.round((row.problemsSolved / maxSolved) * 100);
            const timePct = Math.round((row.timeSpentMinutes / maxMinutes) * 100);
            const hours = Math.round((row.timeSpentMinutes / 60) * 10) / 10;

            return (
              <div key={row.category} className="rounded-[18px] border border-white/6 bg-slate-950/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{row.category}</div>
                    <div className="mt-1 text-xs text-white/40">{row.count} topics tracked</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">
                      {row.problemsSolved} solved
                    </div>
                    <div className="mt-1 text-xs text-white/40">{hours}h spent</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-white/35">
                      <span>Solved</span>
                      <span className="text-white/45">{solvedPct}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-white/[0.06]">
                      <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${solvedPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-white/35">
                      <span>Time</span>
                      <span className="text-white/45">{timePct}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-white/[0.06]">
                      <div className="h-full rounded-full bg-sky-500/60" style={{ width: `${timePct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProgressUnified() {
  const { isDark, toggleTheme } = useTheme();
  const [data, setData] = useState<ProgressDashboardData>(() => getProgressDashboardData());
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  const refreshDashboard = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const freshData = await fetchDashboard(true);
      setData(freshData);
    } catch {
      setData(getProgressDashboardData(true));
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const realData = await fetchDashboard();
        if (!cancelled) setData(realData);
      } catch {
        if (!cancelled) setData(getProgressDashboardData(true));
      } finally {
        if (!cancelled) setIsLoading(false);
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
      // keep existing contributions on transient failures
    }
  }, []);

  useEffect(() => {
    let fallbackPollId: number | null = null;
    let refreshDebounceId: number | null = null;

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

    const scheduleRefresh = () => {
      if (refreshDebounceId !== null) window.clearTimeout(refreshDebounceId);
      refreshDebounceId = window.setTimeout(() => void refreshDashboard(false), 250);
    };

    const handleExternalUpdate = () => scheduleRefresh();
    const handleVisibility = () => {
      if (!document.hidden) scheduleRefresh();
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
      if (refreshDebounceId !== null) window.clearTimeout(refreshDebounceId);
    };
  }, [refreshDashboard]);

  const syncLabel = formatRelativeSync(data.lastUpdated);
  const connectionLabel = !isOnline ? 'Offline cache' : isLive ? 'Realtime synced' : 'Syncing';

  const summary = useMemo(
    () => [
      {
        label: 'Streak',
        value: `${data.streak.currentStreak}`,
        sub: 'days',
        accent: '#f59e0b',
        icon: '🔥',
      },
      {
        label: 'Problems solved',
        value: `${data.problemSolving.totalSolved}`,
        sub: 'total',
        accent: '#10b981',
        icon: '✅',
      },
      {
        label: 'Active days',
        value: `${data.activity.activeDays}`,
        sub: 'days',
        accent: '#38bdf8',
        icon: '📅',
      },
      {
        label: 'Badges',
        value: `${data.badges.totalUnlocked}`,
        sub: `of ${data.badges.totalBadges}`,
        accent: '#8b5cf6',
        icon: '🏆',
      },
    ],
    [data],
  );

  return (
    <div className="relative min-h-screen pb-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-sky-500/8 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-500/6 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1500px] space-y-7 px-3 sm:px-6">
        {/* Navbar */}
        <div className="sticky top-4 z-30">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] p-3" style={SURFACE_STYLE}>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/30">
                Progress Intelligence
              </div>
              <div className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
                Unified progress dashboard
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium"
                style={{
                  background: !isOnline
                    ? 'rgba(239,68,68,0.14)'
                    : isLive
                      ? 'rgba(16,185,129,0.14)'
                      : 'rgba(245,158,11,0.14)',
                  color: !isOnline ? '#f87171' : isLive ? '#34d399' : '#fbbf24',
                  border: !isOnline
                    ? '1px solid rgba(239,68,68,0.2)'
                    : isLive
                      ? '1px solid rgba(16,185,129,0.2)'
                      : '1px solid rgba(245,158,11,0.2)',
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
                onClick={() => toggleTheme()}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/70 transition-all hover:bg-white/[0.06]"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
              </button>

              <button
                type="button"
                onClick={() => void refreshDashboard(true)}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-200 transition-all hover:bg-indigo-500/16 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Refreshing' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.35 }}
              whileHover={{ y: -3, scale: 1.01 }}
              className="relative overflow-hidden rounded-[24px] px-5 py-5 transition-all duration-300 hover:shadow-[0_24px_60px_rgba(2,6,23,0.36)]"
              style={{
                background: `linear-gradient(135deg, ${stat.accent}14, rgba(15,23,42,0.88))`,
                border: `1px solid ${stat.accent}18`,
                backdropFilter: 'blur(18px)',
              }}
            >
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/30">
                    {stat.label}
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <div className="text-4xl font-bold leading-none text-white">{stat.value}</div>
                    <div className="pb-1 text-sm text-white/45">{stat.sub}</div>
                  </div>
                </div>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                  style={{ background: `${stat.accent}16`, border: `1px solid ${stat.accent}24` }}
                >
                  {stat.icon}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={data.lastUpdated}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24 }}
            className="space-y-7"
          >
            <Suspense fallback={<SectionSkeleton />}>
              {/* Activity section */}
              <section className="space-y-4">
                <div className="px-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/28">
                    Activity
                  </div>
                  <div className="text-xl font-semibold tracking-tight text-white">Your practice cadence</div>
                  <div className="max-w-3xl text-sm leading-6 text-white/40">
                    Heatmap-first layout with a compact time overview so you can read momentum instantly.
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr,0.65fr]">
                  <SectionBoundary title="Contribution Heatmap">
                    <ContributionHeatmap data={data.contributions} onYearChange={handleYearChange} />
                  </SectionBoundary>
                  <SectionBoundary title="Time Analytics">
                    <TimeAnalytics
                      data={data.timeAnalytics}
                      hourlyActivity={data.intelligence.activeHours}
                      variant="compact"
                    />
                  </SectionBoundary>
                </div>
              </section>

              {/* Summary streak card (kept) */}
              <section className="space-y-4">
                <div className="px-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/28">
                    Summary
                  </div>
                  <div className="text-xl font-semibold tracking-tight text-white">Streak and consistency</div>
                  <div className="max-w-3xl text-sm leading-6 text-white/40">
                    The streak engine stays intact and gets prime placement for a LeetCode-style “signal-first” feel.
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <SectionBoundary title="Streak Engine">
                    <StreakDisplay data={data.streak} />
                  </SectionBoundary>
                  <SectionBoundary title="Intelligence Hub">
                    <IntelligentInsights data={data.intelligence} />
                  </SectionBoundary>
                </div>
              </section>

              {/* Problem intelligence */}
              <section className="space-y-4">
                <div className="px-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/28">
                    Problem intelligence
                  </div>
                  <div className="text-xl font-semibold tracking-tight text-white">
                    Difficulty breakdown and category focus
                  </div>
                  <div className="max-w-3xl text-sm leading-6 text-white/40">
                    See solved distribution by difficulty, then spot which categories are consuming time vs yielding wins.
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <SectionBoundary title="Problem Solving Stats">
                    <ProblemSolvingStats data={data.problemSolving} />
                  </SectionBoundary>
                  <SectionBoundary title="Category-wise Stats">
                    <CategoryWiseStatsCard topics={data.topicMap.topics} />
                  </SectionBoundary>
                </div>
              </section>

              {/* Skill intelligence */}
              <section className="space-y-4">
                <div className="px-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/28">
                    Skill intelligence
                  </div>
                  <div className="text-xl font-semibold tracking-tight text-white">Bubble map + time spent per skill</div>
                  <div className="max-w-3xl text-sm leading-6 text-white/40">
                    Bubble labels stay contained, and hover/selection reveals minutes spent per topic.
                  </div>
                </div>
                <SectionBoundary title="Skill Map">
                  <TopicBubbleMap data={data.topicMap} />
                </SectionBoundary>
              </section>

              {/* Badges & achievements */}
              <section className="space-y-4">
                <div className="px-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/28">
                    Badges & achievements
                  </div>
                  <div className="text-xl font-semibold tracking-tight text-white">Unlock momentum</div>
                  <div className="max-w-3xl text-sm leading-6 text-white/40">
                    A clean grid that keeps rarity + progress readable without clutter.
                  </div>
                </div>
                <SectionBoundary title="Achievements">
                  <BadgeSystem data={data.badges} />
                </SectionBoundary>
              </section>
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

