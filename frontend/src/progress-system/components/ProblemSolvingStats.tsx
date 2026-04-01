import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import {
  mutedTextClassName,
  panelClassName,
  strongTextClassName,
  surfaceClassName,
  surfaceHoverClassName,
  titleTextClassName,
} from '../ui/surfaces';
import { SkeletonBlock, SkeletonCircle, SkeletonText } from '../ui/loading';
import type { ProblemSolvingStats as ProblemStats } from '../types';

interface Props {
  data: ProblemStats;
  loading?: boolean;
}

function CircularProgress({
  value,
  max,
  size = 110,
  strokeWidth = 8,
  color,
  label,
  sublabel,
  delay = 0,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  sublabel: string;
  delay?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 transform">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(148,163,184,0.22)"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.3, delay, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={`text-2xl font-[900] tracking-tighter ${titleTextClassName}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.4 }}
          >
            {value}
          </motion.span>
          <span className={`text-xs ${mutedTextClassName}`}>/ {max}</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold" style={{ color }}>
          {label}
        </div>
        <div className={`text-xs ${mutedTextClassName}`}>{sublabel}</div>
      </div>
    </div>
  );
}

const surfaceCardClassName = `rounded-2xl p-5 ${surfaceClassName} ${surfaceHoverClassName}`;

const ProblemSolvingStats = memo(function ProblemSolvingStats({ data, loading = false }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'recent'>('overview');

  const difficultyConfig = {
    easy: { color: '#10b981', label: 'Beginner' },
    medium: { color: '#f59e0b', label: 'Intermediate' },
    hard: { color: '#ef4444', label: 'Advanced' },
  };

  const statusColors: Record<string, { color: string; label: string }> = {
    accepted: { color: '#10b981', label: 'Passed' },
    wrong_answer: { color: '#ef4444', label: 'Failed' },
    time_limit: { color: '#f59e0b', label: 'Incomplete' },
    runtime_error: { color: '#8b5cf6', label: 'Error' },
  };

  const totalPercentage = data.totalAvailable > 0 ? ((data.totalSolved / data.totalAvailable) * 100).toFixed(1) : '0.0';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="min-w-0">
      <Card className={surfaceCardClassName}>
        {loading ? (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <SkeletonText lines={['w-40', 'w-64']} />
              <SkeletonBlock className="h-9 w-28 rounded-xl" />
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className={`rounded-xl border p-4 ${panelClassName}`}>
                  <SkeletonBlock className="h-3 w-20" />
                  <SkeletonBlock className="mt-3 h-7 w-16" />
                </div>
              ))}
            </div>

            <div className="mb-5 flex flex-wrap justify-center gap-6">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex flex-col items-center gap-3">
                  <SkeletonCircle size={110} />
                  <SkeletonBlock className="h-3 w-20" />
                  <SkeletonBlock className="h-3 w-12" />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index}>
                  <div className="mb-2 flex items-center justify-between">
                    <SkeletonBlock className="h-3 w-24" />
                    <SkeletonBlock className="h-3 w-16" />
                  </div>
                  <SkeletonBlock className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className={`text-base font-semibold ${titleTextClassName}`}>Learning Analytics</h3>
            <p className={`mt-1 text-xs ${mutedTextClassName}`}>Difficulty spread, attempts, acceptance, and recent submissions.</p>
          </div>

          <div className="flex overflow-hidden rounded-xl border border-slate-200/70 bg-white/70 dark:border-slate-800/60 dark:bg-slate-950/30">
            {(['overview', 'recent'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === tab
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : `${mutedTextClassName} hover:text-slate-900 dark:hover:text-white`
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Completed', value: data.totalSolved, color: '#6366f1' },
                { label: 'Attempts', value: data.totalSubmissions, color: '#06b6d4' },
                { label: 'Acceptance', value: `${data.acceptanceRate}%`, color: '#10b981' },
                { label: 'Progress', value: `${totalPercentage}%`, color: '#f59e0b' },
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  whileHover={{ y: -1 }}
                  className={`rounded-xl border p-4 ${panelClassName}`}
                >
                  <div className={`text-[11px] font-black uppercase tracking-widest ${mutedTextClassName}`}>
                    {stat.label}
                  </div>
                  <div className="mt-2 text-2xl font-[900] tracking-tighter" style={{ color: stat.color }}>
                    {stat.value}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mb-5 flex flex-wrap justify-center gap-6">
              {(['easy', 'medium', 'hard'] as const).map((difficulty, index) => (
                <CircularProgress
                  key={difficulty}
                  value={data.difficulty[difficulty].solved}
                  max={data.difficulty[difficulty].total}
                  color={difficultyConfig[difficulty].color}
                  label={difficultyConfig[difficulty].label}
                  sublabel={
                    data.difficulty[difficulty].total > 0
                      ? `${((data.difficulty[difficulty].solved / data.difficulty[difficulty].total) * 100).toFixed(0)}%`
                      : '0%'
                  }
                  delay={index * 0.15}
                />
              ))}
            </div>

            <div className="space-y-3">
              {(['easy', 'medium', 'hard'] as const).map((difficulty, index) => {
                const percentage =
                  data.difficulty[difficulty].total > 0
                    ? (data.difficulty[difficulty].solved / data.difficulty[difficulty].total) * 100
                    : 0;

                return (
                  <div key={difficulty}>
                    <div className={`mb-1 flex items-center justify-between text-xs ${mutedTextClassName}`}>
                      <span style={{ color: difficultyConfig[difficulty].color }} className="font-semibold">
                        {difficultyConfig[difficulty].label}
                      </span>
                      <span className={strongTextClassName}>
                        {data.difficulty[difficulty].solved}/{data.difficulty[difficulty].total}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: difficultyConfig[difficulty].color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, delay: 0.3 + index * 0.15, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'recent' && (
          <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {data.recentSubmissions.length === 0 && (
              <div className={`py-6 text-center text-sm ${mutedTextClassName}`}>
                No real submissions have been recorded yet.
              </div>
            )}

            {data.recentSubmissions.map((submission, index) => (
              <motion.div
                key={submission.id}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`flex items-center justify-between rounded-xl border p-4 ${panelClassName}`}
              >
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm font-semibold ${titleTextClassName}`}>{submission.title}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        background: `${difficultyConfig[submission.difficulty].color}16`,
                        color: difficultyConfig[submission.difficulty].color,
                      }}
                    >
                      {difficultyConfig[submission.difficulty].label}
                    </span>
                    <span className={`text-xs ${mutedTextClassName}`}>{submission.language}</span>
                  </div>
                </div>

                <div className="ml-4 flex flex-col items-end gap-1">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      background: `${statusColors[submission.status].color}16`,
                      color: statusColors[submission.status].color,
                    }}
                  >
                    {statusColors[submission.status].label}
                  </span>
                  <span className={`text-xs ${mutedTextClassName}`}>
                    {new Date(submission.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
          </>
        )}
      </Card>
    </motion.div>
  );
});

export default ProblemSolvingStats;
