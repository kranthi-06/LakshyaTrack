import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTimeline, type TimelineEvent } from '../../progress-system/services/progressApi';
import type { ActivitySummary } from '../../progress-system/types';

type TimeFilter = 'today' | 'week' | 'month' | 'all';

interface Props {
    summary: ActivitySummary;
    loading: boolean;
    unavailable?: boolean;
    onRetry?: () => void;
}

export function ActivityTab({ summary, loading, unavailable = false, onRetry }: Props) {
    const [filter, setFilter] = useState<TimeFilter>('week');
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [feedLoading, setFeedLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (nextFilter: TimeFilter, nextPage: number, append = false) => {
        setFeedLoading(!append);
        setError(null);
        try {
            const data = await fetchTimeline(nextFilter, nextPage, 20);
            setEvents((prev) => (append ? [...prev, ...data.events] : data.events));
            setTotal(data.total);
            setHasMore(data.has_more);
            setPage(nextPage);
        } catch {
            setError('Could not load your activity feed.');
        } finally {
            setFeedLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(filter, 1);
    }, [filter, load]);

    return (
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.3fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                <h3 className="font-black text-slate-900 dark:text-white">Activity summary</h3>
                {unavailable ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                        <p>Activity summary unavailable right now.</p>
                        {onRetry && (
                            <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">Retry</button>
                        )}
                    </div>
                ) : loading ? (
                    <p className="mt-4 text-sm text-slate-400">Loading tracked activity…</p>
                ) : (
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><dt className="text-xs text-slate-400">Sessions</dt><dd className="text-xl font-black text-slate-900 dark:text-white">{summary.totalSessions}</dd></div>
                        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><dt className="text-xs text-slate-400">Active days</dt><dd className="text-xl font-black text-slate-900 dark:text-white">{summary.activeDays}</dd></div>
                        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><dt className="text-xs text-slate-400">Active minutes</dt><dd className="text-xl font-black text-slate-900 dark:text-white">{summary.totalActiveTime}</dd></div>
                        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><dt className="text-xs text-slate-400">Avg session</dt><dd className="text-xl font-black text-slate-900 dark:text-white">{summary.avgSessionDuration}m</dd></div>
                    </dl>
                )}
                <p className="mt-4 text-xs text-slate-400">
                    Heatmaps, hourly rhythm, and skill bubbles remain on{' '}
                    <Link to="/progress" className="font-semibold text-[#6C63FF]">Progress Intelligence</Link>.
                </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-black text-slate-900 dark:text-white">Timeline {total > 0 ? `· ${total}` : ''}</h3>
                    <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
                        {(['today', 'week', 'month', 'all'] as TimeFilter[]).map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setFilter(item)}
                                aria-pressed={filter === item}
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ${filter === item ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        <span>{error}</span>
                        <button type="button" className="font-semibold" onClick={() => void load(filter, 1)}>Retry</button>
                    </div>
                )}

                <div className="mt-4 space-y-3">
                    {feedLoading ? (
                        <p className="text-sm text-slate-400">Loading timeline…</p>
                    ) : error && events.length === 0 ? null : events.length === 0 ? (
                        <p className="text-sm text-slate-400">No tracked events in this period.</p>
                    ) : (
                        events.map((event) => (
                            <div key={event.id} className="flex gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                                <span className="text-lg" aria-hidden>{event.icon}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{event.description}</p>
                                    <p className="text-xs text-slate-400">{new Date(event.timestamp).toLocaleString()}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {hasMore && !feedLoading && (
                    <button
                        type="button"
                        onClick={() => void load(filter, page + 1, true)}
                        className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700"
                    >
                        Load more
                    </button>
                )}
            </article>
        </div>
    );
}
