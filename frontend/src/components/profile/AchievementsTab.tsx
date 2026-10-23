import { useMemo, useState } from 'react';
import { Award, Lock } from 'lucide-react';
import type { Badge, BadgeSystemData } from '../../progress-system/types';
import { Link } from 'react-router-dom';

const RARITY_COLOR: Record<string, string> = {
    common: '#94a3b8',
    rare: '#3b82f6',
    epic: '#8b5cf6',
    legendary: '#f59e0b',
};

interface Props {
    data: BadgeSystemData;
    loading: boolean;
    error?: string | null;
    onRetry?: () => void;
}

export function AchievementsTab({ data, loading, error = null, onRetry }: Props) {
    const unlocked = data.recentlyUnlocked[0] || data.badges.find((badge) => badge.isUnlocked) || null;
    const [selectedId, setSelectedId] = useState<string | null>(unlocked?.id ?? null);
    const selected = useMemo(
        () => data.badges.find((badge) => badge.id === selectedId) || unlocked,
        [data.badges, selectedId, unlocked],
    );

    if (loading && data.totalBadges === 0) {
        return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-950">Loading achievements…</div>;
    }

    if (error && data.totalBadges === 0) {
        return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center dark:border-rose-500/30 dark:bg-rose-500/10">
                <Award className="mx-auto h-10 w-10 text-rose-300" />
                <h3 className="mt-4 text-lg font-black text-rose-800 dark:text-rose-200">Achievements unavailable</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-rose-700 dark:text-rose-300">{error}</p>
                {onRetry && (
                    <button type="button" onClick={onRetry} className="mt-4 rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/40 dark:text-rose-200">
                        Retry
                    </button>
                )}
            </div>
        );
    }

    if (data.totalBadges === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-950">
                <Award className="mx-auto h-10 w-10 text-slate-300" />
                <h3 className="mt-4 text-lg font-black text-slate-800 dark:text-white">No achievement catalog yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                    Badges unlock from real LakshyaTrack activity. Nothing is shown until the progress engine returns your collection.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                    Showing cached achievements. The latest refresh failed.
                </div>
            )}
            <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        Badge gallery · {data.totalUnlocked}/{data.totalBadges}
                    </h3>
                    <Link to="/progress" className="text-xs font-semibold text-[#6C63FF]">Analytics</Link>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {data.badges.map((badge) => (
                        <button
                            key={badge.id}
                            type="button"
                            onClick={() => setSelectedId(badge.id)}
                            aria-pressed={selected?.id === badge.id}
                            className={`rounded-2xl border p-3 text-left transition-colors ${
                                selected?.id === badge.id
                                    ? 'border-[#6C63FF] bg-indigo-50 dark:bg-indigo-500/10'
                                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950'
                            }`}
                        >
                            <div className="flex items-start justify-between">
                                <span className={`text-2xl ${badge.isUnlocked ? '' : 'grayscale opacity-60'}`}>{badge.icon}</span>
                                {!badge.isUnlocked && <Lock className="h-3.5 w-3.5 text-slate-400" />}
                            </div>
                            <p className="mt-2 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{badge.name}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: RARITY_COLOR[badge.rarity] }}>
                                {badge.rarity}
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            <SelectedBadge badge={selected} recent={data.recentlyUnlocked} next={data.nextToUnlock} />
            </div>
        </div>
    );
}

function SelectedBadge({
    badge,
    recent,
    next,
}: {
    badge: Badge | null | undefined;
    recent: Badge[];
    next: Badge | null;
}) {
    return (
        <aside className="space-y-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                {badge ? (
                    <>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Selected badge</p>
                        <div className="mt-3 text-4xl">{badge.icon}</div>
                        <h4 className="mt-2 text-xl font-black text-slate-900 dark:text-white">{badge.name}</h4>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{badge.description}</p>
                        <p className="mt-3 text-xs text-slate-400">{badge.requirement}</p>
                        {badge.isUnlocked ? (
                            <p className="mt-4 text-sm font-semibold text-emerald-600">
                                Unlocked {badge.unlockedAt ? new Date(badge.unlockedAt).toLocaleDateString() : ''}
                            </p>
                        ) : (
                            <div className="mt-4">
                                <div className="mb-1 flex justify-between text-xs text-slate-500">
                                    <span>{badge.currentValue}/{badge.requirementValue}</span>
                                    <span>{badge.progress}%</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                    <div className="h-full rounded-full bg-[#6C63FF]" style={{ width: `${Math.min(100, badge.progress)}%` }} />
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-slate-400">Select a badge to inspect its requirements.</p>
                )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                <h4 className="font-black text-slate-900 dark:text-white">Recent unlocks</h4>
                {recent.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-400">No recent unlocks.</p>
                ) : (
                    <ul className="mt-3 space-y-2">
                        {recent.slice(0, 4).map((item) => (
                            <li key={item.id} className="text-sm text-slate-600 dark:text-slate-300">
                                {item.icon} {item.name}
                            </li>
                        ))}
                    </ul>
                )}
                {next && (
                    <p className="mt-4 text-xs text-slate-400">
                        Next: {next.name} ({next.progress}%)
                    </p>
                )}
            </article>
        </aside>
    );
}
