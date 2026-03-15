import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { motion } from 'framer-motion';
import {
    FileText,
    Target,
    Zap,
    Trophy,
    TrendingUp,
    Calendar,
    ChevronRight,
    Play,
    CheckCircle2,
    Clock,
    User as UserIcon,
    Briefcase,
    Mic2,
    BookOpen,
    BrainCircuit,
    ArrowUpRight,
    Plus,
    Sparkles,
    BarChart3,
    Rocket,
    Lock,
    Crown,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getActiveRoadmap } from '../services/careerPlatform';

export default function Dashboard() {
    const { user } = useAuth();
    const { stage, hasFeature, isAdmin } = useSubscription();
    const navigate = useNavigate();
    const [roadmapProgress, setRoadmapProgress] = useState(0);
    const [roadmapRole, setRoadmapRole] = useState('Career Plan');
    const [nextSkill, setNextSkill] = useState('Planning required');
    const [hasRoadmap, setHasRoadmap] = useState(false);

    useEffect(() => {
        const fetchRoadmap = async () => {
            try {
                const res = await getActiveRoadmap();
                if (res?.roadmap) {
                    setHasRoadmap(true);
                    setRoadmapRole(res.roadmap.target_role || 'Career Plan');

                    if (res.roadmap.roadmap_data && res.roadmap.roadmap_data.levels) {
                        let totalSkills = 0;
                        let completedSkills = 0;
                        let foundNext = false;

                        res.roadmap.roadmap_data.levels.forEach((level: any) => {
                            if (level.skills) {
                                level.skills.forEach((skill: any) => {
                                    totalSkills++;
                                    if (skill.status === 'completed') {
                                        completedSkills++;
                                    } else if (!foundNext && skill.status === 'unlocked') {
                                        setNextSkill(skill.name);
                                        foundNext = true;
                                    }
                                });
                            }
                        });

                        if (totalSkills > 0) {
                            setRoadmapProgress(Math.round((completedSkills / totalSkills) * 100));
                        }

                        if (!foundNext && completedSkills > 0) {
                            setNextSkill('All skills completed!');
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching roadmap:', error);
            }
        };
        fetchRoadmap();
    }, []);

    const displayName = (user?.profile?.full_name || user?.full_name || user?.email?.split('@')[0] || 'User');
    const firstName = displayName.split(' ')[0];

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const stats = [
        { label: 'Skills Assessed', value: '12', change: '+3 this week', icon: Zap, color: 'from-blue-500 to-cyan-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
        { label: 'Achievements', value: '8', change: 'New badge earned!', icon: Trophy, color: 'from-emerald-500 to-teal-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
        { label: 'Profile Score', value: '85%', change: '+5% this month', icon: TrendingUp, color: 'from-amber-500 to-orange-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
        { label: 'Streak Days', value: '15', change: 'Keep it up!', icon: Calendar, color: 'from-violet-500 to-purple-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
    ];

    const quickActions = [
        { title: 'Resume Studio', desc: 'Build & optimize your resume with AI', icon: FileText, path: '/resume-builder', accent: '#6C63FF', featureKey: 'resume_builder' },
        { title: 'Skill Check', desc: 'Assess your skills vs job requirements', icon: Target, path: '/evaluate', accent: '#10B981', featureKey: null },
        { title: 'Learning Path', desc: 'Get AI-powered training roadmap', icon: BookOpen, path: '/career', accent: '#F59E0B', featureKey: 'roadmap_generate' },
        { title: 'Practice Quiz', desc: 'Test knowledge with adaptive quizzes', icon: BrainCircuit, path: '/quiz', accent: '#8B5CF6', featureKey: null },
        { title: 'Mock Interview', desc: 'AI-powered interview simulator', icon: Mic2, path: '/interview', accent: '#EF4444', featureKey: 'interview_start' },
        { title: 'Opportunities', desc: 'Jobs, internships & certifications', icon: Briefcase, path: '/jobs', accent: '#0EA5E9', featureKey: 'job_portal' },
    ];

    const fadeIn = (i: number) => ({
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: i * 0.06, duration: 0.4 },
    });

    return (
        <div className="min-h-screen px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            <div className="max-w-[1360px] mx-auto space-y-6 sm:space-y-8">

                {/* ═══════════════════════════════════════ */}
                {/* Welcome Header                          */}
                {/* ═══════════════════════════════════════ */}
                <motion.div {...fadeIn(0)} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                            {getGreeting()}, {firstName} 👋
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
                            Here's an overview of your career journey
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/resume-builder')}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6C63FF] hover:bg-[#5B54E0] text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20"
                        >
                            <Plus className="w-4 h-4" />
                            New Resume
                        </button>
                    </div>
                </motion.div>

                {/* ═══════════════════════════════════════ */}
                {/* Subscription Banner (Free users)         */}
                {/* ═══════════════════════════════════════ */}
                {!isAdmin && stage === 0 && (
                    <motion.div
                        {...fadeIn(0.5)}
                        onClick={() => navigate('/plans')}
                        className="bg-gradient-to-r from-[#6C63FF]/5 via-[#8B83FF]/5 to-[#4F46E5]/5 rounded-2xl border border-[#6C63FF]/20 p-5 cursor-pointer hover:border-[#6C63FF]/40 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
                                <Crown className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C63FF] transition-colors">
                                    Unlock Premium Features
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                    Upgrade to access resume downloads, roadmaps, interviews, and more
                                </p>
                            </div>
                            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#4F46E5] text-white text-xs font-bold shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                                View Plans
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ═══════════════════════════════════════ */}
                {/* Stats Row                               */}
                {/* ═══════════════════════════════════════ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {stats.map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            {...fadeIn(i + 1)}
                            className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-3.5 sm:p-5 hover:shadow-lg hover:shadow-slate-200/40 dark:hover:shadow-slate-900/40 transition-all group"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                                    <stat.icon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-[#6C63FF] transition-colors" />
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{stat.value}</p>
                            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</p>
                            <p className="text-[11px] font-medium text-emerald-500 dark:text-emerald-400 mt-1">{stat.change}</p>
                        </motion.div>
                    ))}
                </div>

                {/* ═══════════════════════════════════════ */}
                {/* Roadmap Progress Card                    */}
                {/* ═══════════════════════════════════════ */}
                <motion.div
                    {...fadeIn(5)}
                    onClick={() => navigate('/career')}
                    className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-6 cursor-pointer hover:shadow-lg hover:shadow-slate-200/40 dark:hover:shadow-slate-900/40 transition-all group"
                >
                    <div className="flex flex-col md:flex-row md:items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6C63FF] to-[#4F46E5] flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
                            <Rocket className="w-7 h-7 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-[#6C63FF] transition-colors">
                                    {hasRoadmap ? `Roadmap: ${roadmapRole}` : 'Start Your Career Roadmap'}
                                </h3>
                                <span className="text-sm font-bold text-[#6C63FF] flex-shrink-0 ml-4">{roadmapProgress}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                <motion.div
                                    className="bg-gradient-to-r from-[#6C63FF] to-[#8B83FF] h-full rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${roadmapProgress}%` }}
                                    transition={{ duration: 1.2, ease: 'easeOut' }}
                                />
                            </div>
                            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-2">
                                {hasRoadmap ? (
                                    <>Up Next: <span className="text-slate-700 dark:text-slate-300">{nextSkill}</span></>
                                ) : (
                                    <>Get started: <span className="text-slate-700 dark:text-slate-300">Generate your career path</span></>
                                )}
                            </p>
                        </div>

                        <div className="hidden md:flex w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 items-center justify-center group-hover:bg-[#6C63FF] group-hover:text-white transition-all flex-shrink-0">
                            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white" />
                        </div>
                    </div>
                </motion.div>

                {/* ═══════════════════════════════════════ */}
                {/* Quick Actions Grid                      */}
                {/* ═══════════════════════════════════════ */}
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-[#6C63FF]" />
                        Quick Actions
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {quickActions.map((action, i) => (
                            <motion.div
                                key={action.title}
                                {...fadeIn(i + 6)}
                                onClick={() => navigate(action.path)}
                                className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5 cursor-pointer
                                    hover:shadow-lg hover:shadow-slate-200/40 dark:hover:shadow-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
                            >
                                <div className="flex items-start gap-4">
                                    <div
                                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                                        style={{ backgroundColor: `${action.accent}15` }}
                                    >
                                        <action.icon className="w-5 h-5" style={{ color: action.accent }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6C63FF] transition-colors">
                                                {action.title}
                                            </h4>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {action.featureKey && !hasFeature(action.featureKey) && (
                                                    <Lock className="w-3.5 h-3.5 text-amber-500/70" />
                                                )}
                                                <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-[#6C63FF] transition-colors" />
                                            </div>
                                        </div>
                                        <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">{action.desc}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* ═══════════════════════════════════════ */}
                {/* AI Recommendations                      */}
                {/* ═══════════════════════════════════════ */}
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-emerald-500" />
                        Recommended for You
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                        {[
                            { t: 'Complete Your Profile', d: 'Add work experience for better job matches', p: 75, path: '/profile', accent: '#6C63FF' },
                            { t: 'Take Skill Assessment', d: 'Evaluate your JavaScript skills', p: 0, path: '/evaluate', accent: '#10B981' },
                            { t: 'Practice Interview', d: 'Prepare for your next interview with AI', p: 25, path: '/interview', accent: '#8B5CF6' },
                        ].map((rec, i) => (
                            <motion.div
                                key={rec.t}
                                {...fadeIn(i + 12)}
                                onClick={() => navigate(rec.path)}
                                className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/60 p-5 cursor-pointer
                                    hover:shadow-lg hover:shadow-slate-200/40 dark:hover:shadow-slate-900/40 transition-all group"
                            >
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{rec.t}</h4>
                                <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium mb-3">{rec.d}</p>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden mb-2">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${rec.p}%`, backgroundColor: rec.accent }}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-slate-400">{rec.p}% complete</span>
                                    <span className="text-[11px] font-semibold text-[#6C63FF] group-hover:underline">Continue →</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
