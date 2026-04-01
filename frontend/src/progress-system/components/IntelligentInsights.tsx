import { useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card } from '@/components/ui/card';
import {
  mutedTextClassName,
  panelClassName,
  surfaceClassName,
  surfaceHoverClassName,
  titleTextClassName,
} from '../ui/surfaces';
import { SkeletonBlock, SkeletonCircle, SkeletonText } from '../ui/loading';
import type { IntelligenceData, Insight, InsightType } from '../types';

interface Props {
  data: IntelligenceData;
  loading?: boolean;
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

const axisColor = 'hsl(var(--muted-foreground))';
const surfaceCardClassName = `rounded-2xl p-5 ${surfaceClassName} ${surfaceHoverClassName}`;

const INSIGHT_CONFIG: Record<InsightType, { bg: string; border: string; accent: string }> = {
  pattern: {
    bg: 'rgba(99,102,241,0.08)',
    border: 'rgba(99,102,241,0.16)',
    accent: '#6366f1',
  },
  suggestion: {
    bg: 'rgba(14,165,233,0.08)',
    border: 'rgba(14,165,233,0.16)',
    accent: '#0ea5e9',
  },
  warning: {
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.16)',
    accent: '#ef4444',
  },
  achievement: {
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.16)',
    accent: '#10b981',
  },
  prediction: {
    bg: 'rgba(168,85,247,0.08)',
    border: 'rgba(168,85,247,0.16)',
    accent: '#8b5cf6',
  },
};

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const config = INSIGHT_CONFIG[insight.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl border p-4 transition-transform duration-200 hover:-translate-y-0.5"
      style={{
        background: config.bg,
        borderColor: config.border,
      }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-xl">{insight.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={`text-sm font-semibold ${titleTextClassName}`}>{insight.title}</span>
            {insight.priority === 'high' && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-600 dark:bg-red-500/10 dark:text-red-300">
                Priority
              </span>
            )}
          </div>
          <p className={`text-xs leading-relaxed ${mutedTextClassName}`}>{insight.description}</p>
          {insight.actionable && insight.action && (
            <button
              type="button"
              className="mt-3 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: `${config.accent}16`,
                color: config.accent,
              }}
            >
              {insight.action}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ScoreGauge({
  value,
  label,
  color,
  size = 88,
}: {
  value: number;
  label: string;
  color: string;
  size?: number;
}) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 transform">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth={strokeWidth} />
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
            transition={{ duration: 1.4, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-[900] tracking-tighter ${titleTextClassName}`}>{value}</span>
        </div>
      </div>
      <span className={`text-xs text-center ${mutedTextClassName}`}>{label}</span>
    </div>
  );
}

const HourlyTooltip = ({ active, payload }: HourlyTooltipProps) => {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const datum = payload[0].payload;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-800/70 dark:bg-slate-950/95">
      <div className={`font-medium ${titleTextClassName}`}>
        {datum.hour > 12 ? datum.hour - 12 : datum.hour || 12}:00 {datum.hour >= 12 ? 'PM' : 'AM'}
      </div>
      <div className={`mt-1 ${mutedTextClassName}`}>Activity: {datum.activity}</div>
    </div>
  );
};

const IntelligentInsights = memo(function IntelligentInsights({ data, loading = false }: Props) {
  const peakHour = useMemo(
    () =>
      data.activeHours.reduce(
        (max, hour) => (hour.activity > max.activity ? hour : max),
        data.activeHours[0] ?? { hour: 0, activity: 0 },
      ),
    [data.activeHours],
  );

  const streakHealthScore = data.predictedStreakBreak
    ? Math.max(0, Math.round(data.consistencyScore * 0.5))
    : Math.max(0, Math.min(100, data.consistencyScore));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }} className="min-w-0">
      <Card className={surfaceCardClassName}>
        {loading ? (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <SkeletonText lines={['w-36', 'w-64']} />
              <SkeletonBlock className="h-8 w-32 rounded-full" />
            </div>

            <div className="mb-4 flex flex-wrap justify-center gap-6">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex flex-col items-center gap-3">
                  <SkeletonCircle size={72} />
                  <SkeletonBlock className="h-3 w-20" />
                </div>
              ))}
            </div>

            <div className={`mb-4 rounded-2xl border p-4 ${panelClassName}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <SkeletonText lines={['w-28', 'w-44']} />
                <SkeletonBlock className="h-3 w-20" />
              </div>
              <SkeletonBlock className="h-[110px] w-full" />
            </div>

            <div className="mb-5">
              <SkeletonBlock className="mb-3 h-3 w-32" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <SkeletonBlock key={index} className="h-8 w-28 rounded-full" />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <SkeletonBlock className="h-3 w-28" />
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="rounded-xl border p-4" style={{ background: 'rgba(148,163,184,0.06)', borderColor: 'rgba(148,163,184,0.16)' }}>
                  <div className="flex items-start gap-3">
                    <SkeletonCircle size={24} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <SkeletonBlock className="h-4 w-40" />
                      <SkeletonText lines={['w-full', 'w-5/6']} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className={`text-base font-semibold ${titleTextClassName}`}>Intelligence Hub</h3>
            <p className={`mt-1 text-xs ${mutedTextClassName}`}>Signals, recommendations, and anomaly warnings from your activity stream.</p>
          </div>

          {data.predictedStreakBreak && (
            <motion.span
              animate={{ opacity: [0.75, 1, 0.75] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
            >
              Streak break predicted
            </motion.span>
          )}
        </div>

        <div className="mb-4 flex flex-wrap justify-center gap-6">
          <ScoreGauge value={data.consistencyScore} label="Consistency" color="#10b981" size={72} />
          <ScoreGauge value={Math.min(100, Math.round(data.growthRate * 5))} label="Growth Rate" color="#6366f1" size={72} />
          <ScoreGauge value={streakHealthScore} label="Streak Health" color={data.predictedStreakBreak ? '#ef4444' : '#f59e0b'} size={72} />
        </div>

        <div className={`mb-4 rounded-2xl border p-4 ${panelClassName}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className={`text-[11px] font-black uppercase tracking-widest ${mutedTextClassName}`}>Activity by Hour</div>
              <div className={`mt-1 text-sm font-semibold ${titleTextClassName}`}>
                Peak focus around {peakHour.hour > 12 ? peakHour.hour - 12 : peakHour.hour || 12}:00 {peakHour.hour >= 12 ? 'PM' : 'AM'}
              </div>
            </div>
            <div className={`text-xs ${mutedTextClassName}`}>Behavior rhythm</div>
          </div>

          <div className="h-[110px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.activeHours} margin={{ top: 0, right: 0, bottom: 0, left: -10 }} barCategoryGap="28%">
                <XAxis
                  dataKey="hour"
                  tickFormatter={(hour) => (hour % 3 === 0 ? `${hour > 12 ? hour - 12 : hour || 12}${hour >= 12 ? 'p' : 'a'}` : '')}
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip content={<HourlyTooltip />} />
                <Bar dataKey="activity" radius={[4, 4, 0, 0]} maxBarSize={12}>
                  {data.activeHours.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={
                        entry.hour === peakHour.hour
                          ? '#f59e0b'
                          : entry.activity > 50
                            ? '#6366f1'
                            : '#cbd5e1'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mb-3">
          <div className={`mb-2 text-[11px] font-black uppercase tracking-widest ${mutedTextClassName}`}>Suggested Focus Areas</div>
          {data.suggestedFocusAreas.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.suggestedFocusAreas.map((area, index) => (
                <motion.span
                  key={area}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.07 }}
                  className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300"
                >
                  {area}
                </motion.span>
              ))}
            </div>
          ) : (
            <div className={`text-sm ${mutedTextClassName}`}>
              Focus recommendations will appear once more real learning activity is available.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className={`text-[11px] font-black uppercase tracking-widest ${mutedTextClassName}`}>AI-Powered Insights</div>
          {data.insights.length > 0 ? (
            data.insights.map((insight, index) => <InsightCard key={insight.id} insight={insight} index={index} />)
          ) : (
            <div className={`text-sm ${mutedTextClassName}`}>
              Insights will appear after enough real usage patterns have been collected.
            </div>
          )}
        </div>
          </>
        )}
      </Card>
    </motion.div>
  );
});

export default IntelligentInsights;
