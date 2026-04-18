import type { ReactNode } from 'react';

export interface IntelligenceHubProps {
  children: ReactNode;
}

export function IntelligenceHub({ children }: IntelligenceHubProps) {
  return (
    <div className="col-span-12 lg:col-span-6 w-full min-w-0">
      {children}
    </div>
  );
}
