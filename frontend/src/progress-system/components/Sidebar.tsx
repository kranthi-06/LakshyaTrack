import { memo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight, Layers3 } from 'lucide-react';
import { motion } from 'framer-motion';

export type DashboardSection = 'overview' | 'realtime' | 'time' | 'insights' | 'reports';
export type DetailLevel = 'overview' | 'detailed' | 'deep';

export interface SidebarItem {
  id: DashboardSection;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
}

interface SidebarProps {
  items: SidebarItem[];
  activeSection: DashboardSection;
  onSectionChange: (section: DashboardSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  detailLevel: DetailLevel;
  onDetailLevelChange: (level: DetailLevel) => void;
}

const LEVELS: { id: DetailLevel; label: string; helper: string }[] = [
  { id: 'overview', label: 'Overview', helper: 'Signal first' },
  { id: 'detailed', label: 'Detailed', helper: 'Expanded insights' },
  { id: 'deep', label: 'Deep', helper: 'Full drill down' },
];

function Sidebar({
  items,
  activeSection,
  onSectionChange,
  collapsed,
  onToggleCollapse,
  detailLevel,
  onDetailLevelChange,
}: SidebarProps) {
  return (
    <motion.aside
      layout
      className="pi-surface rounded-[28px] p-3 sm:p-4"
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={`min-w-0 ${collapsed ? 'hidden xl:block' : ''}`}>
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[var(--pi-text-soft)]">
            Workspace
          </div>
          <div className={`mt-1 flex items-center gap-2 ${collapsed ? 'xl:justify-center' : ''}`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--pi-accent-soft)] text-[var(--pi-accent)]">
              <Layers3 className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--pi-text)]">
                  Progress Intelligence
                </div>
                <div className="text-xs text-[var(--pi-text-soft)]">Multi-layer control plane</div>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="pi-control hidden h-11 w-11 items-center justify-center rounded-2xl xl:inline-flex"
          aria-label={collapsed ? 'Expand analytics navigation' : 'Collapse analytics navigation'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={`group relative flex min-w-[11rem] items-center gap-3 rounded-2xl border px-3 py-3 text-left xl:min-w-0 ${
                isActive
                  ? 'border-[var(--pi-border-strong)] bg-[var(--pi-accent-soft)] text-[var(--pi-text)]'
                  : 'border-transparent bg-transparent text-[var(--pi-text-muted)] hover:border-[var(--pi-border)] hover:bg-[var(--pi-surface-soft)]'
              } ${collapsed ? 'xl:min-w-0 xl:justify-center xl:px-0' : ''}`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  isActive
                    ? 'bg-[var(--pi-surface-strong)] text-[var(--pi-accent)]'
                    : 'bg-[var(--pi-surface-soft)] text-[var(--pi-text-soft)] group-hover:text-[var(--pi-text)]'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>

              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{item.label}</span>
                    {item.badge && (
                      <span className="rounded-full bg-[var(--pi-surface-strong)] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--pi-text-soft)]">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs text-[var(--pi-text-soft)]">{item.description}</div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-3xl border border-[var(--pi-border)] bg-[var(--pi-surface-soft)] p-3">
        {!collapsed && (
          <div className="mb-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pi-text-soft)]">
              Experience Level
            </div>
            <div className="mt-1 text-xs text-[var(--pi-text-soft)]">
              Switch between summary, detail, and deep analytics.
            </div>
          </div>
        )}

        <div className={`flex gap-2 ${collapsed ? 'xl:flex-col' : 'flex-col'}`}>
          {LEVELS.map((level) => {
            const active = detailLevel === level.id;
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => onDetailLevelChange(level.id)}
                className={`rounded-2xl border px-3 py-2.5 text-left ${
                  active
                    ? 'border-[var(--pi-border-strong)] bg-[var(--pi-accent-soft)] text-[var(--pi-text)]'
                    : 'border-transparent bg-transparent text-[var(--pi-text-muted)] hover:border-[var(--pi-border)] hover:bg-[var(--pi-surface)]'
                } ${collapsed ? 'xl:px-0 xl:text-center' : ''}`}
              >
                <div className={`text-sm font-semibold ${collapsed ? 'xl:text-xs' : ''}`}>{level.label}</div>
                {!collapsed && <div className="text-[0.7rem] text-[var(--pi-text-soft)]">{level.helper}</div>}
              </button>
            );
          })}
        </div>
      </div>
    </motion.aside>
  );
}

export default memo(Sidebar);
