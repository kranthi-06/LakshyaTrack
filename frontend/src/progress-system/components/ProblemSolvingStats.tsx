// ══════════════════════════════════════════════════════════════
// Learning Analytics Component — LakshyaTrack Platform
// Displays quiz attempts, interview sessions, and overall progress
// ══════════════════════════════════════════════════════════════

import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import type { ProblemSolvingStats as ProblemStats } from '../types';

interface Props {
  data: ProblemStats;
}

// Circular progress ring component
function CircularProgress({
  value,
  max,
  size = 140,
  strokeWidth = 10,
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
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
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
            transition={{ duration: 1.5, delay, ease: 'easeOut' }}
            style={{
              filter: `drop-shadow(0 0 8px ${color}50)`,
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.5 }}
          >
            {value}
          </motion.span>
          <span className="text-xs text-white/40">/ {max}</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold" style={{ color }}>{label}</div>
        <div className="text-xs text-white/40">{sublabel}</div>
      </div>
    </div>
  );
}

const ProblemSolvingStats = memo(function ProblemSolvingStats({ data }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'recent'>('overview');

  const difficultyConfig = {
    easy: { color: '#10b981', label: 'Beginner', bgGlow: 'rgba(16,185,129,0.1)' },
    medium: { color: '#f59e0b', label: 'Intermediate', bgGlow: 'rgba(245,158,11,0.1)' },
    hard: { color: '#ef4444', label: 'Advanced', bgGlow: 'rgba(239,68,68,0.1)' },
  };

  const statusColors: Record<string, { color: string; label: string }> = {
    accepted: { color: '#10b981', label: 'Passed' },
    wrong_answer: { color: '#ef4444', label: 'Failed' },
    time_limit: { color: '#f59e0b', label: 'Incomplete' },
    runtime_error: { color: '#8b5cf6', label: 'Error' },
  };

  const totalPercentage = data.totalAvailable > 0
    ? ((data.totalSolved / data.totalAvailable) * 100).toFixed(1)
    : '0.0';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="rounded-2xl p-6 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-xl">📊</span>
          Learning Analytics
        </h3>
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          {(['overview', 'recent'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: activeTab === tab ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: activeTab === tab ? '#818cf8' : 'rgba(255,255,255,0.5)',
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Main stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Completed', value: data.totalSolved, color: '#6366f1', icon: '✅' },
              { label: 'Attempts', value: data.totalSubmissions, color: '#06b6d4', icon: '📝' },
              { label: 'Acceptance', value: `${data.acceptanceRate}%`, color: '#10b981', icon: '🎯' },
              { label: 'Progress', value: `${totalPercentage}%`, color: '#f59e0b', icon: '📈' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl p-3 text-center"
                style={{
                  background: `linear-gradient(135deg, ${stat.color}10, ${stat.color}05)`,
                  border: `1px solid ${stat.color}20`,
                }}
              >
                <div className="text-lg mb-1">{stat.icon}</div>
                <div className="text-xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-white/40 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Difficulty rings */}
          <div className="flex justify-center gap-8 sm:gap-12 mb-6">
            {(['easy', 'medium', 'hard'] as const).map((diff, i) => (
              <CircularProgress
                key={diff}
                value={data.difficulty[diff].solved}
                max={data.difficulty[diff].total}
                color={difficultyConfig[diff].color}
                label={difficultyConfig[diff].label}
                sublabel={data.difficulty[diff].total > 0
                  ? `${((data.difficulty[diff].solved / data.difficulty[diff].total) * 100).toFixed(0)}%`
                  : '0%'}
                delay={i * 0.2}
              />
            ))}
          </div>

          {/* Difficulty progress bars */}
          <div className="space-y-3">
            {(['easy', 'medium', 'hard'] as const).map((diff, i) => {
              const pct = data.difficulty[diff].total > 0
                ? (data.difficulty[diff].solved / data.difficulty[diff].total) * 100
                : 0;
              return (
                <div key={diff}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: difficultyConfig[diff].color }} className="font-medium">
                      {difficultyConfig[diff].label}
                    </span>
                    <span className="text-white/40">
                      {data.difficulty[diff].solved}/{data.difficulty[diff].total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: difficultyConfig[diff].color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, delay: 0.5 + i * 0.2, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'recent' && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          {data.recentSubmissions.length === 0 && (
            <div className="text-sm text-white/35 py-6 text-center">
              No real submissions have been recorded yet.
            </div>
          )}
          {data.recentSubmissions.map((sub, i) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between p-3 rounded-xl transition-colors"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{sub.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: `${difficultyConfig[sub.difficulty].color}20`,
                      color: difficultyConfig[sub.difficulty].color,
                    }}
                  >
                    {difficultyConfig[sub.difficulty].label}
                  </span>
                  <span className="text-xs text-white/30">{sub.language}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: `${statusColors[sub.status].color}15`,
                    color: statusColors[sub.status].color,
                  }}
                >
                  {statusColors[sub.status].label}
                </span>
                <span className="text-xs text-white/30">
                  {new Date(sub.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
});

export default ProblemSolvingStats;
