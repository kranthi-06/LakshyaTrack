// ══════════════════════════════════════════════════════════════
// Progress Intelligence Dashboard — Main Page Component
// Now powered by real-time event-driven analytics engine
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback, Suspense, lazy, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchDashboard,
  getProgressDashboardData,
  fetchContributions,
} from './services/progressApi';
import { PROGRESS_UPDATE_EVENT } from './services/eventTracker';
import type { ProgressDashboardData } from './types';
import ErrorBoundary from '../components/ErrorBoundary';

// ── Lazy-loaded components for code splitting ─────────────────
const ContributionHeatmap = lazy(() => import('./components/ContributionHeatmap'));
const ProblemSolvingStats = lazy(() => import('./components/ProblemSolvingStats'));
const StreakDisplay = lazy(() => import('./components/StreakDisplay'));
const BadgeSystem = lazy(() => import('./components/BadgeSystem'));
const TopicBubbleMap = lazy(() => import('./components/TopicBubbleMap'));
const TimeAnalytics = lazy(() => import('./components/TimeAnalytics'));
const ActivityTracking = lazy(() => import('./components/ActivityTracking'));
const IntelligentInsights = lazy(() => import('./components/IntelligentInsights'));
const ActivityTimeline = lazy(() => import('./components/ActivityTimeline'));

// ── Section Loading Skeleton ──────────────────────────────────
function SectionSkeleton() {
  return (
    <div
      className="rounded-2xl p-6 animate-pulse"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
        border: '1px solid rgba(255,255,255,0.08)',
        minHeight: 200,
      }}
    >
      <div className="h-5 w-40 rounded bg-white/5 mb-4" />
      <div className="h-3 w-full rounded bg-white/5 mb-3" />
      <div className="h-3 w-3/4 rounded bg-white/5 mb-3" />
      <div className="h-20 w-full rounded-xl bg-white/5" />
    </div>
  );
}

function SectionFallback({ title }: { title: string }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="text-sm font-semibold text-white mb-2">{title}</div>
      <div className="text-xs text-white/40">
        This section hit a rendering issue. Refresh to retry.
      </div>
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

// ── Tab Navigation ────────────────────────────────────────────
type DashboardTab = 'overview' | 'problems' | 'skills' | 'time' | 'activity' | 'badges' | 'insights';

const TABS: { id: DashboardTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '🏠' },
  { id: 'problems', label: 'Problems', icon: '🧩' },
  { id: 'skills', label: 'Skills', icon: '🫧' },
  { id: 'time', label: 'Time', icon: '⏱️' },
  { id: 'activity', label: 'Activity', icon: '📋' },
  { id: 'badges', label: 'Badges', icon: '🏆' },
  { id: 'insights', label: 'Insights', icon: '🧠' },
];

// ── Main Dashboard Component ──────────────────────────────────
export default function ProgressDashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [data, setData] = useState<ProgressDashboardData>(() => getProgressDashboardData());
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const refreshDashboard = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const freshData = await fetchDashboard(true);
      setData(freshData);
      setIsLive(true);
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
          setIsLive(true);
        }
      } catch {
        // Empty fallback data is already loaded locally.
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
      setData(prev => ({ ...prev, contributions }));
    } catch {
      // silent
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    await refreshDashboard(true);
  }, [refreshDashboard]);

  useEffect(() => {
    const handleExternalUpdate = () => {
      void refreshDashboard(false);
    };
    const handleVisibility = () => {
      if (!document.hidden) {
        void refreshDashboard(false);
      }
    };

    window.addEventListener(PROGRESS_UPDATE_EVENT, handleExternalUpdate as EventListener);
    window.addEventListener('focus', handleExternalUpdate);
    document.addEventListener('visibilitychange', handleVisibility);

    const pollId = window.setInterval(() => {
      if (!document.hidden) {
        void refreshDashboard(false);
      }
    }, 15000);

    return () => {
      window.removeEventListener(PROGRESS_UPDATE_EVENT, handleExternalUpdate as EventListener);
      window.removeEventListener('focus', handleExternalUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(pollId);
    };
  }, [refreshDashboard]);

  // Summary stats for the header
  const headerStats = useMemo(() => [
    {
      label: 'Streak',
      value: `${data.streak.currentStreak}`,
      icon: '🔥',
      color: '#f59e0b',
      sub: 'days',
    },
    {
      label: 'Solved',
      value: `${data.problemSolving.totalSolved}`,
      icon: '✅',
      color: '#10b981',
      sub: 'problems',
    },
    {
      label: 'Badges',
      value: `${data.badges.totalUnlocked}`,
      icon: '🏆',
      color: '#a855f7',
      sub: `of ${data.badges.totalBadges}`,
    },
    {
      label: 'Active',
      value: `${data.activity.activeDays}`,
      icon: '📅',
      color: '#06b6d4',
      sub: 'days',
    },
  ], [data]);

  return (
    <div className="min-h-screen pb-10">
      {/* ── Header Section ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-6"
      >
        {/* Title + refresh + live indicator */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <motion.span
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                className="text-3xl"
              >
                📊
              </motion.span>
              Progress Intelligence
            </h1>
            <p className="text-sm text-white/40 mt-1 flex items-center gap-2">
              Your performance analytics & growth insights
              {isLive && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  LIVE
                </span>
              )}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
              border: '1px solid rgba(99,102,241,0.2)',
              color: '#a5b4fc',
            }}
          >
            <span className={`text-base ${isLoading ? 'animate-spin' : ''}`}>🔄</span>
            {isLoading ? 'Loading...' : 'Refresh'}
          </motion.button>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {headerStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}
              className="rounded-xl p-4 flex items-center gap-3 group cursor-default"
              style={{
                background: `linear-gradient(135deg, ${stat.color}08, ${stat.color}03)`,
                border: `1px solid ${stat.color}15`,
                backdropFilter: 'blur(10px)',
              }}
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">{stat.icon}</span>
              <div>
                <div className="text-2xl font-bold text-white leading-tight">{stat.value}</div>
                <div className="text-xs text-white/40">{stat.sub}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Tab Navigation ─────────────────────────────────────── */}
      <div className="mb-6 overflow-x-auto">
        <div
          className="inline-flex rounded-xl p-1 gap-1 min-w-full sm:min-w-0"
          style={{
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5"
              style={{
                color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.45)',
              }}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.15))',
                    border: '1px solid rgba(99,102,241,0.2)',
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10 text-base">{tab.icon}</span>
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content Area ───────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          <Suspense fallback={<SectionSkeleton />}>
            {/* ── Overview Tab ── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <SectionBoundary title="Contribution Heatmap">
                  <ContributionHeatmap data={data.contributions} onYearChange={handleYearChange} />
                </SectionBoundary>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SectionBoundary title="Time Analytics">
                    <TimeAnalytics data={data.timeAnalytics} />
                  </SectionBoundary>
                  <SectionBoundary title="Skill Map">
                    <TopicBubbleMap data={data.topicMap} />
                  </SectionBoundary>
                </div>

                {/* Badge highlights */}
                <SectionBoundary title="Recent Achievements">
                  <div
                    className="rounded-2xl p-5"
                    style={{
                      background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        🏆 Recent Achievements
                      </h3>
                      <button
                        onClick={() => setActiveTab('badges')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        View all →
                      </button>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      {data.badges.recentlyUnlocked.length === 0 && (
                        <div className="text-xs text-white/40">
                          New achievements will appear here after your next milestone.
                        </div>
                      )}
                      {data.badges.recentlyUnlocked.map((badge, i) => (
                        <motion.div
                          key={badge.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          <span className="text-xl">{badge.icon}</span>
                          <div>
                            <div className="text-xs font-medium text-white">{badge.name}</div>
                            <div className="text-[10px] text-white/30">{badge.description}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </SectionBoundary>

                {/* Intelligence preview */}
                <SectionBoundary title="Quick Insights">
                  <div
                    className="rounded-2xl p-5"
                    style={{
                      background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        🧠 Quick Insights
                      </h3>
                      <button
                        onClick={() => setActiveTab('insights')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        View all →
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {data.intelligence.insights.length === 0 && (
                        <div className="text-xs text-white/40">
                          Insights will appear once there is enough real activity to analyze.
                        </div>
                      )}
                      {data.intelligence.insights.slice(0, 4).map((insight, i) => (
                        <motion.div
                          key={insight.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center gap-2.5 p-3 rounded-xl"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          <span className="text-xl">{insight.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-white truncate">{insight.title}</div>
                            <div className="text-[10px] text-white/35 truncate">{insight.description}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </SectionBoundary>
              </div>
            )}

            {/* ── Problems Tab ── */}
            {activeTab === 'problems' && (
              <SectionBoundary title="Problem Solving Stats">
                <ProblemSolvingStats data={data.problemSolving} />
              </SectionBoundary>
            )}

            {/* ── Skills Tab ── */}
            {activeTab === 'skills' && (
              <SectionBoundary title="Skill Map">
                <TopicBubbleMap data={data.topicMap} />
              </SectionBoundary>
            )}

            {/* ── Time Tab ── */}
            {activeTab === 'time' && (
              <div className="space-y-6">
                <SectionBoundary title="Time Analytics">
                  <TimeAnalytics data={data.timeAnalytics} />
                </SectionBoundary>
                <SectionBoundary title="Activity Tracking">
                  <ActivityTracking data={data.activity} />
                </SectionBoundary>
              </div>
            )}

            {/* ── Activity Tab (NEW) ── */}
            {activeTab === 'activity' && (
              <SectionBoundary title="Activity Timeline">
                <ActivityTimeline />
              </SectionBoundary>
            )}

            {/* ── Badges Tab ── */}
            {activeTab === 'badges' && (
              <SectionBoundary title="Achievements">
                <BadgeSystem data={data.badges} />
              </SectionBoundary>
            )}

            {/* ── Insights Tab ── */}
            {activeTab === 'insights' && (
              <SectionBoundary title="Intelligence Hub">
                <IntelligentInsights data={data.intelligence} />
              </SectionBoundary>
            )}
          </Suspense>
        </motion.div>
      </AnimatePresence>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div className="mt-8 text-center text-xs text-white/20">
        Last updated: {new Date(data.lastUpdated).toLocaleString()} · Progress Intelligence Dashboard v2.0
        {isLive && ' · Real-Time Engine Connected'}
      </div>
    </div>
  );
}
