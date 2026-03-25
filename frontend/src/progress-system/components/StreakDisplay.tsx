// ══════════════════════════════════════════════════════════════
// Streak Engine Display Component
// ══════════════════════════════════════════════════════════════

import { memo } from 'react';
import { motion } from 'framer-motion';
import type { StreakData } from '../types';

interface Props {
  data: StreakData;
}

function FlameIcon({ size = 32, active = true }: { size?: number; active?: boolean }) {
  return (
    <motion.div
      animate={active ? {
        scale: [1, 1.1, 1],
        filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1)'],
      } : {}}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id="flameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
        <path
          d="M12 2C10.5 6 7 8 7 12C7 15.31 9.69 18 13 18C13 18 12 16 12 14C12 11 15 9 16 6C16 6 18 10 18 13C18 16.31 15.31 19 12 19C8.13 19 5 15.87 5 12C5 7 9 3 12 2Z"
          fill={active ? 'url(#flameGrad)' : 'rgba(255,255,255,0.15)'}
        />
      </svg>
    </motion.div>
  );
}

const StreakDisplay = memo(function StreakDisplay({ data }: Props) {
  const streakPercentOfMax = data.longestStreak > 0

    ? Math.round((data.currentStreak / data.longestStreak) * 100)
    : 0;
  const activeHistoryDays = data.streakHistory.filter(h => h.active).length;
  const historyLength = data.streakHistory.length;
  const consistencyPercent = historyLength > 0
    ? Math.round((activeHistoryDays / historyLength) * 100)
    : 0;

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-2xl p-6 overflow-hidden relative"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Ambient glow for active streak */}
      {data.currentStreak > 0 && (
        <div
          className="absolute top-0 right-0 w-32 h-32 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)',
            filter: 'blur(20px)',
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-xl">🔥</span>
          Streak Engine
        </h3>
        {data.isAtRisk && (
          <motion.div
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
            style={{
              background: 'rgba(239,68,68,0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            ⚠️ Streak at risk! {data.hoursUntilReset}h left
          </motion.div>
        )}
      </div>

      {/* Main streak display */}
      <div className="flex items-center justify-center gap-8 mb-6 relative z-10">
        {/* Current streak */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <FlameIcon size={48} active={data.currentStreak > 0} />
          </div>
          <motion.div
            className="text-5xl font-bold text-white mb-1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.3 }}
          >
            {data.currentStreak}
          </motion.div>
          <div className="text-sm text-white/50">Current Streak</div>
        </div>

        {/* Divider */}
        <div className="h-20 w-px" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Longest streak */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <span className="text-4xl">⭐</span>
          </div>
          <motion.div
            className="text-5xl font-bold text-amber-400 mb-1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.5 }}
          >
            {data.longestStreak}
          </motion.div>
          <div className="text-sm text-white/50">Longest Streak</div>
        </div>
      </div>

      {/* Progress towards record */}
      <div className="mb-5 relative z-10">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-white/50">Progress to record</span>
          <span className="text-amber-400 font-medium">{streakPercentOfMax}%</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
              boxShadow: '0 0 12px rgba(245,158,11,0.4)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, streakPercentOfMax)}%` }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
          />
        </div>
      </div>

      {/* Weekly activity */}
      <div className="relative z-10">
        <div className="text-xs text-white/40 mb-3 font-medium">This Week's Activity</div>
        <div className="flex items-end gap-2 justify-between">
          {data.weeklyActivity.map((count, i) => {
            const maxCount = Math.max(...data.weeklyActivity, 1);
            const height = Math.max(8, (count / maxCount) * 60);
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                <motion.div
                  className="w-full rounded-md min-h-[8px]"
                  style={{
                    background: count > 0
                      ? `linear-gradient(180deg, #f59e0b, #ef4444)`
                      : 'rgba(255,255,255,0.06)',
                    maxWidth: 32,
                  }}
                  initial={{ height: 0 }}
                  animate={{ height }}
                  transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
                />
                <span className="text-[10px] text-white/30">{dayLabels[i]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mt-5 pt-4 relative z-10" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-center">
          <div className="text-lg font-bold text-white">{data.totalActiveDays}</div>
          <div className="text-xs text-white/40">Active Days</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-emerald-400">
            {activeHistoryDays}/{historyLength}
          </div>
          <div className="text-xs text-white/40">Last 30 Days</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-cyan-400">
            {consistencyPercent}%
          </div>
          <div className="text-xs text-white/40">Consistency</div>
        </div>
      </div>

      {/* Motivational message */}
      {data.currentStreak >= 7 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="mt-4 p-3 rounded-xl text-center text-sm relative z-10"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(239,68,68,0.1))',
            border: '1px solid rgba(245,158,11,0.15)',
          }}
        >
          {data.currentStreak >= 30 ? (
            <span className="text-amber-300">🏆 Legendary! You're on a {data.currentStreak}-day streak! Unstoppable!</span>
          ) : data.currentStreak >= 14 ? (
            <span className="text-amber-300">🔥 Amazing! {data.currentStreak} days strong! You're in the top 5%!</span>
          ) : (
            <span className="text-amber-300">💪 Great momentum! Keep it going for the 14-day badge!</span>
          )}
        </motion.div>
      )}
    </motion.div>
  );
});

export default StreakDisplay;
