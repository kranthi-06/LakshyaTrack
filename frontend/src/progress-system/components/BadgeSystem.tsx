// ══════════════════════════════════════════════════════════════
// Badge & Achievement System Component
// ══════════════════════════════════════════════════════════════

import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BadgeSystemData, Badge, BadgeRarity } from '../types';

interface Props {
  data: BadgeSystemData;
}

const RARITY_CONFIG: Record<BadgeRarity, { bg: string; border: string; glow: string; label: string; textColor: string }> = {
  common: {
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.2)',
    glow: 'rgba(148,163,184,0.15)',
    label: 'Common',
    textColor: '#94a3b8',
  },
  rare: {
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.2)',
    glow: 'rgba(59,130,246,0.15)',
    label: 'Rare',
    textColor: '#3b82f6',
  },
  epic: {
    bg: 'rgba(168,85,247,0.08)',
    border: 'rgba(168,85,247,0.2)',
    glow: 'rgba(168,85,247,0.15)',
    label: 'Epic',
    textColor: '#a855f7',
  },
  legendary: {
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
    glow: 'rgba(245,158,11,0.15)',
    label: 'Legendary',
    textColor: '#f59e0b',
  },
};

function BadgeCard({ badge, index }: { badge: Badge; index: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const rarity = RARITY_CONFIG[badge.rarity];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 200 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative rounded-xl p-4 cursor-pointer transition-all duration-300 group"
      style={{
        background: badge.isUnlocked
          ? `linear-gradient(135deg, ${rarity.bg}, transparent)`
          : 'rgba(255,255,255,0.02)',
        border: `1px solid ${badge.isUnlocked ? rarity.border : 'rgba(255,255,255,0.05)'}`,
        opacity: badge.isUnlocked ? 1 : 0.6,
        boxShadow: isHovered && badge.isUnlocked ? `0 0 30px ${rarity.glow}` : 'none',
      }}
    >
      {/* Rarity indicator */}
      <div
        className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
        style={{
          background: `${rarity.textColor}15`,
          color: rarity.textColor,
        }}
      >
        {rarity.label}
      </div>

      {/* Icon */}
      <div className="text-3xl mb-2 filter" style={{ filter: badge.isUnlocked ? 'none' : 'grayscale(1)' }}>
        {badge.icon}
      </div>

      {/* Name */}
      <div className="text-sm font-semibold text-white mb-0.5 pr-12">{badge.name}</div>

      {/* Description */}
      <div className="text-xs text-white/40 mb-3 line-clamp-2">{badge.description}</div>

      {/* Progress bar */}
      {!badge.isUnlocked && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/40">{badge.currentValue}/{badge.requirementValue}</span>
            <span style={{ color: rarity.textColor }}>{badge.progress}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: rarity.textColor }}
              initial={{ width: 0 }}
              animate={{ width: `${badge.progress}%` }}
              transition={{ duration: 1, delay: index * 0.1 }}
            />
          </div>
        </div>
      )}

      {/* Unlocked indicator */}
      {badge.isUnlocked && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-xs text-emerald-400">✓ Unlocked</span>
          {badge.unlockedAt && (
            <span className="text-xs text-white/30">
              {new Date(badge.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      )}

      {/* Lock overlay */}
      {!badge.isUnlocked && (
        <div className="absolute top-3 left-3 text-lg opacity-40">🔒</div>
      )}
    </motion.div>
  );
}

const BadgeSystem = memo(function BadgeSystem({ data }: Props) {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const completionPercent = data.totalBadges > 0
    ? Math.round((data.totalUnlocked / data.totalBadges) * 100)
    : 0;

  const categories = ['all', ...new Set(data.badges.map(b => b.category))];

  const filteredBadges = data.badges.filter(b => {
    if (filter === 'unlocked' && !b.isUnlocked) return false;
    if (filter === 'locked' && b.isUnlocked) return false;
    if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-2xl p-6 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-xl">🏆</span>
          Achievements
          <span className="text-sm font-normal text-white/40 ml-1">
            {data.totalUnlocked}/{data.totalBadges}
          </span>
        </h3>

        {/* Overall progress */}
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #6366f1, #a855f7)' }}
              initial={{ width: 0 }}
              animate={{ width: `${completionPercent}%` }}
              transition={{ duration: 1.5 }}
            />
          </div>
          <span className="text-xs text-white/50">
            {completionPercent}%
          </span>
        </div>
      </div>

      {/* Next to unlock highlight */}
      {data.nextToUnlock && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-5 p-3 rounded-xl flex items-center gap-3"
          style={{
            background: `linear-gradient(135deg, ${RARITY_CONFIG[data.nextToUnlock.rarity].bg}, transparent)`,
            border: `1px solid ${RARITY_CONFIG[data.nextToUnlock.rarity].border}`,
          }}
        >
          <span className="text-2xl">{data.nextToUnlock.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white">
              Next: {data.nextToUnlock.name}
            </div>
            <div className="text-xs text-white/40 truncate">{data.nextToUnlock.requirement}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold" style={{ color: RARITY_CONFIG[data.nextToUnlock.rarity].textColor }}>
              {data.nextToUnlock.progress}%
            </div>
            <div className="text-xs text-white/30">{data.nextToUnlock.currentValue}/{data.nextToUnlock.requirementValue}</div>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          {(['all', 'unlocked', 'locked'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: filter === f ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: filter === f ? '#818cf8' : 'rgba(255,255,255,0.5)',
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className="px-2.5 py-1 text-xs rounded-full transition-all"
              style={{
                background: categoryFilter === cat ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                color: categoryFilter === cat ? 'white' : 'rgba(255,255,255,0.4)',
                border: `1px solid ${categoryFilter === cat ? 'rgba(255,255,255,0.15)' : 'transparent'}`,
              }}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Badge grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {filteredBadges.map((badge, i) => (
            <BadgeCard key={badge.id} badge={badge} index={i} />
          ))}
        </AnimatePresence>
      </div>

      {filteredBadges.length === 0 && (
        <div className="text-center text-white/30 py-8 text-sm">
          No badges match the current filter.
        </div>
      )}
    </motion.div>
  );
});

export default BadgeSystem;
