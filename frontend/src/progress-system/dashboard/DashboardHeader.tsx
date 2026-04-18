import type { ReactNode } from 'react';

export interface DashboardHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function DashboardHeader({ eyebrow = 'Progress Intelligence', title, description, actions }: DashboardHeaderProps) {
  return (
    <header className="col-span-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
          {eyebrow}
        </div>
        <h1 className="mt-1 text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
