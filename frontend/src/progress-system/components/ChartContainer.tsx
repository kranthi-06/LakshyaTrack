import { memo, type ReactNode } from 'react';

interface ChartContainerProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

function ChartContainer({
  eyebrow,
  title,
  description,
  action,
  footer,
  className = '',
  children,
}: ChartContainerProps) {
  return (
    <section className={`pi-surface rounded-[28px] p-4 sm:p-5 ${className}`.trim()}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--pi-text-soft)]">
            {eyebrow}
          </div>
          <div className="mt-1 text-lg font-semibold text-[var(--pi-text)]">{title}</div>
          <div className="mt-1 text-sm text-[var(--pi-text-soft)]">{description}</div>
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="mt-5">{children}</div>

      {footer && <div className="mt-4">{footer}</div>}
    </section>
  );
}

export default memo(ChartContainer);
