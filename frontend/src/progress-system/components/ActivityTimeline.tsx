// ══════════════════════════════════════════════════════════════
// Activity Timeline — Chronological User Action Feed
// New tab: real-time activity feed with filters & pagination
// ══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchTimeline, type TimelineEvent, type TimelineResponse } from '../services/progressApi';

type TimeFilter = 'today' | 'week' | 'month' | 'all';

const FILTER_OPTIONS: { label: string; value: TimeFilter }[] = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time', value: 'all' },
];

// ── Single Timeline Item ─────────────────────────────────────

const TimelineItem = memo(({ event, index }: { event: TimelineEvent; index: number }) => {
  const time = new Date(event.timestamp);
  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const typeColors: Record<string, string> = {
    PROBLEM_SOLVED: 'from-green-500/20 to-emerald-500/10 border-green-500/30',
    QUIZ_COMPLETED: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30',
    PAGE_VISIT: 'from-gray-500/20 to-slate-500/10 border-gray-500/30',
    FEATURE_USED: 'from-purple-500/20 to-violet-500/10 border-purple-500/30',
    SESSION_START: 'from-cyan-500/20 to-teal-500/10 border-cyan-500/30',
    SESSION_END: 'from-red-500/20 to-rose-500/10 border-red-500/30',
    INTERVIEW_COMPLETED: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30',
    CODE_EXECUTED: 'from-orange-500/20 to-red-500/10 border-orange-500/30',
    RESUME_ANALYZED: 'from-indigo-500/20 to-blue-500/10 border-indigo-500/30',
    BADGE_UNLOCKED: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/30',
  };

  const dotColors: Record<string, string> = {
    PROBLEM_SOLVED: 'bg-green-400',
    QUIZ_COMPLETED: 'bg-blue-400',
    FEATURE_USED: 'bg-purple-400',
    SESSION_START: 'bg-cyan-400',
    SESSION_END: 'bg-red-400',
    INTERVIEW_COMPLETED: 'bg-amber-400',
    CODE_EXECUTED: 'bg-orange-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="relative flex gap-4 pb-6 last:pb-0"
    >
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full ${dotColors[event.type] || 'bg-gray-400'} ring-4 ring-white/5 z-10 flex-shrink-0`}
        />
        <div className="w-0.5 flex-1 bg-white/10 mt-1" />
      </div>

      {/* Content card */}
      <div
        className={`flex-1 bg-gradient-to-r ${typeColors[event.type] || typeColors.PAGE_VISIT} border rounded-xl px-4 py-3 backdrop-blur-sm`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl flex-shrink-0">{event.icon}</span>
            <p className="text-sm text-white/90 font-medium truncate">{event.description}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-white/50">{dateStr}</p>
            <p className="text-xs text-white/40">{timeStr}</p>
          </div>
        </div>

        {/* Metadata tags */}
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {Object.entries(event.metadata)
              .filter(([k]) => !['id', 'status'].includes(k))
              .slice(0, 3)
              .map(([key, val]) => (
                <span
                  key={key}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10"
                >
                  {key}: {String(val)}
                </span>
              ))}
          </div>
        )}
      </div>
    </motion.div>
  );
});
TimelineItem.displayName = 'TimelineItem';

// ── Empty State ──────────────────────────────────────────────

function EmptyTimeline() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="text-5xl mb-4">📭</div>
      <h3 className="text-lg font-semibold text-white/70 mb-2">No Activity Yet</h3>
      <p className="text-sm text-white/40 max-w-xs">
        Start taking quizzes, practicing interviews, or building resumes to see your activity here.
      </p>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════
// ActivityTimeline Component
// ══════════════════════════════════════════════════════════════

function ActivityTimeline() {
  const [filter, setFilter] = useState<TimeFilter>('today');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadEvents = useCallback(async (f: TimeFilter, p: number, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const data: TimelineResponse = await fetchTimeline(f, p, 20);
      if (append) {
        setEvents((prev) => [...prev, ...data.events]);
      } else {
        setEvents(data.events);
      }
      setTotal(data.total);
      setHasMore(data.has_more);
      setPage(p);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadEvents(filter, 1);
  }, [filter, loadEvents]);

  const handleLoadMore = () => {
    loadEvents(filter, page + 1, true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-[24px] p-5 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(2,6,23,0.35)]"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">📋</span> Activity Timeline
          </h2>
          <p className="text-sm text-white/40 mt-1">
            {total > 0 ? `${total} events tracked` : 'Your chronological activity feed'}
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 bg-white/5 rounded-xl p-1 border border-white/10">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                ${filter === opt.value
                  ? 'bg-indigo-500/80 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-0.5 flex-1 bg-white/5 mt-1" />
                </div>
                <div className="flex-1 h-16 bg-white/5 rounded-xl" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyTimeline />
        ) : (
          <AnimatePresence mode="popLayout">
            {events.map((event, index) => (
              <TimelineItem key={event.id} event={event} index={index} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Load More */}
      {hasMore && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center pt-2"
        >
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 
                       rounded-xl text-sm text-white/60 hover:text-white/80 transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </span>
            ) : (
              `Load More (${total - events.length} remaining)`
            )}
          </button>
        </motion.div>
      )}
    </div>
    </motion.div>
  );
}

export default memo(ActivityTimeline);
