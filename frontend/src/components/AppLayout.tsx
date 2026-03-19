import { useState, useEffect, useCallback, memo, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AnimatePresence, motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';
import { usePerformanceMode } from '../hooks/usePerformanceMode';

const NetworkBackground = lazy(() => import('./NetworkBackground'));

import logoUrl from '../assets/logo.png';

interface AppLayoutProps {
    children: React.ReactNode;
}

const SIDEBAR_KEY = 'vm-sidebar-collapsed';

export const AppLayout = memo(function AppLayout({ children }: AppLayoutProps) {
    const [collapsed, setCollapsed] = useState(() => {
        const stored = localStorage.getItem(SIDEBAR_KEY);
        return stored === 'true';
    });
    const [isMobile, setIsMobile] = useState(false);
    const [isSmallScreen, setIsSmallScreen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [enableInteractiveBg, setEnableInteractiveBg] = useState(false);
    const location = useLocation();
    const { liteMode } = usePerformanceMode();

    // Close mobile sidebar on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    // Detect mobile and small screen (debounced)
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        const check = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                const mobile = window.innerWidth < 1024;
                const small = window.innerWidth < 768;
                setIsMobile(mobile);
                setIsSmallScreen(small);
                if (mobile) setCollapsed(true);
            }, 100);
        };
        // Initial check (no debounce)
        const mobile = window.innerWidth < 1024;
        const small = window.innerWidth < 768;
        setIsMobile(mobile);
        setIsSmallScreen(small);
        if (mobile) setCollapsed(true);

        window.addEventListener('resize', check, { passive: true });
        return () => {
            window.removeEventListener('resize', check);
            clearTimeout(timeout);
        };
    }, []);

    // Defer interactive background until idle to avoid blocking route transitions.
    useEffect(() => {
        if (isSmallScreen || liteMode) {
            setEnableInteractiveBg(false);
            return;
        }

        if ('requestIdleCallback' in window) {
            const idleId = requestIdleCallback(() => setEnableInteractiveBg(true), { timeout: 1500 });
            return () => cancelIdleCallback(idleId);
        }

        const timeoutId = setTimeout(() => setEnableInteractiveBg(true), 600);
        return () => clearTimeout(timeoutId);
    }, [isSmallScreen, liteMode]);

    useEffect(() => {
        document.documentElement.setAttribute('data-mobile-perf-mode', liteMode ? 'true' : 'false');
        return () => {
            document.documentElement.removeAttribute('data-mobile-perf-mode');
        };
    }, [liteMode]);

    // Prevent body scroll when mobile sidebar is open
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [mobileOpen]);

    const handleToggle = useCallback(() => {
        if (isMobile) {
            setMobileOpen(prev => !prev);
        } else {
            setCollapsed(prev => {
                localStorage.setItem(SIDEBAR_KEY, String(!prev));
                return !prev;
            });
        }
    }, [isMobile]);

    const sidebarWidth = collapsed ? 72 : 264;

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#050510]">
            {/* Mobile overlay */}
            <AnimatePresence>
                {isMobile && mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
                        onClick={() => setMobileOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar — always visible on desktop, overlay on mobile */}
            {isMobile ? (
                <AnimatePresence>
                    {mobileOpen && (
                        <motion.div
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                            className="fixed z-50 h-screen"
                            style={{ width: 264 }}
                        >
                            <AppSidebar collapsed={false} onToggle={handleToggle} />
                        </motion.div>
                    )}
                </AnimatePresence>
            ) : (
                <AppSidebar collapsed={collapsed} onToggle={handleToggle} />
            )}

            {/* Main content area */}
            <main
                className="flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 relative"
                style={{ marginLeft: isMobile ? 0 : sidebarWidth }}
            >
                {/* ── Global interactive background (skip on small devices for perf) ── */}
                <div className="fixed inset-0 pointer-events-none" style={{ marginLeft: isMobile ? 0 : sidebarWidth }}>
                    {/* Gradient base — always visible */}
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-50/40 via-rose-50/20 to-amber-50/15 dark:from-[#020817] dark:via-[#0a1628] dark:to-[#050510]" />
                    {/* Interactive canvas — skip on small screens for performance */}
                    {!isSmallScreen && !liteMode && enableInteractiveBg && (
                        <div className="absolute inset-0 pointer-events-auto">
                            <Suspense fallback={null}>
                                <NetworkBackground />
                            </Suspense>
                        </div>
                    )}
                </div>

                {/* Mobile top bar */}
                {isMobile && (
                    <div className="sticky top-0 z-30 flex items-center h-14 px-3 sm:px-4 bg-white/90 dark:bg-[#0a0a14]/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/60"
                        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
                    >
                        <button
                            onClick={() => setMobileOpen(true)}
                            className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                            aria-label="Open navigation menu"
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        </button>
                        <div className="ml-2 flex items-center gap-2">
                            <div className="w-7 h-7 flex items-center justify-center">
                                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain drop-shadow-sm" />
                            </div>
                            <span className="text-[15px] font-extrabold text-slate-900 dark:text-white tracking-tight">
                                Lakshya<span className="text-[#6C63FF]">Track</span>
                            </span>
                        </div>
                    </div>
                )}

                {/* Page content — sits above the interactive background */}
                <div className="min-h-full relative z-10">
                    {children}
                </div>
            </main>
        </div>
    );
});
