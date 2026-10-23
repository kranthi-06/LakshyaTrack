import { useMemo, useState, useCallback, useEffect } from 'react';
import { Award, Lock, ChevronLeft, ChevronRight, Share2, Calendar, TrendingUp } from 'lucide-react';
import type { Badge, BadgeSystemData } from '../../progress-system/types';
import { Link } from 'react-router-dom';

const RARITY_COLOR: Record<string, { bg: string; border: string; glow: string; bgLight: string; borderLight: string; glowLight: string }> = {
    common: { 
        bg: 'from-slate-600 to-slate-700', 
        border: 'border-slate-500', 
        glow: 'shadow-slate-500/20',
        bgLight: 'from-slate-300 to-slate-400',
        borderLight: 'border-slate-400',
        glowLight: 'shadow-slate-400/20'
    },
    rare: { 
        bg: 'from-blue-600 to-cyan-600', 
        border: 'border-blue-400', 
        glow: 'shadow-blue-500/30',
        bgLight: 'from-blue-300 to-cyan-300',
        borderLight: 'border-blue-400',
        glowLight: 'shadow-blue-400/30'
    },
    epic: { 
        bg: 'from-violet-600 to-purple-600', 
        border: 'border-violet-400', 
        glow: 'shadow-violet-500/30',
        bgLight: 'from-violet-300 to-purple-300',
        borderLight: 'border-violet-400',
        glowLight: 'shadow-violet-400/30'
    },
    legendary: { 
        bg: 'from-amber-500 to-orange-500', 
        border: 'border-amber-400', 
        glow: 'shadow-amber-500/40',
        bgLight: 'from-amber-300 to-orange-300',
        borderLight: 'border-amber-400',
        glowLight: 'shadow-amber-400/40'
    },
};

interface Props {
    data: BadgeSystemData;
    loading: boolean;
    error?: string | null;
    onRetry?: () => void;
}

export function AchievementGalleryPremium({ data, loading, error = null, onRetry }: Props) {
    const unlocked = data.recentlyUnlocked[0] || data.badges.find((badge) => badge.isUnlocked) || null;
    const [selectedId, setSelectedId] = useState<string | null>(unlocked?.id ?? null);
    const [currentIndex, setCurrentIndex] = useState(0);
    
    const selected = useMemo(
        () => data.badges.find((badge) => badge.id === selectedId) || unlocked,
        [data.badges, selectedId, unlocked],
    );

    const sortedBadges = useMemo(() => {
        return [...data.badges].sort((a, b) => {
            if (a.isUnlocked && !b.isUnlocked) return -1;
            if (!a.isUnlocked && b.isUnlocked) return 1;
            return 0;
        });
    }, [data.badges]);

    const selectedIndex = useMemo(() => {
        return sortedBadges.findIndex(b => b.id === selected?.id);
    }, [sortedBadges, selected]);

    useEffect(() => {
        if (selectedIndex >= 0) {
            setCurrentIndex(selectedIndex);
        }
    }, [selectedIndex]);

    const handlePrevious = useCallback(() => {
        const newIndex = currentIndex > 0 ? currentIndex - 1 : sortedBadges.length - 1;
        setCurrentIndex(newIndex);
        setSelectedId(sortedBadges[newIndex].id);
    }, [currentIndex, sortedBadges]);

    const handleNext = useCallback(() => {
        const newIndex = currentIndex < sortedBadges.length - 1 ? currentIndex + 1 : 0;
        setCurrentIndex(newIndex);
        setSelectedId(sortedBadges[newIndex].id);
    }, [currentIndex, sortedBadges]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowLeft') handlePrevious();
        if (e.key === 'ArrowRight') handleNext();
    }, [handlePrevious, handleNext]);

    const getVisibleBadges = useCallback(() => {
        const visible: (Badge | null)[] = [];
        const count = 5;
        
        for (let i = -2; i <= 2; i++) {
            const index = (currentIndex + i + sortedBadges.length) % sortedBadges.length;
            visible.push(sortedBadges[index]);
        }
        
        return visible;
    }, [currentIndex, sortedBadges]);

    const visibleBadges = getVisibleBadges();

    if (loading && data.totalBadges === 0) {
        return (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-950/50 p-8 text-sm text-slate-500 dark:text-slate-400">
                Loading achievements…
            </div>
        );
    }

    if (error && data.totalBadges === 0) {
        return (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-6 py-10 text-center">
                <Award className="mx-auto h-10 w-10 text-rose-400 dark:text-rose-300" />
                <h3 className="mt-4 text-lg font-black text-rose-800 dark:text-rose-200">Achievements unavailable</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-rose-700 dark:text-rose-300">{error}</p>
                {onRetry && (
                    <button type="button" onClick={onRetry} className="mt-4 rounded-xl border border-rose-300 dark:border-rose-500/40 px-4 py-2 text-sm font-semibold text-rose-700 dark:text-rose-200">
                        Retry
                    </button>
                )}
            </div>
        );
    }

    if (data.totalBadges === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-950/50 px-6 py-16 text-center">
                <Award className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                <h3 className="mt-4 text-lg font-black text-slate-800 dark:text-slate-300">No achievement catalog yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                    Badges unlock from real LakshyaTrack activity. Nothing is shown until the progress engine returns your collection.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <div role="status" className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
                    Showing cached achievements. The latest refresh failed.
                </div>
            )}
            
            {/* Gallery Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">Badge Gallery</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {data.totalUnlocked} of {data.totalBadges} unlocked
                    </p>
                </div>
                <Link to="/progress" className="flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300">
                    <TrendingUp className="h-4 w-4" />
                    Analytics
                </Link>
            </div>

            {/* Cinematic Carousel */}
            <div 
                className="relative flex items-center justify-center gap-4 py-8"
                onKeyDown={handleKeyDown}
                tabIndex={0}
                role="region"
                aria-label="Achievement gallery carousel"
            >
                {/* Previous Button */}
                <button
                    type="button"
                    onClick={handlePrevious}
                    className="absolute left-0 z-20 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-3 text-slate-500 dark:text-slate-400 hover:border-violet-500/50 dark:hover:border-violet-500/50 hover:bg-violet-50 dark:hover:bg-violet-500/20 hover:text-violet-600 dark:hover:text-violet-300 transition-all"
                    aria-label="Previous badge"
                >
                    <ChevronLeft className="h-6 w-6" />
                </button>

                {/* Badge Cards */}
                <div className="flex items-center justify-center gap-3">
                    {visibleBadges.map((badge, index) => {
                        if (!badge) return null;
                        const offset = index - 2;
                        const isSelected = offset === 0;
                        const rarityStyle = RARITY_COLOR[badge.rarity] || RARITY_COLOR.common;
                        
                        return (
                            <button
                                key={badge.id}
                                type="button"
                                onClick={() => setSelectedId(badge.id)}
                                aria-pressed={isSelected}
                                className={`
                                    relative flex-shrink-0 rounded-2xl border p-4 text-left transition-all duration-300
                                    ${isSelected 
                                        ? `w-48 h-56 ${rarityStyle.border} dark:${rarityStyle.border} bg-gradient-to-br ${rarityStyle.bgLight} dark:${rarityStyle.bg} shadow-2xl ${rarityStyle.glowLight} dark:${rarityStyle.glow} scale-100 z-10` 
                                        : offset === -1 || offset === 1
                                            ? 'w-36 h-44 border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/50 scale-90 opacity-60 hover:opacity-80'
                                            : 'w-28 h-32 border-slate-200 dark:border-slate-800/30 bg-slate-50 dark:bg-slate-900/30 scale-75 opacity-40'
                                    }
                                `}
                            >
                                {/* Glow effect for selected */}
                                {isSelected && (
                                    <div className={`absolute -inset-1 rounded-2xl bg-gradient-to-br ${rarityStyle.bgLight} dark:${rarityStyle.bg} opacity-30 blur-xl`} />
                                )}
                                
                                <div className="relative">
                                    <div className="flex items-start justify-between">
                                        <span className={`text-4xl ${badge.isUnlocked ? '' : 'grayscale opacity-50'}`}>
                                            {badge.icon}
                                        </span>
                                        {!badge.isUnlocked && (
                                            <Lock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                        )}
                                    </div>
                                    <p className={`mt-4 truncate font-bold text-slate-800 dark:text-white ${isSelected ? 'text-base' : 'text-sm'}`}>
                                        {badge.name}
                                    </p>
                                    {isSelected && (
                                        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-white/80">
                                            {badge.rarity}
                                        </p>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Next Button */}
                <button
                    type="button"
                    onClick={handleNext}
                    className="absolute right-0 z-20 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-3 text-slate-500 dark:text-slate-400 hover:border-violet-500/50 dark:hover:border-violet-500/50 hover:bg-violet-50 dark:hover:bg-violet-500/20 hover:text-violet-600 dark:hover:text-violet-300 transition-all"
                    aria-label="Next badge"
                >
                    <ChevronRight className="h-6 w-6" />
                </button>
            </div>

            {/* Selected Badge Details Panel */}
            <SelectedBadgePanel badge={selected} recent={data.recentlyUnlocked} next={data.nextToUnlock} />
        </div>
    );
}

function SelectedBadgePanel({
    badge,
    recent,
    next,
}: {
    badge: Badge | null | undefined;
    recent: Badge[];
    next: Badge | null;
}) {
    const rarityStyle = badge ? RARITY_COLOR[badge.rarity] || RARITY_COLOR.common : null;

    return (
        <aside className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            {/* Main Badge Details */}
            <article className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/50 backdrop-blur-sm p-6">
                {badge ? (
                    <>
                        {/* Background gradient */}
                        <div className={`absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br ${rarityStyle?.bgLight} dark:${rarityStyle?.bg} opacity-10 blur-3xl`} />
                        
                        <div className="relative">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Selected badge</p>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r ${rarityStyle?.bgLight} dark:${rarityStyle?.bg} text-white`}>
                                    {badge.rarity}
                                </span>
                            </div>
                            
                            <div className="mt-6 flex items-center gap-6">
                                <div className={`relative h-24 w-24 rounded-2xl bg-gradient-to-br ${rarityStyle?.bgLight} dark:${rarityStyle?.bg} flex items-center justify-center shadow-xl ${rarityStyle?.glowLight} dark:${rarityStyle?.glow}`}>
                                    <span className="text-6xl">{badge.icon}</span>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-2xl font-black text-slate-900 dark:text-white">{badge.name}</h4>
                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{badge.description}</p>
                                </div>
                            </div>

                            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/50 pt-4">
                                {badge.requirement}
                            </p>

                            {badge.isUnlocked ? (
                                <div className="mt-6 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                        <Calendar className="h-4 w-4" />
                                        Unlocked {badge.unlockedAt ? new Date(badge.unlockedAt).toLocaleDateString() : ''}
                                    </div>
                                    <button className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/20 transition-colors">
                                        <Share2 className="h-4 w-4" />
                                        Share Badge
                                    </button>
                                </div>
                            ) : (
                                <div className="mt-6">
                                    <div className="mb-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                        <span>Progress</span>
                                        <span>{badge.currentValue}/{badge.requirementValue}</span>
                                    </div>
                                    <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                        <div 
                                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 dark:from-violet-600 dark:to-indigo-600 transition-all duration-500"
                                            style={{ width: `${Math.min(100, badge.progress)}%` }}
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{badge.progress}% complete</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Select a badge to inspect its requirements.</p>
                )}
            </article>

            {/* Recent Unlocks */}
            <article className="rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/50 backdrop-blur-sm p-6">
                <h4 className="font-black text-slate-900 dark:text-white">Recent unlocks</h4>
                {recent.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No recent unlocks.</p>
                ) : (
                    <ul className="mt-4 space-y-3">
                        {recent.slice(0, 5).map((item) => {
                            const itemRarity = RARITY_COLOR[item.rarity] || RARITY_COLOR.common;
                            return (
                                <li key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800/30 bg-slate-50 dark:bg-slate-900/30">
                                    <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${itemRarity.bgLight} dark:${itemRarity.bg} flex items-center justify-center`}>
                                        <span className="text-xl">{item.icon}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{item.name}</p>
                                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.rarity}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
                {next && (
                    <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/50">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Next to unlock: <span className="font-semibold text-slate-800 dark:text-white">{next.name}</span> ({next.progress}%)
                        </p>
                    </div>
                )}
            </article>
        </aside>
    );
}
