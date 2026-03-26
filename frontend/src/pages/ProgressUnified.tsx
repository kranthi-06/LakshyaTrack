import {
  useCallback,
  useMemo,
  lazy,
  Suspense,
  type ReactNode,
} from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Sun, Moon, WifiOff, Radio } from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary';
import { useTheme } from '../context/ThemeContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import type { TopicBubble } from '../progress-system/types';
import {
  useProgressDashboardRuntime,
  useProgressDashboardStore,
} from '../progress-system/store/useProgressDashboardStore';

const ContributionHeatmap = lazy(() => import('../progress-system/components/ContributionHeatmap'));
const ProblemSolvingStats = lazy(() => import('../progress-system/components/ProblemSolvingStats'));
const BadgeSystem = lazy(() => import('../progress-system/components/BadgeSystem'));
const TopicBubbleMap = lazy(() => import('../progress-system/components/TopicBubbleMap'));
const TimeAnalytics = lazy(() => import('../progress-system/components/TimeAnalytics'));
const IntelligentInsights = lazy(() => import('../progress-system/components/IntelligentInsights'));
const StreakDisplay = lazy(() => import('../progress-system/components/StreakDisplay'));

const surfaceClassName =
  'border-slate-200/70 bg-white/85 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/40';
const surfaceHoverClassName =
  'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md';

function SectionSkeleton({ minHeight = 220 }: { minHeight?: number }) {
  return (
    <Card className={`rounded-2xl p-5 ${surfaceClassName}`} style={{ minHeight }}>
      <div className="mb-4 h-5 w-44 rounded bg-slate-200/70 dark:bg-white/10" />
      <div className="mb-3 h-3 w-full rounded bg-slate-200/60 dark:bg-white/10" />
      <div className="mb-3 h-3 w-3/4 rounded bg-slate-200/60 dark:bg-white/10" />
      <div className="h-24 w-full rounded-2xl bg-slate-200/50 dark:bg-white/10" />
    </Card>
  );
}

function SectionFallback({ title }: { title: string }) {
  return (
    <Card className={`rounded-2xl p-5 ${surfaceClassName}`}>
      <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        This section hit a rendering issue. Refresh to retry.
      </div>
    </Card>
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
    <Card className={`rounded-2xl p-5 ${surfaceClassName} ${surfaceHoverClassName}`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <span className="text-xl">🗂️</span>
            Category-wise Stats
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Where your practice time and wins are concentrating.
          </p>
        </div>
        <div className="rounded-full border border-slate-200/70 bg-white/60 px-3 py-2 text-xs text-slate-600 dark:border-slate-800/60 dark:bg-slate-950/30 dark:text-slate-300">
          {rows.length} categories
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-5 text-sm text-slate-600 dark:border-slate-800/60 dark:bg-slate-950/30 dark:text-slate-300">
          No category activity yet. Start solving quizzes/problems to populate this view.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 8).map((row) => {
            const solvedPct = Math.round((row.problemsSolved / maxSolved) * 100);
            const timePct = Math.round((row.timeSpentMinutes / maxMinutes) * 100);
            const hours = Math.round((row.timeSpentMinutes / 60) * 10) / 10;

            return (
              <div
                key={row.category}
                className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-slate-800/60 dark:bg-slate-950/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{row.category}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.count} topics tracked</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{row.problemsSolved} solved</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hours}h spent</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Solved</span>
                      <span className="text-slate-600 dark:text-slate-300">{solvedPct}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-slate-200/70 dark:bg-white/10">
                      <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${solvedPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Time</span>
                      <span className="text-slate-600 dark:text-slate-300">{timePct}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-slate-200/70 dark:bg-white/10">
                      <div className="h-full rounded-full bg-sky-500/70" style={{ width: `${timePct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function ProgressUnified() {
  useProgressDashboardRuntime();

  const { isDark, toggleTheme } = useTheme();
  const data = useProgressDashboardStore((state) => state.data);
  const isRefreshing = useProgressDashboardStore((state) => state.isRefreshing);
  const isLive = useProgressDashboardStore((state) => state.isLive);
  const isOnline = useProgressDashboardStore((state) => state.isOnline);
  const refreshDashboard = useProgressDashboardStore((state) => state.refreshDashboard);
  const refreshContributionYear = useProgressDashboardStore((state) => state.refreshContributionYear);

  const handleYearChange = useCallback(
    (year: number) => {
      void refreshContributionYear(year);
    },
    [refreshContributionYear],
  );

  const syncLabel = formatRelativeSync(data.lastUpdated);
  const connectionLabel = !isOnline
    ? 'Offline cache'
    : isLive
      ? isRefreshing
        ? 'Realtime syncing'
        : 'Realtime synced'
      : isRefreshing
        ? 'Syncing'
        : 'Standby sync';

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
    <div className="min-h-screen px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="max-w-[1360px] mx-auto space-y-6 sm:space-y-8">
        {/* Navbar */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Progress Intelligence
            </div>
            <h1 className="mt-1 text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
              Unified progress dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
              Signal-first layout inspired by LeetCode: cadence, difficulty, skills, insights, achievements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className={[
                'inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold',
                !isOnline
                  ? 'border border-red-200 bg-red-50 text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300'
                  : isLive
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
              ].join(' ')}
            >
              {!isOnline ? <WifiOff className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5" />}
              {connectionLabel}
            </div>

            <div className="rounded-full border border-slate-200/70 bg-white/70 px-3 py-2 text-xs text-slate-600 dark:border-slate-800/60 dark:bg-slate-950/30 dark:text-slate-300">
              Synced {syncLabel}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={toggleTheme}
              className="rounded-full px-4"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="hidden sm:inline ml-2">{isDark ? 'Light' : 'Dark'}</span>
            </Button>

            <Button
              type="button"
              onClick={() => void refreshDashboard({ showLoading: true, forceRefresh: true, reason: 'manual-refresh' })}
              disabled={isRefreshing}
              className="rounded-full bg-[#6C63FF] hover:bg-[#5B54E0] text-white shadow-lg shadow-indigo-500/20"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="ml-2">{isRefreshing ? 'Refreshing' : 'Refresh'}</span>
            </Button>
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
              whileHover={{ y: -2 }}
              className="min-w-0"
            >
              <Card className={`rounded-2xl p-5 ${surfaceClassName} ${surfaceHoverClassName}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      {stat.label}
                    </div>
                    <div className="mt-2 flex items-end gap-2">
                      <div className="text-4xl font-[900] tracking-tighter text-slate-900 dark:text-white">
                        {stat.value}
                      </div>
                      <div className="pb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                        {stat.sub}
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl border"
                    style={{
                      background: `${stat.accent}12`,
                      borderColor: `${stat.accent}22`,
                    }}
                  >
                    {stat.icon}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="space-y-7">
          <Suspense fallback={<SectionSkeleton />}>
              {/* Activity section */}
              <section className="space-y-4">
                <div className="px-0.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                    Activity
                  </div>
                  <div className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Your practice cadence
                  </div>
                  <div className="max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Heatmap-first layout with a compact time overview so you can read momentum instantly.
                  </div>
                </div>

                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.72fr)]">
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
                <div className="px-0.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                    Summary
                  </div>
                  <div className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Streak and consistency
                  </div>
                  <div className="max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
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
                <div className="px-0.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                    Problem intelligence
                  </div>
                  <div className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Difficulty breakdown and category focus
                  </div>
                  <div className="max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
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
                <div className="px-0.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                    Skill intelligence
                  </div>
                  <div className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Bubble map + time spent per skill
                  </div>
                  <div className="max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Bubble labels stay contained, and hover/selection reveals minutes spent per topic.
                  </div>
                </div>
                <SectionBoundary title="Skill Map">
                  <TopicBubbleMap data={data.topicMap} />
                </SectionBoundary>
              </section>

              {/* Badges & achievements */}
              <section className="space-y-4">
                <div className="px-0.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                    Badges & achievements
                  </div>
                  <div className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Unlock momentum
                  </div>
                  <div className="max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    A clean grid that keeps rarity + progress readable without clutter.
                  </div>
                </div>
                <SectionBoundary title="Achievements">
                  <BadgeSystem data={data.badges} />
                </SectionBoundary>
              </section>
          </Suspense>
        </motion.div>

        <div className="pt-1 text-center text-xs text-slate-500 dark:text-slate-400">
          Last updated: {new Date(data.lastUpdated).toLocaleString()} · synced {syncLabel}
          {isLive && ' · realtime engine connected'}
        </div>
      </div>
    </div>
  );
}
