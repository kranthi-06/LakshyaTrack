import type { ReactNode } from 'react';

export interface TimeAnalyticsSectionProps {
  children: ReactNode;
}

/** Full-width analytics row for time / hourly charts (single column in 12-grid). */
export function TimeAnalyticsSection({ children }: TimeAnalyticsSectionProps) {
  return <div className="col-span-12 w-full min-w-0">{children}</div>;
}
