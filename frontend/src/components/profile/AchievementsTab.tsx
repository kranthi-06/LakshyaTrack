import { useMemo, useState } from 'react';
import { Award } from 'lucide-react';
import type { Badge, BadgeSystemData } from '../../progress-system/types';
import { Link } from 'react-router-dom';
import BadgeArtwork from '../../badges/BadgeArtwork';
import { getBadgeRarityTheme } from '../../badges/badgeRegistry';

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
                    {data.badges.map((badge) => {
                        const theme = getBadgeRarityTheme(badge.rarity);
                        return (
                            <button
                                key={badge.id}
                                type="button"
                                onClick={() => setSelectedId(badge.id)}
                                aria-pressed={selected?.id === badge.id}
                                className={`rounded-2xl border p-3 text-left transition-colors ${
                                    selected?.id === badge.id
                                        ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-400/60 dark:bg-indigo-500/10'
                                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950'
                                }`}
                            >
                                <BadgeArtwork
                                    badgeId={badge.id}
                                    name={badge.name}
                                    rarity={badge.rarity}
                                    isUnlocked={badge.isUnlocked}
                                    size={64}
                                    progress={badge.progress}
                                    decorative
                                />
                                <p className="mt-2 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{badge.name}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.color }}>
                                    {theme.label}
                                </p>
                            </button>
                        );
                    })}
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
    const theme = badge ? getBadgeRarityTheme(badge.rarity) : null;

    return (
        <aside className="space-y-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                {badge ? (
                    <>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Selected badge</p>
                        <div className="mt-3">
                            <BadgeArtwork
                                badgeId={badge.id}
                                name={badge.name}
                                rarity={badge.rarity}
                                isUnlocked={badge.isUnlocked}
                                size={112}
                                progress={badge.progress}
                                priority
                            />
                        </div>
                        <h4 className="mt-3 text-xl font-black text-slate-900 dark:text-white">{badge.name}</h4>
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
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${Math.min(100, badge.progress)}%`, background: theme?.color ?? '#6C63FF' }}
                                    />
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
                            <li key={item.id} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                                <BadgeArtwork
                                    badgeId={item.id}
                                    name={item.name}
                                    rarity={item.rarity}
                                    isUnlocked
                                    size={32}
                                    decorative
                                />
                                {item.name}
                            </li>
                        ))}
                    </ul>
                )}
                {next && (
                    <div className="mt-4 flex items-center gap-2.5">
                        <BadgeArtwork
                            badgeId={next.id}
                            name={next.name}
                            rarity={next.rarity}
                            isUnlocked={next.isUnlocked}
                            size={32}
                            progress={next.progress}
                            decorative
                        />
                        <p className="text-xs text-slate-400">
                            Next: {next.name} ({next.progress}%)
                        </p>
                    </div>
                )}
            </article>
        </aside>
    );
}
