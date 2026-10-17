import { describe, expect, it } from 'vitest';
import { buildContributionGrid, getUtcDateKey } from './contributionGrid';

describe('contribution grid UTC date handling', () => {
  it('uses the backend UTC day for timestamps near a local date boundary', () => {
    expect(getUtcDateKey('2025-01-01T00:30:00+02:00')).toBe('2024-12-31');
  });

  it('places contributions in the UTC day column and fills missing days with level zero', () => {
    const grid = buildContributionGrid(
      [{ date: '2024-01-01', count: 3, level: 2 }],
      2024,
      new Date('2024-01-03T12:00:00Z'),
    );
    const days = grid.flat().filter((day) => day !== null);

    expect(days[0]).toEqual({ date: '2024-01-01', count: 3, level: 2 });
    expect(days[1]).toEqual({ date: '2024-01-02', count: 0, level: 0 });
    expect(days[2]).toEqual({ date: '2024-01-03', count: 0, level: 0 });
  });
});
