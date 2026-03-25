// ══════════════════════════════════════════════════════════════
// Time Analytics Engine Component
// ══════════════════════════════════════════════════════════════

import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { TimeAnalyticsData } from '../types';

interface Props {
  data: TimeAnalyticsData;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs"
      style={{
        background: 'rgba(0,0,0,0.9)',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div className="text-white/60 mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white font-medium">
            {p.name}: {typeof p.value === 'number' ? (p.value >= 60 ? `${(p.value / 60).toFixed(1)}h` : `${p.value}m`) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const TimeAnalytics = memo(function TimeAnalytics({ data }: Props) {
  const [view, setView] = useState<'daily' | 'weekly' | 'features'>('daily');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="rounded-2xl p-6 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-xl">⏱️</span>
          Time Analytics
        </h3>
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          {(['daily', 'weekly', 'features'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: view === v ? 'rgba(6,182,212,0.2)' : 'transparent',
                color: view === v ? '#06b6d4' : 'rgba(255,255,255,0.5)',
              }}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'This Week', value: `${data.totalHoursThisWeek}h`, color: '#06b6d4', icon: '📅' },
          { label: 'This Month', value: `${data.totalHoursThisMonth}h`, color: '#10b981', icon: '📆' },
          { label: 'Avg/Day', value: `${data.avgDailyMinutes}m`, color: '#8b5cf6', icon: '⏰' },
          { label: 'Peak Time', value: `${data.peakHour > 12 ? data.peakHour - 12 : data.peakHour}${data.peakHour >= 12 ? 'PM' : 'AM'}`, color: '#f59e0b', icon: '🔥' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-xl p-3 text-center"
            style={{
              background: `${stat.color}08`,
              border: `1px solid ${stat.color}15`,
            }}
          >
            <div className="text-lg mb-0.5">{stat.icon}</div>
            <div className="text-xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-white/40">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      {view === 'daily' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="h-[280px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.dailyUsage} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
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
                tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                tickFormatter={(v) => `${v}m`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="totalMinutes"
                stroke="#06b6d4"
                strokeWidth={2}
                fill="url(#totalGrad)"
                name="Total"
                dot={false}
                activeDot={{ r: 4, fill: '#06b6d4', stroke: '#0f172a', strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="activeMinutes"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#activeGrad)"
                name="Active"
                dot={false}
                activeDot={{ r: 4, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <div className="w-3 h-0.5 rounded" style={{ background: '#06b6d4' }} />
              Total Time
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <div className="w-3 h-0.5 rounded" style={{ background: '#10b981' }} />
              Active Time
            </div>
          </div>
        </motion.div>
      )}

      {view === 'weekly' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="h-[280px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.weeklyTrends} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.4} />
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
                tickFormatter={(v) => `${v}h`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="totalHours"
                fill="url(#barGrad)"
                radius={[4, 4, 0, 0]}
                name="Hours"
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {view === 'features' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col sm:flex-row items-center gap-6"
        >
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
                  {data.featureTimeSpent.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2.5 w-full">
            {data.featureTimeSpent.map((f, i) => (
              <motion.div
                key={f.feature}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: f.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-white/70 truncate">{f.feature}</span>
                    <span className="text-xs text-white/40 ml-2">
                      {f.minutes >= 60 ? `${(f.minutes / 60).toFixed(1)}h` : `${f.minutes}m`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: f.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${f.percentage}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                    />
                  </div>
                </div>
                <span className="text-xs font-medium text-white/50 w-8 text-right">{f.percentage}%</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Peak activity indicator */}
      <div className="mt-5 pt-4 flex items-center justify-between text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-white/40">
          Most active on <span className="text-cyan-400 font-medium">{data.peakDay}s</span>
        </span>
        <span className="text-white/40">
          Peak hours: <span className="text-cyan-400 font-medium">
            {data.peakHour > 12 ? data.peakHour - 12 : data.peakHour}{data.peakHour >= 12 ? 'PM' : 'AM'} -
            {' '}{(data.peakHour + 2) % 24 > 12 ? (data.peakHour + 2) % 24 - 12 : (data.peakHour + 2) % 24}{(data.peakHour + 2) % 24 >= 12 ? 'PM' : 'AM'}
          </span>
        </span>
      </div>
    </motion.div>
  );
});

export default TimeAnalytics;
