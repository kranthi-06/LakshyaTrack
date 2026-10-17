import type { DailyContribution } from '../types';

export function getUtcDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function getUtcMonth(value: string): number {
  return new Date(`${getUtcDateKey(value)}T00:00:00Z`).getUTCMonth();
}

export function getUtcDayOfMonth(value: string): number {
  return new Date(`${getUtcDateKey(value)}T00:00:00Z`).getUTCDate();
}

export function buildContributionGrid(
  contributions: DailyContribution[],
  year: number,
  today = new Date(),
): (DailyContribution | null)[][] {
  const countsByDate = new Map(contributions.map((item) => [getUtcDateKey(item.date), item]));
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const lastDay = year < todayUtc.getUTCFullYear()
    ? yearEnd
    : year === todayUtc.getUTCFullYear()
      ? todayUtc
      : new Date(Date.UTC(year, 0, 0));
  const weeks: (DailyContribution | null)[][] = [];
  let currentWeek: (DailyContribution | null)[] = [];
  const firstDay = new Date(Date.UTC(year, 0, 1)).getUTCDay();

  for (let index = 0; index < firstDay; index += 1) currentWeek.push(null);

  for (let day = new Date(Date.UTC(year, 0, 1)); day <= lastDay; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    currentWeek.push(countsByDate.get(date) ?? { date, count: 0, level: 0 });
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return weeks;
}
