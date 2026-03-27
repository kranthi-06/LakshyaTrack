import { memo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import {
  mutedTextClassName,
  panelClassName,
  surfaceClassName,
  surfaceHoverClassName,
  titleTextClassName,
} from '../ui/surfaces';
import { SkeletonBlock, SkeletonCircle, SkeletonText } from '../ui/loading';
import type { StreakData } from '../types';

interface Props {
  data: StreakData;
  loading?: boolean;
}

function FlameIcon({ size = 32, active = true }: { size?: number; active?: boolean }) {
  return (
    <motion.div
      animate={
        active
          ? {
              scale: [1, 1.08, 1],
              filter: ['brightness(1)', 'brightness(1.18)', 'brightness(1)'],
            }
          : {}
      }
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
          fill={active ? 'url(#flameGrad)' : 'rgba(148,163,184,0.4)'}
        />
      </svg>
    </motion.div>
  );
}

const surfaceCardClassName = `rounded-2xl p-5 ${surfaceClassName} ${surfaceHoverClassName}`;

const StreakDisplay = memo(function StreakDisplay({ data, loading = false }: Props) {
  const streakPercentOfMax =
    data.longestStreak > 0 ? Math.round((data.currentStreak / data.longestStreak) * 100) : 0;
  const activeHistoryDays = data.streakHistory.filter((history) => history.active).length;
  const historyLength = data.streakHistory.length;
  const consistencyPercent = historyLength > 0 ? Math.round((activeHistoryDays / historyLength) * 100) : 0;
  const maxWeeklyCount = Math.max(...data.weeklyActivity, 1);
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="min-w-0">
      <Card className={`relative overflow-hidden ${surfaceCardClassName}`}>
        {loading ? (
          <>
            <div className="relative z-10 mb-5 flex flex-wrap items-center justify-between gap-3">
              <SkeletonText lines={['w-32', 'w-52']} />
              <SkeletonBlock className="h-8 w-32 rounded-full" />
            </div>

            <div className={`relative z-10 mb-6 grid gap-4 md:grid-cols-[1fr,auto,1fr]`}>
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className={`rounded-2xl border p-5 text-center ${panelClassName}`}>
                  <div className="mb-3 flex items-center justify-center">
                    <SkeletonCircle size={46} />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <SkeletonBlock className="h-12 w-20" />
                    <SkeletonBlock className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>

            <div className="relative z-10 mb-5">
              <div className="mb-2 flex items-center justify-between">
                <SkeletonBlock className="h-3 w-28" />
                <SkeletonBlock className="h-3 w-12" />
              </div>
              <SkeletonBlock className="h-2.5 w-full rounded-full" />
            </div>

            <div className={`relative z-10 rounded-2xl border p-4 ${panelClassName}`}>
              <SkeletonBlock className="mb-4 h-3 w-28" />
              <div className="flex items-end justify-between gap-2">
                {Array.from({ length: 7 }, (_, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-2">
                    <SkeletonBlock className="h-12 w-full max-w-[32px] rounded-md" />
                    <SkeletonBlock className="h-3 w-6" />
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 mt-5 grid grid-cols-3 gap-3 border-t border-slate-200/70 pt-4 dark:border-slate-800/60">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="text-center">
                  <SkeletonBlock className="mx-auto h-6 w-14" />
                  <SkeletonBlock className="mx-auto mt-2 h-3 w-20" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
        {data.currentStreak > 0 && (
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl dark:bg-amber-500/10" />
        )}

        <div className="relative z-10 mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className={`text-base font-semibold ${titleTextClassName}`}>Streak Engine</h3>
            <p className={`mt-1 text-xs ${mutedTextClassName}`}>Consistency, record pace, and weekly cadence.</p>
          </div>

          {data.isAtRisk && (
            <motion.div
              animate={{ opacity: [0.75, 1, 0.75] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
            >
              Streak at risk: {data.hoursUntilReset}h left
            </motion.div>
          )}
        </div>

        <div className={`relative z-10 mb-6 grid gap-4 md:grid-cols-[1fr,auto,1fr]`}>
          <div className={`rounded-2xl border p-5 text-center ${panelClassName}`}>
            <div className="mb-2 flex items-center justify-center">
              <FlameIcon size={46} active={data.currentStreak > 0} />
            </div>
            <motion.div
              className={`text-5xl font-[900] tracking-tighter ${titleTextClassName}`}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.2 }}
            >
              {data.currentStreak}
            </motion.div>
            <div className={`mt-1 text-sm ${mutedTextClassName}`}>Current Streak</div>
          </div>

          <div className="hidden h-full w-px self-stretch bg-slate-200 dark:bg-slate-800 md:block" />

          <div className={`rounded-2xl border p-5 text-center ${panelClassName}`}>
            <div className="mb-2 flex items-center justify-center text-4xl text-amber-500">★</div>
            <motion.div
              className="text-5xl font-[900] tracking-tighter text-amber-500"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.3 }}
            >
              {data.longestStreak}
            </motion.div>
            <div className={`mt-1 text-sm ${mutedTextClassName}`}>Longest Streak</div>
          </div>
        </div>

        <div className="relative z-10 mb-5">
          <div className={`mb-2 flex items-center justify-between text-xs ${mutedTextClassName}`}>
            <span>Progress to record</span>
            <span className="font-semibold text-amber-600 dark:text-amber-300">{streakPercentOfMax}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, streakPercentOfMax)}%`,
                background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                boxShadow: '0 0 12px rgba(245,158,11,0.32)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, streakPercentOfMax)}%` }}
              transition={{ duration: 1.1, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
        </div>

        <div className={`relative z-10 rounded-2xl border p-4 ${panelClassName}`}>
          <div className={`mb-3 text-xs font-semibold uppercase tracking-[0.22em] ${mutedTextClassName}`}>
            This Week's Activity
          </div>

          <div className="flex items-end justify-between gap-2">
            {data.weeklyActivity.map((count, index) => {
              const height = Math.max(8, (count / maxWeeklyCount) * 60);
              return (
                <div key={index} className="flex flex-1 flex-col items-center gap-1.5">
                  <motion.div
                    className="min-h-[8px] w-full rounded-md"
                    style={{
                      maxWidth: 32,
                      height,
                      background: count > 0 ? 'linear-gradient(180deg, #f59e0b, #ef4444)' : 'rgba(148,163,184,0.24)',
                    }}
                    initial={{ height: 0 }}
                    animate={{ height }}
                    transition={{ duration: 0.7, delay: 0.1 + index * 0.06, ease: 'easeOut' }}
                  />
                  <span className={`text-[10px] ${mutedTextClassName}`}>{dayLabels[index]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 mt-5 grid grid-cols-3 gap-3 border-t border-slate-200/70 pt-4 dark:border-slate-800/60">
          <div className="text-center">
            <div className={`text-lg font-bold ${titleTextClassName}`}>{data.totalActiveDays}</div>
            <div className={`text-xs ${mutedTextClassName}`}>Active Days</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-300">
              {activeHistoryDays}/{historyLength}
            </div>
            <div className={`text-xs ${mutedTextClassName}`}>Last 30 Days</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-cyan-600 dark:text-cyan-300">{consistencyPercent}%</div>
            <div className={`text-xs ${mutedTextClassName}`}>Consistency</div>
          </div>
        </div>

        {data.currentStreak >= 7 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="relative z-10 mt-4 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-center text-sm dark:border-amber-500/20 dark:bg-amber-500/10"
          >
            <span className="font-medium text-amber-700 dark:text-amber-200">
              {data.currentStreak >= 30
                ? `Legendary streak: ${data.currentStreak} days and still climbing.`
                : data.currentStreak >= 14
                  ? `Amazing momentum: ${data.currentStreak} days strong.`
                  : 'Great momentum. Keep pushing toward the 14-day badge.'}
            </span>
          </motion.div>
        )}
          </>
        )}
      </Card>
    </motion.div>
  );
});

export default StreakDisplay;
