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
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SkeletonBlock } from '../progress-system/ui/loading';

import {
  useProgressDashboardRuntime,
  useProgressDashboardStore,
} from '../progress-system/store/useProgressDashboardStore';

import {
  CategoryWiseStatsCard,
  DashboardFooter,
  DashboardHeader,
  HeatmapFullRow,
  InsightsSection,
  IntelligenceHub,
  ProblemIntelligence,
  ProblemIntelligenceColumn,
  StreakEngine,
  SummaryCards,
  TimeAnalyticsSection,
} from '../progress-system/dashboard';

import '../progress-system/dashboard/progressDashboardTokens.css';

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

function SummaryCardSkeleton() {
  return (
    <Card className={`rounded-2xl p-5 ${surfaceClassName}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <SkeletonBlock className="h-3 w-24" />
          <div className="flex items-end gap-2">
            <SkeletonBlock className="h-10 w-16" />
            <SkeletonBlock className="h-4 w-12" />
          </div>
        </div>
        <SkeletonBlock className="h-11 w-11 rounded-2xl" />
      </div>
    </Card>
  );
}

function LoadingHint({ message }: { message: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          key={message}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-indigo-50/80 px-3 py-2 text-xs font-medium text-indigo-700 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-200"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75" />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
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

function useLiveSyncLabel(timestamp: string | null): string | null {
  const [label, setLabel] = useState<string | null>(() => (timestamp ? formatRelativeSync(timestamp) : null));
  useEffect(() => {
    if (!timestamp) {
      setLabel(null);
      return;
    }
    setLabel(formatRelativeSync(timestamp));
    const interval = setInterval(() => {
      setLabel(formatRelativeSync(timestamp));
    }, 10_000);
    return () => clearInterval(interval);
  }, [timestamp]);
  return label;
}

export default function ProgressUnified() {
  useProgressDashboardRuntime();

  const { isDark, toggleTheme } = useTheme();
  const data = useProgressDashboardStore((state) => state.data);
  const isLoading = useProgressDashboardStore((state) => state.isLoading);
  const isRefreshing = useProgressDashboardStore((state) => state.isRefreshing);
  const isLive = useProgressDashboardStore((state) => state.isLive);
  const isOnline = useProgressDashboardStore((state) => state.isOnline);
  const hasHydrated = useProgressDashboardStore((state) => state.hasHydrated);
  const loadedSections = useProgressDashboardStore((state) => state.loadedSections);
  const refreshDashboard = useProgressDashboardStore((state) => state.refreshDashboard);
  const refreshContributionYear = useProgressDashboardStore((state) => state.refreshContributionYear);

  const handleYearChange = useCallback(
    (year: number) => {
      void refreshContributionYear(year);
    },
    [refreshContributionYear],
  );

  const loadedSectionCount = useMemo(
    () => Object.values(loadedSections).filter(Boolean).length,
    [loadedSections],
  );
  const totalSectionCount = Object.keys(loadedSections).length;
  const showLoadingHint = isLoading && loadedSectionCount < totalSectionCount;
  const loadingHintMessage = showLoadingHint
    ? loadedSectionCount === 0
      ? 'Preparing your progress insights...'
      : 'Analyzing your activity...'
    : null;
  const syncLabel = useLiveSyncLabel(hasHydrated ? data.lastUpdated : null);
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
        numericValue: data.streak.currentStreak,
        sub: 'days',
        accent: '#f59e0b',
        icon: '🔥',
      },
      {
        label: 'Problems solved',
        value: `${data.problemSolving.totalSolved}`,
        numericValue: data.problemSolving.totalSolved,
        sub: 'total',
        accent: '#10b981',
        icon: '✅',
      },
      {
        label: 'Active days',
        value: `${data.activity.activeDays}`,
        numericValue: data.activity.activeDays,
        sub: 'days',
        accent: '#38bdf8',
        icon: '📅',
      },
      {
        label: 'Badges',
        value: `${data.badges.totalUnlocked}`,
        numericValue: data.badges.totalUnlocked,
        sub: `of ${data.badges.totalBadges}`,
        accent: '#8b5cf6',
        icon: '🏆',
      },
    ],
    [data],
  );

  const loadedFlags = [
    loadedSections.streak,
    loadedSections.problemSolving,
    loadedSections.activity,
    loadedSections.badges,
  ];

  const headerActions = (
    <>
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

      {syncLabel && (
        <div className="rounded-full border border-slate-200/70 bg-white/70 px-3 py-2 text-xs text-slate-600 dark:border-slate-800/60 dark:bg-slate-950/30 dark:text-slate-300">
          Synced {syncLabel}
        </div>
      )}

      <Button type="button" variant="outline" onClick={toggleTheme} className="rounded-full px-4" aria-label="Toggle theme">
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
    </>
  );

  return (
    <div className="progress-intelligence-dashboard min-h-screen px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="max-w-[1360px] 3xl:max-w-[1500px] mx-auto grid grid-cols-12 gap-x-4 gap-y-6 md:gap-x-6 md:gap-y-8">
        <DashboardHeader
          title="Unified progress dashboard"
          description="Signal-first layout inspired by LeetCode: cadence, difficulty, skills, insights, achievements."
          actions={headerActions}
        />

        <div className="col-span-12">
          <LoadingHint message={loadingHintMessage} />
        </div>

        <SummaryCards
          stats={summary}
          loadedFlags={loadedFlags}
          surfaceClassName={surfaceClassName}
          surfaceHoverClassName={surfaceHoverClassName}
          skeleton={<SummaryCardSkeleton />}
        />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
          className="col-span-12 space-y-8 md:space-y-10"
        >
          <Suspense fallback={<SectionSkeleton />}>
            <InsightsSection
              eyebrow="Activity"
              title="Your practice cadence"
              description="Full-width contribution calendar (GitHub-style). Time analytics sit in the next section so the heatmap stays uncluttered."
            >
              <HeatmapFullRow>
                <SectionBoundary title="Contribution Heatmap">
                  <ContributionHeatmap
                    data={data.contributions}
                    onYearChange={handleYearChange}
                    loading={!loadedSections.contributions}
                  />
                </SectionBoundary>
              </HeatmapFullRow>
            </InsightsSection>

            <InsightsSection
              eyebrow="Time"
              title="Rhythm and focus"
              description="Hour-of-day usage and weekly time allocation — same analytics engine as before, reorganized for readability."
            >
              <TimeAnalyticsSection>
                <SectionBoundary title="Time Analytics">
                  <TimeAnalytics
                    data={data.timeAnalytics}
                    hourlyActivity={data.intelligence.activeHours}
                    variant="compact"
                    loading={!(loadedSections.timeAnalytics && loadedSections.intelligence)}
                  />
                </SectionBoundary>
              </TimeAnalyticsSection>
            </InsightsSection>

            <InsightsSection
              eyebrow="Summary"
              title="Streak and consistency"
              description="Streak engine and intelligence hub stay side by side on large screens; they stack on smaller breakpoints."
            >
              <div className="grid grid-cols-12 gap-5 xl:gap-6 items-start">
                <StreakEngine>
                  <SectionBoundary title="Streak Engine">
                    <StreakDisplay data={data.streak} loading={!loadedSections.streak} />
                  </SectionBoundary>
                </StreakEngine>
                <IntelligenceHub>
                  <SectionBoundary title="Intelligence Hub">
                    <IntelligentInsights data={data.intelligence} loading={!loadedSections.intelligence} />
                  </SectionBoundary>
                </IntelligenceHub>
              </div>
            </InsightsSection>

            <InsightsSection
              eyebrow="Problem intelligence"
              title="Difficulty breakdown and category focus"
              description="See solved distribution by difficulty, then spot which categories are consuming time versus yielding wins."
            >
              <ProblemIntelligence>
                <ProblemIntelligenceColumn>
                  <SectionBoundary title="Problem Solving Stats">
                    <ProblemSolvingStats data={data.problemSolving} loading={!loadedSections.problemSolving} />
                  </SectionBoundary>
                </ProblemIntelligenceColumn>
                <ProblemIntelligenceColumn>
                  <SectionBoundary title="Category-wise Stats">
                    <CategoryWiseStatsCard topics={data.topicMap.topics} loading={!loadedSections.topicMap} />
                  </SectionBoundary>
                </ProblemIntelligenceColumn>
              </ProblemIntelligence>
            </InsightsSection>

            <InsightsSection
              eyebrow="Skill intelligence"
              title="Bubble map + time spent per skill"
              description="Bubble labels stay contained, and hover or selection reveals minutes spent per topic."
            >
              <SectionBoundary title="Skill Map">
                <TopicBubbleMap data={data.topicMap} loading={!loadedSections.topicMap} />
              </SectionBoundary>
            </InsightsSection>

            <InsightsSection
              eyebrow="Badges & achievements"
              title="Unlock momentum"
              description="A clean grid that keeps rarity and progress readable without clutter."
            >
              <SectionBoundary title="Achievements">
                <BadgeSystem data={data.badges} loading={!loadedSections.badges} />
              </SectionBoundary>
            </InsightsSection>
          </Suspense>
        </motion.div>

        <DashboardFooter lastUpdated={data.lastUpdated} syncLabel={syncLabel} isLive={isLive} />
      </div>
    </div>
  );
}
