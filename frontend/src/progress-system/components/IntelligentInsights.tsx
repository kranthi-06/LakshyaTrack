// ══════════════════════════════════════════════════════════════
// Intelligent Insights Component — AI Pattern Detection
// ══════════════════════════════════════════════════════════════

import { useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { IntelligenceData, Insight, InsightType } from '../types';

interface Props {
  data: IntelligenceData;
}

interface HourlyTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: {
      hour: number;
      activity: number;
    };
  }>;
}

const INSIGHT_CONFIG: Record<InsightType, { bg: string; border: string; accent: string }> = {
  pattern: {
    bg: 'rgba(99,102,241,0.06)',
    border: 'rgba(99,102,241,0.15)',
    accent: '#818cf8',
  },
  suggestion: {
    bg: 'rgba(6,182,212,0.06)',
    border: 'rgba(6,182,212,0.15)',
    accent: '#06b6d4',
  },
  warning: {
    bg: 'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.15)',
    accent: '#ef4444',
  },
  achievement: {
    bg: 'rgba(16,185,129,0.06)',
    border: 'rgba(16,185,129,0.15)',
    accent: '#10b981',
  },
  prediction: {
    bg: 'rgba(168,85,247,0.06)',
    border: 'rgba(168,85,247,0.15)',
    accent: '#a855f7',
  },
};

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const config = INSIGHT_CONFIG[insight.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-[20px] p-5 transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 mt-0.5">{insight.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{insight.title}</span>
            {insight.priority === 'high' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                Priority
              </span>
            )}
          </div>
          <p className="text-xs text-white/50 leading-relaxed">{insight.description}</p>
          {insight.actionable && insight.action && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-2.5 px-4 py-1.5 text-xs font-medium rounded-lg transition-colors"
              style={{
                background: `${config.accent}20`,
                color: config.accent,
                border: `1px solid ${config.accent}30`,
              }}
            >
              {insight.action} →
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Circular gauge component for scores
function ScoreGauge({ value, label, color, size = 90 }: { value: number; label: string; color: string; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-white">{value}</span>
        </div>
      </div>
      <span className="text-xs text-white/40 text-center">{label}</span>
    </div>
  );
}

const HourlyTooltip = ({ active, payload }: HourlyTooltipProps) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d) return null;
  return (
    <div className="px-3 py-2 rounded-lg text-xs"
      style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.15)' }}>
      <div className="text-white font-medium">
        {d.hour > 12 ? d.hour - 12 : d.hour || 12}:00 {d.hour >= 12 ? 'PM' : 'AM'}
      </div>
      <div className="text-white/60">Activity: {d.activity}</div>
    </div>
  );
};

const IntelligentInsights = memo(function IntelligentInsights({ data }: Props) {
  const peakHour = useMemo(() => {
    return data.activeHours.reduce(
      (max, h) => h.activity > max.activity ? h : max,
      data.activeHours[0] ?? { hour: 0, activity: 0 },
    );
  }, [data.activeHours]);
  const streakHealthScore = data.predictedStreakBreak
    ? Math.max(0, Math.round(data.consistencyScore * 0.5))
    : Math.max(0, Math.min(100, data.consistencyScore));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="rounded-[24px] p-5 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(2,6,23,0.35)]"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-xl">🧠</span>
          Intelligence Hub
        </h3>
        {data.predictedStreakBreak && (
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            🔮 Streak break predicted
          </motion.span>
        )}
      </div>

      {/* Score gauges */}
      <div className="flex justify-center gap-8 sm:gap-12 mb-6">
        <ScoreGauge value={data.consistencyScore} label="Consistency" color="#10b981" />
        <ScoreGauge value={Math.min(100, Math.round(data.growthRate * 5))} label="Growth Rate" color="#6366f1" />
        <ScoreGauge
          value={streakHealthScore}
          label="Streak Health"
          color={data.predictedStreakBreak ? '#ef4444' : '#f59e0b'}
        />
      </div>

      {/* Activity by hour chart */}
      <div className="mb-6">
        <div className="text-xs text-white/40 mb-3 font-medium">Activity by Hour of Day</div>
        <div className="h-[132px] rounded-[18px] border border-white/6 bg-slate-950/25 px-2 py-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.activeHours} margin={{ top: 0, right: 0, bottom: 0, left: -10 }} barCategoryGap="28%">
              <XAxis
                dataKey="hour"
                tickFormatter={(h) => h % 3 === 0 ? `${h > 12 ? h - 12 : h || 12}${h >= 12 ? 'p' : 'a'}` : ''}
                stroke="rgba(255,255,255,0.1)"
                tick={{ fill: 'rgba(255,255,255,0.28)', fontSize: 9 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide />
              <Tooltip content={<HourlyTooltip />} />
              <Bar dataKey="activity" radius={[3, 3, 0, 0]} maxBarSize={12}>
                {data.activeHours.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.hour === peakHour.hour
                      ? '#f59e0b'
                      : entry.activity > 50
                        ? '#6366f1'
                        : 'rgba(99,102,241,0.35)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Suggested focus areas */}
      <div className="mb-5">
        <div className="text-xs text-white/40 mb-2 font-medium">Suggested Focus Areas</div>
        {data.suggestedFocusAreas.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
          {data.suggestedFocusAreas.map((area, i) => (
            <motion.span
              key={area}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="px-3 py-1.5 text-xs rounded-full font-medium"
              style={{
                background: 'rgba(168,85,247,0.1)',
                color: '#c084fc',
                border: '1px solid rgba(168,85,247,0.2)',
              }}
            >
              {area}
            </motion.span>
          ))}
          </div>
        ) : (
          <div className="text-sm text-white/35">
            Focus recommendations will appear once more real learning activity is available.
          </div>
        )}
      </div>

      {/* Insight cards */}
      <div className="space-y-3">
        <div className="text-xs text-white/40 font-medium mb-2">AI-Powered Insights</div>
        {data.insights.length > 0 ? (
          data.insights.map((insight, i) => (
            <InsightCard key={insight.id} insight={insight} index={i} />
          ))
        ) : (
          <div className="text-sm text-white/35">
            Insights will appear after enough real usage patterns have been collected.
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default IntelligentInsights;
