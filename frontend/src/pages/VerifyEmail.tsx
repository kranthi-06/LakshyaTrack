import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight,
    CheckCircle2,
    Clock3,
    GraduationCap,
    Mail,
    ShieldCheck,
    Sparkles,
    BadgeCheck,
    LockKeyhole,
    RefreshCcw,
} from 'lucide-react';

function FloatingParticles() {
    const particles = useMemo(
        () =>
            Array.from({ length: 40 }, (_, i) => ({
                id: i,
                x: Math.random() * 100,
                y: Math.random() * 100,
                size: Math.random() * 3 + 1,
                duration: Math.random() * 15 + 10,
                delay: Math.random() * 8,
                opacity: Math.random() * 0.5 + 0.1,
            })),
        []
    );

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((particle) => (
                <motion.div
                    key={particle.id}
                    className="absolute rounded-full bg-white"
                    style={{
                        left: `${particle.x}%`,
                        top: `${particle.y}%`,
                        width: particle.size,
                        height: particle.size,
                    }}
                    animate={{
                        y: [0, -30, 10, -20, 0],
                        x: [0, 15, -10, 5, 0],
                        opacity: [
                            particle.opacity,
                            particle.opacity + 0.2,
                            particle.opacity,
                            particle.opacity + 0.3,
                            particle.opacity,
                        ],
                    }}
                    transition={{
                        duration: particle.duration,
                        repeat: Infinity,
                        delay: particle.delay,
                        ease: 'easeInOut',
                    }}
                />
            ))}
        </div>
    );
}

const FEATURES = [
    {
        icon: BadgeCheck,
        title: 'Trusted Access',
        desc: 'Verification protects your account before you enter your dashboard.',
        gradient: 'from-blue-400/20 to-cyan-400/20',
        iconBg: 'bg-blue-400/20',
        iconColor: 'text-blue-200',
    },
    {
        icon: LockKeyhole,
        title: 'Secure Identity Check',
        desc: 'Every code is time-sensitive and encrypted for a safer sign-in flow.',
        gradient: 'from-purple-400/20 to-pink-400/20',
        iconBg: 'bg-purple-400/20',
        iconColor: 'text-purple-200',
    },
    {
        icon: RefreshCcw,
        title: 'Quick Recovery',
        desc: 'Request a fresh code instantly if the first message does not arrive.',
        gradient: 'from-emerald-400/20 to-teal-400/20',
        iconBg: 'bg-emerald-400/20',
        iconColor: 'text-emerald-200',
    },
];

export default function VerifyEmail() {
    const { state } = useLocation();
    const [email] = useState(state?.email || '');
    const [otp, setOtp] = useState('');
    const { verifyOtp, resendOtp } = useAuth();
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState<{
        message: string;
        type: 'success' | 'error' | 'info';
    } | null>(null);
    const navigate = useNavigate();

    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await verifyOtp(email, otp);
            showToast('Email verified successfully! Redirecting to dashboard...', 'success');
            setTimeout(() => navigate('/dashboard'), 1500);
        } catch (err: any) {
            console.error('Verification Error:', err);
            let errorMsg = 'Verification failed. Invalid OTP.';
            if (err.response?.data?.detail) {
                errorMsg = err.response.data.detail;
            }
            setError(errorMsg);
            showToast(errorMsg, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        try {
            showToast('Resending code...', 'info');
            await resendOtp(email);
            showToast('Verification code resent!', 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to resend code', 'error');
        }
    };

    return (
        <div className="min-h-screen flex font-sans">
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ y: -60, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -60, opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-2xl shadow-2xl text-white z-[100] font-semibold flex items-center gap-2.5 text-sm backdrop-blur-md ${
                            toast.type === 'success'
                                ? 'bg-emerald-500/90'
                                : toast.type === 'error'
                                  ? 'bg-rose-500/90'
                                  : 'bg-indigo-500/90'
                        }`}
                    >
                        {toast.type === 'success' && <CheckCircle2 size={18} />}
                        {toast.type !== 'success' && <ShieldCheck size={18} />}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="hidden lg:flex w-[44%] relative overflow-hidden flex-col justify-between p-10 xl:p-14">
                <div className="absolute inset-0 bg-gradient-to-br from-[#4f46e5] via-[#7c3aed] to-[#ec4899]" />

                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage: `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15) 0%, transparent 50%),
                                          radial-gradient(circle at 80% 80%, rgba(168,85,247,0.2) 0%, transparent 50%),
                                          radial-gradient(circle at 50% 50%, rgba(59,130,246,0.1) 0%, transparent 70%)`,
                    }}
                />

                <FloatingParticles />

                <div className="absolute top-[15%] left-[10%] w-72 h-72 bg-blue-500/20 rounded-full blur-[100px] animate-pulse" />
                <div
                    className="absolute bottom-[10%] right-[5%] w-80 h-80 bg-pink-500/15 rounded-full blur-[120px]"
                    style={{ animationDelay: '2s', animationDuration: '4s' }}
                />
                <div
                    className="absolute top-[60%] left-[50%] w-48 h-48 bg-violet-400/15 rounded-full blur-[80px]"
                    style={{ animationDelay: '1s', animationDuration: '5s' }}
                />

                <div className="relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Link to="/" className="flex items-center gap-3 w-fit hover:opacity-80 transition-opacity">
                            <div className="w-11 h-11 bg-white/15 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-lg shadow-white/5">
                                <GraduationCap size={24} className="text-white" />
                            </div>
                            <span className="text-2xl font-extrabold tracking-tight text-white">Vidorya</span>
                        </Link>
                    </motion.div>
                </div>

                <div className="relative z-10 space-y-8 my-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-amber-300" />
                            <span className="text-xs font-bold text-white/70 uppercase tracking-[0.2em]">
                                Secure Account Verification
                            </span>
                        </div>
                        <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
                            One Final Step
                            <br />
                            Before You Enter
                        </h1>
                        <p className="text-base xl:text-lg text-white/60 mt-4 leading-relaxed max-w-md font-medium">
                            Confirm your email address to unlock your personalized career workspace and keep your
                            account protected from day one.
                        </p>
                    </motion.div>

                    <div className="space-y-3">
                        {FEATURES.map((feature, index) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                                whileHover={{ x: 6, scale: 1.01 }}
                                className={`flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-r ${feature.gradient} backdrop-blur-md border border-white/10 cursor-default transition-all duration-300 hover:border-white/20 hover:shadow-lg hover:shadow-white/5 group`}
                            >
                                <div
                                    className={`w-10 h-10 rounded-xl ${feature.iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}
                                >
                                    <feature.icon className={`w-5 h-5 ${feature.iconColor}`} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-white text-sm tracking-wide">{feature.title}</h3>
                                    <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{feature.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="relative z-10"
                >
                    <p className="text-[11px] text-white/30 font-medium">
                        Copyright {new Date().getFullYear()} Vidorya. All rights reserved.
                    </p>
                </motion.div>
            </div>

            <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-950 p-6 sm:p-10 relative overflow-hidden">
                <div
                    className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] pointer-events-none"
                    style={{
                        backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
                        backgroundSize: '32px 32px',
                    }}
                />
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-50/70 via-transparent to-transparent dark:from-indigo-950/20 pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="w-full max-w-[520px] relative z-10"
                >
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
                            <GraduationCap size={22} className="text-white" />
                        </div>
                        <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                            Vidorya
                        </span>
                    </div>

                    <div className="rounded-[30px] border border-white/70 dark:border-slate-800 bg-white/80 dark:bg-slate-950/70 backdrop-blur-2xl shadow-[0_32px_90px_-40px_rgba(79,70,229,0.45)] dark:shadow-[0_32px_90px_-40px_rgba(15,23,42,0.9)] p-6 sm:p-8">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 mb-7">
                            <div className="space-y-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-[11px] font-bold uppercase tracking-[0.18em]">
                                    <Mail className="w-3.5 h-3.5" />
                                    Email verification
                                </div>
                                <div>
                                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                        Verify Your Email
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-[15px] font-medium max-w-md">
                                        Enter the 6-digit code we sent to your inbox to complete sign in.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
                                <div className="w-11 h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center">
                                    <Clock3 className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                                        Check your inbox
                                    </p>
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        Code sent instantly
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50 via-white to-fuchsia-50 dark:from-indigo-950/30 dark:via-slate-950/60 dark:to-fuchsia-950/20 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500 mb-2">
                                Verification email
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm">
                                    <Mail className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-300" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white break-all">
                                        {email || 'No email found'}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Make sure the code matches the most recent message.
                                    </p>
                                </div>
                            </div>
                        </div>

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

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="otp"
                                    className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                                >
                                    One-time password
                                </Label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <ShieldCheck className="h-[18px] w-[18px] text-slate-400 dark:text-slate-600 group-focus-within:text-indigo-500 transition-colors duration-200" />
                                    </div>
                                    <Input
                                        id="otp"
                                        required
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="pl-11 pr-4 h-14 rounded-2xl border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/15 dark:focus:ring-indigo-400/15 bg-slate-50/70 dark:bg-slate-900/60 focus:bg-white dark:focus:bg-slate-900 transition-all text-center text-xl sm:text-2xl font-semibold tracking-[0.45em] text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-[0_0_0_0_rgba(79,70,229,0)] focus:shadow-[0_0_0_6px_rgba(99,102,241,0.08)]"
                                        placeholder="123456"
                                        maxLength={6}
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                    />
                                </div>
                                <p className="text-[13px] text-slate-500 dark:text-slate-400">
                                    Paste the code from your email, or type it manually.
                                </p>
                            </div>

                            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-12 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:via-violet-500 hover:to-purple-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/25 dark:shadow-indigo-900/30 hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-300 disabled:opacity-70 flex items-center justify-center gap-2 group"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center gap-2">
                                            <svg
                                                className="animate-spin h-4 w-4 text-white"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                                />
                                            </svg>
                                            Verifying...
                                        </span>
                                    ) : (
                                        <>
                                            Verify & Login
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                        </>
                                    )}
                                </Button>
                            </motion.div>
                        </form>

                        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <p className="text-[14px] text-slate-500 dark:text-slate-400 font-medium">
                                Did not receive the code?
                            </p>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handleResendOtp}
                                className="justify-start sm:justify-center px-0 sm:px-3 h-auto text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 hover:bg-transparent font-bold text-sm"
                            >
                                Resend Verification Code
                            </Button>
                        </div>

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
                                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Protected Verification
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-500 leading-relaxed mt-0.5">
                                    We verify your email before granting access so your account stays secure across
                                    sign-in sessions.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
