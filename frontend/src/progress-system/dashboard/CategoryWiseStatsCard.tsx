import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { SkeletonBlock, SkeletonText } from '../ui/loading';
import type { TopicBubble } from '../types';

const surfaceClassName =
  'border-slate-200/70 bg-white/85 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/40';
const surfaceHoverClassName =
  'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md';

function buildCategoryStats(topics: TopicBubble[]) {
  const totals = new Map<string, { problemsSolved: number; timeSpentMinutes: number; count: number }>();
  topics.forEach((topic) => {
    const key = topic.category || 'Other';
    const current = totals.get(key) ?? { problemsSolved: 0, timeSpentMinutes: 0, count: 0 };
    current.problemsSolved += topic.problemsSolved;
    current.timeSpentMinutes += topic.timeSpentMinutes;
    current.count += 1;
    totals.set(key, current);
  });

  return Array.from(totals.entries())
    .map(([category, value]) => ({ category, ...value }))
    .sort((a, b) => b.problemsSolved - a.problemsSolved || b.timeSpentMinutes - a.timeSpentMinutes);
}

export interface CategoryWiseStatsCardProps {
  topics: TopicBubble[];
  loading?: boolean;
}

export function CategoryWiseStatsCard({ topics, loading = false }: CategoryWiseStatsCardProps) {
  const rows = useMemo(() => buildCategoryStats(topics), [topics]);
  const maxSolved = Math.max(1, ...rows.map((r) => r.problemsSolved));
  const maxMinutes = Math.max(1, ...rows.map((r) => r.timeSpentMinutes));

  return (
    <Card className={`rounded-2xl p-5 ${surfaceClassName} ${surfaceHoverClassName}`}>
      {loading ? (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <SkeletonText lines={['w-32', 'w-56']} />
            <SkeletonBlock className="h-8 w-24 rounded-full" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-slate-800/60 dark:bg-slate-950/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <SkeletonBlock className="h-4 w-28" />
                    <SkeletonBlock className="h-3 w-20" />
                  </div>
                  <div className="space-y-2 text-right">
                    <SkeletonBlock className="h-4 w-16" />
                    <SkeletonBlock className="h-3 w-14" />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {Array.from({ length: 2 }, (_, barIndex) => (
                    <div key={barIndex}>
                      <div className="mb-2 flex items-center justify-between">
                        <SkeletonBlock className="h-3 w-10" />
                        <SkeletonBlock className="h-3 w-8" />
                      </div>
                      <SkeletonBlock className="h-2 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                <span className="text-xl">🗂️</span>
                Category-wise Stats
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Where your practice time and wins are concentrating.
              </p>
            </div>
            <div className="rounded-full border border-slate-200/70 bg-white/60 px-3 py-2 text-xs text-slate-600 dark:border-slate-800/60 dark:bg-slate-950/30 dark:text-slate-300">
              {rows.length} categories
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-5 text-sm text-slate-600 dark:border-slate-800/60 dark:bg-slate-950/30 dark:text-slate-300">
              No category activity yet. Start solving quizzes/problems to populate this view.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.slice(0, 8).map((row) => {
                const solvedPct = Math.round((row.problemsSolved / maxSolved) * 100);
                const timePct = Math.round((row.timeSpentMinutes / maxMinutes) * 100);
                const hours = Math.round((row.timeSpentMinutes / 60) * 10) / 10;

                return (
                  <div
                    key={row.category}
                    className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-slate-800/60 dark:bg-slate-950/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{row.category}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.count} topics tracked</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{row.problemsSolved} solved</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hours}h spent</div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Solved</span>
                          <span className="text-slate-600 dark:text-slate-300">{solvedPct}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden bg-slate-200/70 dark:bg-white/10">
                          <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${solvedPct}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Time</span>
                          <span className="text-slate-600 dark:text-slate-300">{timePct}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden bg-slate-200/70 dark:bg-white/10">
                          <div className="h-full rounded-full bg-sky-500/70" style={{ width: `${timePct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
