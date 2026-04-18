import type { ReactNode } from 'react';

export interface InsightsSectionProps {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Section chrome for analytics / insights blocks (heading + full-width content). */
export function InsightsSection({ eyebrow, title, description, children, className = '' }: InsightsSectionProps) {
  return (
    <section className={`col-span-12 space-y-4 ${className}`.trim()}>
      <div className="px-0.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
          {eyebrow}
        </div>
        <div className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</div>
        {description ? (
          <div className="max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
