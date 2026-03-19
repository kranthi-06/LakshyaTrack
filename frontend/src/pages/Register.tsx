import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User,
    Mail,
    Lock,
    Eye,
    EyeOff,
    CheckCircle2,
    ShieldCheck,
    GraduationCap,
    ArrowRight,
    Sparkles,
    FileText,
    Map,
    BarChart3,
} from 'lucide-react';

/* ─────────────── Google Icon SVG ─────────────── */
const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

/* ─────────────── Animated Particles ─────────────── */
function FloatingParticles() {
    const particles = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 15 + 10,
        delay: Math.random() * 8,
        opacity: Math.random() * 0.5 + 0.1,
    })), []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map(p => (
                <motion.div
                    key={p.id}
                    className="absolute rounded-full bg-white"
                    style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
                    animate={{
                        y: [0, -30, 10, -20, 0],
                        x: [0, 15, -10, 5, 0],
                        opacity: [p.opacity, p.opacity + 0.2, p.opacity, p.opacity + 0.3, p.opacity],
                    }}
                    transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

/* ─────────────── Feature Cards Data ─────────────── */
const FEATURES = [
    {
        icon: FileText,
        title: 'Smart Resume Builder',
        desc: 'Create ATS-friendly resumes in minutes with AI assistance.',
        gradient: 'from-blue-400/20 to-cyan-400/20',
        iconBg: 'bg-blue-400/20',
        iconColor: 'text-blue-200',
    },
    {
        icon: Map,
        title: 'Career Roadmap',
        desc: 'Step-by-step guide to your dream job with personalized milestones.',
        gradient: 'from-purple-400/20 to-pink-400/20',
        iconBg: 'bg-purple-400/20',
        iconColor: 'text-purple-200',
    },
    {
        icon: BarChart3,
        title: 'Skill Analytics',
        desc: 'Track your progress relative to industry standards.',
        gradient: 'from-emerald-400/20 to-teal-400/20',
        iconBg: 'bg-emerald-400/20',
        iconColor: 'text-emerald-200',
    },
];

/* ═══════════════════════════════════════════════════════ */
/*  REGISTER PAGE                                         */
/* ═══════════════════════════════════════════════════════ */
export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const { register, signInWithGoogle, resendOtp } = useAuth();
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
    const navigate = useNavigate();

    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            showToast('Passwords do not match', 'error');
            return;
        }

        setIsLoading(true);
        try {
            const fullName = `${firstName} ${lastName}`.trim();
            const finalUsername = username || email.split('@')[0];

            const response = await register({
                email,
                password,
                full_name: fullName,
                username: finalUsername
            });

            if (response.warning) {
                showToast(response.message || 'Account created. Check server logs for OTP.', 'info');
            } else {
                showToast('Account created & OTP sent! Please verify your email.', 'success');
            }

            setTimeout(() => navigate('/verify-email', { state: { email } }), 1500);
        } catch (err: any) {
            console.error('Registration Error:', err);
            let errorMsg = 'Registration failed. Please try again.';

            if (err.response?.data?.detail) {
                const detail = err.response.data.detail;
                if (typeof detail === 'string') {
                    errorMsg = detail;
                } else if (Array.isArray(detail)) {
                    errorMsg = detail.map((e: any) => e.msg).join(', ');
                } else {
                    errorMsg = JSON.stringify(detail);
                }
            } else if (err.response?.data) {
                errorMsg = `Server Error: ${JSON.stringify(err.response.data)}`;
            } else if (err.message) {
                errorMsg = err.message;
            }

            setError(errorMsg);
            showToast(errorMsg, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignUp = async () => {
        if (googleLoading) return;
        setGoogleLoading(true);
        try {
            await signInWithGoogle();
        } catch (err) {
            showToast('Google sign-in failed', 'error');
            setGoogleLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex font-sans">

            {/* ═══════════════════════════════════════════ */}
            {/* Toast Notification                          */}
            {/* ═══════════════════════════════════════════ */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ y: -60, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -60, opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-2xl shadow-2xl text-white z-[100] font-semibold flex items-center gap-2.5 text-sm backdrop-blur-md ${
                            toast.type === 'success' ? 'bg-emerald-500/90' :
                            toast.type === 'error' ? 'bg-rose-500/90' : 'bg-indigo-500/90'
                        }`}
                    >
                        {toast.type === 'success' && <CheckCircle2 size={18} />}
                        {toast.type === 'error' && <ShieldCheck size={18} />}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══════════════════════════════════════════ */}
            {/* LEFT SIDE — Branding Panel                  */}
            {/* ═══════════════════════════════════════════ */}
            <div className="hidden lg:flex w-[44%] relative overflow-hidden flex-col justify-between p-10 xl:p-14">
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#4f46e5] via-[#7c3aed] to-[#ec4899]" />

                {/* Animated mesh overlay */}
                <div className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage: `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15) 0%, transparent 50%),
                                          radial-gradient(circle at 80% 80%, rgba(168,85,247,0.2) 0%, transparent 50%),
                                          radial-gradient(circle at 50% 50%, rgba(59,130,246,0.1) 0%, transparent 70%)`,
                    }}
                />

                {/* Floating particles */}
                <FloatingParticles />

                {/* Glowing orbs */}
                <div className="absolute top-[15%] left-[10%] w-72 h-72 bg-blue-500/20 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-[10%] right-[5%] w-80 h-80 bg-pink-500/15 rounded-full blur-[120px]" style={{ animationDelay: '2s', animationDuration: '4s' }} />
                <div className="absolute top-[60%] left-[50%] w-48 h-48 bg-violet-400/15 rounded-full blur-[80px]" style={{ animationDelay: '1s', animationDuration: '5s' }} />

                {/* Content */}
                <div className="relative z-10">
                    {/* Logo */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Link to="/" className="flex items-center gap-3 w-fit hover:opacity-80 transition-opacity">
                            <div className="w-11 h-11 flex items-center justify-center">
                                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-md" />
                            </div>
                            <span className="text-2xl font-extrabold tracking-tight text-white">LakshyaTrack</span>
                        </Link>
                    </motion.div>
                </div>

                <div className="relative z-10 space-y-8 my-auto">
                    {/* Headline */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-amber-300" />
                            <span className="text-xs font-bold text-white/70 uppercase tracking-[0.2em]">Join 15,000+ Professionals</span>
                        </div>
                        <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
                            Start Your Journey<br />
                            to{' '}
                            <span className="bg-gradient-to-r from-amber-200 via-yellow-200 to-orange-200 bg-clip-text text-transparent">
                                Success
                            </span>
                            {' '}Today
                        </h1>
                        <p className="text-base xl:text-lg text-white/60 mt-4 leading-relaxed max-w-md font-medium">
                            Create your account to unlock AI-powered career tools, personalized learning paths, and mock interviews.
                        </p>
                    </motion.div>

                    {/* Feature Cards */}
                    <div className="space-y-3">
                        {FEATURES.map((f, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.4, delay: 0.3 + idx * 0.1 }}
                                whileHover={{ x: 6, scale: 1.01 }}
                                className={`flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-r ${f.gradient} backdrop-blur-md border border-white/10 cursor-default transition-all duration-300 hover:border-white/20 hover:shadow-lg hover:shadow-white/5 group`}
                            >
                                <div className={`w-10 h-10 rounded-xl ${f.iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                                    <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-white text-sm tracking-wide">{f.title}</h3>
                                    <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{f.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Bottom */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="relative z-10"
                >
                    <p className="text-[11px] text-white/30 font-medium">
                        © {new Date().getFullYear()} LakshyaTrack. All rights reserved.
                    </p>
                </motion.div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* RIGHT SIDE — Registration Form              */}
            {/* ═══════════════════════════════════════════ */}
            <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-950 p-6 sm:p-10 relative overflow-y-auto">

                {/* Subtle background pattern */}
                <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '32px 32px' }}
                />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="w-full max-w-[440px] relative z-10 py-4"
                >
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                        <div className="w-10 h-10 flex items-center justify-center">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-md" />
                        </div>
                        <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">LakshyaTrack</span>
                    </div>

                    {/* Header */}
                    <div className="mb-7">
                        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Create Account</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-[15px] font-medium">Enter your details to get started</p>
                    </div>

                    {/* Error Banner */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -8, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                exit={{ opacity: 0, y: -8, height: 0 }}
                                className="mb-5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2"
                            >
                                <div className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center flex-shrink-0">
                                    <span className="text-rose-500 text-xs">!</span>
                                </div>
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Google Sign-Up (Top for prominence) ── */}
                    <Button
                        type="button"
                        onClick={handleGoogleSignUp}
                        disabled={googleLoading}
                        variant="outline"
                        className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-center justify-center gap-3 text-slate-700 dark:text-slate-200 font-semibold text-sm disabled:opacity-70 shadow-sm hover:shadow-md"
                    >
                        {googleLoading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Connecting to Google...
                            </span>
                        ) : (
                            <>
                                <GoogleIcon />
                                <span>Continue with Google</span>
                            </>
                        )}
                    </Button>

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-200 dark:border-slate-800" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-white dark:bg-slate-950 px-4 text-[11px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-[0.15em]">or sign up with email</span>
                        </div>
                    </div>

                    {/* ── Registration Form ── */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name Fields */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="firstName" className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">First Name</Label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <User className="h-[16px] w-[16px] text-slate-400 dark:text-slate-600 group-focus-within:text-indigo-500 transition-colors duration-200" />
                                    </div>
                                    <Input
                                        id="firstName"
                                        required
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="pl-9 h-12 rounded-xl border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                        placeholder="John"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="lastName" className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Last Name</Label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <User className="h-[16px] w-[16px] text-slate-400 dark:text-slate-600 group-focus-within:text-indigo-500 transition-colors duration-200" />
                                    </div>
                                    <Input
                                        id="lastName"
                                        required
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="pl-9 h-12 rounded-xl border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Email Field */}
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Email Address</Label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Mail className="h-[18px] w-[18px] text-slate-400 dark:text-slate-600 group-focus-within:text-indigo-500 transition-colors duration-200" />
                                </div>
                                <Input
                                    type="email"
                                    id="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 h-12 rounded-xl border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Password</Label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="h-[18px] w-[18px] text-slate-400 dark:text-slate-600 group-focus-within:text-indigo-500 transition-colors duration-200" />
                                </div>
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 pr-11 h-12 rounded-xl border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                    placeholder="Create a password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 dark:text-slate-600 hover:text-indigo-500 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password Field */}
                        <div className="space-y-1.5">
                            <Label htmlFor="confirmPassword" className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Confirm Password</Label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="h-[18px] w-[18px] text-slate-400 dark:text-slate-600 group-focus-within:text-indigo-500 transition-colors duration-200" />
                                </div>
                                <Input
                                    type={showConfirmPassword ? "text" : "password"}
                                    id="confirmPassword"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10 pr-11 h-12 rounded-xl border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-900 transition-all text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                    placeholder="Confirm your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 dark:text-slate-600 hover:text-indigo-500 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                                </button>
                            </div>
                        </div>

                        {/* Password match indicator */}
                        {confirmPassword && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className={`flex items-center gap-2 text-xs font-medium ${
                                    password === confirmPassword
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-500 dark:text-rose-400'
                                }`}
                            >
                                {password === confirmPassword ? (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Passwords match</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span>Passwords do not match</span>
                                    </>
                                )}
                            </motion.div>
                        )}

                        {/* Create Account Button */}
                        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="pt-1">
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-12 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:via-violet-500 hover:to-purple-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/25 dark:shadow-indigo-900/30 hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-300 disabled:opacity-70 flex items-center justify-center gap-2 group"
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Creating Account...
                                    </span>
                                ) : (
                                    <>
                                        Create Account
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                    </>
                                )}
                            </Button>
                        </motion.div>
                    </form>

                    {/* Sign In Link */}
                    <p className="text-center text-slate-500 dark:text-slate-400 text-[14px] mt-6 font-medium">
                        Already have an account?{' '}
                        <Link to="/login" className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors">
                            Sign in instead
                        </Link>
                    </p>

                    {/* Security Notice */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-6 flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800"
                    >
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Secure Registration</h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-500 leading-relaxed mt-0.5">
                                Your data is encrypted and protected using industry-standard security protocols. We never share your information.
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
