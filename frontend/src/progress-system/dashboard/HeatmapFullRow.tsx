import type { ReactNode } from 'react';

export interface HeatmapFullRowProps {
  children: ReactNode;
  className?: string;
}

/**
 * CRITICAL: Heatmap must occupy 100% width of the row with no siblings in the same row.
 */
export function HeatmapFullRow({ children, className = '' }: HeatmapFullRowProps) {
  return (
    <div className={`col-span-12 w-full min-w-0 ${className}`.trim()}>
      {children}
    </div>
  );
}
