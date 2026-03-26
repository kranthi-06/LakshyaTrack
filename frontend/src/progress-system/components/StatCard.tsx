import { memo, type ReactNode } from 'react';
import { motion } from 'framer-motion';

export type StatTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  helper?: string;
  icon: ReactNode;
  tone?: StatTone;
}

const TONE_STYLES: Record<StatTone, { background: string; color: string }> = {
  accent: { background: 'rgba(79, 70, 229, 0.12)', color: 'var(--pi-accent)' },
  success: { background: 'rgba(16, 185, 129, 0.12)', color: 'var(--pi-success)' },
  warning: { background: 'rgba(245, 158, 11, 0.12)', color: 'var(--pi-warning)' },
  danger: { background: 'rgba(239, 68, 68, 0.12)', color: 'var(--pi-danger)' },
  neutral: { background: 'rgba(148, 163, 184, 0.14)', color: 'var(--pi-text-soft)' },
};

function StatCard({
  title,
  value,
  subtitle,
  helper,
  icon,
  tone = 'accent',
}: StatCardProps) {
  const toneStyle = TONE_STYLES[tone];

  return (
    <motion.div whileHover={{ y: -4 }} className="pi-surface rounded-[26px] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--pi-text-soft)]">
            {title}
          </div>
          <div className="mt-3 text-2xl font-semibold text-[var(--pi-text)]">{value}</div>
          <div className="mt-1 text-sm text-[var(--pi-text-muted)]">{subtitle}</div>
        </div>

        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: toneStyle.background, color: toneStyle.color }}
        >
          {icon}
        </div>
      </div>

      {helper && (
        <div className="mt-4 rounded-2xl border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] px-3 py-2 text-xs text-[var(--pi-text-soft)]">
          {helper}
        </div>
      )}
    </motion.div>
  );
}

export default memo(StatCard);
