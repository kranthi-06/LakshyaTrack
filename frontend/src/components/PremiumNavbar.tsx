import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from './ThemeToggle';
import logoUrl from '../assets/logo.png';
import {
    LogOut,
    LayoutDashboard,
    FileText,
    Target,
    BookOpen,
    BrainCircuit,
    Mic2,
    Briefcase,
    LineChart,
    GraduationCap,
    Menu,
    X,
    User,
    Shield
} from 'lucide-react';

export const PremiumNavbar = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    let localProfileImage = '';

    try {
        const rawProfile = user?.email ? localStorage.getItem(`user_profile_${user.email}`) : null;
        localProfileImage = rawProfile ? JSON.parse(rawProfile).image || '' : '';
    } catch {
        localProfileImage = '';
    }

    const profileImage =
        (user as any)?.profile?.profile_image_url ||
        (user as any)?.profile?.profile_photo_url ||
        localProfileImage;

    const navItems = [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Resume', path: '/resume-builder', icon: FileText },
        { label: 'Evaluate', path: '/evaluate', icon: Target },
        { label: 'Plan', path: '/career', icon: BookOpen },
        { label: 'Quiz', path: '/quiz', icon: BrainCircuit },
        { label: 'Interview', path: '/interview', icon: Mic2 },
        { label: 'Opportunities', path: '/jobs', icon: Briefcase },
        { label: 'Progress', path: '/progress', icon: LineChart },
    ];

    if (user?.role === 'admin' || user?.role === 'black_admin') {
        navItems.push({ label: 'Admin', path: '/admin/users', icon: Shield });
    }

    return (
        <nav className="bg-[#5c52d2] sticky top-0 z-50 shadow-lg border-b border-white/10">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">

                    {/* Logo & Desktop Nav */}
                    <div className="flex items-center gap-10">
                        <Link to="/dashboard" className="flex items-center space-x-3 group relative z-10">
                            <motion.div
                                whileHover={{ rotate: 5, scale: 1.05 }}
                                className="w-10 h-10 flex items-center justify-center relative overflow-hidden"
                            >
                                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain relative z-10 drop-shadow-xl" />
                            </motion.div>
                            <span className="text-2xl font-black text-white tracking-tighter hidden sm:block">
                                Lakshya<span className="text-yellow-300">Track</span>
                            </span>
                        </Link>

                        <div className="hidden xl:flex items-center gap-1 p-1 bg-black/10 rounded-2xl backdrop-blur-sm border border-white/5">
                            {navItems.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.label}
                                        to={item.path}
                                        className="relative group"
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="navbar-active"
                                                className="absolute inset-0 bg-white rounded-xl shadow-lg"
                                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                            />
                                        )}
                                        <div className={`relative px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors font-bold text-xs uppercase tracking-wider ${isActive ? 'text-[#5c52d2]' : 'text-white/70 hover:text-white hover:bg-white/5'
                                            }`}>
                                            <item.icon className={`w-4 h-4 ${isActive ? 'text-[#5c52d2]' : 'opacity-70 group-hover:opacity-100'}`} />
                                            {item.label}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-4">
                        <ThemeToggle variant="navbar" />
                        <div className="hidden sm:flex items-center gap-3 pl-6 border-l border-white/10">
                            <Link to="/profile" className="bg-white/10 hover:bg-white/20 transition-all rounded-full p-0.5 border border-white/10 pr-4 flex items-center gap-3 group cursor-pointer">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-300 to-orange-400 p-0.5 group-hover:scale-105 transition-transform duration-300">
                                    <div className="w-full h-full rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                                        {profileImage ? (
                                            <img
                                                src={profileImage}
                                                alt="Profile"
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                                decoding="async"
                                                onError={(e) => {
                                                    // fallback if image is broken
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[#5c52d2]"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
                                                }}
                                            />
                                        ) : (
                                            <User size={16} className="text-[#5c52d2]" />
                                        )}
                                    </div>
                                </div>
                                <div className="text-xs font-bold text-white leading-tight">
                                    <p>{(user?.profile?.full_name || user?.full_name || user?.email?.split('@')[0] || 'User').split(' ')[0]}</p>
                                </div>
                            </Link>
                        </div>

                        <button
                            onClick={logout}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white hover:text-[#5c52d2] font-bold text-xs uppercase tracking-wider transition-all border border-white/5 shadow-sm"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                        </button>

                        <button
                            className="xl:hidden p-2 text-white hover:bg-white/10 rounded-xl transition-colors"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="xl:hidden border-t border-white/10 bg-[#5c52d2] overflow-hidden"
                    >
                        <div className="p-4 space-y-2">
                            {navItems.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.label}
                                        to={item.path}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${isActive
                                            ? 'bg-white text-[#5c52d2] shadow-lg'
                                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        <div className={`p-1.5 rounded-lg ${isActive ? 'bg-[#5c52d2]/10' : 'bg-transparent'}`}>
                                            <item.icon className="w-5 h-5" />
                                        </div>
                                        {item.label}
                                    </Link>
                                );
                            })}
                            <button
                                onClick={logout}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-all mt-4 border-t border-white/10 pt-4"
                            >
                                <LogOut className="w-5 h-5" />
                                Sign Out
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};
