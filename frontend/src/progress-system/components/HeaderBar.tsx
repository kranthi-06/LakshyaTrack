import { memo } from 'react';
import { Activity, RefreshCw, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { ThemeToggle } from '../../components/ThemeToggle';

export type HeaderStatusTone = 'active' | 'syncing' | 'offline';

export interface HeaderSummaryItem {
  label: string;
  value: string;
  helper: string;
}

interface HeaderBarProps {
  greeting: string;
  subtitle: string;
  statusTone: HeaderStatusTone;
  statusLabel: string;
  statusDetail: string;
  sessionLabel: string;
  summary: HeaderSummaryItem[];
  refreshing: boolean;
  onRefresh: () => void;
}

const STATUS_TONE_CLASS: Record<HeaderStatusTone, string> = {
  active: 'bg-emerald-500/12 text-emerald-500 border-emerald-500/20',
  syncing: 'bg-amber-500/12 text-amber-500 border-amber-500/20',
  offline: 'bg-rose-500/12 text-rose-500 border-rose-500/20',
};

function HeaderBar({
  greeting,
  subtitle,
  statusTone,
  statusLabel,
  statusDetail,
  sessionLabel,
  summary,
  refreshing,
  onRefresh,
}: HeaderBarProps) {
  return (
    <div className="pi-surface-strong rounded-[30px] p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--pi-text-soft)]">
            <span className="rounded-full bg-[var(--pi-accent-soft)] px-3 py-1 text-[var(--pi-accent)]">
              Intelligence Bar
            </span>
            <span className="rounded-full border border-[var(--pi-border)] px-3 py-1">
              Real-time analytics workspace
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-2xl font-semibold tracking-tight text-[var(--pi-text)] sm:text-3xl">
              {greeting}
            </div>
            <div className="max-w-3xl text-sm text-[var(--pi-text-soft)] sm:text-[0.95rem]">
              {subtitle}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${STATUS_TONE_CLASS[statusTone]}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${statusTone === 'active' ? 'bg-emerald-500 pi-pulse-dot' : statusTone === 'syncing' ? 'bg-amber-500' : 'bg-rose-500'}`} />
              {statusLabel}
            </div>

            <div className="pi-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
              <Activity className="h-3.5 w-3.5" />
              {statusDetail}
            </div>

            <div className="pi-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-[var(--pi-accent)]" />
              Session {sessionLabel}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          <ThemeToggle variant="standalone" className="!rounded-2xl !bg-[var(--pi-surface)] !text-[var(--pi-text-muted)] !border-[var(--pi-border)] !shadow-none" />

          <motion.button
            type="button"
            onClick={onRefresh}
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--pi-border-strong)] bg-[var(--pi-accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--pi-text)]"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Syncing...' : 'Refresh live data'}
          </motion.button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="pi-chip rounded-[24px] px-4 py-4">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[var(--pi-text-soft)]">
              {item.label}
            </div>
            <div className="mt-2 text-xl font-semibold text-[var(--pi-text)]">{item.value}</div>
            <div className="mt-1 text-xs text-[var(--pi-text-soft)]">{item.helper}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(HeaderBar);
