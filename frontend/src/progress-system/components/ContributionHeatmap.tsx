import { useState, useMemo, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ContributionData, DailyContribution, HeatmapView } from '../types';

interface Props {
  data: ContributionData;
  onYearChange?: (year: number) => void;
}

const CELL_SIZE = 12;
const CELL_GAP = 4;
const TOTAL_CELL = CELL_SIZE + CELL_GAP;

const LEVEL_COLORS: Record<DailyContribution['level'], string> = {
  0: 'rgba(148,163,184,0.10)',
  1: '#163c2d',
  2: '#1e6648',
  3: '#22a06b',
  4: '#4ade80',
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const cardClassName =
  'relative rounded-[24px] p-5 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(2,6,23,0.35)]';

const ContributionHeatmap = memo(function ContributionHeatmap({ data, onYearChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<HeatmapView>('yearly');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: DailyContribution } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const grid = useMemo(() => {
    const weeks: (DailyContribution | null)[][] = [];
    let currentWeek: (DailyContribution | null)[] = [];

    const firstDay = new Date(data.year, 0, 1).getDay();
    for (let index = 0; index < firstDay; index += 1) {
      currentWeek.push(null);
    }

    data.contributions.forEach((contribution) => {
      currentWeek.push(contribution);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    return weeks;
  }, [data]);

  const monthPositions = useMemo(() => {
    const positions: { label: string; x: number }[] = [];
    let lastMonth = -1;

    grid.forEach((week, weekIndex) => {
      week.forEach((cell) => {
        if (!cell) {
          return;
        }

        const month = new Date(cell.date).getMonth();
        if (month !== lastMonth) {
          positions.push({ label: MONTH_LABELS[month], x: weekIndex * TOTAL_CELL + 34 });
          lastMonth = month;
        }
      });
    });

    return positions;
  }, [grid]);

  const monthlyGrid = useMemo(() => {
    if (view !== 'monthly') return [];
    return data.contributions.filter((contribution) => new Date(contribution.date).getMonth() === selectedMonth);
  }, [data, view, selectedMonth]);

  const monthlyTotal = useMemo(
    () => monthlyGrid.reduce((sum, contribution) => sum + contribution.count, 0),
    [monthlyGrid],
  );

  const averagePerActiveDay = useMemo(() => {
    const activeDays = data.contributions.filter((item) => item.count > 0).length;
    if (activeDays === 0) {
      return 0;
    }

    return Math.round((data.totalContributions / activeDays) * 10) / 10;
  }, [data]);

  const handleCellHover = useCallback((event: React.MouseEvent, cell: DailyContribution) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    setTooltip({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top - 10,
      data: cell,
    });
  }, []);

  const handleCellLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
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
            <span className="text-xl">📊</span>
            Activity Calendar
          </h3>
          <p className="mt-1 text-xs text-white/40">
            {data.totalContributions.toLocaleString()} tracked activities across {data.year}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            {(['yearly', 'monthly'] as HeatmapView[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className="px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: view === mode ? 'rgba(57,211,83,0.18)' : 'transparent',
                  color: view === mode ? '#4ade80' : 'rgba(255,255,255,0.5)',
                }}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <select
            value={data.year}
            onChange={(event) => onYearChange?.(parseInt(event.target.value, 10))}
            className="cursor-pointer rounded-xl border border-white/10 bg-slate-950/70 px-3 py-1.5 text-sm text-white/70 outline-none"
          >
            {years.map((year) => (
              <option key={year} value={year} style={{ background: '#0f172a' }}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { label: 'Total Activity', value: data.totalContributions.toLocaleString(), color: '#4ade80' },
          { label: 'Current Streak', value: `${data.currentStreak} days`, color: '#f59e0b' },
          { label: 'Avg / Active Day', value: `${averagePerActiveDay}`, color: '#60a5fa' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[20px] border p-4"
            style={{
              background: `${stat.color}08`,
              borderColor: `${stat.color}16`,
            }}
          >
            <div className="text-xs uppercase tracking-[0.18em] text-white/28">{stat.label}</div>
            <div className="mt-2 text-2xl font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {view === 'monthly' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4 flex flex-wrap gap-1.5"
          >
            {MONTH_LABELS.map((month, index) => (
              <button
                key={month}
                type="button"
                onClick={() => setSelectedMonth(index)}
                className="rounded-full px-3 py-1 text-xs transition-all"
                style={{
                  background: selectedMonth === index ? 'rgba(57,211,83,0.2)' : 'rgba(255,255,255,0.05)',
                  color: selectedMonth === index ? '#4ade80' : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${selectedMonth === index ? 'rgba(74,222,128,0.26)' : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                {month}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={containerRef}
        className="relative rounded-[22px] border border-white/6 bg-slate-950/35 p-4"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}
      >
        {view === 'yearly' && (
          <div className="overflow-x-auto pb-2">
            <svg width={grid.length * TOTAL_CELL + 56} height={7 * TOTAL_CELL + 38} className="block min-w-full">
              {monthPositions.map(({ label, x }, index) => (
                <text
                  key={`${label}-${index}`}
                  x={x}
                  y={12}
                  fill="rgba(255,255,255,0.42)"
                  fontSize="10"
                  fontFamily="Inter, sans-serif"
                >
                  {label}
                </text>
              ))}

              {DAY_LABELS.map(
                (label, index) =>
                  label && (
                    <text
                      key={`${label}-${index}`}
                      x={4}
                      y={index * TOTAL_CELL + 30}
                      fill="rgba(255,255,255,0.28)"
                      fontSize="10"
                      fontFamily="Inter, sans-serif"
                      dominantBaseline="middle"
                    >
                      {label}
                    </text>
                  ),
              )}

              {grid.map((week, weekIndex) =>
                week.map((cell, dayIndex) => {
                  if (!cell) return null;
                  return (
                    <rect
                      key={`${weekIndex}-${dayIndex}`}
                      x={weekIndex * TOTAL_CELL + 34}
                      y={dayIndex * TOTAL_CELL + 20}
                      width={CELL_SIZE}
                      height={CELL_SIZE}
                      rx={3}
                      ry={3}
                      fill={LEVEL_COLORS[cell.level]}
                      stroke={cell.level > 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)'}
                      strokeWidth={0.8}
                      className="cursor-pointer transition-all duration-200"
                      style={{
                        filter:
                          cell.level > 0
                            ? `drop-shadow(0 0 ${cell.level * 2}px ${LEVEL_COLORS[cell.level]}55)`
                            : 'none',
                      }}
                      onMouseEnter={(event) => handleCellHover(event, cell)}
                      onMouseMove={(event) => handleCellHover(event, cell)}
                      onMouseLeave={handleCellLeave}
                    />
                  );
                }),
              )}
            </svg>
          </div>
        )}

        {view === 'monthly' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="text-sm text-white/50">
              {monthlyTotal} activities in {MONTH_LABELS[selectedMonth]} {data.year}
            </div>
            <div className="grid grid-cols-7 gap-2.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="pb-1 text-center text-xs text-white/28">
                  {day}
                </div>
              ))}
              {Array.from({ length: new Date(data.year, selectedMonth, 1).getDay() }, (_, index) => (
                <div key={`pad-${index}`} />
              ))}
              {monthlyGrid.map((cell, index) => (
                <motion.button
                  key={cell.date}
                  type="button"
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.01 }}
                  className="aspect-square rounded-xl border text-xs font-medium transition-transform duration-200 hover:scale-[1.04]"
                  style={{
                    background: LEVEL_COLORS[cell.level],
                    color: cell.level > 0 ? '#f8fafc' : 'rgba(255,255,255,0.28)',
                    borderColor: cell.level > 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                  }}
                  onMouseEnter={(event) => handleCellHover(event, cell)}
                  onMouseMove={(event) => handleCellHover(event, cell)}
                  onMouseLeave={handleCellLeave}
                >
                  {new Date(cell.date).getDate()}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {tooltip && (
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="pointer-events-none absolute z-20 rounded-xl px-3 py-2 text-xs"
              style={{
                left: tooltip.x,
                top: tooltip.y,
                transform: 'translate(-50%, -100%)',
                background: 'rgba(0,0,0,0.92)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white',
                boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
              }}
            >
              <div className="font-semibold">
                {tooltip.data.count} activit{tooltip.data.count === 1 ? 'y' : 'ies'}
              </div>
              <div className="mt-0.5 text-white/60">
                {new Date(tooltip.data.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/6 pt-4">
        <div className="flex flex-wrap items-center gap-4 text-xs text-white/40">
          <span>
            🔥 Current: <span className="font-semibold text-emerald-400">{data.currentStreak} days</span>
          </span>
          <span>
            ⭐ Longest: <span className="font-semibold text-amber-400">{data.longestStreak} days</span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
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
    </motion.div>
  );
});

export default ContributionHeatmap;
