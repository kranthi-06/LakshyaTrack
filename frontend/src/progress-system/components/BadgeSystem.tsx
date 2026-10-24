import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import BadgeArtwork from '@/badges/BadgeArtwork';
import { getBadgeRarityTheme } from '@/badges/badgeRegistry';
import {
  mutedTextClassName,
  panelClassName,
  strongTextClassName,
  surfaceClassName,
  surfaceHoverClassName,
  titleTextClassName,
} from '../ui/surfaces';
import { SkeletonBlock, SkeletonText } from '../ui/loading';
import type { BadgeSystemData, Badge } from '../types';

interface Props {
  data: BadgeSystemData;
  loading?: boolean;
}

const surfaceCardClassName = `rounded-2xl p-5 ${surfaceClassName} ${surfaceHoverClassName}`;

function BadgeCard({ badge, index }: { badge: Badge; index: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const rarity = getBadgeRarityTheme(badge.rarity);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 210 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative rounded-xl border p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 ${panelClassName}`}
      style={{
        borderColor: badge.isUnlocked ? rarity.border : undefined,
        background: badge.isUnlocked ? `linear-gradient(135deg, ${rarity.soft}, transparent)` : undefined,
        opacity: badge.isUnlocked ? 1 : 0.78,
        boxShadow: isHovered && badge.isUnlocked ? `0 12px 28px ${rarity.glow}` : 'none',
      }}
    >
      <div
        className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{
          background: `${rarity.color}14`,
          color: rarity.color,
        }}
      >
        {rarity.label}
      </div>

      <div className="mb-3 w-fit transition-transform duration-300 group-hover:scale-[1.03]">
        <BadgeArtwork
          badgeId={badge.id}
          name={badge.name}
          rarity={badge.rarity}
          isUnlocked={badge.isUnlocked}
          size={92}
          progress={badge.progress}
          decorative
        />
      </div>
      <div className={`mb-1 pr-16 text-sm font-semibold ${titleTextClassName}`}>{badge.name}</div>
      <div className={`mb-3 line-clamp-2 text-xs ${mutedTextClassName}`}>{badge.description}</div>

      {!badge.isUnlocked && (
        <div>
          <div className={`mb-1 flex items-center justify-between text-xs ${mutedTextClassName}`}>
            <span>
              {badge.currentValue}/{badge.requirementValue}
            </span>
            <span style={{ color: rarity.color }} className="font-semibold">
              {badge.progress}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: rarity.color }}
              initial={{ width: 0 }}
              animate={{ width: `${badge.progress}%` }}
              transition={{ duration: 0.9, delay: index * 0.05 }}
            />
          </div>
        </div>
      )}

      {badge.isUnlocked && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">Unlocked</span>
          {badge.unlockedAt && (
            <span className={`text-xs ${mutedTextClassName}`}>
              {new Date(badge.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

const BadgeSystem = memo(function BadgeSystem({ data, loading = false }: Props) {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const completionPercent = data.totalBadges > 0 ? Math.round((data.totalUnlocked / data.totalBadges) * 100) : 0;
  const categories = ['all', ...new Set(data.badges.map((badge) => badge.category))];

  const filteredBadges = data.badges.filter((badge) => {
    if (filter === 'unlocked' && !badge.isUnlocked) return false;
    if (filter === 'locked' && badge.isUnlocked) return false;
    if (categoryFilter !== 'all' && badge.category !== categoryFilter) return false;
    return true;
  });

  const nextBadge = data.nextToUnlock;
  const nextRarity = nextBadge ? getBadgeRarityTheme(nextBadge.rarity) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="min-w-0">
      <Card className={surfaceCardClassName}>
        {loading ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SkeletonText lines={['w-40', 'w-56']} />
              <div className="flex items-center gap-2">
                <SkeletonBlock className="h-2 w-24 rounded-full" />
                <SkeletonBlock className="h-3 w-10" />
              </div>
            </div>

            <div className={`mb-5 flex items-center gap-3 rounded-xl border p-4 ${panelClassName}`}>
              <SkeletonBlock className="h-10 w-10 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-32" />
                <SkeletonBlock className="h-3 w-48" />
              </div>
              <div className="space-y-2 text-right">
                <SkeletonBlock className="h-4 w-12" />
                <SkeletonBlock className="h-3 w-12" />
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <SkeletonBlock className="h-9 w-36 rounded-xl" />
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 4 }, (_, index) => (
                  <SkeletonBlock key={index} className="h-7 w-24 rounded-full" />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className={`rounded-xl border p-4 ${panelClassName}`}>
                  <SkeletonBlock className="mb-3 h-10 w-10 rounded-full" />
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonText className="mt-3" lines={['w-full', 'w-5/6']} />
                  <SkeletonBlock className="mt-4 h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className={`text-base font-semibold ${titleTextClassName}`}>
              Achievements <span className={`ml-1 text-sm font-normal ${mutedTextClassName}`}>{data.totalUnlocked}/{data.totalBadges}</span>
            </h3>
            <p className={`mt-1 text-xs ${mutedTextClassName}`}>Rarity, unlock progress, and your next milestone.</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
                initial={{ width: 0 }}
                animate={{ width: `${completionPercent}%` }}
                transition={{ duration: 1.2 }}
              />
            </div>
            <span className={`text-xs font-semibold ${strongTextClassName}`}>{completionPercent}%</span>
          </div>
        </div>

        {nextBadge && nextRarity && (
          <motion.div
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            className={`mb-5 flex items-center gap-3 rounded-xl border p-3.5 ${panelClassName}`}
            style={{
              borderColor: nextRarity.border,
              background: `linear-gradient(135deg, ${nextRarity.soft}, transparent)`,
            }}
          >
            <BadgeArtwork
              badgeId={nextBadge.id}
              name={nextBadge.name}
              rarity={nextBadge.rarity}
              isUnlocked={nextBadge.isUnlocked}
              size={56}
              progress={nextBadge.progress}
              decorative
            />
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-semibold ${titleTextClassName}`}>Next: {nextBadge.name}</div>
              <div className={`truncate text-xs ${mutedTextClassName}`}>{nextBadge.requirement}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-bold" style={{ color: nextRarity.color }}>
                {nextBadge.progress}%
              </div>
              <div className={`text-xs ${mutedTextClassName}`}>
                {nextBadge.currentValue}/{nextBadge.requirementValue}
              </div>
            </div>
          </motion.div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <div className="flex overflow-hidden rounded-xl border border-slate-200/70 bg-white/70 dark:border-slate-800/60 dark:bg-slate-950/30">
            {(['all', 'unlocked', 'locked'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === value
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : `${mutedTextClassName} hover:text-slate-900 dark:hover:text-white`
                }`}
              >
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setCategoryFilter(category)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  categoryFilter === category
                    ? 'border border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
                    : 'border border-slate-200/70 bg-white/60 text-slate-500 dark:border-slate-800/60 dark:bg-slate-950/30 dark:text-slate-400'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredBadges.map((badge, index) => (
              <BadgeCard key={badge.id} badge={badge} index={index} />
            ))}
          </AnimatePresence>
        </div>

        {filteredBadges.length === 0 && (
          <div className={`py-8 text-center text-sm ${mutedTextClassName}`}>No badges match the current filter.</div>
        )}
          </>
        )}
      </Card>
    </motion.div>
  );
});

export default BadgeSystem;
