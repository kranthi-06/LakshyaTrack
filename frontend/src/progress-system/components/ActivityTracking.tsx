// ══════════════════════════════════════════════════════════════
// Activity Tracking & Session Analytics Component
// ══════════════════════════════════════════════════════════════

import { memo } from 'react';
import { motion } from 'framer-motion';
import type { ActivitySummary } from '../types';

interface Props {
  data: ActivitySummary;
}

function formatMinutes(mins: number): string {
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainder = mins % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  }
  return `${mins}m`;
}

const ActivityTracking = memo(function ActivityTracking({ data }: Props) {
  const maxPageCount = Math.max(1, ...data.mostVisitedPages.map(p => p.count));
  const maxFeatureCount = Math.max(1, ...data.mostUsedFeatures.map(f => f.count));
  const totalTrackedMinutes = data.totalActiveTime + data.totalIdleTime;
  const activePercent = totalTrackedMinutes > 0
    ? Math.round((data.totalActiveTime / totalTrackedMinutes) * 100)
    : 0;
  const idlePercent = totalTrackedMinutes > 0
    ? Math.max(0, 100 - activePercent)
    : 0;

  const pageColors = ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff'];
  const featureColors = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="rounded-2xl p-6 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-5">
        <span className="text-xl">📡</span>
        Activity Tracking
      </h3>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Sessions', value: data.totalSessions.toLocaleString(), icon: '🔄', color: '#6366f1' },
          { label: 'Avg Session', value: formatMinutes(data.avgSessionDuration), icon: '⏱️', color: '#06b6d4' },
          { label: 'Active Days', value: data.activeDays.toString(), icon: '📅', color: '#10b981' },
          { label: 'Active Time', value: formatMinutes(data.totalActiveTime), icon: '🟢', color: '#f59e0b' },
          { label: 'Idle Time', value: formatMinutes(data.totalIdleTime), icon: '💤', color: '#94a3b8' },
          { label: 'Engagement', value: `${activePercent}%`, icon: '🎯', color: '#ec4899' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className="rounded-xl p-3 text-center"
            style={{
              background: `${stat.color}06`,
              border: `1px solid ${stat.color}12`,
            }}
          >
            <div className="text-base mb-0.5">{stat.icon}</div>
            <div className="text-lg font-bold text-white">{stat.value}</div>
            <div className="text-[10px] text-white/40 leading-tight">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Most visited pages */}
        <div>
          <div className="text-xs text-white/40 font-medium mb-3">Most Visited Pages</div>
          <div className="space-y-2.5">
            {data.mostVisitedPages.length === 0 && (
              <div className="text-xs text-white/35">No tracked page visits yet.</div>
            )}
            {data.mostVisitedPages.map((page, i) => {
              const pct = (page.count / maxPageCount) * 100;
              return (
                <motion.div
                  key={page.page}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                >
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/70 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: pageColors[i] }} />
                      {page.page}
                    </span>
                    <span className="text-white/40">{page.count} visits</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: pageColors[i] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Most used features */}
        <div>
          <div className="text-xs text-white/40 font-medium mb-3">Most Used Features</div>
          <div className="space-y-2.5">
            {data.mostUsedFeatures.length === 0 && (
              <div className="text-xs text-white/35">No tracked feature usage yet.</div>
            )}
            {data.mostUsedFeatures.map((feature, i) => {
              const pct = (feature.count / maxFeatureCount) * 100;
              return (
                <motion.div
                  key={feature.feature}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                >
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/70 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: featureColors[i] }} />
                      {feature.feature}
                    </span>
                    <span className="text-white/40">{feature.count}×</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: featureColors[i] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Engagement ratio bar */}
      <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex justify-between text-xs mb-2">
          <span className="text-white/40">Active vs Idle Time</span>
          <span className="text-emerald-400 text-xs font-medium">
            {activePercent}% active
          </span>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <motion.div
            className="h-full"
            style={{
              background: 'linear-gradient(90deg, #10b981, #06b6d4)',
              borderRadius: '9999px 0 0 9999px',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${activePercent}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
          <motion.div
            className="h-full"
            style={{
              background: 'rgba(148,163,184,0.3)',
              borderRadius: '0 9999px 9999px 0',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${idlePercent}%` }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/30 mt-1">
          <span>🟢 Active: {formatMinutes(data.totalActiveTime)}</span>
          <span>💤 Idle: {formatMinutes(data.totalIdleTime)}</span>
        </div>
      </div>
    </motion.div>
  );
});

export default ActivityTracking;
