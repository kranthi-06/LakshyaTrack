import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AnimatePresence, motion } from 'framer-motion';
import NetworkBackground from './NetworkBackground';

interface AppLayoutProps {
    children: React.ReactNode;
}

const SIDEBAR_KEY = 'vm-sidebar-collapsed';

export function AppLayout({ children }: AppLayoutProps) {
    const [collapsed, setCollapsed] = useState(() => {
        const stored = localStorage.getItem(SIDEBAR_KEY);
        return stored === 'true';
    });
    const [isMobile, setIsMobile] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();

    // Close mobile sidebar on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    // Detect mobile
    useEffect(() => {
        const check = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            if (mobile) setCollapsed(true);
        };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const handleToggle = () => {
        if (isMobile) {
            setMobileOpen(prev => !prev);
        } else {
            setCollapsed(prev => {
                localStorage.setItem(SIDEBAR_KEY, String(!prev));
                return !prev;
            });
        }
    };

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
                        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
                        onClick={() => setMobileOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar — always visible on desktop, overlay on mobile */}
            {isMobile ? (
                <AnimatePresence>
                    {mobileOpen && (
                        <motion.div
                            initial={{ x: -264 }}
                            animate={{ x: 0 }}
                            exit={{ x: -264 }}
                            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
                            className="fixed z-50"
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
                {/* ── Global interactive background ── */}
                <div className="fixed inset-0 pointer-events-none" style={{ marginLeft: isMobile ? 0 : sidebarWidth }}>
                    {/* Gradient base */}
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-50/40 via-rose-50/20 to-amber-50/15 dark:from-[#020817] dark:via-[#0a1628] dark:to-[#050510]" />
                    {/* Interactive canvas */}
                    <div className="absolute inset-0 pointer-events-auto">
                        <NetworkBackground />
                    </div>
                </div>

                {/* Mobile top bar */}
                {isMobile && (
                    <div className="sticky top-0 z-30 flex items-center h-14 px-4 bg-white/80 dark:bg-[#0a0a14]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/60">
                        <button
                            onClick={() => setMobileOpen(true)}
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        </button>
                        <span className="ml-3 text-[15px] font-bold text-slate-900 dark:text-white">VidyaMithra</span>
                    </div>
                )}

                {/* Page content — sits above the interactive background */}
                <div className="min-h-full relative z-10">
                    {children}
                </div>
            </main>
        </div>
    );
}
