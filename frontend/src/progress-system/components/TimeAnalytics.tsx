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
import { Card } from '@/components/ui/card';
import {
  mutedTextClassName,
  panelClassName,
  pillClassName,
  strongTextClassName,
  surfaceClassName,
  surfaceHoverClassName,
  titleTextClassName,
} from '../ui/surfaces';
import { SkeletonBlock, SkeletonText } from '../ui/loading';
import type { TimeAnalyticsData } from '../types';

interface Props {
  data: TimeAnalyticsData;
  hourlyActivity?: { hour: number; activity: number }[];
  variant?: 'full' | 'compact';
  loading?: boolean;
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

const axisColor = 'hsl(var(--muted-foreground))';
const surfaceCardClassName = `rounded-2xl p-5 ${surfaceClassName} ${surfaceHoverClassName}`;

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-800/70 dark:bg-slate-950/95">
      {label && <div className={`mb-1 ${mutedTextClassName}`}>{label}</div>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className={`font-medium ${titleTextClassName}`}>
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
  if (!active || !payload?.length || !payload[0].payload) return null;
  const datum = payload[0].payload;
  const formattedHour = `${datum.hour % 12 || 12}${datum.hour >= 12 ? 'PM' : 'AM'}`;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-800/70 dark:bg-slate-950/95">
      <div className={`font-medium ${titleTextClassName}`}>{formattedHour}</div>
      <div className={`mt-1 ${mutedTextClassName}`}>{datum.activity} tracked interactions</div>
    </div>
  );
};

const TimeAnalytics = memo(function TimeAnalytics({
  data,
  hourlyActivity = [],
  variant = 'full',
  loading = false,
}: Props) {
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

  const summaryStats = [
    { label: 'This Week', value: `${data.totalHoursThisWeek}h`, color: '#0ea5e9' },
    { label: 'This Month', value: `${data.totalHoursThisMonth}h`, color: '#10b981' },
    { label: 'Avg / Day', value: `${data.avgDailyMinutes}m`, color: '#8b5cf6' },
    { label: 'Peak Time', value: hasTrackedTime ? formatHour(data.peakHour) : 'No data', color: '#f59e0b' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }} className="min-w-0">
      <Card className={surfaceCardClassName}>
        {loading ? (
          <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <SkeletonText lines={['w-32', 'w-56']} />
              {variant === 'full' && <SkeletonBlock className="h-9 w-36 rounded-xl" />}
            </div>

            <div className={`mb-5 grid gap-3 ${variant === 'compact' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {Array.from({ length: variant === 'compact' ? 4 : 4 }, (_, index) => (
                <div key={index} className={`rounded-xl border p-4 ${panelClassName}`}>
                  <SkeletonBlock className="h-3 w-20" />
                  <SkeletonBlock className="mt-3 h-7 w-16" />
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className={`rounded-2xl border p-4 ${panelClassName}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <SkeletonText lines={['w-24', 'w-44']} />
                  <SkeletonBlock className="h-3 w-24" />
                </div>
                <SkeletonBlock className={variant === 'compact' ? 'h-[112px] w-full' : 'h-[124px] w-full'} />
              </div>

              {variant === 'compact' ? (
                <div className={`rounded-2xl border p-4 ${panelClassName}`}>
                  <SkeletonText lines={['w-24', 'w-40', 'w-28']} />
                </div>
              ) : (
                <div className={`rounded-2xl border p-4 ${panelClassName}`}>
                  <SkeletonBlock className="mb-4 h-[280px] w-full" />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className={`text-base font-semibold ${titleTextClassName}`}>Time Analytics</h3>
            <p className={`mt-1 text-xs ${mutedTextClassName}`}>
              Weekly time, active rhythm, and feature depth in one view.
            </p>
          </div>

          {variant === 'full' && (
            <div className={`flex overflow-hidden rounded-xl ${pillClassName}`}>
              {(['daily', 'weekly', 'features'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    view === mode
                      ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300'
                      : `${mutedTextClassName} hover:text-slate-900 dark:hover:text-white`
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`mb-5 grid gap-3 ${variant === 'compact' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {summaryStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -1 }}
              className={`rounded-xl border p-4 ${panelClassName}`}
            >
              <div className={`text-[11px] font-black uppercase tracking-widest ${mutedTextClassName}`}>
                {stat.label}
              </div>
              <div className={`mt-2 text-2xl font-[900] tracking-tighter ${titleTextClassName}`} style={{ color: variant === 'compact' ? stat.color : undefined }}>
                {stat.value}
              </div>
            </motion.div>
          ))}
        </div>

        {variant === 'compact' ? (
          <div className="space-y-4">
            <div className={`rounded-2xl border p-4 ${panelClassName}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={`text-[11px] font-black uppercase tracking-widest ${mutedTextClassName}`}>
                    Focus Window
                  </div>
                  <div className={`mt-2 text-sm font-semibold ${titleTextClassName}`}>
                    Peak hours: <span className="text-cyan-600 dark:text-cyan-300">{peakTimeRange}</span>
                  </div>
                  <div className={`mt-1 text-xs ${mutedTextClassName}`}>
                    Most active on <span className={strongTextClassName}>{data.peakDay}s</span>
                  </div>
                </div>
                <div className="rounded-full bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300">
                  Compact
                </div>
              </div>
            </div>

            {hourlyActivity.length > 0 && (
              <div className={`rounded-2xl border p-4 ${panelClassName}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className={`text-[11px] font-black uppercase tracking-widest ${mutedTextClassName}`}>
                      Activity Rhythm
                    </div>
                    <div className={`mt-1 text-sm font-semibold ${titleTextClassName}`}>
                      Peak focus around {formatHour(hourPeak.hour)}
                    </div>
                  </div>
                  <div className={`text-xs ${mutedTextClassName}`}>Hour-of-day density</div>
                </div>
                <div className="h-[112px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyActivity} margin={{ top: 0, right: 0, bottom: 0, left: -10 }} barCategoryGap="26%">
                      <XAxis
                        dataKey="hour"
                        tickFormatter={(hour) => (hour % 4 === 0 ? `${hour % 12 || 12}${hour >= 12 ? 'p' : 'a'}` : '')}
                        stroke={axisColor}
                        tick={{ fill: axisColor, fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis hide />
                      <Tooltip content={<HourlyTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                      <Bar dataKey="activity" radius={[4, 4, 0, 0]} maxBarSize={12}>
                        {hourlyActivity.map((entry, index) => (
                          <Cell
                            key={`${entry.hour}-${index}`}
                            fill={
                              entry.hour === hourPeak.hour
                                ? '#f59e0b'
                                : entry.activity > hourPeak.activity * 0.6
                                  ? '#38bdf8'
                                  : '#cbd5e1'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {hourlyActivity.length > 0 && (
              <div className={`mb-5 rounded-2xl border p-4 ${panelClassName}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className={`text-[11px] font-black uppercase tracking-widest ${mutedTextClassName}`}>
                      Activity Rhythm
                    </div>
                    <div className={`mt-1 text-sm font-semibold ${titleTextClassName}`}>
                      Peak focus around {formatHour(hourPeak.hour)}
                    </div>
                  </div>
                  <div className={`text-xs ${mutedTextClassName}`}>Hour-of-day interaction density</div>
                </div>

                <div className="h-[124px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyActivity} margin={{ top: 0, right: 0, bottom: 0, left: -10 }} barCategoryGap="26%">
                      <XAxis
                        dataKey="hour"
                        tickFormatter={(hour) => (hour % 3 === 0 ? `${hour % 12 || 12}${hour >= 12 ? 'p' : 'a'}` : '')}
                        stroke={axisColor}
                        tick={{ fill: axisColor, fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis hide />
                      <Tooltip content={<HourlyTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                      <Bar dataKey="activity" radius={[4, 4, 0, 0]} maxBarSize={12}>
                        {hourlyActivity.map((entry, index) => (
                          <Cell
                            key={`${entry.hour}-${index}`}
                            fill={
                              entry.hour === hourPeak.hour
                                ? '#f59e0b'
                                : entry.activity > hourPeak.activity * 0.6
                                  ? '#38bdf8'
                                  : '#cbd5e1'
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-2xl border p-4 ${panelClassName}`}>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.dailyUsage} margin={{ top: 5, right: 8, bottom: 5, left: -10 }}>
                      <defs>
                        <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) =>
                          new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        }
                        stroke={axisColor}
                        tick={{ fill: axisColor, fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        interval={6}
                      />
                      <YAxis
                        stroke={axisColor}
                        tick={{ fill: axisColor, fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}m`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="totalMinutes"
                        stroke="#0ea5e9"
                        strokeWidth={2.2}
                        fill="url(#totalGrad)"
                        name="Total"
                        dot={false}
                        activeDot={{ r: 4, fill: '#0ea5e9', stroke: '#ffffff', strokeWidth: 2 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="activeMinutes"
                        stroke="#10b981"
                        strokeWidth={2.2}
                        fill="url(#activeGrad)"
                        name="Active"
                        dot={false}
                        activeDot={{ r: 4, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 flex justify-center gap-6">
                  <div className={`flex items-center gap-1.5 text-xs ${mutedTextClassName}`}>
                    <div className="h-0.5 w-3 rounded bg-sky-500" />
                    Total Time
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs ${mutedTextClassName}`}>
                    <div className="h-0.5 w-3 rounded bg-emerald-500" />
                    Active Time
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'weekly' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-2xl border p-4 ${panelClassName}`}>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.weeklyTrends} margin={{ top: 5, right: 8, bottom: 5, left: -10 }} barCategoryGap="26%">
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.82} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.45} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="week"
                        stroke={axisColor}
                        tick={{ fill: axisColor, fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke={axisColor}
                        tick={{ fill: axisColor, fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}h`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="totalHours" fill="url(#barGrad)" radius={[6, 6, 0, 0]} name="Hours" maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {view === 'features' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-2xl border p-4 ${panelClassName}`}>
                <div className="flex flex-col items-center gap-6 sm:flex-row">
                  {data.featureTimeSpent.length === 0 && (
                    <div className={`w-full py-8 text-center text-sm ${mutedTextClassName}`}>
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
                                <span className={`truncate text-xs ${strongTextClassName}`}>{feature.feature}</span>
                                <span className={`ml-2 text-xs ${mutedTextClassName}`}>
                                  {feature.minutes >= 60 ? `${(feature.minutes / 60).toFixed(1)}h` : `${feature.minutes}m`}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ background: feature.color }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${feature.percentage}%` }}
                                  transition={{ duration: 1, delay: index * 0.08 }}
                                />
                              </div>
                            </div>
                            <span className={`w-8 text-right text-xs font-semibold ${mutedTextClassName}`}>
                              {feature.percentage}%
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-slate-200/70 pt-4 text-xs dark:border-slate-800/60">
              <span className={mutedTextClassName}>
                Most active on <span className={strongTextClassName}>{data.peakDay}s</span>
              </span>
              <span className={mutedTextClassName}>
                Peak hours: <span className={strongTextClassName}>{peakTimeRange}</span>
              </span>
            </div>
          </>
        )}
          </>
        )}
      </Card>
    </motion.div>
  );
});

export default TimeAnalytics;
