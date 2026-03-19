import { useState, useEffect, useMemo, MouseEvent } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PremiumBackground } from '../components/PremiumBackground';
import {
    Sparkles,
    CheckCircle2,
    FileText,
    Target,
    Mic,
    BookOpen,
    Play,
    ChevronRight,
    Search,
    Facebook,
    Twitter,
    Linkedin,
    Mail,
    GraduationCap,
    ArrowRight,
    MousePointer2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '../components/ThemeToggle';
import { usePerformanceMode } from '../hooks/usePerformanceMode';

// 3D Tilt Card Component
const TiltCard = ({ children, className }: { children: React.ReactNode, className?: string }) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotateX = useTransform(y, [-100, 100], [30, -30]);
    const rotateY = useTransform(x, [-100, 100], [-30, 30]);

    function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
        const rect = event.currentTarget.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const xPct = mouseX / width - 0.5;
        const yPct = mouseY / height - 0.5;
        x.set(xPct * 200);
        y.set(yPct * 200);
    }

    function handleMouseLeave() {
        x.set(0);
        y.set(0);
    }

    return (
        <motion.div
            style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={className}
        >
            <div style={{ transform: "translateZ(75px)", transformStyle: "preserve-3d" }}>
                {children}
            </div>
        </motion.div>
    );
};

export default function Landing() {
    const [activeFeature, setActiveFeature] = useState('resume');
    const [scrolled, setScrolled] = useState(false);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'info' } | null>(null);
    const { liteMode, isMobile } = usePerformanceMode();

    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    useEffect(() => {
        let rafId = 0;
        const handleScroll = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const next = window.scrollY > 50;
                setScrolled((prev) => (prev === next ? prev : next));
            });
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const floatingParticles = useMemo(() => {
        const count = liteMode ? 0 : isMobile ? 5 : 20;
        return Array.from({ length: count }).map((_, index) => ({
            id: index,
            width: Math.random() * 300 + 50,
            height: Math.random() * 300 + 50,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            moveY: Math.random() * 100 - 50,
            moveX: Math.random() * 100 - 50,
            duration: Math.random() * 10 + 10,
        }));
    }, [isMobile, liteMode]);

    const showToast = (message: string, type: 'success' | 'info' = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const features = {
        resume: {
            title: "AI-Powered Resume Analysis",
            desc: "Upload your resume and get instant feedback with our advanced AI engine that analyzes structure, content, and keywords.",
            points: ["Instant ATS compatibility check", "Skill gap identification", "Personalized improvement suggestions"],
            icon: FileText,
            color: "purple"
        },
        skills: {
            title: "Comprehensive Skill Mapping",
            desc: "Identify your strengths and weaknesses with detailed skill assessments across technical and soft skills.",
            points: ["Interactive skill quizzes", "Industry benchmark comparisons", "Skill development roadmaps"],
            icon: Target,
            color: "blue"
        },
        interview: {
            title: "AI-Powered Mock Interviews",
            desc: "Practice with realistic interview simulations and get instant feedback on your responses, tone, and confidence.",
            points: ["Voice and text-based interviews", "Real-time feedback and scoring", "Technical & behavioral rounds"],
            icon: Mic,
            color: "green"
        },
        training: {
            title: "Personalized Training Plans",
            desc: "Get customized learning paths with curated resources, video tutorials, and hands-on projects tailored to your goals.",
            points: ["AI-curated learning resources", "Progress tracking & milestones", "Hands-on projects & assessments"],
            icon: BookOpen,
            color: "yellow"
        }
    };

    return (
        <div className="relative min-h-screen font-inter overflow-x-hidden bg-gray-50 selection:bg-purple-200 selection:text-purple-900" style={{ overflowX: 'hidden' }}>
            {/* Scroll Progress Bar */}
            <motion.div
                className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 origin-left z-[100]"
                style={{ scaleX }}
            />

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ x: 300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 300, opacity: 0 }}
                        className={`fixed top-24 right-4 px-6 py-4 rounded-xl shadow-2xl text-white z-[100] backdrop-blur-md border border-white/20 flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-500/90' : 'bg-blue-500/90'}`}
                    >
                        {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                        <span className="font-bold">{toast.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Navigation */}
            <nav className={`fixed w-full top-0 z-50 transition-all duration-500 py-4 ${scrolled ? 'bg-white/80 backdrop-blur-xl shadow-lg py-3 border-b border-gray-100' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-8 gap-4 sm:gap-6">
                    <div className="flex items-center space-x-2 sm:space-x-3 group cursor-pointer shrink-0" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                        <motion.div
                            whileHover={{ rotate: 5, scale: 1.05 }}
                            className="w-12 h-12 flex items-center justify-center relative overflow-hidden"
                        >
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain relative z-10 drop-shadow-lg" />
                        </motion.div>
                        <span className={`text-xl sm:text-2xl font-black tracking-tighter ${scrolled ? "text-gray-900" : "text-white"}`}>
                            Lakshya<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">Track</span>
                        </span>
                    </div>

                    <div className="hidden sm:flex items-center space-x-6 sm:space-x-10">
                        {['Home', 'Features', 'Demo'].map((item) => (
                            <a
                                key={item}
                                href={`#${item.toLowerCase()}`}
                                className={`font-bold text-[10px] sm:text-sm uppercase tracking-widest transition-all hover:scale-105 relative group ${scrolled ? 'text-gray-600 hover:text-purple-600' : 'text-white/80 hover:text-white'}`}
                            >
                                {item}
                                <span className={`absolute -bottom-1 left-0 w-0 h-0.5 transition-all group-hover:w-full ${scrolled ? 'bg-purple-600' : 'bg-white'}`}></span>
                            </a>
                        ))}
                    </div>

                    <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
                        <ThemeToggle variant="landing" />
                        <Link to="/login">
                            <Button variant="ghost" className={`font-bold text-xs sm:text-sm hover:bg-white/10 h-9 sm:h-10 ${scrolled ? 'text-gray-600 hover:text-purple-600 hover:bg-purple-50' : 'text-white'}`}>
                                Sign In
                            </Button>
                        </Link>
                        <Link to="/register">
                            <Button className={`font-black rounded-lg sm:rounded-xl transition-all h-9 sm:h-11 px-4 sm:px-8 text-xs sm:text-sm shadow-xl hover:shadow-2xl hover:-translate-y-1 ${scrolled ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' : 'bg-white text-slate-800 hover:bg-yellow-300'
                                }`}>
                                Get Started
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section id="home" className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 overflow-hidden min-h-screen flex items-center animated-gradient">
                <PremiumBackground />

                {/* Floating Particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {floatingParticles.map((particle) => (
                        <motion.div
                            key={particle.id}
                            className="absolute rounded-full bg-white/10 blur-xl"
                            style={{
                                width: particle.width,
                                height: particle.height,
                                left: particle.left,
                                top: particle.top,
                            }}
                            animate={{
                                y: [0, particle.moveY],
                                x: [0, particle.moveX],
                                scale: [1, 1.2, 1],
                                opacity: [0.1, 0.3, 0.1],
                            }}
                            transition={{
                                duration: particle.duration,
                                repeat: Infinity,
                                ease: "linear",
                            }}
                        />
                    ))}
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10 w-full">
                    <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="text-white space-y-8"
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-yellow-300 font-bold text-sm tracking-wide"
                            >
                                <Sparkles className="w-4 h-4" />
                                <span>#1 AI Career Assistant</span>
                            </motion.div>

                            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-[5.5rem] font-black leading-[1.15] md:leading-[1.05] tracking-tighter drop-shadow-2xl">
                                Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-indigo-200">Intelligent</span> <br />
                                <span className="relative inline-block">
                                    <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-300 italic">Career Agent</span>
                                    <motion.svg className="absolute w-full h-3 -bottom-1 left-0 text-yellow-500 z-0" viewBox="0 0 100 10" preserveAspectRatio="none">
                                        <motion.path d="M0 5 Q 50 10 100 5" fill="transparent" strokeWidth="4" stroke="currentColor" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.8 }} />
                                    </motion.svg>
                                </span>
                            </h1>

                            <p className="text-base sm:text-lg md:text-xl text-purple-100 max-w-xl leading-relaxed font-medium opacity-90">
                                Stop guessing. Start growing. Let our AI analyze your potential, optimize your resume, and guide you to your dream job with surgical precision.
                            </p>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="flex flex-wrap gap-4"
                            >
                                <Link to="/register">
                                    <Button size="lg" className="h-14 sm:h-16 px-8 sm:px-10 rounded-2xl bg-white text-slate-800 hover:bg-yellow-300 font-black text-base sm:text-lg shadow-[0_20px_40px_-10px_rgba(255,255,255,0.3)] hover:-translate-y-1 transition-all flex items-center gap-2 group w-full sm:w-auto justify-center">
                                        Launch Career
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </Link>

                            </motion.div>


                        </motion.div>

                        <div className="hidden lg:flex justify-center perspective-1000">
                            <TiltCard className="relative w-full max-w-lg cursor-none group">
                                <motion.div
                                    className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-purple-600 rounded-[2.5rem] blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"
                                    animate={{
                                        scale: [1, 1.02, 1],
                                        rotate: [0, 1, -1, 0]
                                    }}
                                    transition={{ duration: 5, repeat: Infinity }}
                                ></motion.div>
                                <div className="relative bg-[#0F172A]/90 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-2xl p-8 overflow-hidden">
                                    {/* Mock UI */}
                                    <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 p-0.5">
                                                <div className="w-full h-full rounded-full bg-[#0F172A] flex items-center justify-center">
                                                    <span className="font-bold text-white">US</span>
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-white font-bold">Welcome, User</h3>
                                                <p className="text-gray-400 text-xs">Software Engineer</p>
                                            </div>
                                        </div>
                                        {/* Badge Removed */}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2">
                                            <p className="text-gray-400 text-xs font-bold uppercase">Resume Score</p>
                                            <p className="text-3xl font-black text-white flex items-end gap-2">
                                                92 <span className="text-sm text-green-400 font-bold mb-1">↑ 12%</span>
                                            </p>
                                            <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: "92%" }}
                                                    transition={{ delay: 1, duration: 1.5 }}
                                                    className="h-full bg-green-500 rounded-full"
                                                />
                                            </div>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2">
                                            <p className="text-gray-400 text-xs font-bold uppercase">Interviews</p>
                                            <p className="text-3xl font-black text-white flex items-end gap-2">
                                                15 <span className="text-sm text-purple-400 font-bold mb-1">Completed</span>
                                            </p>
                                            <div className="flex -space-x-1">
                                                {[1, 2, 3].map(i => <div key={i} className="w-6 h-6 rounded-full bg-gray-600 border border-[#0F172A]"></div>)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-sm font-bold text-white mb-2">
                                            <span>Skill Growth</span>
                                            <span>Last 30 Days</span>
                                        </div>
                                        <div className="h-32 flex items-end justify-between gap-2">
                                            {[40, 65, 50, 80, 60, 90, 75].map((h, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ height: 0 }}
                                                    animate={{ height: `${h}%` }}
                                                    transition={{ delay: 1.5 + (i * 0.1), duration: 0.5 }}
                                                    className="w-full bg-purple-500/30 rounded-t-lg relative overflow-hidden group hover:bg-purple-500 transition-colors"
                                                >
                                                    <div className="absolute top-0 left-0 w-full h-1 bg-purple-400/50"></div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Cursor follower overlay */}
                                    <motion.div
                                        className="absolute pointer-events-none"
                                        style={{ x: 100, y: 100 }}
                                        animate={{ x: [50, 200, 300, 100], y: [50, 150, 50, 100] }}
                                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                    >
                                        <MousePointer2 className="w-6 h-6 text-yellow-400 fill-yellow-400 drop-shadow-lg" />
                                        <div className="ml-4 mt-2 px-3 py-1 bg-yellow-400 text-black text-xs font-bold rounded-lg shadow-lg">
                                            Analyzing Resume...
                                        </div>
                                    </motion.div>
                                </div>
                            </TiltCard>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section - Interactive Tabs */}
            <section id="features" className="py-16 sm:py-24 lg:py-32 relative z-10 overflow-hidden animated-gradient">
                <PremiumBackground />
                <div className="max-w-7xl mx-auto px-4 sm:px-8 relative">
                    <div className="text-center max-w-3xl mx-auto mb-20 space-y-6">
                        <motion.span
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            className="text-[#5c52d2] font-black uppercase tracking-[0.4em] text-xs px-6 py-2 bg-purple-50 rounded-full border border-purple-100"
                        >
                            Powerhouse Features
                        </motion.span>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tighter text-gray-900"
                        >
                            Built for <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent italic px-2">Greatness</span>
                        </motion.h2>
                    </div>

                    {/* Interactive Tabs */}
                    <div className="flex flex-nowrap sm:flex-wrap justify-start sm:justify-center gap-3 sm:gap-4 mb-10 sm:mb-16 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
                        {Object.entries(features).map(([key, feature]) => {
                            const Icon = feature.icon;
                            const isActive = activeFeature === key;
                            return (
                                <motion.button
                                    key={key}
                                    onClick={() => setActiveFeature(key)}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={`px-5 sm:px-8 py-3 sm:py-4 rounded-full font-bold transition-all flex items-center gap-2 sm:gap-3 border-2 whitespace-nowrap text-sm sm:text-base shrink-0 ${isActive
                                        ? 'border-purple-600 bg-purple-600 text-white shadow-xl shadow-purple-200'
                                        : 'border-transparent bg-gray-100 text-gray-500 hover:bg-white hover:border-gray-200 hover:shadow-lg'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 ${isActive ? 'text-yellow-300' : 'text-gray-400'}`} />
                                    {key.charAt(0).toUpperCase() + key.slice(1)}
                                </motion.button>
                            );
                        })}
                    </div>

                    <div className="relative">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeFeature}
                                initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                                transition={{ duration: 0.4 }}
                                className="bg-white rounded-2xl sm:rounded-[3rem] p-5 sm:p-8 md:p-16 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.1)] border border-gray-100 relative overflow-hidden"
                            >
                                <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-${features[activeFeature as keyof typeof features].color}-400 to-${features[activeFeature as keyof typeof features].color}-600`}></div>
                                <div className="grid lg:grid-cols-2 gap-8 lg:gap-20 items-center">
                                    <div className="space-y-10 relative z-10">
                                        <div className={`inline-flex p-4 rounded-2xl bg-${features[activeFeature as keyof typeof features].color}-50 text-${features[activeFeature as keyof typeof features].color}-600`}>
                                            {(() => {
                                                const Icon = features[activeFeature as keyof typeof features].icon;
                                                return <Icon className="w-10 h-10" />;
                                            })()}
                                        </div>
                                        <div className="space-y-6">
                                            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-gray-900">
                                                {features[activeFeature as keyof typeof features].title}
                                            </h3>
                                            <p className="text-base sm:text-lg md:text-xl text-gray-600 leading-relaxed font-medium">
                                                {features[activeFeature as keyof typeof features].desc}
                                            </p>
                                        </div>
                                        <ul className="space-y-4">
                                            {features[activeFeature as keyof typeof features].points.map((point, i) => (
                                                <motion.li
                                                    key={i}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.1 * i }}
                                                    className="flex items-center gap-4 text-gray-800 font-bold p-4 bg-gray-50 rounded-xl hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100"
                                                >
                                                    <CheckCircle2 className={`w-6 h-6 text-${features[activeFeature as keyof typeof features].color}-500`} />
                                                    {point}
                                                </motion.li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Dynamic Visual Side */}
                                    <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] bg-gray-50 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 flex items-center justify-center overflow-hidden group">
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]"></div>

                                        {/* Mock Visuals based on Feature */}
                                        <motion.div
                                            className="text-center space-y-6 relative z-10"
                                            initial={{ scale: 0.8 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 200 }}
                                        >
                                            <div className="w-32 h-32 mx-auto bg-white rounded-full shadow-2xl flex items-center justify-center relative">
                                                <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
                                                <motion.div
                                                    className={`absolute inset-0 rounded-full border-4 border-${features[activeFeature as keyof typeof features].color}-500 border-t-transparent`}
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                ></motion.div>
                                                {(() => {
                                                    const Icon = features[activeFeature as keyof typeof features].icon;
                                                    return <Icon className={`w-12 h-12 text-${features[activeFeature as keyof typeof features].color}-500`} />;
                                                })()}
                                            </div>
                                            <div className="bg-white px-8 py-3 rounded-full shadow-lg border border-gray-100 font-black text-gray-900">
                                                AI Analysis in Progress...
                                            </div>
                                        </motion.div>

                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </section>

            {/* CTA Section - Acting as Demo/Get Started */}
            {/* CTA Section - Acting as Demo/Get Started */}
            <section id="demo" className="py-16 sm:py-24 lg:py-32 relative overflow-hidden animated-gradient">
                <PremiumBackground />

                <div className="max-w-4xl mx-auto px-4 relative z-10 text-center space-y-12">
                    <motion.h2
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="text-4xl sm:text-6xl md:text-8xl font-black text-white tracking-tighter"
                    >
                        Ready to <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500">Ascend?</span>
                    </motion.h2>

                    <p className="text-lg sm:text-xl md:text-2xl text-gray-400 font-medium leading-relaxed">
                        Join the platform that is redefining career growth for the AI age.
                    </p>

                    <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                        <Link to="/register" className="w-full md:w-auto">
                            <Button className="w-full md:w-auto h-16 sm:h-20 px-8 sm:px-12 text-xl sm:text-2xl font-black bg-white text-[#0F172A] hover:bg-yellow-300 rounded-2xl sm:rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.3)] hover:shadow-[0_0_80px_rgba(255,255,255,0.5)] transition-all hover:-translate-y-2">
                                Start Free Trial
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-100 pt-12 sm:pt-24 pb-8 sm:pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 sm:gap-10">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 flex items-center justify-center">
                                <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain drop-shadow-lg" />
                            </div>
                            <span className="text-3xl font-black tracking-tighter text-gray-900">LakshyaTrack</span>
                        </div>
                        <div className="flex gap-4 sm:gap-8 text-gray-500 font-bold text-sm sm:text-base">
                            <a href="#" className="hover:text-purple-600 transition-colors">Privacy</a>
                            <a href="#" className="hover:text-purple-600 transition-colors">Terms</a>
                            <a href="#" className="hover:text-purple-600 transition-colors">Twitter</a>
                            <a href="#" className="hover:text-purple-600 transition-colors">LinkedIn</a>
                        </div>
                    </div>
                    <div className="mt-12 text-center text-gray-400 font-medium text-sm">
                        &copy; 2026 LakshyaTrack Intelligence. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}

// Helper for stars
const Star = (props: any) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
);
