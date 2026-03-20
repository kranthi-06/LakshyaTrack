import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { prefetchRoute } from '../utils/routePrefetch';
import {
    LayoutDashboard,
    FileText,
    BookOpen,
    BrainCircuit,
    Mic2,
    Briefcase,
    LineChart,
    GraduationCap,
    LogOut,
    ChevronLeft,
    User,
    Shield,
    Sun,
    Moon,
    Target,
    Sparkles,
    PanelLeftClose,
    PanelLeft,
    Crown,
    Lock,
    Languages,
    Brain,
} from 'lucide-react';
import SubscriptionBadge from './SubscriptionBadge';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

// Feature keys mapped to each nav item (null = always free)
const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, featureKey: null },
    { label: 'Resume Studio', path: '/resume-builder', icon: FileText, featureKey: 'resume_builder' },
    { label: 'Evaluate', path: '/evaluate', icon: Target, featureKey: null },
    { label: 'Learning Roadmaps', path: '/career', icon: BookOpen, featureKey: 'roadmap_generate' },
    { label: 'Quizzes', path: '/quiz', icon: BrainCircuit, featureKey: null },
    { label: 'Interview Simulator', path: '/interview', icon: Mic2, featureKey: 'interview_start' },
    { label: 'English Coach', path: '/english', icon: Languages, featureKey: null },
    { label: 'Reasoning', path: '/reasoning', icon: Brain, featureKey: null },
    { label: 'Opportunity Portal', path: '/jobs', icon: Briefcase, featureKey: 'job_portal' },
    { label: 'Progress Tracker', path: '/progress', icon: LineChart, featureKey: null },
];

import logoUrl from '../assets/logo.png';

export function AppSidebar({ collapsed, onToggle }: SidebarProps) {
    const { user, logout } = useAuth();
    const { hasFeature, stage, loading: subLoading, resolved: subResolved } = useSubscription();
    const location = useLocation();
    const { isDark, toggleTheme } = useTheme();

    const isAdmin = user?.role === 'admin' || user?.role === 'black_admin';
    const displayName = user?.profile?.full_name || user?.full_name || user?.email?.split('@')[0] || 'User';
    const profilePhoto = (user as any)?.profile?.profile_image_url || (user as any)?.profile?.profile_photo_url || null;
    const prefetchPath = useCallback((path: string) => {
        prefetchRoute(path);
    }, []);

    // Keyboard shortcut: Ctrl+B / Cmd+B
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
                e.preventDefault();
                onToggle();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onToggle]);

    return (
        <aside
            className={`fixed top-0 left-0 h-screen z-50 flex flex-col border-r transition-all duration-300 ease-in-out
                ${collapsed ? 'w-[72px]' : 'w-[264px]'}
                bg-white dark:bg-[#0a0a14] border-slate-200/80 dark:border-slate-800/60`}
        >
            {/* ── Logo Area ── */}
            <div className={`flex items-center h-16 px-4 border-b border-slate-200/80 dark:border-slate-800/60 ${collapsed ? 'justify-center' : 'justify-between'}`}>
                <Link to="/dashboard" className="flex items-center gap-3 group min-w-0">
                    <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-contain drop-shadow-lg" />
                    </div>
                    {!collapsed && (
                        <motion.span
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-[17px] font-extrabold text-slate-900 dark:text-white tracking-tight truncate"
                        >
                            Lakshya<span className="text-[#6C63FF]">Track</span>
                        </motion.span>
                    )}
                </Link>
                {!collapsed && (
                    <button
                        onClick={onToggle}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Collapse sidebar (Ctrl+B)"
                    >
                        <PanelLeftClose className="w-[18px] h-[18px]" />
                    </button>
                )}
            </div>

            {/* ── Navigation ── */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-3 space-y-0.5 no-scrollbar">
                {collapsed && (
                    <button
                        onClick={onToggle}
                        className="w-full flex justify-center py-2 mb-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                        title="Expand sidebar"
                    >
                        <PanelLeft className="w-[18px] h-[18px]" />
                    </button>
                )}

                {navItems.map((item) => {
                    const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                    // Only show lock icons after subscription data resolves to prevent flicker
                    const isLocked = subResolved && item.featureKey ? !hasFeature(item.featureKey) : false;
                    return (
                        <Link
                            key={item.label}
                            to={item.path}
                            onMouseEnter={() => prefetchPath(item.path)}
                            onFocus={() => prefetchPath(item.path)}
                            onTouchStart={() => prefetchPath(item.path)}
                            className={`relative flex items-center gap-3 rounded-xl transition-all duration-200 group
                                ${collapsed ? 'justify-center px-0 py-2.5 mx-auto' : 'px-3 py-2.5'}
                                ${isActive
                                    ? 'bg-[#6C63FF]/10 text-[#6C63FF] dark:bg-[#6C63FF]/15 dark:text-[#8B83FF] font-semibold'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                }`}
                            title={collapsed ? `${item.label}${isLocked ? ' 🔒' : ''}` : undefined}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="sidebar-active-pill"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#6C63FF] rounded-r-full"
                                    transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                                />
                            )}
                            <item.icon className={`flex-shrink-0 ${collapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]'}`} />
                            {!collapsed && (
                                <>
                                    <motion.span
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-[13px] font-medium truncate flex-1"
                                    >
                                        {item.label}
                                    </motion.span>
                                    {isLocked && (
                                        <Lock className="w-3.5 h-3.5 text-amber-500/70 flex-shrink-0" />
                                    )}
                                </>
                            )}
                        </Link>
                    );
                })}

                {isAdmin && (
                    <>
                        <div className={`my-3 border-t border-slate-200/80 dark:border-slate-800/60 ${collapsed ? 'mx-2' : 'mx-1'}`} />
                        <Link
                            to="/admin/users"
                            onMouseEnter={() => prefetchPath('/admin/users')}
                            onFocus={() => prefetchPath('/admin/users')}
                            onTouchStart={() => prefetchPath('/admin/users')}
                            className={`relative flex items-center gap-3 rounded-xl transition-all duration-200
                                ${collapsed ? 'justify-center px-0 py-2.5 mx-auto' : 'px-3 py-2.5'}
                                ${location.pathname.startsWith('/admin')
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                }`}
                            title={collapsed ? 'Admin' : undefined}
                        >
                            <Shield className={`flex-shrink-0 ${collapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]'}`} />
                            {!collapsed && <span className="text-[13px] font-medium">Admin Panel</span>}
                        </Link>
                    </>
                )}
            </nav>

            {/* ── Bottom Section ── */}
            <div className="border-t border-slate-200/80 dark:border-slate-800/60 p-3 space-y-1.5">
                {/* Upgrade button (for non-ultimate users only) */}
                {/* Only show after subscription data resolves to prevent flicker */}
                {subResolved && !subLoading && !isAdmin && stage < 3 && (
                    <Link
                        to="/plans"
                        className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/15 hover:to-orange-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 transition-all
                            ${collapsed ? 'justify-center px-0' : ''}`}
                        title={collapsed ? 'Upgrade Plan' : undefined}
                    >
                        <Crown className={`flex-shrink-0 ${collapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]'}`} />
                        {!collapsed && <span className="text-[13px] font-bold">Upgrade Plan</span>}
                    </Link>
                )}

                {/* Theme toggle */}
                <button
                    onClick={toggleTheme}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all
                        ${collapsed ? 'justify-center px-0' : ''}`}
                    title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {isDark ? <Sun className="w-[18px] h-[18px] flex-shrink-0" /> : <Moon className="w-[18px] h-[18px] flex-shrink-0" />}
                    {!collapsed && <span className="text-[13px] font-medium">{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
                </button>

                {/* Profile link */}
                <Link
                    to="/profile"
                    onMouseEnter={() => prefetchPath('/profile')}
                    onFocus={() => prefetchPath('/profile')}
                    onTouchStart={() => prefetchPath('/profile')}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group
                        ${collapsed ? 'justify-center px-0' : ''}
                        ${location.pathname === '/profile' ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                    title={collapsed ? displayName : undefined}
                >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#4F46E5] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {profilePhoto ? (
                            <img src={profilePhoto} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                        ) : (
                            <User className="w-4 h-4 text-white" />
                        )}
                    </div>
                    {!collapsed && (
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate leading-tight">{displayName}</p>
                                <SubscriptionBadge />
                            </div>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate leading-tight">{user?.email}</p>
                        </div>
                    )}
                </Link>

                {/* Logout */}
                <button
                    onClick={logout}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all
                        ${collapsed ? 'justify-center px-0' : ''}`}
                    title={collapsed ? 'Sign out' : undefined}
                >
                    <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
                    {!collapsed && <span className="text-[13px] font-medium">Sign Out</span>}
                </button>
            </div>
        </aside>
    );
}
