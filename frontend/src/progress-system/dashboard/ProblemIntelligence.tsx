import type { ReactNode } from 'react';

export interface ProblemIntelligenceProps {
  children: ReactNode;
}

/** Problem-solving stats + related analytics (two columns on large screens). */
export function ProblemIntelligence({ children }: ProblemIntelligenceProps) {
  return (
    <div className="col-span-12 grid grid-cols-12 gap-5 xl:gap-6 items-start">
      {children}
    </div>
  );
}

export function ProblemIntelligenceColumn({ children }: { children: ReactNode }) {
  return <div className="col-span-12 xl:col-span-6 w-full min-w-0">{children}</div>;
}
