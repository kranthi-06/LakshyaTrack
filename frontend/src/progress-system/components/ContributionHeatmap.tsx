// ══════════════════════════════════════════════════════════════
// GitHub-Style Contribution Heatmap Component
// ══════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ContributionData, DailyContribution, HeatmapView } from '../types';

interface Props {
  data: ContributionData;
  onYearChange?: (year: number) => void;
}

const CELL_SIZE = 13;
const CELL_GAP = 3;
const TOTAL_CELL = CELL_SIZE + CELL_GAP;

const LEVEL_COLORS = {
  0: 'rgba(255,255,255,0.04)',
  1: '#0e4429',
  2: '#006d32',
  3: '#26a641',
  4: '#39d353',
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function getWeekNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  const startDay = start.getDay();
  return Math.floor((dayOfYear + startDay) / 7);
}

const ContributionHeatmap = memo(function ContributionHeatmap({ data, onYearChange }: Props) {
  const [view, setView] = useState<HeatmapView>('yearly');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: DailyContribution } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  // Group contributions by week for the grid
  const grid = useMemo(() => {
    const weeks: (DailyContribution | null)[][] = [];
    let currentWeek: (DailyContribution | null)[] = [];

    // Find the first day of the year and pad
    const firstDay = new Date(data.year, 0, 1).getDay();
    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(null);
    }

    for (const contrib of data.contributions) {
      currentWeek.push(contrib);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    return weeks;
  }, [data]);

  // Month label positions
  const monthPositions = useMemo(() => {
    const positions: { label: string; x: number }[] = [];
    let lastMonth = -1;
    grid.forEach((week, weekIdx) => {
      for (const cell of week) {
        if (cell) {
          const month = new Date(cell.date).getMonth();
          if (month !== lastMonth) {
            positions.push({ label: MONTH_LABELS[month], x: weekIdx * TOTAL_CELL });
            lastMonth = month;
          }
          break;
        }
      }
    });
    return positions;
  }, [grid]);

  // Monthly view data
  const monthlyGrid = useMemo(() => {
    if (view !== 'monthly') return [];
    return data.contributions.filter(c => {
      const month = new Date(c.date).getMonth();
      return month === selectedMonth;
    });
  }, [data, view, selectedMonth]);

  const monthlyTotal = useMemo(() => {
    return monthlyGrid.reduce((sum, c) => sum + c.count, 0);
  }, [monthlyGrid]);

  const handleCellHover = useCallback((e: React.MouseEvent, cell: DailyContribution) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 10, data: cell });
  }, []);

  const handleCellLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative rounded-2xl p-6 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-xl">📊</span>
            {data.totalContributions.toLocaleString()} contributions in {data.year}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {(['yearly', 'monthly'] as HeatmapView[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: view === v ? 'rgba(57,211,83,0.2)' : 'transparent',
                  color: view === v ? '#39d353' : 'rgba(255,255,255,0.5)',
                }}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Year selector */}
          <select
            value={data.year}
            onChange={e => onYearChange?.(parseInt(e.target.value))}
            className="bg-transparent text-sm text-white/70 border border-white/10 rounded-lg px-2 py-1.5 outline-none cursor-pointer"
            style={{ background: 'rgba(15,23,42,0.8)' }}
          >
            {years.map(y => (
              <option key={y} value={y} style={{ background: '#1e293b' }}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Monthly selector (when in monthly view) */}
      <AnimatePresence>
        {view === 'monthly' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4 flex gap-1 flex-wrap"
          >
            {MONTH_LABELS.map((m, i) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(i)}
                className="px-3 py-1 text-xs rounded-full transition-all"
                style={{
                  background: selectedMonth === i ? 'rgba(57,211,83,0.25)' : 'rgba(255,255,255,0.05)',
                  color: selectedMonth === i ? '#39d353' : 'rgba(255,255,255,0.5)',
                  border: selectedMonth === i ? '1px solid rgba(57,211,83,0.3)' : '1px solid transparent',
                }}
              >
                {m}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Yearly Heatmap Grid */}
      {view === 'yearly' && (
        <div className="overflow-x-auto pb-2">
          <svg
            width={grid.length * TOTAL_CELL + 40}
            height={7 * TOTAL_CELL + 30}
            className="block"
          >
            {/* Month labels */}
            {monthPositions.map(({ label, x }, i) => (
              <text
                key={i}
                x={x + 32}
                y={10}
                fill="rgba(255,255,255,0.4)"
                fontSize="10"
                fontFamily="Inter, sans-serif"
              >
                {label}
              </text>
            ))}

            {/* Day labels */}
            {DAY_LABELS.map((label, i) => (
              label && (
                <text
                  key={i}
                  x={0}
                  y={i * TOTAL_CELL + 28}
                  fill="rgba(255,255,255,0.3)"
                  fontSize="9"
                  fontFamily="Inter, sans-serif"
                  dominantBaseline="middle"
                >
                  {label}
                </text>
              )
            ))}

            {/* Cells */}
            {grid.map((week, weekIdx) =>
              week.map((cell, dayIdx) => {
                if (!cell) return null;
                return (
                  <rect
                    key={`${weekIdx}-${dayIdx}`}
                    x={weekIdx * TOTAL_CELL + 30}
                    y={dayIdx * TOTAL_CELL + 18}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    rx={2.5}
                    ry={2.5}
                    fill={LEVEL_COLORS[cell.level]}
                    className="cursor-pointer transition-all duration-150"
                    style={{ filter: cell.level > 0 ? `drop-shadow(0 0 ${cell.level * 2}px ${LEVEL_COLORS[cell.level]}40)` : 'none' }}
                    onMouseEnter={(e) => handleCellHover(e, cell)}
                    onMouseLeave={handleCellLeave}
                  />
                );
              })
            )}
          </svg>
        </div>
      )}

      {/* Monthly Grid View */}
      {view === 'monthly' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <p className="text-sm text-white/50">
            {monthlyTotal} contributions in {MONTH_LABELS[selectedMonth]} {data.year}
          </p>
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs text-white/30 pb-1">{d}</div>
            ))}
            {/* Pad start */}
            {Array.from({ length: new Date(data.year, selectedMonth, 1).getDay() }, (_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {monthlyGrid.map((cell, i) => (
              <motion.div
                key={cell.date}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.015 }}
                className="aspect-square rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer transition-transform hover:scale-110"
                style={{
                  background: LEVEL_COLORS[cell.level],
                  color: cell.level > 0 ? 'white' : 'rgba(255,255,255,0.2)',
                  border: `1px solid ${cell.level > 0 ? 'rgba(57,211,83,0.2)' : 'rgba(255,255,255,0.05)'}`,
                }}
                title={`${cell.date}: ${cell.count} contributions`}
              >
                {new Date(cell.date).getDate()}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-4 text-xs text-white/40">
          <span>🔥 Current: <span className="text-emerald-400 font-semibold">{data.currentStreak} days</span></span>
          <span>⭐ Longest: <span className="text-amber-400 font-semibold">{data.longestStreak} days</span></span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map(level => (
            <div
              key={level}
              className="rounded-sm"
              style={{
                width: 12,
                height: 12,
                background: LEVEL_COLORS[level],
              }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed z-[100] px-3 py-2 rounded-lg text-xs font-medium pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
              background: 'rgba(0,0,0,0.9)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div className="font-semibold">{tooltip.data.count} contribution{tooltip.data.count !== 1 ? 's' : ''}</div>
            <div className="text-white/60 mt-0.5">
              {new Date(tooltip.data.date).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default ContributionHeatmap;
