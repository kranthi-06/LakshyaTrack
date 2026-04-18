import type { ReactNode } from 'react';
import { SummaryCard, type SummaryStatItem } from './SummaryCard';

export interface SummaryCardsProps {
  stats: SummaryStatItem[];
  loadedFlags: boolean[];
  surfaceClassName: string;
  surfaceHoverClassName: string;
  skeleton: ReactNode;
}

export function SummaryCards({
  stats,
  loadedFlags,
  surfaceClassName,
  surfaceHoverClassName,
  skeleton,
}: SummaryCardsProps) {
  return (
    <div className="col-span-12 grid grid-cols-12 gap-4 md:gap-5">
      {stats.map((stat, index) => (
        <div key={stat.label} className="col-span-12 sm:col-span-6 xl:col-span-3">
          <SummaryCard
            stat={stat}
            index={index}
            loaded={Boolean(loadedFlags[index])}
            surfaceClassName={surfaceClassName}
            surfaceHoverClassName={surfaceHoverClassName}
            skeleton={skeleton}
          />
        </div>
      ))}
    </div>
  );
}
