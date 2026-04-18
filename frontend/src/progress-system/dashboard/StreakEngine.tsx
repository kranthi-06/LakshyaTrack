import type { ReactNode } from 'react';

export interface StreakEngineProps {
  children: ReactNode;
}

export function StreakEngine({ children }: StreakEngineProps) {
  return (
    <div className="col-span-12 lg:col-span-6 w-full min-w-0">
      {children}
    </div>
  );
}
