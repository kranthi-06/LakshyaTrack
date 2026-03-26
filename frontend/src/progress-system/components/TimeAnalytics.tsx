import { useMemo, useState, memo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { TimeAnalyticsData } from '../types';

interface Props {
  data: TimeAnalyticsData;
  hourlyActivity?: { hour: number; activity: number }[];
  variant?: 'full' | 'compact';
}

interface ChartTooltipEntry {
  color?: string;
  name?: string;
  value?: number | string;
  payload?: { hour: number; activity: number };
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: ChartTooltipEntry[];
}

const cardClassName =
  'rounded-[24px] p-5 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(2,6,23,0.35)]';

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{
        background: 'rgba(0,0,0,0.9)',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div className="mb-1 text-white/60">{label}</div>
      {payload.map((entry, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="font-medium text-white">
            {entry.name}:{' '}
            {typeof entry.value === 'number'
              ? entry.value >= 60
                ? `${(entry.value / 60).toFixed(1)}h`
                : `${entry.value}m`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const HourlyTooltip = ({ active, payload }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;
  if (!datum) return null;
  const formattedHour = `${datum.hour % 12 || 12}${datum.hour >= 12 ? 'PM' : 'AM'}`;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{
        background: 'rgba(0,0,0,0.92)',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
      }}
    >
      <div className="font-medium text-white">{formattedHour}</div>
      <div className="mt-1 text-white/60">{datum.activity} tracked interactions</div>
    </div>
  );
};

const TimeAnalytics = memo(function TimeAnalytics({ data, hourlyActivity = [], variant = 'full' }: Props) {
  const [view, setView] = useState<'daily' | 'weekly' | 'features'>('daily');
  const hasTrackedTime =
    data.dailyUsage.some((day) => day.totalMinutes > 0 || day.activeMinutes > 0) ||
    data.featureTimeSpent.some((feature) => feature.minutes > 0);

  const formatHour = (hour: number) => {
    const normalized = ((hour % 24) + 24) % 24;
    return `${normalized % 12 || 12}${normalized >= 12 ? 'PM' : 'AM'}`;
  };

  const peakTimeRange = hasTrackedTime
    ? `${formatHour(data.peakHour)} - ${formatHour((data.peakHour + 2) % 24)}`
    : 'No activity yet';

  const hourPeak = useMemo(
    () =>
      hourlyActivity.reduce(
        (max, current) => (current.activity > max.activity ? current : max),
        hourlyActivity[0] ?? { hour: 0, activity: 0 },
      ),
    [hourlyActivity],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className={cardClassName}
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
            <span className="text-xl">⏱️</span>
            Time Analytics
          </h3>
          <p className="mt-1 text-xs text-white/40">
            Weekly time, active rhythm, and feature depth in one consistent view.
          </p>
        </div>
        {variant === 'full' && (
          <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            {(['daily', 'weekly', 'features'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className="px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: view === mode ? 'rgba(6,182,212,0.18)' : 'transparent',
                  color: view === mode ? '#67e8f9' : 'rgba(255,255,255,0.5)',
                }}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'This Week', value: `${data.totalHoursThisWeek}h`, color: '#06b6d4', icon: '📅' },
          { label: 'This Month', value: `${data.totalHoursThisMonth}h`, color: '#10b981', icon: '🗓️' },
          { label: 'Avg/Day', value: `${data.avgDailyMinutes}m`, color: '#8b5cf6', icon: '⏰' },
          { label: 'Peak Time', value: hasTrackedTime ? formatHour(data.peakHour) : 'No data', color: '#f59e0b', icon: '🔥' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            whileHover={{ scale: 1.02 }}
            className="rounded-[20px] p-4 text-center transition-all duration-300"
            style={{
              background: `${stat.color}08`,
              border: `1px solid ${stat.color}16`,
            }}
          >
            <div className="mb-1 text-lg">{stat.icon}</div>
            <div className="text-[1.35rem] font-bold leading-none text-white">{stat.value}</div>
            <div className="mt-2 text-xs text-white/40">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {variant === 'compact' && (
        <div className="rounded-[20px] border border-white/8 bg-slate-950/30 p-4" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/28">
            Focus window
          </div>
          <div className="mt-2 text-sm font-medium text-white">
            Peak hours: <span className="text-cyan-300">{peakTimeRange}</span>
          </div>
          <div className="mt-2 text-xs text-white/40">
            Compact view keeps the dashboard heatmap-first.
          </div>
        </div>
      )}

      {variant === 'compact' && (
        <div className="mt-5 flex items-center justify-between border-t border-white/6 pt-4 text-xs">
          <span className="text-white/40">
            Most active on <span className="font-medium text-cyan-400">{data.peakDay}s</span>
          </span>
          <span className="text-white/40">
            Peak hours: <span className="font-medium text-cyan-400">{peakTimeRange}</span>
          </span>
        </div>
      )}

      {variant === 'compact' ? null : (
        <>
          {hourlyActivity.length > 0 && (
            <div
              className="mb-5 rounded-[20px] border border-white/8 bg-slate-950/30 p-4"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/28">
                    Activity Rhythm
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    Peak focus around {formatHour(hourPeak.hour)}
                  </div>
                </div>
                <div className="text-xs text-white/38">
                  Hour-of-day interaction density
                </div>
              </div>

              <div className="h-[124px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyActivity} margin={{ top: 0, right: 0, bottom: 0, left: -10 }} barCategoryGap="26%">
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(hour) => (hour % 3 === 0 ? `${hour % 12 || 12}${hour >= 12 ? 'p' : 'a'}` : '')}
                      stroke="rgba(255,255,255,0.12)"
                      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis hide />
                    <Tooltip content={<HourlyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="activity" radius={[4, 4, 0, 0]} maxBarSize={12}>
                      {hourlyActivity.map((entry, index) => (
                        <Cell
                          key={`${entry.hour}-${index}`}
                          fill={
                            entry.hour === hourPeak.hour
                              ? '#f59e0b'
                              : entry.activity > hourPeak.activity * 0.6
                                ? '#60a5fa'
                                : 'rgba(99,102,241,0.38)'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {view === 'daily' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.dailyUsage} margin={{ top: 5, right: 8, bottom: 5, left: -10 }}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }
                stroke="rgba(255,255,255,0.15)"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={6}
              />
              <YAxis
                stroke="rgba(255,255,255,0.15)"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}m`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="totalMinutes"
                stroke="#06b6d4"
                strokeWidth={2.2}
                fill="url(#totalGrad)"
                name="Total"
                dot={false}
                activeDot={{ r: 4, fill: '#06b6d4', stroke: '#0f172a', strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="activeMinutes"
                stroke="#10b981"
                strokeWidth={2.2}
                fill="url(#activeGrad)"
                name="Active"
                dot={false}
                activeDot={{ r: 4, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-center gap-6">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <div className="h-0.5 w-3 rounded" style={{ background: '#06b6d4' }} />
              Total Time
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <div className="h-0.5 w-3 rounded" style={{ background: '#10b981' }} />
              Active Time
            </div>
          </div>
        </motion.div>
      )}

      {view === 'weekly' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.weeklyTrends} margin={{ top: 5, right: 8, bottom: 5, left: -10 }} barCategoryGap="26%">
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.45} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="week"
                stroke="rgba(255,255,255,0.15)"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="rgba(255,255,255,0.15)"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}h`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="totalHours" fill="url(#barGrad)" radius={[6, 6, 0, 0]} name="Hours" maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {view === 'features' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-6 sm:flex-row">
          {data.featureTimeSpent.length === 0 && (
            <div className="w-full py-8 text-center text-sm text-white/35">
              No real feature time has been tracked yet.
            </div>
          )}
          {data.featureTimeSpent.length > 0 && (
            <>
              <div className="h-[250px] w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.featureTimeSpent}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      dataKey="percentage"
                      nameKey="feature"
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {data.featureTimeSpent.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="w-full flex-1 space-y-3">
                {data.featureTimeSpent.map((feature, index) => (
                  <motion.div
                    key={feature.feature}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className="flex items-center gap-3"
                  >
                    <div className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: feature.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="truncate text-xs text-white/70">{feature.feature}</span>
                        <span className="ml-2 text-xs text-white/40">
                          {feature.minutes >= 60 ? `${(feature.minutes / 60).toFixed(1)}h` : `${feature.minutes}m`}
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: feature.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${feature.percentage}%` }}
                          transition={{ duration: 1, delay: index * 0.08 }}
                        />
                      </div>
                    </div>
                    <span className="w-8 text-right text-xs font-medium text-white/50">{feature.percentage}%</span>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-white/6 pt-4 text-xs">
        <span className="text-white/40">
          Most active on <span className="font-medium text-cyan-400">{data.peakDay}s</span>
        </span>
        <span className="text-white/40">
          Peak hours: <span className="font-medium text-cyan-400">{peakTimeRange}</span>
        </span>
      </div>
        </>
      )}
    </motion.div>
  );
});

export default TimeAnalytics;
