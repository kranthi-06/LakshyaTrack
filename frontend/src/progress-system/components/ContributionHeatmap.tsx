import { useState, useMemo, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useTheme } from '../../context/ThemeContext';
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
import type { ContributionData, DailyContribution, HeatmapView } from '../types';

interface Props {
  data: ContributionData;
  onYearChange?: (year: number) => void;
  loading?: boolean;
}

const CELL_SIZE = 12;
const CELL_GAP = 4;
const TOTAL_CELL = CELL_SIZE + CELL_GAP;

const LIGHT_LEVEL_COLORS: Record<DailyContribution['level'], string> = {
  0: 'rgba(148,163,184,0.16)',
  1: '#dcfce7',
  2: '#86efac',
  3: '#22c55e',
  4: '#15803d',
};

const DARK_LEVEL_COLORS: Record<DailyContribution['level'], string> = {
  0: 'rgba(148,163,184,0.10)',
  1: '#163c2d',
  2: '#1e6648',
  3: '#22a06b',
  4: '#4ade80',
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const surfaceCardClassName = `rounded-2xl p-5 ${surfaceClassName} ${surfaceHoverClassName}`;

const ContributionHeatmap = memo(function ContributionHeatmap({ data, onYearChange, loading = false }: Props) {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<HeatmapView>('yearly');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: DailyContribution } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  const levelColors = isDark ? DARK_LEVEL_COLORS : LIGHT_LEVEL_COLORS;
  const axisLabelColor = isDark ? 'rgba(148,163,184,0.86)' : 'rgba(71,85,105,0.92)';
  const activeStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.10)';
  const inactiveStroke = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.06)';

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
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    return weeks;
  }, [data]);

  const monthPositions = useMemo(() => {
    const positions: { label: string; x: number }[] = [];
    let lastMonth = -1;

    grid.forEach((week, weekIndex) => {
      week.forEach((cell) => {
        if (!cell) return;
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
    if (activeDays === 0) return 0;
    return Math.round((data.totalContributions / activeDays) * 10) / 10;
  }, [data]);

  const handleCellHover = useCallback((event: React.MouseEvent, cell: DailyContribution) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;

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
      className="min-w-0 self-start"
    >
      <Card className={surfaceCardClassName}>
        {loading ? (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <SkeletonText lines={['w-36', 'w-56']} />
              <div className="flex items-center gap-3">
                <SkeletonBlock className="h-9 w-32 rounded-xl" />
                <SkeletonBlock className="h-9 w-20 rounded-xl" />
              </div>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className={`rounded-xl border p-4 ${panelClassName}`}>
                  <SkeletonBlock className="h-3 w-24" />
                  <SkeletonBlock className="mt-3 h-7 w-20" />
                </div>
              ))}
            </div>

            <div className={`rounded-2xl border p-4 ${panelClassName}`}>
              <div className="mb-4 flex items-center justify-between">
                <SkeletonBlock className="h-3 w-44" />
                <SkeletonBlock className="h-3 w-24" />
              </div>
              <div className="grid grid-cols-12 gap-1.5">
                {Array.from({ length: 84 }, (_, index) => (
                  <SkeletonBlock key={index} className="h-3.5 w-full rounded-[4px]" />
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/70 pt-4 dark:border-slate-800/60">
              <div className="flex gap-4">
                <SkeletonBlock className="h-3 w-28" />
                <SkeletonBlock className="h-3 w-28" />
              </div>
              <SkeletonBlock className="h-3 w-28" />
            </div>
          </>
        ) : (
          <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className={`text-base font-semibold ${titleTextClassName}`}>Activity Calendar</h3>
            <p className={`mt-1 text-xs ${mutedTextClassName}`}>
              {data.totalContributions.toLocaleString()} tracked activities across {data.year}.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex overflow-hidden rounded-xl ${pillClassName}`}>
              {(['yearly', 'monthly'] as HeatmapView[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    view === mode
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : `${mutedTextClassName} hover:text-slate-900 dark:hover:text-white`
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            <select
              value={data.year}
              onChange={(event) => onYearChange?.(parseInt(event.target.value, 10))}
              className={`cursor-pointer rounded-xl px-3 py-1.5 text-sm outline-none ${pillClassName} ${strongTextClassName}`}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2.5">
          {[
            { label: 'Total Activity', value: data.totalContributions.toLocaleString(), color: '#4ade80' },
            { label: 'Current Streak', value: `${data.currentStreak} days`, color: '#f59e0b' },
            { label: 'Avg / Active Day', value: `${averagePerActiveDay}`, color: '#60a5fa' },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl border p-3 ${panelClassName}`}
              style={{
                background: `${stat.color}08`,
                borderColor: `${stat.color}22`,
              }}
            >
              <div className={`text-[10px] font-black uppercase tracking-widest ${mutedTextClassName}`}>{stat.label}</div>
              <div className={`mt-1 text-xl font-[900] tracking-tighter ${titleTextClassName}`}>{stat.value}</div>
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
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    selectedMonth === index
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : `${pillClassName} ${mutedTextClassName}`
                  }`}
                >
                  {month}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={containerRef} className={`relative rounded-2xl border p-4 ${panelClassName}`}>
          {view === 'yearly' && (
            <div className="overflow-x-auto pb-2">
              <svg width={grid.length * TOTAL_CELL + 56} height={7 * TOTAL_CELL + 38} className="block min-w-full">
                {monthPositions.map(({ label, x }, index) => (
                  <text
                    key={`${label}-${index}`}
                    x={x}
                    y={12}
                    fill={axisLabelColor}
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
                        fill={axisLabelColor}
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
                        fill={levelColors[cell.level]}
                        stroke={cell.level > 0 ? activeStroke : inactiveStroke}
                        strokeWidth={0.8}
                        className="cursor-pointer transition-all duration-200"
                        style={{
                          filter: cell.level > 0 ? `drop-shadow(0 0 ${cell.level * 2}px ${levelColors[cell.level]}55)` : 'none',
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
              <div className={`text-sm ${mutedTextClassName}`}>
                {monthlyTotal} activities in {MONTH_LABELS[selectedMonth]} {data.year}
              </div>
              <div className="grid grid-cols-7 gap-2.5">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className={`pb-1 text-center text-xs ${mutedTextClassName}`}>
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
                      background: levelColors[cell.level],
                      color: cell.level > 2 ? '#f8fafc' : isDark ? '#e2e8f0' : '#334155',
                      borderColor: cell.level > 0 ? activeStroke : 'rgba(148,163,184,0.16)',
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
                className="pointer-events-none absolute z-20 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-800/70 dark:bg-slate-950/95"
                style={{
                  left: tooltip.x,
                  top: tooltip.y,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div className={`font-semibold ${titleTextClassName}`}>
                  {tooltip.data.count} activit{tooltip.data.count === 1 ? 'y' : 'ies'}
                </div>
                <div className={`mt-0.5 ${mutedTextClassName}`}>
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-3 text-xs dark:border-slate-800/60">
          <div className={`flex flex-wrap items-center gap-4 ${mutedTextClassName}`}>
            <span>
              Current: <span className="font-semibold text-emerald-600 dark:text-emerald-300">{data.currentStreak} days</span>
            </span>
            <span>
              Longest: <span className="font-semibold text-amber-600 dark:text-amber-300">{data.longestStreak} days</span>
            </span>
          </div>

          <div className={`flex items-center gap-2 ${mutedTextClassName}`}>
            <span>Less</span>
            {([0, 1, 2, 3, 4] as const).map((level) => (
              <div
                key={level}
                className="rounded-sm"
                style={{
                  width: 12,
                  height: 12,
                  background: levelColors[level],
                }}
              />
            ))}
            <span>More</span>
          </div>
        </div>
          </>
        )}
      </Card>
    </motion.div>
  );
});

export default ContributionHeatmap;
