import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  Clock3,
  MousePointerClick,
  Radio,
  TimerReset,
  WifiOff,
} from 'lucide-react';
import {
  fetchTimeline,
  type ProgressStreamMessage,
  type TimelineEvent,
} from '../services/progressApi';
import type { DetailLevel } from './Sidebar';

export type FeedStatus = 'active' | 'syncing' | 'offline';

interface ActivityFeedProps {
  detailLevel: DetailLevel;
  refreshToken: number;
  streamMessages: ProgressStreamMessage[];
  status: FeedStatus;
  variant?: 'compact' | 'full';
}

type TimeFilter = 'today' | 'week' | 'month' | 'all';

interface FeedItem {
  id: string;
  title: string;
  description: string;
  timeLabel: string;
  icon: ReactNode;
  toneClass: string;
  tags: string[];
  live: boolean;
}

const FILTERS: { value: TimeFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All' },
];

function formatRelativeTime(timestamp: string): string {
  const value = new Date(timestamp).getTime();
  if (Number.isNaN(value)) {
    return 'Just now';
  }

  const deltaSeconds = Math.max(0, Math.round((Date.now() - value) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  if (deltaSeconds < 3600) return `${Math.round(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 86400) return `${Math.round(deltaSeconds / 3600)}h ago`;
  return `${Math.round(deltaSeconds / 86400)}d ago`;
}

function iconForTimeline(event: TimelineEvent): ReactNode {
  switch (event.type) {
    case 'PROBLEM_SOLVED':
      return <ArrowUpRight className="h-4 w-4" />;
    case 'FEATURE_USED':
      return <MousePointerClick className="h-4 w-4" />;
    case 'SESSION_START':
    case 'SESSION_END':
      return <TimerReset className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}

function toneForType(type: string): string {
  switch (type) {
    case 'PROBLEM_SOLVED':
      return 'bg-emerald-500/12 text-emerald-500 border-emerald-500/20';
    case 'FEATURE_USED':
      return 'bg-indigo-500/12 text-indigo-500 border-indigo-500/20';
    case 'SESSION_START':
    case 'SESSION_END':
      return 'bg-sky-500/12 text-sky-500 border-sky-500/20';
    default:
      return 'bg-slate-500/12 text-[var(--pi-text-soft)] border-[var(--pi-border)]';
  }
}

function mapTimelineItem(event: TimelineEvent): FeedItem {
  const tags = Object.entries(event.metadata || {})
    .filter(([key]) => !['id', 'status'].includes(key))
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`);

  return {
    id: `timeline-${event.id}`,
    title: event.description,
    description: event.type.replace(/_/g, ' '),
    timeLabel: formatRelativeTime(event.timestamp),
    icon: iconForTimeline(event),
    toneClass: toneForType(event.type),
    tags,
    live: false,
  };
}

function mapStreamItem(message: ProgressStreamMessage, index: number): FeedItem {
  const eventTypes = (message.eventTypes || []).slice(0, 3).join(', ') || 'background activity';
  const persisted = message.persistence?.mongo || message.persistence?.sql || 0;

  return {
    id: `stream-${message.timestamp || index}-${index}`,
    title: message.kind === 'progress_update' ? 'Live telemetry update' : 'Realtime channel activity',
    description: `${eventTypes}${persisted ? ` • ${persisted} persisted` : ''}`,
    timeLabel: message.timestamp ? formatRelativeTime(message.timestamp) : 'Just now',
    icon: <Radio className="h-4 w-4" />,
    toneClass: 'bg-amber-500/12 text-amber-500 border-amber-500/20',
    tags: [
      message.eventCount ? `${message.eventCount} event${message.eventCount === 1 ? '' : 's'}` : 'Live event',
      message.kind || 'stream',
    ],
    live: true,
  };
}

function ActivityFeed({
  detailLevel,
  refreshToken,
  streamMessages,
  status,
  variant = 'full',
}: ActivityFeedProps) {
  const [filter, setFilter] = useState<TimeFilter>('today');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const response = await fetchTimeline(filter, 1, variant === 'compact' ? 6 : 16);
        if (!cancelled) {
          setTimeline(response.events);
        }
      } catch {
        if (!cancelled) {
          setTimeline([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [filter, refreshToken, variant]);

  const items = useMemo(() => {
    const liveItems = streamMessages.slice(0, variant === 'compact' ? 3 : 6).map(mapStreamItem);
    const historyItems = timeline.map(mapTimelineItem);
    const merged = [...liveItems, ...historyItems];
    const maxItems = variant === 'compact'
      ? detailLevel === 'deep' ? 8 : 6
      : detailLevel === 'overview' ? 10 : detailLevel === 'detailed' ? 14 : 20;
    return merged.slice(0, maxItems);
  }, [detailLevel, streamMessages, timeline, variant]);

  const emptyLabel =
    status === 'offline'
      ? 'Offline cache active. Live events will resume when the connection returns.'
      : 'Tracked activity will appear here as soon as the realtime pipeline receives user events.';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-semibold text-[var(--pi-text)]">Live activity feed</div>
          <div className="text-sm text-[var(--pi-text-soft)]">
            {status === 'active'
              ? 'Telemetry is streaming into the dashboard in real time.'
              : status === 'syncing'
                ? 'The dashboard is refreshing and reconciling the latest activity.'
                : 'Realtime transport is offline. Historical activity is still available.'}
          </div>
        </div>

        {variant === 'full' && (
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold ${
                  filter === option.value
                    ? 'border-[var(--pi-border-strong)] bg-[var(--pi-accent-soft)] text-[var(--pi-text)]'
                    : 'border-[var(--pi-border)] bg-[var(--pi-surface-soft)] text-[var(--pi-text-soft)] hover:bg-[var(--pi-surface)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={`pi-scroll space-y-3 overflow-y-auto ${variant === 'compact' ? 'max-h-[22rem]' : 'max-h-[33rem]'}`}>
        {loading ? (
          Array.from({ length: variant === 'compact' ? 4 : 6 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-[22px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4">
              <div className="h-4 w-32 rounded-full bg-slate-300/40 dark:bg-slate-700/40" />
              <div className="mt-3 h-3 w-4/5 rounded-full bg-slate-300/30 dark:bg-slate-700/30" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-slate-300/20 dark:bg-slate-700/20" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-5 text-sm text-[var(--pi-text-soft)]">
            {emptyLabel}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.24, delay: index * 0.02 }}
                className="rounded-[24px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${item.toneClass}`}>
                    {item.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--pi-text)]">{item.title}</div>
                        <div className="mt-1 text-xs text-[var(--pi-text-soft)]">{item.description}</div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[var(--pi-text-soft)]">
                        {item.live && (
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 pi-pulse-dot" />
                        )}
                        <Clock3 className="h-3.5 w-3.5" />
                        {item.timeLabel}
                      </div>
                    </div>

                    {item.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.tags.map((tag) => (
                          <span
                            key={`${item.id}-${tag}`}
                            className="rounded-full border border-[var(--pi-border)] bg-[var(--pi-surface)] px-2.5 py-1 text-[0.68rem] text-[var(--pi-text-soft)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="rounded-[22px] border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] px-4 py-3 text-xs text-[var(--pi-text-soft)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2">
            {status === 'offline' ? <WifiOff className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5" />}
            {status === 'active' ? 'Sub-second stream connected' : status === 'syncing' ? 'Refresh fallback engaged' : 'Offline cache mode'}
          </span>
          <span className="inline-flex items-center gap-2">
            <TimerReset className="h-3.5 w-3.5" />
            Timeline snapshots are reconciled automatically after each live update
          </span>
        </div>
      </div>
    </div>
  );
}

export default memo(ActivityFeed);
