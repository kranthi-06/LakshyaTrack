import { memo, type ReactNode } from 'react';

interface LayoutWrapperProps {
  header: ReactNode;
  sidebar: ReactNode;
  insights: ReactNode;
  footer: ReactNode;
  sidebarCollapsed: boolean;
  children: ReactNode;
}

function LayoutWrapper({
  header,
  sidebar,
  insights,
  footer,
  sidebarCollapsed,
  children,
}: LayoutWrapperProps) {
  return (
    <div
      className="progress-intelligence-dashboard min-h-full overflow-hidden"
      style={{ ['--pi-sidebar-width' as string]: sidebarCollapsed ? '5.75rem' : '16.5rem' }}
    >
      <div className="pi-layer px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 lg:gap-6">
          <div className="sticky top-3 z-30">{header}</div>

          <div className="grid gap-4 xl:grid-cols-[var(--pi-sidebar-width),minmax(0,1fr)] 2xl:grid-cols-[var(--pi-sidebar-width),minmax(0,1fr),21rem]">
            <div className="xl:sticky xl:top-28 xl:self-start">{sidebar}</div>

            <div className="min-w-0 space-y-4 lg:space-y-6">
              {children}
              <div className="2xl:hidden">{insights}</div>
            </div>

            <div className="pi-sticky-panel hidden 2xl:block 2xl:sticky 2xl:top-28 2xl:self-start">
              {insights}
            </div>
          </div>

          {footer}
        </div>
      </div>
    </div>
  );
}

export default memo(LayoutWrapper);
