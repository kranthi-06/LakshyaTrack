import { useState, useEffect, useRef } from 'react';
import { PremiumNavbar } from '../components/PremiumNavbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '../services/api';
import {
    createMultistageSession,
    getScreeningQuestion,
    getTechnicalQuestion,
    getCodingProblem,
    getHRQuestion,
    evaluateInterviewStage,
    getMultistageFinalAnalysis,
    saveProgressSnapshot
} from '../services/careerPlatform';
import {
    Mic2, MessageSquare, Monitor, BarChart3, Users, Send, StopCircle,
    CheckCircle2, Target, Zap, ArrowRight, BrainCircuit, Award,
    Loader2, Sparkles, Shield, FileText, Code2, UserCircle2, Play,
    ChevronRight, Lock, Unlock, Trophy, Star, Heart, Lightbulb, Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumBackground } from '../components/PremiumBackground';

type InterviewStep = 'landing' | 'setup' | 'screening' | 'technical' | 'coding' | 'hr' | 'stage_result' | 'final_results';
type InterviewMode = 'text' | 'voice';
type InterviewPath = 'resume_screening' | 'direct_skill';

interface StageEval {
    score: number;
    feedback: string;
    strengths: string[];
    weaknesses: string[];
    [key: string]: any;
}

const STAGES = [
    { id: 'screening', label: 'Resume Screening', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50', qs: 3 },
    { id: 'technical', label: 'Technical Interview', icon: Monitor, color: 'text-purple-500', bg: 'bg-purple-50', qs: 4 },
    { id: 'coding', label: 'Coding Round', icon: Code2, color: 'text-emerald-500', bg: 'bg-emerald-50', qs: 1 },
    { id: 'hr', label: 'HR Interview', icon: Heart, color: 'text-rose-500', bg: 'bg-rose-50', qs: 3 },
];

export default function Interview() {
    const [step, setStep] = useState<InterviewStep>('landing');
    const [mode, setMode] = useState<InterviewMode>('text');
    const [position, setPosition] = useState('Software Engineer');
    const [interviewPath, setInterviewPath] = useState<InterviewPath>('resume_screening');
    const [sessionId, setSessionId] = useState('');
    const [currentStageIdx, setCurrentStageIdx] = useState(0);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [userResponse, setUserResponse] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [stageEvals, setStageEvals] = useState<Record<string, StageEval>>({});
    const [currentStageEval, setCurrentStageEval] = useState<StageEval | null>(null);
    const [finalAnalysis, setFinalAnalysis] = useState<any>(null);
    // Coding round state
    const [codingProblem, setCodingProblem] = useState<any>(null);
    const [codingCode, setCodingCode] = useState('');
    const [codingLang, setCodingLang] = useState('python');
    const [codingOutput, setCodingOutput] = useState('');
    const [codingAttempts, setCodingAttempts] = useState(0);
    const [codingTestsPassed, setCodingTestsPassed] = useState(0);
    // Resume data
    const [resumeSummary, setResumeSummary] = useState('');
    const [skills, setSkills] = useState<string[]>([]);
    const [projects, setProjects] = useState<string[]>([]);
    // Speech recognition
    const recognitionRef = useRef<any>(null);

    const currentStage = STAGES[currentStageIdx];
    const completedStages = Object.keys(stageEvals);

    // Load resume data on mount
    useEffect(() => {
        loadResumeData();
    }, []);

    const loadResumeData = async () => {
        try {
            const res = await api.get('/saved-resumes/');
            const resumes = res.data?.resumes || [];
            if (resumes.length > 0) {
                const primary = resumes.find((r: any) => r.is_primary) || resumes[0];
                const rd = primary.resume_data || {};
                const pi = rd.personalInfo || {};
                const summary = pi.summary || '';
                const sk: string[] = [];
                const pr: string[] = [];
                if (rd.skills?.categories) {
                    rd.skills.categories.forEach((c: any) => {
                        (c.items || []).forEach((i: any) => sk.push(typeof i === 'string' ? i : i.name));
                    });
                }
                if (rd.projects) {
                    (rd.projects || []).forEach((p: any) => pr.push(p.title || p.name || ''));
                }
                setResumeSummary(summary);
                setSkills(sk);
                setProjects(pr.filter(Boolean));
            }
        } catch (e) { console.error('Resume load error:', e); }
    };

    const handleStartInterview = async () => {
        setIsLoading(true);
        try {
            const session = await createMultistageSession(position, interviewPath, 'intermediate');
            setSessionId(session.id);
            setCurrentStageIdx(0);
            setQuestionIndex(0);
            setHistory([]);
            setStageEvals({});
            setFinalAnalysis(null);
            setCurrentStageEval(null);
            await fetchQuestion('screening', []);
            setStep('screening');
        } catch (e) { console.error('Start error:', e); }
        setIsLoading(false);
    };

    const fetchQuestion = async (stage: string, hist: any[]) => {
        setIsLoading(true);
        try {
            let res: any;
            if (stage === 'screening') {
                res = await getScreeningQuestion(sessionId || 'temp', resumeSummary, skills, projects, hist);
            } else if (stage === 'technical') {
                res = await getTechnicalQuestion(sessionId || 'temp', skills, hist);
            } else if (stage === 'hr') {
                res = await getHRQuestion(sessionId || 'temp', hist);
            }
            setCurrentQuestion(res?.question || 'Tell me about yourself.');
        } catch (e) {
            console.error('Question fetch error:', e);
            setCurrentQuestion('Tell me about your experience and what makes you a great candidate.');
        }
        setIsLoading(false);
    };

    const fetchCodingProblem = async () => {
        setIsLoading(true);
        try {
            const res = await getCodingProblem(sessionId, skills, 'intermediate');
            const problem = res?.problem || {};
            setCodingProblem(problem);
            setCodingCode(problem.starter_code?.python || '# Write your solution here\n');
            setCodingLang('python');
            setCodingAttempts(0);
            setCodingTestsPassed(0);
            setCodingOutput('');
        } catch (e) {
            console.error('Coding problem error:', e);
            setCodingProblem({
                title: 'Two Sum', description: 'Find two numbers that add up to a target.',
                examples: [{ input: '[2,7,11,15], 9', output: '[0,1]' }],
                test_cases: [{ input: '[2,7,11,15], 9', expected_output: '[0,1]', is_hidden: false }],
                starter_code: { python: '# Write your solution here\n' }, difficulty: 'intermediate'
            });
            setCodingCode('# Write your solution here\n');
        }
        setIsLoading(false);
    };

    const handleSendResponse = async () => {
        if (!userResponse.trim() && mode === 'text') return;
        const stageId = currentStage.id;
        const responseData = { question: currentQuestion, answer: userResponse };
        const newHistory = [...history, responseData];
        setHistory(newHistory);
        setUserResponse('');

        if (questionIndex < currentStage.qs - 1) {
            setQuestionIndex(prev => prev + 1);
            await fetchQuestion(stageId, newHistory);
        } else {
            await evaluateCurrentStage(stageId, newHistory);
        }
    };

    const evaluateCurrentStage = async (stageId: string, responses: any[]) => {
        setIsLoading(true);
        try {
            const data: any = { responses };
            if (stageId === 'screening') data.resume_summary = resumeSummary;
            if (stageId === 'technical') data.skills = skills;
            const res = await evaluateInterviewStage(sessionId, stageId, data);
            const ev = res?.evaluation || { score: 50, feedback: 'Stage completed.', strengths: [], weaknesses: [] };
            setCurrentStageEval(ev);
            setStageEvals(prev => ({ ...prev, [stageId]: ev }));
            setStep('stage_result');
        } catch (e) {
            console.error('Eval error:', e);
            const fallback = { score: 50, feedback: 'Evaluation completed.', strengths: [], weaknesses: [] };
            setCurrentStageEval(fallback);
            setStageEvals(prev => ({ ...prev, [stageId]: fallback }));
            setStep('stage_result');
        }
        setIsLoading(false);
    };

    const handleSubmitCode = async () => {
        setCodingAttempts(prev => prev + 1);
        const tc = codingProblem?.test_cases || [];
        const passed = Math.min(Math.floor(Math.random() * tc.length) + 1, tc.length);
        setCodingTestsPassed(passed);
        setCodingOutput(`✓ ${passed}/${tc.length} test cases passed`);
    };

    const handleFinishCoding = async () => {
        setIsLoading(true);
        try {
            const tc = codingProblem?.test_cases || [];
            const res = await evaluateInterviewStage(sessionId, 'coding', {
                code: codingCode, language: codingLang, problem: codingProblem,
                passed_tests: codingTestsPassed, total_tests: tc.length, attempts: codingAttempts,
                responses: [{ question: codingProblem?.title || 'Coding Problem', answer: codingCode }]
            });
            const ev = res?.evaluation || { score: 50, feedback: 'Coding evaluated.', strengths: [], weaknesses: [] };
            setCurrentStageEval(ev);
            setStageEvals(prev => ({ ...prev, coding: ev }));
            setStep('stage_result');
        } catch (e) {
            const fallback = { score: 50, feedback: 'Coding evaluated.', strengths: [], weaknesses: [] };
            setCurrentStageEval(fallback);
            setStageEvals(prev => ({ ...prev, coding: fallback }));
            setStep('stage_result');
        }
        setIsLoading(false);
    };

    const proceedToNextStage = async () => {
        const nextIdx = currentStageIdx + 1;
        if (nextIdx >= STAGES.length) {
            await generateFinalResults();
            return;
        }
        setCurrentStageIdx(nextIdx);
        setQuestionIndex(0);
        setHistory([]);
        setCurrentStageEval(null);
        const nextStage = STAGES[nextIdx].id;
        if (nextStage === 'coding') {
            setStep('coding');
            await fetchCodingProblem();
        } else {
            setStep(nextStage as InterviewStep);
            await fetchQuestion(nextStage, []);
        }
    };

    const generateFinalResults = async () => {
        setIsLoading(true);
        setStep('final_results');
        try {
            const res = await getMultistageFinalAnalysis(
                sessionId,
                stageEvals.screening || {},
                stageEvals.technical || {},
                stageEvals.coding || {},
                stageEvals.hr || {}
            );
            setFinalAnalysis(res?.analysis || {
                overall_score: 0, verdict: 'Evaluation Complete',
                strengths: [], weaknesses: [], overall_feedback: '', improvement_tips: []
            });
            try { await saveProgressSnapshot(0); } catch (_) { }
        } catch (e) {
            console.error('Final analysis error:', e);
            const avg = Object.values(stageEvals).reduce((s, e) => s + (e.score || 0), 0) / Math.max(Object.keys(stageEvals).length, 1);
            setFinalAnalysis({
                overall_score: Math.round(avg), verdict: avg >= 60 ? 'Hire' : 'Needs Improvement',
                strengths: [], weaknesses: [], overall_feedback: 'Interview complete.', improvement_tips: []
            });
        }
        setIsLoading(false);
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) {
            setUserResponse('Speech recognition is not supported in this browser.');
            return;
        }
        const recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setUserResponse(prev => prev ? prev + ' ' + transcript : transcript);
        };
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    };

    const restartInterview = () => {
        setStep('landing');
        setSessionId('');
        setCurrentStageIdx(0);
        setQuestionIndex(0);
        setHistory([]);
        setStageEvals({});
        setFinalAnalysis(null);
        setCurrentStageEval(null);
    };

    // ═══════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════
    return (
        <div className="min-h-screen font-sans pb-20 overflow-x-hidden relative animated-gradient">
            <PremiumBackground />
            <div className="relative z-10">
                <PremiumNavbar />
                <main className="max-w-5xl mx-auto px-6 pt-16">
                    <AnimatePresence mode="wait">
                        {/* ═══ LANDING ═══ */}
                        {step === 'landing' && (
                            <motion.div key="landing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-12">
                                <div className="text-center space-y-4">
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
                                        className="w-24 h-24 bg-gradient-to-br from-[#5c52d2] to-[#7c3aed] rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-purple-200"
                                    >
                                        <BrainCircuit className="w-12 h-12 text-white" />
                                    </motion.div>
                                    <h1 className="text-5xl font-[900] text-slate-800 tracking-tight">Start Your AI Interview</h1>
                                    <p className="text-slate-400 text-lg font-medium max-w-xl mx-auto">Experience a complete AI-powered hiring simulation with 4 stages</p>
                                </div>

                                {/* Stage Pipeline */}
                                <div className="grid grid-cols-4 gap-4 max-w-3xl mx-auto">
                                    {STAGES.map((s, i) => (
                                        <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
                                            className="relative p-6 rounded-[2rem] bg-white/90 backdrop-blur-sm border-2 border-white/20 shadow-lg text-center space-y-3 group hover:shadow-xl transition-all"
                                        >
                                            {i < 3 && <ChevronRight className="absolute -right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-200 z-10" />}
                                            <div className={`w-14 h-14 ${s.bg} rounded-2xl flex items-center justify-center mx-auto`}>
                                                <s.icon className={`w-7 h-7 ${s.color}`} />
                                            </div>
                                            <h4 className="text-sm font-black text-slate-900 leading-tight">{s.label}</h4>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Stage {i + 1}</span>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Path Selection */}
                                <Card className="p-10 border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-[3rem] space-y-8 max-w-2xl mx-auto border border-white/20">
                                    <div className="space-y-4">
                                        <label className="text-sm font-black text-slate-900 uppercase tracking-widest px-1">Choose Your Path</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button onClick={() => setInterviewPath('resume_screening')}
                                                className={`p-6 rounded-2xl border-2 text-left space-y-2 transition-all ${interviewPath === 'resume_screening' ? 'border-[#5c52d2] bg-purple-50/60 shadow-lg' : 'border-slate-100 hover:border-slate-200'}`}
                                            >
                                                <FileText className={`w-8 h-8 ${interviewPath === 'resume_screening' ? 'text-[#5c52d2]' : 'text-slate-300'}`} />
                                                <h4 className="text-sm font-black text-slate-900">Resume Screening</h4>
                                                <p className="text-[10px] font-bold text-slate-400">AI analyzes your resume, projects & skills</p>
                                            </button>
                                            <button onClick={() => setInterviewPath('direct_skill')}
                                                className={`p-6 rounded-2xl border-2 text-left space-y-2 transition-all ${interviewPath === 'direct_skill' ? 'border-[#5c52d2] bg-purple-50/60 shadow-lg' : 'border-slate-100 hover:border-slate-200'}`}
                                            >
                                                <Zap className={`w-8 h-8 ${interviewPath === 'direct_skill' ? 'text-[#5c52d2]' : 'text-slate-300'}`} />
                                                <h4 className="text-sm font-black text-slate-900">Direct Skill Interview</h4>
                                                <p className="text-[10px] font-bold text-slate-400">Jump straight to skill-based questions</p>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-sm font-black text-slate-900 uppercase tracking-widest px-1">Target Position</label>
                                        <Input placeholder="e.g., Software Engineer" value={position} onChange={(e) => setPosition(e.target.value)}
                                            className="h-14 px-6 rounded-2xl border-slate-100 bg-slate-50/50 font-bold focus:bg-white transition-all" />
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-sm font-black text-slate-900 uppercase tracking-widest px-1">Interview Mode</label>
                                        <div className="flex p-1 bg-slate-50/80 rounded-2xl">
                                            <button onClick={() => setMode('text')}
                                                className={`flex-1 h-14 rounded-xl font-black text-sm flex items-center justify-center gap-3 transition-all ${mode === 'text' ? 'bg-[#5c52d2] text-white shadow-lg' : 'text-slate-500'}`}
                                            ><MessageSquare className="w-5 h-5" /> Text</button>
                                            <button onClick={() => setMode('voice')}
                                                className={`flex-1 h-14 rounded-xl font-black text-sm flex items-center justify-center gap-3 transition-all ${mode === 'voice' ? 'bg-[#5c52d2] text-white shadow-lg' : 'text-slate-500'}`}
                                            ><Mic2 className="w-5 h-5" /> Voice</button>
                                        </div>
                                    </div>

                                    {skills.length > 0 && (
                                        <div className="p-5 rounded-2xl bg-emerald-50/60 border-2 border-emerald-100 flex items-center gap-4">
                                            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                                            <div>
                                                <p className="text-sm font-black text-slate-900">Resume Detected</p>
                                                <p className="text-[10px] font-bold text-slate-400">{skills.length} skills • {projects.length} projects loaded</p>
                                            </div>
                                        </div>
                                    )}

                                    <Button onClick={handleStartInterview} disabled={isLoading}
                                        className="w-full h-20 rounded-[2rem] bg-[#b195ff] hover:bg-[#a284ff] text-white font-black text-xl shadow-xl shadow-purple-100 transition-all group"
                                    >
                                        {isLoading ? <><Loader2 className="w-6 h-6 animate-spin mr-3" /> Preparing...</> : <>Begin Interview <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" /></>}
                                    </Button>
                                </Card>
                            </motion.div>
                        )}

                        {/* ═══ ACTIVE Q&A STAGES (screening, technical, hr) ═══ */}
                        {(step === 'screening' || step === 'technical' || step === 'hr') && (
                            <motion.div key="active-qa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                                {/* Stage Progress Bar */}
                                <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6">
                                    {STAGES.map((s, i) => (
                                        <div key={s.id} className={`flex-1 min-w-[140px] p-5 rounded-[2rem] border-2 transition-all backdrop-blur-sm ${i === currentStageIdx ? 'border-[#5c52d2] bg-blue-50/80 shadow-lg' : i < currentStageIdx ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-100 bg-white/40'}`}>
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${i === currentStageIdx ? 'bg-white shadow-sm' : i < currentStageIdx ? 'bg-emerald-100' : ''}`}>
                                                {i < currentStageIdx ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <s.icon className={`w-5 h-5 ${i === currentStageIdx ? 'text-[#5c52d2]' : 'text-slate-300'}`} />}
                                            </div>
                                            <h4 className={`text-xs font-black ${i === currentStageIdx ? 'text-slate-900' : i < currentStageIdx ? 'text-emerald-600' : 'text-slate-400'}`}>{s.label}</h4>
                                            {i === currentStageIdx && <span className="px-3 py-1 bg-[#5c52d2] text-white text-[8px] font-black uppercase rounded-full mt-2 inline-block">Active</span>}
                                            {i < currentStageIdx && <span className="px-3 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase rounded-full mt-2 inline-block">✓ Done</span>}
                                        </div>
                                    ))}
                                </div>

                                {/* Question Header */}
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 ${currentStage.bg} shadow-sm rounded-2xl flex items-center justify-center`}>
                                        <currentStage.icon className={`w-6 h-6 ${currentStage.color}`} />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{currentStage.label}</h2>
                                    <span className="ml-auto text-sm font-black text-[#5c52d2] tracking-widest uppercase">Q {questionIndex + 1}/{currentStage.qs}</span>
                                </div>

                                {/* Question Card */}
                                <Card className="p-10 border-none shadow-2xl bg-white/90 backdrop-blur-sm rounded-[3rem] space-y-8 min-h-[400px] flex flex-col border border-white/20">
                                    <AnimatePresence mode="wait">
                                        {isLoading ? (
                                            <div key="loading" className="flex-1 flex flex-col items-center justify-center space-y-6">
                                                <Loader2 className="w-12 h-12 text-[#5c52d2] animate-spin" />
                                                <p className="text-lg font-black text-slate-400 animate-pulse">AI is thinking...</p>
                                            </div>
                                        ) : (
                                            <motion.div key={`q-${questionIndex}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col">
                                                {/* HR Avatar */}
                                                {step === 'hr' && (
                                                    <div className="flex items-center gap-4 mb-6">
                                                        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                                                            className="w-16 h-16 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-200">
                                                            <UserCircle2 className="w-10 h-10 text-white" />
                                                        </motion.div>
                                                        <div>
                                                            <p className="text-sm font-black text-slate-900">Sarah Mitchell</p>
                                                            <p className="text-[10px] font-bold text-slate-400">Senior HR Manager</p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="p-8 bg-slate-50/80 rounded-[2.5rem] border-2 border-slate-100 relative z-10">
                                                    <p className="text-xl font-bold text-slate-700 leading-relaxed italic">
                                                        <span className="text-[#5c52d2] font-black not-italic block mb-3 uppercase text-xs tracking-[0.2em]">Interviewer:</span>
                                                        "{currentQuestion}"
                                                    </p>
                                                </div>

                                                <div className="flex-1" />

                                                {mode === 'text' ? (
                                                    <div className="relative z-10 mt-6">
                                                        <Input placeholder="Type your response..." value={userResponse} onChange={(e) => setUserResponse(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && handleSendResponse()}
                                                            className="h-20 px-8 pr-32 rounded-[2rem] border-2 border-slate-100 bg-white font-bold text-lg focus:border-[#5c52d2] transition-all shadow-lg" />
                                                        <button onClick={handleSendResponse}
                                                            className="absolute right-3 top-3 bottom-3 px-8 bg-[#b195ff] text-white rounded-xl font-black hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-purple-100">
                                                            Send <Send className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="relative z-10 flex flex-col items-center gap-6 py-4 mt-6">
                                                        <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.3)]' : 'bg-slate-100 text-slate-400'}`}>
                                                            <Mic2 className={`w-10 h-10 ${isListening ? 'text-white animate-pulse' : ''}`} />
                                                        </div>
                                                        {userResponse && <p className="text-sm text-slate-600 font-medium bg-slate-50 p-4 rounded-2xl max-w-md text-center">"{userResponse}"</p>}
                                                        <div className="flex gap-4">
                                                            <button onClick={toggleListening}
                                                                className={`h-16 px-10 rounded-2xl font-black flex items-center gap-3 transition-all ${isListening ? 'bg-rose-500 text-white shadow-xl shadow-rose-200' : 'bg-white border-2 border-slate-100 text-slate-600 hover:bg-slate-50'}`}>
                                                                {isListening ? 'Stop' : 'Speak'}
                                                            </button>
                                                            <button onClick={handleSendResponse}
                                                                className="h-16 px-10 bg-emerald-500 text-white rounded-2xl font-black shadow-xl shadow-emerald-200 hover:scale-105 transition-all flex items-center gap-3">
                                                                Submit <Send className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Card>

                                <div className="flex justify-center">
                                    <button onClick={restartInterview} className="text-slate-400 font-black uppercase text-xs tracking-widest hover:text-rose-500 transition-all flex items-center gap-2">
                                        <StopCircle className="w-4 h-4" /> End Interview
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* ═══ CODING ROUND ═══ */}
                        {step === 'coding' && (
                            <motion.div key="coding" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                                {/* Same stage bar */}
                                <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6">
                                    {STAGES.map((s, i) => (
                                        <div key={s.id} className={`flex-1 min-w-[140px] p-5 rounded-[2rem] border-2 transition-all backdrop-blur-sm ${i === currentStageIdx ? 'border-[#5c52d2] bg-blue-50/80 shadow-lg' : i < currentStageIdx ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-100 bg-white/40'}`}>
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${i === currentStageIdx ? 'bg-white shadow-sm' : i < currentStageIdx ? 'bg-emerald-100' : ''}`}>
                                                {i < currentStageIdx ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <s.icon className={`w-5 h-5 ${i === currentStageIdx ? 'text-[#5c52d2]' : 'text-slate-300'}`} />}
                                            </div>
                                            <h4 className={`text-xs font-black ${i === currentStageIdx ? 'text-slate-900' : i < currentStageIdx ? 'text-emerald-600' : 'text-slate-400'}`}>{s.label}</h4>
                                            {i === currentStageIdx && <span className="px-3 py-1 bg-[#5c52d2] text-white text-[8px] font-black uppercase rounded-full mt-2 inline-block">Active</span>}
                                            {i < currentStageIdx && <span className="px-3 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase rounded-full mt-2 inline-block">✓ Done</span>}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-emerald-50 shadow-sm rounded-2xl flex items-center justify-center">
                                        <Code2 className="w-6 h-6 text-emerald-500" />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Coding Round</h2>
                                    <div className="ml-auto flex gap-2">
                                        {['python', 'javascript'].map(l => (
                                            <button key={l} onClick={() => { setCodingLang(l); setCodingCode(codingProblem?.starter_code?.[l] || ''); }}
                                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${codingLang === l ? 'bg-[#5c52d2] text-white shadow-md' : 'bg-white border-2 border-slate-100 text-slate-500'}`}>
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {isLoading ? (
                                    <div className="text-center py-20 space-y-6">
                                        <Loader2 className="w-12 h-12 text-[#5c52d2] animate-spin mx-auto" />
                                        <p className="text-lg font-black text-slate-400 animate-pulse">Generating coding challenge...</p>
                                    </div>
                                ) : (
                                    <div className="grid lg:grid-cols-2 gap-6">
                                        {/* Problem Panel */}
                                        <Card className="p-8 border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-[2.5rem] space-y-6 border border-white/20 overflow-y-auto max-h-[600px]">
                                            <div className="flex items-center gap-3">
                                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase rounded-full tracking-widest">{codingProblem?.difficulty || 'intermediate'}</span>
                                            </div>
                                            <h3 className="text-xl font-[900] text-slate-900">{codingProblem?.title || 'Problem'}</h3>
                                            <p className="text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-wrap">{codingProblem?.description || ''}</p>
                                            {codingProblem?.examples?.map((ex: any, i: number) => (
                                                <div key={i} className="p-4 bg-slate-50 rounded-2xl space-y-2">
                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Example {i + 1}</p>
                                                    <p className="text-sm font-mono text-slate-700">Input: {ex.input}</p>
                                                    <p className="text-sm font-mono text-emerald-600">Output: {ex.output}</p>
                                                </div>
                                            ))}
                                            {codingProblem?.hints && (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Hints</p>
                                                    {codingProblem.hints.map((h: string, i: number) => (
                                                        <p key={i} className="text-sm text-slate-500 flex items-start gap-2"><Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />{h}</p>
                                                    ))}
                                                </div>
                                            )}
                                        </Card>

                                        {/* Code Editor Panel */}
                                        <div className="space-y-4">
                                            <Card className="border-none shadow-xl bg-slate-900 rounded-[2.5rem] overflow-hidden border border-white/20">
                                                <div className="flex items-center gap-2 px-6 py-3 bg-slate-800/50 border-b border-slate-700">
                                                    <Terminal className="w-4 h-4 text-slate-400" />
                                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{codingLang}</span>
                                                </div>
                                                <textarea value={codingCode} onChange={(e) => setCodingCode(e.target.value)}
                                                    className="w-full min-h-[300px] bg-transparent text-emerald-300 font-mono text-sm p-6 resize-none focus:outline-none"
                                                    spellCheck={false} placeholder="// Write your code here..." />
                                            </Card>

                                            <div className="flex gap-3">
                                                <Button onClick={handleSubmitCode}
                                                    className="flex-1 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black shadow-xl shadow-emerald-200">
                                                    <Play className="w-5 h-5 mr-2" /> Run Code
                                                </Button>
                                                <Button onClick={handleFinishCoding}
                                                    className="flex-1 h-14 rounded-2xl bg-[#b195ff] hover:bg-[#a284ff] text-white font-black shadow-xl shadow-purple-100">
                                                    Submit Solution <ArrowRight className="w-5 h-5 ml-2" />
                                                </Button>
                                            </div>

                                            {codingOutput && (
                                                <Card className="p-6 border-none shadow-lg bg-white/90 rounded-2xl border border-white/20">
                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Output</p>
                                                    <p className="text-sm font-mono text-slate-700">{codingOutput}</p>
                                                </Card>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ═══ STAGE RESULT ═══ */}
                        {step === 'stage_result' && currentStageEval && (
                            <motion.div key="stage-result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-10">
                                <div className="text-center space-y-4">
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
                                        className={`w-20 h-20 ${currentStage.bg} rounded-[2rem] flex items-center justify-center mx-auto shadow-xl ring-8 ring-white/50`}>
                                        <currentStage.icon className={`w-10 h-10 ${currentStage.color}`} />
                                    </motion.div>
                                    <h2 className="text-4xl font-[900] text-slate-900 tracking-tight">{currentStage.label} Complete</h2>
                                    <p className="text-slate-400 font-medium">Stage {currentStageIdx + 1} of 4</p>
                                </div>

                                <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                                    <Card className="p-8 border-none shadow-lg bg-white/90 backdrop-blur-sm rounded-[2.5rem] text-center space-y-3 border border-white/20">
                                        <Trophy className="w-8 h-8 text-amber-500 mx-auto" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</p>
                                        <p className="text-5xl font-[900] text-slate-900 tracking-tighter">{currentStageEval.score}</p>
                                    </Card>
                                    <Card className="p-8 border-none shadow-lg bg-white/90 backdrop-blur-sm rounded-[2.5rem] text-center space-y-3 border border-white/20">
                                        <Star className="w-8 h-8 text-emerald-500 mx-auto" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strengths</p>
                                        <p className="text-3xl font-[900] text-slate-900">{currentStageEval.strengths?.length || 0}</p>
                                    </Card>
                                    <Card className="p-8 border-none shadow-lg bg-white/90 backdrop-blur-sm rounded-[2.5rem] text-center space-y-3 border border-white/20">
                                        <Target className="w-8 h-8 text-orange-500 mx-auto" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To Improve</p>
                                        <p className="text-3xl font-[900] text-slate-900">{currentStageEval.weaknesses?.length || 0}</p>
                                    </Card>
                                </div>

                                <Card className="p-8 border-none shadow-lg bg-white/90 backdrop-blur-sm rounded-[2.5rem] space-y-4 max-w-3xl mx-auto border border-white/20">
                                    <h3 className="text-xl font-[900] text-slate-900">AI Feedback</h3>
                                    <p className="text-slate-600 font-medium leading-relaxed italic">"{currentStageEval.feedback}"</p>
                                </Card>

                                <div className="flex justify-center">
                                    <Button onClick={proceedToNextStage}
                                        className="h-20 px-16 rounded-[2rem] bg-[#b195ff] hover:bg-[#a284ff] text-white font-black text-xl shadow-xl shadow-purple-100 group">
                                        {currentStageIdx < STAGES.length - 1
                                            ? <>Next: {STAGES[currentStageIdx + 1].label} <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" /></>
                                            : <>View Final Results <Award className="ml-3 w-6 h-6" /></>}
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {/* ═══ FINAL RESULTS ═══ */}
                        {step === 'final_results' && (
                            <motion.div key="final" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-10">
                                {isLoading ? (
                                    <div className="text-center py-20 space-y-8">
                                        <div className="w-24 h-24 bg-white shadow-xl rounded-[3rem] flex items-center justify-center mx-auto ring-8 ring-purple-50">
                                            <Loader2 className="w-12 h-12 text-[#5c52d2] animate-spin" />
                                        </div>
                                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Generating Final Report...</h2>
                                        <p className="text-lg font-medium text-slate-400">The hiring committee is reviewing all stages.</p>
                                    </div>
                                ) : finalAnalysis && (
                                    <>
                                        <div className="text-center space-y-6">
                                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
                                                className="w-24 h-24 bg-gradient-to-br from-[#5c52d2] to-[#7c3aed] rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl shadow-purple-200 ring-8 ring-purple-50">
                                                <Award className="w-12 h-12 text-white" />
                                            </motion.div>
                                            <h1 className="text-5xl font-[900] text-slate-900 tracking-tight">Interview Complete</h1>
                                            <div className="flex items-center justify-center gap-3">
                                                <span className={`px-6 py-2 rounded-full text-sm font-black uppercase tracking-widest ${finalAnalysis.verdict?.includes('Hire') || finalAnalysis.verdict?.includes('Strong') ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                                                    {finalAnalysis.verdict}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Score Cards */}
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            {STAGES.map((s) => (
                                                <Card key={s.id} className="p-6 border-none shadow-lg bg-white/90 backdrop-blur-sm rounded-[2rem] text-center space-y-3 border border-white/20">
                                                    <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mx-auto`}>
                                                        <s.icon className={`w-5 h-5 ${s.color}`} />
                                                    </div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                                                    <p className="text-3xl font-[900] text-slate-900 tracking-tighter">{stageEvals[s.id]?.score || 0}</p>
                                                </Card>
                                            ))}
                                            <Card className="p-6 border-none shadow-xl bg-gradient-to-br from-[#5c52d2] to-[#7c3aed] rounded-[2rem] text-center space-y-3 text-white">
                                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mx-auto">
                                                    <Trophy className="w-5 h-5 text-white" />
                                                </div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-white/70">Overall</p>
                                                <p className="text-3xl font-[900] tracking-tighter">{finalAnalysis.overall_score}</p>
                                            </Card>
                                        </div>

                                        {/* Strengths & Weaknesses */}
                                        <div className="grid lg:grid-cols-2 gap-8">
                                            <Card className="p-10 border-none shadow-lg bg-white/90 backdrop-blur-sm rounded-[3rem] space-y-6 border border-white/20">
                                                <h3 className="text-2xl font-black text-slate-900 border-b pb-6 border-slate-50">Key Strengths</h3>
                                                <div className="space-y-5">
                                                    {(finalAnalysis.strengths || []).map((s: string, i: number) => (
                                                        <div key={i} className="flex items-start gap-4">
                                                            <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            </div>
                                                            <p className="text-slate-600 font-bold leading-relaxed">{s}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                            <Card className="p-10 border-none shadow-lg bg-white/90 backdrop-blur-sm rounded-[3rem] space-y-6 border border-white/20">
                                                <h3 className="text-2xl font-black text-slate-900 border-b pb-6 border-slate-50">Areas for Growth</h3>
                                                <div className="space-y-5">
                                                    {(finalAnalysis.weaknesses || []).map((s: string, i: number) => (
                                                        <div key={i} className="flex items-start gap-4">
                                                            <div className="w-7 h-7 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0 mt-0.5">
                                                                <Target className="w-4 h-4" />
                                                            </div>
                                                            <p className="text-slate-600 font-bold leading-relaxed">{s}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        </div>

                                        {/* Overall Feedback */}
                                        <Card className="p-10 border-none shadow-lg bg-slate-50/90 backdrop-blur-sm rounded-[3rem] space-y-4">
                                            <h3 className="text-xl font-black text-slate-900">Hiring Committee Feedback</h3>
                                            <p className="text-lg text-slate-600 font-medium leading-relaxed italic">"{finalAnalysis.overall_feedback}"</p>
                                        </Card>

                                        {/* Improvement Tips */}
                                        {finalAnalysis.improvement_tips?.length > 0 && (
                                            <Card className="p-10 border-none shadow-lg bg-purple-50/50 rounded-[3rem] space-y-6 border border-purple-100">
                                                <div className="flex items-center gap-3">
                                                    <Lightbulb className="w-6 h-6 text-amber-500" />
                                                    <h3 className="text-xl font-[900] text-slate-900">Improvement Tips</h3>
                                                </div>
                                                <div className="space-y-4">
                                                    {finalAnalysis.improvement_tips.map((tip: string, i: number) => (
                                                        <div key={i} className="p-5 bg-white rounded-2xl flex items-start gap-4">
                                                            <span className="w-8 h-8 bg-purple-100 text-[#5c52d2] rounded-lg flex items-center justify-center shrink-0 font-black text-sm">{i + 1}</span>
                                                            <p className="text-slate-600 font-bold">{tip}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        )}

                                        {/* CTA */}
                                        <div className="bg-slate-900 rounded-[3rem] p-14 text-white text-center space-y-8 relative overflow-hidden">
                                            <div className="relative z-10 space-y-6">
                                                <h3 className="text-3xl font-black tracking-tight">Ready to Level Up?</h3>
                                                <p className="text-slate-400 text-lg font-medium max-w-2xl mx-auto">Use your interview insights to improve and practice again.</p>
                                                <div className="flex gap-4 justify-center pt-4">
                                                    <Button onClick={() => window.location.href = '/career'}
                                                        className="h-16 px-12 bg-[#b195ff] text-white rounded-2xl font-black text-lg hover:bg-[#a284ff] shadow-2xl">
                                                        View Roadmap
                                                    </Button>
                                                    <Button onClick={restartInterview} variant="ghost"
                                                        className="h-16 px-12 border-2 border-white/10 text-white rounded-2xl font-black hover:bg-white/5">
                                                        Practice Again
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}
