export interface DashboardFooterProps {
  lastUpdated: string;
  syncLabel: string | null;
  isLive: boolean;
}

export function DashboardFooter({ lastUpdated, syncLabel, isLive }: DashboardFooterProps) {
  if (!syncLabel) return null;

  return (
    <footer className="col-span-12 pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
      Last updated: {new Date(lastUpdated).toLocaleString()} · synced {syncLabel}
      {isLive && ' · realtime engine connected'}
    </footer>
  );
}
