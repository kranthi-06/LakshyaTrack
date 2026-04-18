import { useState, useMemo, useCallback, useRef, memo, useEffect } from 'react';
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

const CELL_SIZE = 14;
const CELL_GAP = 4;

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

function weekHasMonthStart(week: (DailyContribution | null)[]): boolean {
  return week.some((cell) => {
    if (!cell) return false;
    const dt = new Date(cell.date);
    return dt.getDate() === 1;
  });
}

function findFocusNeighbor(
  grid: (DailyContribution | null)[][],
  w: number,
  d: number,
  key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown',
): [number, number] | null {
  const maxW = grid.length;
  if (key === 'ArrowLeft') {
    for (let cw = w - 1; cw >= 0; cw -= 1) {
      if (grid[cw][d]) return [cw, d];
    }
    return null;
  }
  if (key === 'ArrowRight') {
    for (let cw = w + 1; cw < maxW; cw += 1) {
      if (grid[cw][d]) return [cw, d];
    }
    return null;
  }
  if (key === 'ArrowUp') {
    for (let cd = d - 1; cd >= 0; cd -= 1) {
      if (grid[w][cd]) return [w, cd];
    }
    return null;
  }
  if (key === 'ArrowDown') {
    for (let cd = d + 1; cd < 7; cd += 1) {
      if (grid[w][cd]) return [w, cd];
    }
    return null;
  }
  return null;
}

const ContributionHeatmap = memo(function ContributionHeatmap({ data, onYearChange, loading = false }: Props) {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
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

  const monthLabelsByWeek = useMemo(() => {
    const labels: string[] = grid.map(() => '');
    const seen = new Set<number>();
    grid.forEach((week, wi) => {
      for (const cell of week) {
        if (!cell) continue;
        const dt = new Date(cell.date);
        if (dt.getDate() === 1) {
          const m = dt.getMonth();
          if (!seen.has(m)) {
            seen.add(m);
            labels[wi] = MONTH_LABELS[m];
          }
          break;
        }
      }
    });
    return labels;
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

  const handleCellFocusVisual = useCallback((event: React.FocusEvent<HTMLButtonElement>, cell: DailyContribution) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2 - bounds.left,
      y: rect.top - bounds.top - 8,
      data: cell,
    });
  }, []);

  const handleCellLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const firstDataCoord = useMemo(() => {
    for (let w = 0; w < grid.length; w += 1) {
      for (let d = 0; d < 7; d += 1) {
        if (grid[w][d]) return [w, d] as const;
      }
    }
    return [0, 0] as const;
  }, [grid]);

  const [tabStop, setTabStop] = useState<[number, number]>(() => firstDataCoord);

  useEffect(() => {
    setTabStop(firstDataCoord);
  }, [data.year, firstDataCoord]);

  const handleYearlyKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, w: number, d: number) => {
      const key = event.key;
      if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowDown') {
        return;
      }
      event.preventDefault();
      const next = findFocusNeighbor(grid, w, d, key);
      if (!next) return;
      const [nw, nd] = next;
      setTabStop([nw, nd]);
      requestAnimationFrame(() => {
        cellRefs.current.get(`${nw}-${nd}`)?.focus();
      });
    },
    [grid],
  );

  const handleYearlyCellFocus = useCallback(
    (wi: number, di: number, event: React.FocusEvent<HTMLButtonElement>, cell: DailyContribution) => {
      setTabStop([wi, di]);
      handleCellFocusVisual(event, cell);
    },
    [handleCellFocusVisual],
  );

  const colCount = grid.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-w-0 w-full"
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
                <div
                  className="overflow-x-auto pb-2"
                  role="grid"
                  aria-label={`Activity calendar for ${data.year}`}
                  aria-rowcount={7}
                  aria-colcount={colCount}
                >
                  <div className="inline-flex min-w-full flex-col gap-2">
                    <div className="flex items-end" style={{ paddingLeft: 28 }}>
                      <div className="flex" style={{ gap: CELL_GAP }}>
                        {grid.map((_, wi) => (
                          <div
                            key={`mh-${wi}`}
                            className="flex flex-shrink-0 flex-col items-center justify-end"
                            style={{ width: CELL_SIZE }}
                          >
                            <span
                              className="text-[10px] font-medium leading-none"
                              style={{ color: axisLabelColor }}
                            >
                              {monthLabelsByWeek[wi] ?? ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-stretch" style={{ gap: CELL_GAP }}>
                      <div
                        className="flex flex-shrink-0 flex-col py-0.5"
                        style={{ width: 24, gap: CELL_GAP }}
                      >
                        {Array.from({ length: 7 }, (_, di) => (
                          <div
                            key={`dl-${di}`}
                            className="flex items-center text-[10px] font-medium leading-none"
                            style={{ color: axisLabelColor, height: CELL_SIZE }}
                          >
                            {DAY_LABELS[di] || ''}
                          </div>
                        ))}
                      </div>

                      <div className="flex min-w-0 flex-1" style={{ gap: CELL_GAP }}>
                        {grid.map((week, wi) => {
                          const monthEdge = weekHasMonthStart(week);
                          return (
                            <div
                              key={`w-${wi}`}
                              className={`flex flex-shrink-0 flex-col ${monthEdge ? 'border-l border-slate-300/50 pl-1 dark:border-slate-600/50' : ''}`}
                              style={{ gap: CELL_GAP }}
                              role="presentation"
                            >
                              {week.map((cell, di) => {
                                if (!cell) {
                                  return (
                                    <div
                                      key={`e-${wi}-${di}`}
                                      style={{ width: CELL_SIZE, height: CELL_SIZE }}
                                      aria-hidden
                                    />
                                  );
                                }
                                const dateLabel = new Date(cell.date).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                });
                                return (
                                  <button
                                    key={cell.date}
                                    type="button"
                                    role="gridcell"
                                    aria-label={`${dateLabel}, ${cell.count} activities`}
                                    ref={(el) => {
                                      const k = `${wi}-${di}`;
                                      if (el) cellRefs.current.set(k, el);
                                      else cellRefs.current.delete(k);
                                    }}
                                    tabIndex={tabStop[0] === wi && tabStop[1] === di ? 0 : -1}
                                    className="flex-shrink-0 cursor-pointer rounded-[3px] outline-none ring-offset-2 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-emerald-500/80 focus-visible:ring-offset-0"
                                    style={{
                                      width: CELL_SIZE,
                                      height: CELL_SIZE,
                                      background: levelColors[cell.level],
                                      borderWidth: 0.8,
                                      borderStyle: 'solid',
                                      borderColor: cell.level > 0 ? activeStroke : inactiveStroke,
                                      boxShadow:
                                        cell.level > 0
                                          ? `0 0 ${cell.level * 2}px ${levelColors[cell.level]}55`
                                          : undefined,
                                    }}
                                    onMouseEnter={(event) => handleCellHover(event, cell)}
                                    onMouseMove={(event) => handleCellHover(event, cell)}
                                    onMouseLeave={handleCellLeave}
                                    onFocus={(e) => handleYearlyCellFocus(wi, di, e, cell)}
                                    onBlur={handleCellLeave}
                                    onKeyDown={(e) => handleYearlyKeyDown(e, wi, di)}
                                  />
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {view === 'monthly' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className={`text-sm ${mutedTextClassName}`}>
                    {monthlyTotal} activities in {MONTH_LABELS[selectedMonth]} {data.year}
                  </div>
                  <div className="grid grid-cols-7 gap-2.5" role="grid" aria-label={`Daily activity for ${MONTH_LABELS[selectedMonth]}`}>
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
                        role="gridcell"
                        initial={{ scale: 0.92, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: index * 0.01 }}
                        className="aspect-square rounded-xl border text-xs font-medium transition-transform duration-200 hover:scale-[1.04] outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-emerald-500/80"
                        style={{
                          background: levelColors[cell.level],
                          color: cell.level > 2 ? '#f8fafc' : isDark ? '#e2e8f0' : '#334155',
                          borderColor: cell.level > 0 ? activeStroke : 'rgba(148,163,184,0.16)',
                        }}
                        aria-label={`${new Date(cell.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${cell.count} activities`}
                        onMouseEnter={(event) => handleCellHover(event, cell)}
                        onMouseMove={(event) => handleCellHover(event, cell)}
                        onMouseLeave={handleCellLeave}
                        onFocus={(e) => handleCellFocusVisual(e, cell)}
                        onBlur={handleCellLeave}
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
                    role="tooltip"
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
