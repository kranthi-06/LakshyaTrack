import { useState, useEffect } from 'react';
import AuthLoadingScreen from '../components/AuthLoadingScreen';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    LineChart,
    TrendingUp,
    Award,
    Target,
    Rocket,
    PieChart,
    BrainCircuit,
    History,
    Flame,
    Zap,
    History as HistoryIcon,
    Calendar,
    ChevronRight,
    Search,
    Monitor,
    BarChart3,
    Users2,
    ArrowUpRight,
    Mic2,
    Loader2,
    Shield,
    Sparkles,
    RefreshCw,
    Clock,
    Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
    getCurrentProgress,
    getProgressHistory,
    saveProgressSnapshot,
    deleteProgressSnapshot,
    getQuizHistory,
    getAdvancedInterviewHistory,
    getMultistageHistory,
    getDailyStreak
} from '../services/careerPlatform';

export default function Progress() {
    const [quizHistory, setQuizHistory] = useState<any[]>([]);
    const [interviewHistory, setInterviewHistory] = useState<any[]>([]);
    const [progressData, setProgressData] = useState<any>(null);
    const [snapshots, setSnapshots] = useState<any[]>([]);
    const [streak, setStreak] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [deletingSnapshotId, setDeletingSnapshotId] = useState<string | null>(null);

    // Popup state
    const [selectedQuiz, setSelectedQuiz] = useState<any>(null);

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setIsLoading(true);
        await Promise.allSettled([
            loadProgress(),
            loadSnapshots(),
            loadStreak(),
            loadQuizHistory(),
            loadInterviewHistory()
        ]);
        setIsLoading(false);
    };

    const loadProgress = async () => {
        try {
            const res = await getCurrentProgress(0);
            setProgressData(res);
        } catch (e) {
            console.error('Failed to load progress:', e);
        }
    };

    const loadSnapshots = async () => {
        try {
            const res = await getProgressHistory(60);
            setSnapshots(res?.snapshots || []);
        } catch {
            setSnapshots([]);
        }
    };

    const loadStreak = async () => {
        try {
            const res = await getDailyStreak();
            setStreak(res);
        } catch {
            setStreak(null);
        }
    };

    const handleDeleteSnapshot = async (snapshotId: string) => {
        setDeletingSnapshotId(snapshotId);
        try {
            await deleteProgressSnapshot(snapshotId);
            await loadSnapshots();
            await loadProgress();
        } catch (e) {
            console.error('Failed to delete snapshot:', e);
        } finally {
            setDeletingSnapshotId(null);
        }
    };

    const loadQuizHistory = async () => {
        try {
            const res = await getQuizHistory();
            if (res.attempts && res.attempts.length > 0) {
                const mapped = res.attempts.map((a: any) => ({
                    date: new Date(a.attempted_at).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    }),
                    topic: a.skill_name,
                    diff: a.level || 'Easy',
                    score: `${a.score}%`,
                    result: a.passed ? 'Passed ✓' : 'Review',
                    raw: a
                }));
                setQuizHistory(mapped);
            } else {
                setQuizHistory([]);
            }
        } catch (e) {
            setQuizHistory([]);
        }
    };

    const loadInterviewHistory = async () => {
        try {
            // Load both legacy and multi-stage interviews
            const [advancedRes, multistageRes] = await Promise.allSettled([
                getAdvancedInterviewHistory(),
                getMultistageHistory()
            ]);

            const items: any[] = [];

            // Legacy advanced interviews
            if (advancedRes.status === 'fulfilled' && advancedRes.value?.sessions?.length > 0) {
                advancedRes.value.sessions.forEach((s: any) => {
                    items.push({
                        role: s.position || 'Interview',
                        date: new Date(s.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        overall: `${s.overall_score || 0}%`,
                        type: 'legacy',
                        rounds: [{ type: (s.round_type || 'TECHNICAL').toUpperCase(), time: s.duration || 'N/A', score: `${s.overall_score || 0}%`, icon: Monitor }],
                        raw: s
                    });
                });
            }

            // Multi-stage interviews
            if (multistageRes.status === 'fulfilled' && multistageRes.value?.sessions?.length > 0) {
                multistageRes.value.sessions.forEach((s: any) => {
                    items.push({
                        role: s.position || 'Interview',
                        date: s.created_at ? new Date(s.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A',
                        overall: `${s.overall_score || 0}%`,
                        type: 'multistage',
                        verdict: s.verdict,
                        rounds: [
                            { type: 'SCREENING', score: `${s.screening_score || 0}%`, icon: Monitor },
                            { type: 'TECHNICAL', score: `${s.technical_score || 0}%`, icon: Monitor },
                            { type: 'CODING', score: `${s.coding_score || 0}%`, icon: Monitor },
                            { type: 'HR', score: `${s.hr_score || 0}%`, icon: Monitor },
                        ],
                        raw: s
                    });
                });
            }

            setInterviewHistory(items);
        } catch (e) {
            setInterviewHistory([]);
        }
    };

    const handleRefreshProgress = async () => {
        setIsRefreshing(true);
        try {
            await saveProgressSnapshot(0);
            await loadAllData();
        } catch (e) {
            console.error('Failed to refresh:', e);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Computed stats EXACTLY matching REAL dynamics
    const quizAvgScore = progressData?.quiz_avg_score ?? 0;
    const quizTaken = progressData?.total_quizzes ?? quizHistory.length;
    const quizPassed = progressData?.quizzes_passed ?? 0;
    const interviewAvgScore = progressData?.interview_avg_score ?? 0;
    const interviewsPassed = progressData?.interviews_passed ?? 0;
    const interviewsTaken = interviewHistory.length;
    const readinessScore = progressData?.career_readiness_score ?? null;
    const skillCompletion = progressData?.skill_completion_pct ?? 0;

    const overallProgressRate = progressData?.skill_completion_pct !== undefined ? `${Math.round(progressData.skill_completion_pct)}%` : "Not available";

    // Compute total time roughly based on 5 mins per quiz, 15 mins per interview
    const computeTotalMinutes = () => {
        const total = (quizTaken * 5) + (interviewsTaken * 15);
        if (total === 0) return "Not available";
        const h = Math.floor(total / 60);
        const m = total % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };
    const totalTimeSpent = computeTotalMinutes();

    const activityRate = (quizTaken + interviewsTaken) > 0 ? `${quizTaken + interviewsTaken} actions recently` : "Not available";

    const hasNoActivity = quizTaken === 0 && interviewsTaken === 0 && readinessScore === null && !progressData?.resume_ats_score;

    if (isLoading) {
        return <AuthLoadingScreen />;
    }

    return (
        <div className="min-h-screen font-sans pb-20 overflow-x-hidden relative bg-slate-50 dark:bg-[#050510]">
<main className="max-w-[1200px] mx-auto px-3 sm:px-6 pt-8 sm:pt-16 space-y-8 sm:space-y-16">
                    {/* Header Container */}
                    <div className="text-center space-y-4">
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-[900] text-slate-900 tracking-tight">Your Learning Progress</h1>
                        <p className="text-slate-400 text-lg font-medium">Track your growth and achievements across all activities</p>
                        <Button
                            onClick={handleRefreshProgress}
                            variant="outline"
                            disabled={isRefreshing}
                            className="h-10 px-6 rounded-xl border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest"
                        >
                            {isRefreshing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                            Refresh Stats
                        </Button>
                    </div>

                    {hasNoActivity ? (
                        <div className="text-center py-24 px-6 bg-white/50 backdrop-blur shadow-xl rounded-[3rem] border border-white/40 max-w-2xl mx-auto mt-20 border-b-white">
                            <div className="w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner shadow-slate-200/50">
                                <Rocket className="w-10 h-10 text-slate-400" />
                            </div>
                            <h2 className="text-3xl font-[900] text-slate-900 tracking-tight">No activity yet.</h2>
                            <p className="text-slate-500 mt-4 text-lg font-medium leading-relaxed max-w-md mx-auto">
                                Start learning, take a skills quiz, or practice an interview to see your detailed progress unlocked here.
                            </p>
                            <Button onClick={() => window.location.href = '/quiz'} className="mt-10 h-14 px-10 bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] text-white font-black rounded-2xl shadow-xl shadow-purple-200 hover:scale-105 transition-transform">
                                Take a Knowledge Quiz
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Career Readiness Score (NEW) */}
                            {readinessScore !== null && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                                    <Card className="p-10 border-none shadow-2xl bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] rounded-[3rem] text-white relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                                            <div className="w-32 h-32 bg-white/10 rounded-[2.5rem] flex items-center justify-center shrink-0 backdrop-blur-sm border border-white/20">
                                                <div className="text-center">
                                                    <p className="text-5xl font-[900] tracking-tighter">{Math.round(readinessScore)}%</p>
                                                </div>
                                            </div>
                                            <div className="space-y-3 flex-1 text-center md:text-left">
                                                <div className="flex items-center gap-2 justify-center md:justify-start">
                                                    <Sparkles className="w-5 h-5" />
                                                    <h3 className="text-2xl font-[900] tracking-tight">Career Readiness Score</h3>
                                                </div>
                                                <p className="text-white/70 text-sm font-medium leading-relaxed">
                                                    AI-calculated based on your resume quality, skill completion ({Math.round(skillCompletion)}%), quiz performance, and interview results.
                                                </p>
                                                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden max-w-md">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${readinessScore}%` }}
                                                        transition={{ duration: 1, delay: 0.3 }}
                                                        className="h-full bg-white/40 rounded-full"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </motion.div>
                            )}

                            {/* Main Metrics (Top Row) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8 mb-8">
                                <Card className="p-10 border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-[3rem] relative overflow-hidden group border border-white/20">
                                    <div className="absolute top-0 right-0 p-8">
                                        <TrendingUp className="w-12 h-12 text-[#5c52d2]/10 rotate-12 transition-transform group-hover:rotate-0" />
                                    </div>
                                    <div className="space-y-6">
                                        <div className="w-12 h-12 bg-[#5c52d2]/10 text-[#5c52d2] rounded-2xl flex items-center justify-center">
                                            <TrendingUp className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-3">Overall Progress</p>
                                            <p className="text-4xl font-[900] text-slate-900 tracking-tighter">{overallProgressRate}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-2">Calculated from Real Activities</p>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="p-10 border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-[3rem] relative overflow-hidden group border border-white/20">
                                    <div className="absolute top-0 right-0 p-8">
                                        <Clock className="w-12 h-12 text-emerald-500/10 rotate-12 transition-transform group-hover:rotate-0" />
                                    </div>
                                    <div className="space-y-6">
                                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                                            <Clock className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-3">Total Time Spent</p>
                                            <p className="text-4xl font-[900] text-slate-900 tracking-tighter">{totalTimeSpent}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-2">Estimated Activity Time</p>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="p-10 border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-[3rem] relative overflow-hidden group border border-white/20">
                                    <div className="absolute top-0 right-0 p-8">
                                        <Activity className="w-12 h-12 text-purple-500/10 rotate-12 transition-transform group-hover:rotate-0" />
                                    </div>
                                    <div className="space-y-6">
                                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                                            <Activity className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-3">Activity Rate</p>
                                            <p className="text-4xl font-[900] text-slate-900 tracking-tighter">{activityRate}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-2">Frequency of Actions</p>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* Secondary Stats Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8 mb-8">
                                <Card className="p-10 border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-[3rem] relative overflow-hidden group border border-white/20">
                                    <div className="absolute top-0 right-0 p-8">
                                        <Flame className="w-12 h-12 text-orange-500/10 rotate-12 transition-transform group-hover:rotate-0" />
                                    </div>
                                    <div className="space-y-6">
                                        <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
                                            <Flame className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-3">Daily Streak</p>
                                            <p className="text-4xl font-[900] text-slate-900 tracking-tighter">{streak?.current_streak ?? 0}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-2">Longest: {streak?.longest_streak ?? 0} days</p>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400">
                                            Last active: {streak?.last_active_date ? new Date(streak.last_active_date).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                </Card>

                                <Card className="p-10 border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-[3rem] relative overflow-hidden group border border-white/20">
                                    <div className="absolute top-0 right-0 p-8">
                                        <BrainCircuit className="w-12 h-12 text-blue-500/10 rotate-12 transition-transform group-hover:rotate-0" />
                                    </div>
                                    <div className="space-y-6">
                                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                                            <Target className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-3">Quiz Performance</p>
                                            <p className="text-4xl font-[900] text-slate-900 tracking-tighter">{quizAvgScore}%</p>
                                            <p className="text-xs font-bold text-slate-400 mt-2">Average Score</p>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${quizAvgScore}%` }} className="h-full bg-blue-500 rounded-full" />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400">{quizPassed} out of {quizTaken} quizzes passed</p>
                                    </div>
                                </Card>

                                <Card className="p-10 border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-[3rem] relative overflow-hidden group border border-white/20">
                                    <div className="absolute top-0 right-0 p-8">
                                        <Flame className="w-12 h-12 text-orange-500/10 rotate-12 transition-transform group-hover:rotate-0" />
                                    </div>
                                    <div className="space-y-6">
                                        <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
                                            <HistoryIcon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-3">Quizzes Taken</p>
                                            <p className="text-4xl font-[900] text-slate-900 tracking-tighter">{quizTaken}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-2">Current Count</p>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(quizTaken * 10, 100)}%` }} className="h-full bg-orange-500 rounded-full" />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400">Total attempts across all topics</p>
                                    </div>
                                </Card>

                                <Card className="p-10 border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-[3rem] relative overflow-hidden group border border-white/20">
                                    <div className="absolute top-0 right-0 p-8">
                                        <Mic2 className="w-12 h-12 text-rose-500/10 rotate-12 transition-transform group-hover:rotate-0" />
                                    </div>
                                    <div className="space-y-6">
                                        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                                            <Zap className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-3">Interview Score</p>
                                            <p className="text-4xl font-[900] text-slate-900 tracking-tighter">{interviewAvgScore}%</p>
                                            <p className="text-xs font-bold text-slate-400 mt-2">Average Score</p>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${interviewAvgScore}%` }} className="h-full bg-rose-500 rounded-full" />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400">{interviewsPassed} out of {interviewsTaken} interviews passed</p>
                                    </div>
                                </Card>
                            </div>

                            {/* Quiz History Section */}
                            <div className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                        <BarChart3 className="w-5 h-5 text-slate-900" />
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-[900] text-slate-900 tracking-tight">Quiz History</h2>
                                </div>

                                <Card className="border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-[2.5rem] overflow-hidden border border-white/20">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-[#5c52d2] text-white">
                                                    <th className="px-8 py-6 text-left text-xs font-black uppercase tracking-widest">Date</th>
                                                    <th className="px-8 py-6 text-left text-xs font-black uppercase tracking-widest">Topic</th>
                                                    <th className="px-8 py-6 text-left text-xs font-black uppercase tracking-widest">Difficulty</th>
                                                    <th className="px-8 py-6 text-left text-xs font-black uppercase tracking-widest">Score</th>
                                                    <th className="px-8 py-6 text-left text-xs font-black uppercase tracking-widest">Result</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {quizHistory.map((q, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                                        <td className="px-8 py-6">
                                                            <div className="flex items-center gap-3">
                                                                <Calendar className="w-4 h-4 text-slate-300" />
                                                                <span className="text-sm font-bold text-slate-500">{q.date}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <span className="text-sm font-black text-slate-900">{q.topic}</span>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${q.diff === 'Hard' ? 'bg-rose-50 text-rose-500'
                                                                : q.diff === 'Medium' ? 'bg-orange-50 text-orange-500'
                                                                    : 'bg-blue-50 text-blue-500'
                                                                }`}>
                                                                {q.diff}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <span className="text-sm font-black text-slate-900">{q.score}</span>
                                                        </td>
                                                        <td className="px-8 py-6 flex items-center gap-3">
                                                            {q.result.includes('Passed') ? (
                                                                <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-black uppercase tracking-widest whitespace-nowrap">
                                                                    ✓ Passed
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 text-rose-600 text-xs font-black uppercase tracking-widest whitespace-nowrap">
                                                                    ✕ Failed
                                                                </span>
                                                            )}
                                                            <button
                                                                onClick={() => setSelectedQuiz(q)}
                                                                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-100 text-slate-400 text-xs font-black uppercase tracking-widest hover:border-[#5c52d2] hover:bg-[#5c52d2]/5 hover:text-[#5c52d2] transition-all whitespace-nowrap"
                                                            >
                                                                Review <Search className="w-3 h-3" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </div>

                            {/* Progress Snapshots (deletable) */}
                            <div className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                        <History className="w-5 h-5 text-slate-900" />
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-[900] text-slate-900 tracking-tight">Progress Snapshots</h2>
                                </div>

                                <Card className="border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-[2.5rem] overflow-hidden border border-white/20">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-slate-900 text-white">
                                                    <th className="px-8 py-6 text-left text-xs font-black uppercase tracking-widest">Date</th>
                                                    <th className="px-8 py-6 text-left text-xs font-black uppercase tracking-widest">Readiness</th>
                                                    <th className="px-8 py-6 text-left text-xs font-black uppercase tracking-widest">Quiz Avg</th>
                                                    <th className="px-8 py-6 text-left text-xs font-black uppercase tracking-widest">Interview Avg</th>
                                                    <th className="px-8 py-6 text-left text-xs font-black uppercase tracking-widest">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {snapshots.map((s: any) => (
                                                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-8 py-6">
                                                            <span className="text-sm font-bold text-slate-500">{s.snapshot_date ? new Date(s.snapshot_date).toLocaleString() : 'N/A'}</span>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <span className="text-sm font-black text-slate-900">{Math.round(s.career_readiness_score || 0)}%</span>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <span className="text-sm font-black text-slate-900">{Math.round(s.quiz_avg_score || 0)}%</span>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <span className="text-sm font-black text-slate-900">{Math.round(s.interview_avg_score || 0)}%</span>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <Button
                                                                variant="outline"
                                                                disabled={deletingSnapshotId === s.id}
                                                                onClick={() => handleDeleteSnapshot(s.id)}
                                                                className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                                            >
                                                                {deletingSnapshotId === s.id ? (
                                                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                                                ) : null}
                                                                Delete
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {snapshots.length === 0 && (
                                                    <tr>
                                                        <td className="px-8 py-10 text-center text-sm font-bold text-slate-400" colSpan={5}>
                                                            No snapshots yet. Click “Refresh Stats” to save one.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </div>

                            {/* Interview Practice History */}
                            <div className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center">
                                        <Mic2 className="w-5 h-5" />
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-[900] text-slate-900 tracking-tight">Interview Practice History</h2>
                                </div>

                                <div className="space-y-6">
                                    {interviewHistory.map((item, i) => (
                                        <Card key={i} className="p-8 border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-[2.5rem] space-y-6 group hover:shadow-xl hover:shadow-rose-100/30 transition-all border border-white/20">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <h3 className="text-2xl font-[900] text-slate-900 tracking-tight group-hover:text-rose-500 transition-colors">{item.role}</h3>
                                                    <p className="text-xs font-bold text-slate-400">{item.date}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-3xl font-[900] text-rose-500 tracking-tighter">{item.overall}</p>
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">0/1 rounds passed</p>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                {item.rounds.map((r: any, idx: number) => (
                                                    <div key={idx} className="p-5 rounded-2xl bg-white border-2 border-rose-100/50 flex items-center gap-6 relative overflow-hidden group/round">
                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500" />
                                                        <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center">
                                                            <Monitor className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none mb-1">{r.type}</h4>
                                                            <p className="text-xs font-bold text-slate-400">{r.time}</p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-lg font-black text-rose-500">{r.score}</span>
                                                            <div className="w-8 h-8 rounded-full border-2 border-slate-100 flex items-center justify-center text-slate-300 group-hover/round:border-rose-200 group-hover/round:text-rose-500 transition-all">
                                                                ✕
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>

                            {/* Footer Insight */}
                            <Card className="p-10 border-none shadow-2xl shadow-blue-100/50 bg-white/90 backdrop-blur-sm rounded-[3rem] flex flex-col md:flex-row items-center gap-10 border border-white/20">
                                <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-[2.5rem] flex items-center justify-center shrink-0">
                                    <Rocket className="w-12 h-12" />
                                </div>
                                <div className="space-y-4 flex-1 text-center md:text-left">
                                    <h3 className="text-2xl sm:text-3xl font-[900] text-slate-900 tracking-tight">Growth Insight Available</h3>
                                    <p className="text-slate-500 text-lg font-medium leading-relaxed">
                                        Based on your recent quiz and interview performance, we've identified key patterns in your learning curve. Check out your personalized improvement strategy.
                                    </p>
                                </div>
                                <Button
                                    onClick={() => window.location.href = '/career'}
                                    className="h-16 px-10 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-black shadow-xl shrink-0 group"
                                >
                                    View Roadmap <ArrowUpRight className="ml-2 w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                </Button>
                            </Card>
                        </>
                    )}
                </main>

                {/* Quiz Review Modal */}
                {selectedQuiz && (
                    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
                        <Card className="max-w-3xl w-full max-h-[85vh] overflow-y-auto bg-white rounded-[2.5rem] p-10 space-y-8 shadow-2xl border-none">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-3xl font-[900] text-slate-900 tracking-tight">Quiz Review</h2>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedQuiz.topic} • {selectedQuiz.score} Correct</p>
                                </div>
                                <Button variant="ghost" className="rounded-full w-12 h-12 bg-slate-50 hover:bg-slate-100" onClick={() => setSelectedQuiz(null)}>✕</Button>
                            </div>
                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                {selectedQuiz.raw?.questions_data ? selectedQuiz.raw.questions_data.map((q: any, i: number) => (
                                    <div key={i} className={`p-6 rounded-2xl border-2 ${q.selected === q.correct ? 'border-emerald-100 bg-emerald-50/50' : 'border-rose-100 bg-rose-50/50'}`}>
                                        <p className="font-[900] text-slate-900 mb-4 text-lg">{i + 1}. {q.question_text}</p>
                                        <p className={`text-sm font-bold ${q.selected === q.correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                                            Your Answer: Option {q.selected + 1}
                                        </p>
                                        {q.selected !== q.correct && (
                                            <p className="text-sm font-bold text-emerald-600 mt-2 bg-emerald-100/50 inline-block px-3 py-1.5 rounded-lg border border-emerald-200">
                                                Correct Answer: Option {q.correct + 1}
                                            </p>
                                        )}
                                    </div>
                                )) : (
                                    <div className="text-center py-10 bg-slate-50 rounded-2xl">
                                        <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-500 font-bold">Detailed question data is unavailable for this older attempt.</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                )}
        </div>
    );
}
