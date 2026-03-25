import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    generateSkillQuiz,
    submitSkillQuiz,
    saveProgressSnapshot,
    recordExamViolation,
    checkExamEligibility,
    checkExamCooldown,
} from '../services/careerPlatform';
import { generateQuizQuestions } from '../services/quiz';
import { trackQuizCompleted } from '../progress-system/services/eventTracker';
import {
    BrainCircuit,
    Timer,
    Trophy,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Target,
    Zap,
    BookOpen,
    HelpCircle,
    ArrowRight,
    Loader2,
    Shield,
    Sparkles,
    AlertTriangle,
    Lock,
    XCircle,
    Clock,
    ShieldAlert,
    ShieldCheck,
    Eye,
    Monitor,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExamMode } from '../hooks/useExamMode';

type QuizStep = 'setup' | 'active' | 'results';

const questionsByTopic: Record<string, any[]> = {
    'JavaScript': [
        { id: 1, question: "What is undefined in JavaScript?", options: ["Syntax error", "Variable declared but not assigned", "Keyword", "Type of null"], correct: 1 },
        { id: 2, question: "What is the result of '2' + 2?", options: ["4", "'22'", "NaN", "undefined"], correct: 1 },
        { id: 3, question: "Which keyword declares a constant?", options: ["var", "let", "constant", "const"], correct: 3 },
        { id: 4, question: "Is JavaScript single-threaded?", options: ["Yes", "No", "Depends", "Only in Node.js"], correct: 0 },
        { id: 5, question: "What does 'typeof null' return?", options: ["null", "undefined", "object", "number"], correct: 2 }
    ],
    'Python': [
        { id: 1, question: "How do you start a comment in Python?", options: ["//", "/*", "#", "--"], correct: 2 },
        { id: 2, question: "Which data type is immutable?", options: ["List", "Dictionary", "Set", "Tuple"], correct: 3 },
        { id: 3, question: "What is the correct extension for Python files?", options: [".py", ".pt", ".pyt", ".pyn"], correct: 0 },
        { id: 4, question: "How do you create a function in Python?", options: ["function myFn():", "def myFn():", "create myFn():", "fn myFn():"], correct: 1 },
        { id: 5, question: "Which function gets the length of a list?", options: ["length()", "size()", "len()", "count()"], correct: 2 }
    ],
    'Java': [
        { id: 1, question: "Which keyword is used to inherit a class?", options: ["implements", "extends", "inherits", "using"], correct: 1 },
        { id: 2, question: "What is the default value of a boolean in Java?", options: ["true", "false", "null", "0"], correct: 1 },
        { id: 3, question: "Which company originally developed Java?", options: ["Microsoft", "Google", "Sun Microsystems", "Oracle"], correct: 2 },
        { id: 4, question: "Which method is the entry point for Java apps?", options: ["start()", "run()", "main()", "init()"], correct: 2 },
        { id: 5, question: "What type of variable can hold the value '3.14'?", options: ["int", "double", "char", "boolean"], correct: 1 }
    ],
    'HTML': [
        { id: 1, question: "What does HTML stand for?", options: ["Hyperlinks and Text Markup Language", "Hyper Text Markup Language", "Home Tool Markup Language", "Hyper Tool Markup Language"], correct: 1 },
        { id: 2, question: "Who is making the Web standards?", options: ["Mozilla", "Google", "Microsoft", "The World Wide Web Consortium"], correct: 3 },
        { id: 3, question: "Choose the correct HTML element for the largest heading:", options: ["<heading>", "<h6>", "<h1>", "<head>"], correct: 2 },
        { id: 4, question: "What is the correct HTML element for inserting a line break?", options: ["<lb>", "<br>", "<break>", "<nextline>"], correct: 1 },
        { id: 5, question: "Which attribute is used to provide an alternative text for an image?", options: ["title", "src", "alt", "longdesc"], correct: 2 }
    ],
    'CSS': [
        { id: 1, question: "What does CSS stand for?", options: ["Creative Style Sheets", "Colorful Style Sheets", "Cascading Style Sheets", "Computer Style Sheets"], correct: 2 },
        { id: 2, question: "Where in an HTML document is the correct place to refer to an external style sheet?", options: ["In the <body> section", "In the <head> section", "At the end of the document", "Anywhere is fine"], correct: 1 },
        { id: 3, question: "Which HTML tag is used to define an internal style sheet?", options: ["<css>", "<script>", "<style>", "<design>"], correct: 2 },
        { id: 4, question: "Which CSS property is used to change the background color?", options: ["color", "bg-color", "background-color", "bgcolor"], correct: 2 },
        { id: 5, question: "How do you select an element with id 'demo'?", options: ["demo", ".demo", "*demo", "#demo"], correct: 3 }
    ],
    'C++': [
        { id: 1, question: "Which header file allows us to work with input and output objects?", options: ["<iostream>", "<stdio.h>", "<input>", "<conio.h>"], correct: 0 },
        { id: 2, question: "What is the correct way to output 'Hello World' in C++?", options: ["print('Hello World');", "cout << 'Hello World';", "System.out.println('Hello World');", "Console.Write('Hello World');"], correct: 1 },
        { id: 3, question: "How do you create a variable with the numeric value 5?", options: ["x = 5;", "double x = 5;", "int x = 5;", "num x = 5;"], correct: 2 },
        { id: 4, question: "Which operator is used to multiply two values?", options: ["X", "*", "#", "MOD"], correct: 1 },
        { id: 5, question: "Which keyword is used to create a class in C++?", options: ["class", "struct", "object", "type"], correct: 0 }
    ],
    'C': [
        { id: 1, question: "Which character is used to end a statement in C?", options: ["{", "(", ";", ":"], correct: 2 },
        { id: 2, question: "What is the correct way to output 'Hello World' in C?", options: ["printf('Hello World');", "scanf('Hello World');", "cout << 'Hello World';", "print('Hello World');"], correct: 0 },
        { id: 3, question: "Which data type is used to create a variable that should store text?", options: ["string", "char", "txt", "text"], correct: 1 },
        { id: 4, question: "How do you start a multi-line comment?", options: ["//", "#", "/*", "<!--"], correct: 2 },
        { id: 5, question: "Which library is needed for printf()?", options: ["math.h", "conio.h", "string.h", "stdio.h"], correct: 3 }
    ]
};

const languages = [
    { name: 'JavaScript', color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { name: 'Python', color: 'text-blue-500', bg: 'bg-blue-50' },
    { name: 'Java', color: 'text-red-500', bg: 'bg-red-50' },
    { name: 'HTML', color: 'text-orange-500', bg: 'bg-orange-50' },
    { name: 'CSS', color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { name: 'C++', color: 'text-cyan-500', bg: 'bg-cyan-50' },
    { name: 'C', color: 'text-slate-500', bg: 'bg-slate-50' }
];

// ── Exam Instructions Rules ──
const EXAM_RULES = [
    { icon: Monitor, text: 'The exam must be taken in FULLSCREEN MODE.' },
    { icon: Eye, text: 'Do NOT switch tabs or minimize the browser.' },
    { icon: Lock, text: 'Copy, paste, and text selection are disabled.' },
    { icon: AlertTriangle, text: 'Do NOT refresh the page during the exam.' },
    { icon: XCircle, text: 'Exiting fullscreen or switching tabs may terminate the exam.' },
    { icon: ShieldAlert, text: 'Violations may lock exams temporarily.' },
];

export default function Quiz() {
    const [step, setStep] = useState<QuizStep>('setup');
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
    const [topic, setTopic] = useState('JavaScript');
    const [difficulty, setDifficulty] = useState('Medium');
    const [numQuestions, setNumQuestions] = useState('5');
    const [quizQuestions, setQuizQuestions] = useState<any[]>(questionsByTopic['JavaScript']);
    const [isLoading, setIsLoading] = useState(false);

    // ── Roadmap-linked quiz state ──────────
    const [isRoadmapQuiz, setIsRoadmapQuiz] = useState(false);
    const [roadmapSkillId, setRoadmapSkillId] = useState<string | null>(null);
    const [roadmapSkillName, setRoadmapSkillName] = useState<string | null>(null);
    const [roadmapLevel, setRoadmapLevel] = useState<string | null>(null);
    const [roadmapId, setRoadmapId] = useState<string | null>(null);
    const [passThreshold, setPassThreshold] = useState<number>(70);
    const [quizResult, setQuizResult] = useState<any>(null);

    // ── Exam proctoring state ──────────
    const [showExamInstructions, setShowExamInstructions] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [lockMessage, setLockMessage] = useState('');
    const [lockRemainingSeconds, setLockRemainingSeconds] = useState(0);
    const [isInCooldown, setIsInCooldown] = useState(false);
    const [cooldownMessage, setCooldownMessage] = useState('');
    const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);
    const [checkingEligibility, setCheckingEligibility] = useState(true);
    const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Exam mode hook ──────────
    const handleExamTerminate = useCallback(async (reason: string) => {
        // Record the violation on the server
        try {
            await recordExamViolation('terminated', topic, difficulty);
        } catch (e) {
            console.error('Failed to record violation:', e);
        }
    }, [topic, difficulty]);

    const examMode = useExamMode(handleExamTerminate);

    // Check URL params for roadmap-linked quiz on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const skillId = params.get('skill_id');
        const skillName = params.get('skill_name');
        const level = params.get('level');
        const rmId = params.get('roadmap_id');

        if (skillId && skillName && level) {
            setIsRoadmapQuiz(true);
            setRoadmapSkillId(skillId);
            setRoadmapSkillName(skillName);
            setRoadmapLevel(level);
            setRoadmapId(rmId);
            setTopic(skillName);

            const diffMap: Record<string, string> = {
                'Beginner': 'Easy',
                'Intermediate': 'Medium',
                'Advanced': 'Hard'
            };
            setDifficulty(diffMap[level] || 'Medium');
        }
    }, []);

    // ── Check eligibility + cooldown on mount ──
    useEffect(() => {
        checkEligibility();
    }, []);

    const checkEligibility = async () => {
        setCheckingEligibility(true);
        try {
            const eligibility = await checkExamEligibility();
            if (!eligibility.eligible) {
                setIsLocked(true);
                setLockMessage(eligibility.reason || 'Quizzes are currently locked.');
                setLockRemainingSeconds(eligibility.remaining_seconds || 0);
                startLockCountdown(eligibility.remaining_seconds || 0);
            } else {
                setIsLocked(false);
            }
        } catch (e) {
            // If not logged in or error, allow quiz (fallback)
            setIsLocked(false);
        }
        setCheckingEligibility(false);
    };

    const checkCooldown = async () => {
        const skillId = roadmapSkillId || `standalone_${topic.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        try {
            const cooldown = await checkExamCooldown(skillId);
            if (cooldown.in_cooldown) {
                setIsInCooldown(true);
                setCooldownMessage(`You need more preparation before retrying this exam. Cooldown: ${cooldown.cooldown_minutes} minutes.`);
                setCooldownRemainingSeconds(cooldown.remaining_seconds || 0);
                startCooldownCountdown(cooldown.remaining_seconds || 0);
                return true;
            }
        } catch (e) { /* ignore */ }
        setIsInCooldown(false);
        return false;
    };

    const startLockCountdown = (seconds: number) => {
        if (lockTimerRef.current) clearInterval(lockTimerRef.current);
        setLockRemainingSeconds(seconds);
        lockTimerRef.current = setInterval(() => {
            setLockRemainingSeconds(prev => {
                if (prev <= 1) {
                    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
                    setIsLocked(false);
                    setLockMessage('');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const startCooldownCountdown = (seconds: number) => {
        if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
        setCooldownRemainingSeconds(seconds);
        cooldownTimerRef.current = setInterval(() => {
            setCooldownRemainingSeconds(prev => {
                if (prev <= 1) {
                    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
                    setIsInCooldown(false);
                    setCooldownMessage('');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    // Cleanup timers
    useEffect(() => {
        return () => {
            if (lockTimerRef.current) clearInterval(lockTimerRef.current);
            if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
        };
    }, []);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    // ── Show exam instructions popup (called when user clicks Start) ──
    const handleStartClick = async () => {
        if (isLocked || isInCooldown) return;

        // Check cooldown for this specific skill
        const inCooldown = await checkCooldown();
        if (inCooldown) return;

        // Show exam instructions popup
        setShowExamInstructions(true);
    };

    // ── User agrees to exam rules → activate exam mode + start quiz ──
    const handleAgreeAndStart = async () => {
        setShowExamInstructions(false);
        await examMode.activateExamMode();
        await handleStartQuiz();
    };

    const handleStartQuiz = async () => {
        setIsLoading(true);
        try {
            if (isRoadmapQuiz && roadmapSkillName && roadmapLevel) {
                const count = parseInt(numQuestions);
                const res = await generateSkillQuiz(
                    roadmapSkillName,
                    roadmapLevel,
                    count
                );

                if (res.questions && res.questions.length > 0) {
                    setQuizQuestions(res.questions);
                    setPassThreshold(res.threshold || 70);
                } else {
                    setQuizQuestions(questionsByTopic[topic] || questionsByTopic['JavaScript']);
                }
            } else {
                const count = parseInt(numQuestions);
                const data = await generateQuizQuestions({
                    topic,
                    difficulty,
                    count
                });

                if (data && data.length > 0) {
                    setQuizQuestions(data);
                } else {
                    console.warn("API returned empty questions, using fallback.");
                    setQuizQuestions(questionsByTopic[topic] || questionsByTopic['JavaScript']);
                }
            }

            setStep('active');
            setCurrentQuestion(0);
            setSelectedAnswers({});
            setQuizResult(null);
        } catch (error) {
            console.error("Failed to generate quiz:", error);
            setQuizQuestions(questionsByTopic[topic] || questionsByTopic['JavaScript']);
            setStep('active');
            setCurrentQuestion(0);
            setSelectedAnswers({});
        } finally {
            setIsLoading(false);
        }
    };

    const handleOptionSelect = (optionIndex: number) => {
        setSelectedAnswers({
            ...selectedAnswers,
            [currentQuestion]: optionIndex
        });
    };

    const buildQuizAnswers = () => {
        return Object.entries(selectedAnswers).map(([idx, selected]) => ({
            question_id: parseInt(idx),
            selected,
            correct: quizQuestions[parseInt(idx)].correct,
            question_text: quizQuestions[parseInt(idx)].question
        }));
    };

    const trackCompletedQuiz = (quizName: string, result: any, answers: ReturnType<typeof buildQuizAnswers>) => {
        const totalQuestions = typeof result?.total === 'number' ? result.total : answers.length;
        const score = typeof result?.score === 'number'
            ? result.score
            : totalQuestions > 0
                ? Math.round((answers.filter(answer => answer.selected === answer.correct).length / totalQuestions) * 100)
                : 0;

        trackQuizCompleted(quizName, score, totalQuestions);
    };

    const handleNext = async () => {
        if (currentQuestion < quizQuestions.length - 1) {
            setCurrentQuestion(prev => prev + 1);
        } else {
            // Quiz finished — deactivate exam mode
            examMode.deactivateExamMode();
            setStep('results');

            if (isRoadmapQuiz && roadmapSkillId && roadmapSkillName && roadmapLevel) {
                try {
                    const answers = buildQuizAnswers();

                    const result = await submitSkillQuiz(
                        roadmapId,
                        roadmapSkillId,
                        roadmapSkillName,
                        roadmapLevel,
                        answers
                    );
                    setQuizResult(result);
                    trackCompletedQuiz(roadmapSkillName, result, answers);

                    try { await saveProgressSnapshot(0); } catch (_) { }
                } catch (e) {
                    console.error("Failed to submit roadmap quiz:", e);
                }
            } else {
                try {
                    const answers = buildQuizAnswers();

                    const result = await submitSkillQuiz(
                        null,
                        `standalone_${topic.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                        topic,
                        difficulty,
                        answers
                    );
                    setQuizResult(result);
                    trackCompletedQuiz(topic, result, answers);

                    try { await saveProgressSnapshot(0); } catch (_) { }
                } catch (e) {
                    console.error("Failed to submit standalone quiz:", e);
                }
            }
        }
    };

    const handlePrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(prev => prev - 1);
        }
    };

    const handleRetryAfterTermination = () => {
        setStep('setup');
        setShowExamInstructions(true); // Rule reminder before retry
    };

    const handleBackToLearningPath = () => {
        window.location.href = isRoadmapQuiz ? '/career' : '/dashboard';
    };

    const score = Object.entries(selectedAnswers).reduce((acc, [idx, ans]) => {
        return acc + (ans === quizQuestions[parseInt(idx)].correct ? 1 : 0);
    }, 0);

    const scorePercent = Math.round((score / quizQuestions.length) * 100);

    // ── Render ──
    return (
        <div className="min-h-screen font-sans pb-20 overflow-x-hidden relative bg-slate-50 dark:bg-[#050510]">


                            <main className={`max-w-4xl mx-auto px-3 sm:px-6 ${examMode.isExamActive ? 'pt-8' : 'pt-8 sm:pt-16'}`}>
                    <AnimatePresence mode="wait">
                        {step === 'setup' && (
                            <motion.div
                                key="setup"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-12"
                            >
                                <div className="text-center space-y-6">
                                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                                        <div className="flex flex-wrap w-10 h-10 gap-1 translate-y-1">
                                            <div className="w-4 h-4 bg-green-400 rounded-sm" />
                                            <div className="w-4 h-4 bg-rose-400 rounded-sm" />
                                            <div className="w-4 h-4 bg-blue-400 rounded-sm" />
                                            <div className="w-4 h-4 bg-purple-400 rounded-sm" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h1 className="text-3xl sm:text-4xl font-[900] text-slate-900 tracking-tight">
                                            {isRoadmapQuiz ? `Skill Assessment: ${roadmapSkillName}` : 'Test Your Knowledge'}
                                        </h1>
                                        <p className="text-slate-400 text-lg font-medium max-w-lg mx-auto leading-relaxed">
                                            {isRoadmapQuiz
                                                ? `Pass this ${roadmapLevel} level quiz to unlock the next skill in your roadmap.`
                                                : 'Choose a language and prove your expertise with our high-fidelity skill assessments.'
                                            }
                                        </p>
                                    </div>
                                    {isRoadmapQuiz && (
                                        <div className="flex items-center justify-center gap-2">
                                            <Shield className="w-4 h-4 text-[#5c52d2]" />
                                            <span className="text-xs font-black text-[#5c52d2] uppercase tracking-widest">
                                                Pass threshold: {passThreshold}%
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* ── Lockout Banner ── */}
                                {isLocked && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="max-w-2xl mx-auto p-6 rounded-[2rem] bg-red-50 border-2 border-red-200 space-y-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Lock className="w-6 h-6 text-red-500" />
                                            <span className="font-black text-red-700">Quizzes Locked</span>
                                        </div>
                                        <p className="text-sm font-bold text-red-600">{lockMessage}</p>
                                        {lockRemainingSeconds > 0 && (
                                            <div className="flex items-center gap-2 text-sm font-black text-red-500">
                                                <Clock className="w-4 h-4" />
                                                Unlocks in: {formatTime(lockRemainingSeconds)}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* ── Cooldown Banner ── */}
                                {isInCooldown && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="max-w-2xl mx-auto p-6 rounded-[2rem] bg-amber-50 border-2 border-amber-200 space-y-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Clock className="w-6 h-6 text-amber-500" />
                                            <span className="font-black text-amber-700">Cooldown Active</span>
                                        </div>
                                        <p className="text-sm font-bold text-amber-600">{cooldownMessage}</p>
                                        {cooldownRemainingSeconds > 0 && (
                                            <div className="flex items-center gap-2 text-sm font-black text-amber-500">
                                                <Timer className="w-4 h-4" />
                                                Available in: {formatTime(cooldownRemainingSeconds)}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                <Card className="p-10 border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-[2.5rem] space-y-10 max-w-2xl mx-auto border border-white/20">
                                    {/* Topic selection: show only for standard quizzes */}
                                    {!isRoadmapQuiz && (
                                        <div className="space-y-8">
                                            {/* Smart Search Bar */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3 text-slate-400 text-xs font-black uppercase tracking-widest">
                                                    <Target className="w-4 h-4 text-purple-500" />
                                                    Any Topic, Skill, or subject
                                                </div>
                                                <div className="relative group">
                                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#5c52d2] transition-colors">
                                                        <BrainCircuit className="w-5 h-5" />
                                                    </div>
                                                    <Input
                                                        value={topic}
                                                        onChange={(e) => setTopic(e.target.value)}
                                                        placeholder="Type anything (e.g. 'React Hooks', 'Data Structures', 'AWS Basics')"
                                                        className="pl-14 h-16 rounded-2xl border-2 border-slate-100 bg-white/50 backdrop-blur shadow-sm font-bold text-slate-900 focus-visible:ring-0 focus-visible:border-[#5c52d2] text-lg transition-all"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && topic.trim()) {
                                                                handleStartClick();
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3 text-slate-400 text-xs font-black uppercase tracking-widest pt-4 border-t border-slate-100">
                                                    <BookOpen className="w-4 h-4 text-blue-500" />
                                                    Or Select Popular Languages
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    {languages.map((lang) => (
                                                        <button
                                                            key={lang.name}
                                                            onClick={() => setTopic(lang.name)}
                                                            className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${topic === lang.name
                                                                ? `border-transparent shadow-xl ring-2 ring-slate-900 ${lang.bg} ${lang.color}`
                                                                : 'border-slate-50 bg-slate-50/50 text-slate-400 hover:bg-white hover:border-slate-200'
                                                                }`}
                                                        >
                                                            <BrainCircuit className="w-6 h-6" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">{lang.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* If roadmap quiz, show skill info card */}
                                    {isRoadmapQuiz && (
                                        <div className="p-6 rounded-2xl bg-purple-50/60 border-2 border-purple-100 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <Sparkles className="w-5 h-5 text-[#5c52d2]" />
                                                <span className="font-black text-slate-900">Roadmap Skill Quiz</span>
                                            </div>
                                            <p className="text-sm font-bold text-slate-500">
                                                Skill: <span className="text-[#5c52d2]">{roadmapSkillName}</span> •
                                                Level: <span className="text-[#5c52d2]">{roadmapLevel}</span> •
                                                Threshold: <span className="text-[#5c52d2]">{passThreshold}%</span>
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid sm:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 text-slate-400 text-xs font-black uppercase tracking-widest">
                                                <Zap className="w-4 h-4 text-orange-500" />
                                                Difficulty
                                            </div>
                                            <div className="flex gap-2">
                                                {['Easy', 'Medium', 'Hard'].map((lvl) => (
                                                    <button
                                                        key={lvl}
                                                        onClick={() => !isRoadmapQuiz && setDifficulty(lvl)}
                                                        className={`flex-1 h-12 rounded-xl border text-[10px] font-black tracking-widest uppercase transition-all ${difficulty === lvl
                                                            ? 'bg-[#5c52d2] text-white border-transparent shadow-lg'
                                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                                                            } ${isRoadmapQuiz ? 'cursor-default' : ''}`}
                                                    >
                                                        {lvl}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 text-slate-400 text-xs font-black uppercase tracking-widest">
                                                <HelpCircle className="w-4 h-4 text-purple-500" />
                                                Questions
                                            </div>
                                            <select
                                                value={numQuestions}
                                                onChange={(e) => setNumQuestions(e.target.value)}
                                                className="w-full h-12 px-6 rounded-xl border border-slate-100 bg-slate-50/50 font-black text-xs uppercase tracking-widest focus:bg-white transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="5">5 Questions</option>
                                                <option value="10">10 Questions</option>
                                                <option value="15">15 Questions</option>
                                                <option value="20">20 Questions</option>
                                                <option value="30">30 Questions</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* ── Proctored Exam Badge ── */}
                                    <div className="flex items-center justify-center gap-2 py-2">
                                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                            Proctored Exam Mode
                                        </span>
                                    </div>

                                    <Button
                                        onClick={handleStartClick}
                                        disabled={isLoading || isLocked || isInCooldown || checkingEligibility}
                                        className="w-full h-16 rounded-2xl bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] text-white font-black text-lg shadow-2xl shadow-purple-200 hover:scale-[1.02] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {checkingEligibility ? (
                                            <span className="flex items-center gap-2">
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Checking eligibility...
                                            </span>
                                        ) : isLocked ? (
                                            <span className="flex items-center gap-2">
                                                <Lock className="w-5 h-5" />
                                                Locked — {formatTime(lockRemainingSeconds)}
                                            </span>
                                        ) : isInCooldown ? (
                                            <span className="flex items-center gap-2">
                                                <Clock className="w-5 h-5" />
                                                Cooldown — {formatTime(cooldownRemainingSeconds)}
                                            </span>
                                        ) : isLoading ? (
                                            <span className="flex items-center gap-2">
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Generating {numQuestions} Questions...
                                            </span>
                                        ) : (
                                            isRoadmapQuiz ? `Start ${roadmapSkillName} Assessment` : `Start ${topic} Assessment`
                                        )}
                                    </Button>
                                </Card>
                            </motion.div>
                        )}

                        {step === 'active' && (
                            <motion.div
                                key="active"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="flex justify-between items-center px-2">
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                                        Question {currentQuestion + 1} of {quizQuestions.length}
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        {/* Exam mode indicator */}
                                        {examMode.isExamActive && (
                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-full">
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                EXAM MODE
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-xs font-black text-blue-500 uppercase tracking-widest">
                                            {isRoadmapQuiz ? `${roadmapSkillName} • ${roadmapLevel}` : `${topic} • ${difficulty}`}
                                        </div>
                                    </div>
                                </div>

                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${((currentQuestion + 1) / quizQuestions.length) * 100}%` }}
                                        className="h-full bg-gradient-to-r from-[#5c52d2] to-[#7c3aed]"
                                    />
                                </div>

                                <Card className="p-6 sm:p-12 border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-2xl sm:rounded-[3rem] space-y-8 sm:space-y-10 min-h-[400px] sm:min-h-[500px] flex flex-col justify-center border border-white/20">
                                    <h2 className="text-2xl font-[900] text-slate-900 leading-snug">
                                        {quizQuestions[currentQuestion].question}
                                    </h2>

                                    <div className="space-y-4">
                                        {quizQuestions[currentQuestion].options.map((option: string, idx: number) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleOptionSelect(idx)}
                                                className={`w-full p-6 rounded-2xl border text-left font-bold transition-all ${selectedAnswers[currentQuestion] === idx
                                                    ? 'bg-[#5c52d2] text-white border-transparent shadow-xl ring-2 ring-slate-900 ring-offset-2'
                                                    : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-blue-50/30'
                                                    }`}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </Card>

                                <div className="flex justify-between items-center px-2 pt-8">
                                    <Button
                                        variant="outline"
                                        onClick={handlePrevious}
                                        disabled={currentQuestion === 0}
                                        className="h-14 px-8 rounded-2xl border-slate-100 text-slate-400 font-black hover:bg-slate-50 gap-2"
                                    >
                                        — Previous
                                    </Button>
                                    <Button
                                        onClick={handleNext}
                                        className="h-14 px-10 rounded-2xl bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] text-white font-black shadow-xl shadow-purple-100 hover:scale-105 transition-all gap-2"
                                    >
                                        {currentQuestion === quizQuestions.length - 1 ? 'Submit Quiz' : 'Next Question'} →
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 'results' && (
                            <motion.div
                                key="results"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center space-y-12 py-10"
                            >
                                <div className="relative w-48 h-48 mx-auto">
                                    <div className="absolute inset-0 bg-purple-100 rounded-full blur-3xl opacity-50" />
                                    <div className="relative w-full h-full bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-white">
                                        <div className="flex flex-col items-center">
                                            <span className="text-6xl font-[900] text-[#5c52d2] tracking-tighter">
                                                {scorePercent}%
                                            </span>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">Score Captured</span>
                                        </div>
                                    </div>
                                    <div className="absolute -top-4 -right-4 w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center text-white shadow-lg rotate-12">
                                        <Trophy className="w-6 h-6" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h1 className="text-4xl font-[900] text-slate-900 tracking-tight">
                                        {score === quizQuestions.length ? 'Perfect Score! 🥳' : score > quizQuestions.length / 2 ? 'Great Job! 👏' : 'Keep Practicing! 💪'}
                                    </h1>
                                    <p className="text-slate-500 text-lg font-medium">
                                        You answered {score} out of {quizQuestions.length} questions correctly in {isRoadmapQuiz ? roadmapSkillName : topic}.
                                    </p>
                                </div>

                                {/* Roadmap Quiz Result Banner */}
                                {isRoadmapQuiz && quizResult && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`max-w-xl mx-auto p-6 rounded-[2rem] border-2 ${quizResult.passed
                                            ? 'bg-emerald-50 border-emerald-200'
                                            : 'bg-rose-50 border-rose-200'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center gap-3 mb-3">
                                            {quizResult.passed
                                                ? <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                                : <Target className="w-6 h-6 text-rose-500" />
                                            }
                                            <span className={`text-lg font-black ${quizResult.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                {quizResult.passed ? '🎉 Skill Mastered! Roadmap Progressed.' : `Need ${passThreshold}% to pass. Try again!`}
                                            </span>
                                        </div>
                                        {quizResult.passed && quizResult.skill_unlocked && (
                                            <p className="text-sm font-bold text-emerald-600">Next skill in your roadmap has been unlocked!</p>
                                        )}
                                    </motion.div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-2xl mx-auto pt-8">
                                    <Card className="p-8 border-none bg-blue-50/90 backdrop-blur-sm rounded-3xl space-y-2 shadow-lg">
                                        <Target className="w-6 h-6 text-blue-500 mx-auto" />
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Accuracy</p>
                                        <p className="text-2xl font-black text-blue-600">{scorePercent}%</p>
                                    </Card>
                                    <Card className="p-8 border-none bg-green-50/90 backdrop-blur-sm rounded-3xl space-y-2 shadow-lg">
                                        <Zap className="w-6 h-6 text-green-500 mx-auto" />
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Level</p>
                                        <p className="text-2xl font-black text-green-600">{isRoadmapQuiz ? roadmapLevel : difficulty}</p>
                                    </Card>
                                    <Card className="p-8 border-none bg-purple-50/90 backdrop-blur-sm rounded-3xl space-y-2 shadow-lg">
                                        <CheckCircle2 className="w-6 h-6 text-purple-500 mx-auto" />
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Correct</p>
                                        <p className="text-2xl font-black text-purple-600">{score}/{quizQuestions.length}</p>
                                    </Card>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-10">
                                    {isRoadmapQuiz ? (
                                        <>
                                            <Button
                                                onClick={() => { checkCooldown(); setStep('setup'); }}
                                                variant="outline"
                                                className="h-14 px-10 rounded-2xl border-slate-100 font-black text-slate-600 hover:bg-slate-50"
                                            >
                                                Retry Quiz
                                            </Button>
                                            <Button
                                                onClick={() => window.location.href = '/career'}
                                                className="h-14 px-10 rounded-2xl bg-slate-900 text-white font-black shadow-xl hover:bg-black transition-all gap-2"
                                            >
                                                Back to Roadmap <ArrowRight className="w-5 h-5" />
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button
                                                onClick={() => { checkCooldown(); setStep('setup'); }}
                                                variant="outline"
                                                className="h-14 px-10 rounded-2xl border-slate-100 font-black text-slate-600 hover:bg-slate-50"
                                            >
                                                Try Another Quiz
                                            </Button>
                                            <Button
                                                onClick={() => window.location.href = '/dashboard'}
                                                className="h-14 px-10 rounded-2xl bg-slate-900 text-white font-black shadow-xl hover:bg-black transition-all gap-2"
                                            >
                                                Back to Dashboard <ArrowRight className="w-5 h-5" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            {/* ═══════════════════════════════════════════════════════════ */}
            {/* EXAM MODE OVERLAYS (Popups) — rendered on top of everything */}
            {/* ═══════════════════════════════════════════════════════════ */}

            {/* ── Exam Instructions Popup ── */}
            <AnimatePresence>
                {showExamInstructions && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-[2rem] max-w-lg w-full overflow-hidden shadow-2xl"
                        >
                            <div className="p-8 space-y-6">
                                <div className="text-center space-y-3">
                                    <div className="w-16 h-16 bg-gradient-to-br from-[#5c52d2] to-[#7c3aed] rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                                        <ShieldAlert className="w-8 h-8 text-white" />
                                    </div>
                                    <h2 className="text-2xl font-[900] text-slate-900">Exam Instructions</h2>
                                    <p className="text-sm font-medium text-slate-400">
                                        Please read and acknowledge the following rules before starting.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    {EXAM_RULES.map((rule, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                            <rule.icon className="w-5 h-5 text-[#5c52d2] mt-0.5 shrink-0" />
                                            <span className="text-sm font-bold text-slate-700">{rule.text}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowExamInstructions(false)}
                                        className="flex-1 h-12 rounded-xl font-black text-slate-500"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleAgreeAndStart}
                                        disabled={isLoading}
                                        className="flex-[2] h-12 rounded-xl bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] text-white font-black shadow-lg"
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Starting...
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <ShieldCheck className="w-4 h-4" />
                                                I Agree & Start Exam
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Fullscreen Exit Warning Popup ── */}
            <AnimatePresence>
                {examMode.showFullscreenWarning && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            className="bg-white rounded-[2rem] max-w-md w-full p-8 text-center space-y-6 shadow-2xl"
                        >
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                                <AlertTriangle className="w-10 h-10 text-red-500" />
                            </div>
                            <h2 className="text-xl font-[900] text-slate-900">Fullscreen Required</h2>
                            <p className="text-sm font-medium text-slate-500">
                                You exited exam mode. Please return to fullscreen within{' '}
                                <span className="font-black text-red-500 text-lg">{examMode.fullscreenCountdown}</span>{' '}
                                seconds or the exam will be terminated.
                            </p>
                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                <motion.div
                                    initial={{ width: '100%' }}
                                    animate={{ width: `${(examMode.fullscreenCountdown / 30) * 100}%` }}
                                    className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full"
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                            <Button
                                onClick={examMode.returnToFullscreen}
                                className="w-full h-14 rounded-xl bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] text-white font-black shadow-lg"
                            >
                                <Monitor className="w-5 h-5 mr-2" />
                                Return to Fullscreen
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Tab Switch Warning Popup ── */}
            <AnimatePresence>
                {examMode.showTabWarning && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            className="bg-white rounded-[2rem] max-w-md w-full p-8 text-center space-y-6 shadow-2xl"
                        >
                            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                                <Eye className="w-10 h-10 text-amber-500" />
                            </div>
                            <h2 className="text-xl font-[900] text-slate-900">Warning: Tab Switch Detected</h2>
                            <p className="text-sm font-medium text-slate-500">
                                You switched away from the exam tab. This is your{' '}
                                <span className="font-black text-amber-600">first warning</span>.
                                Another tab switch will <span className="font-black text-red-500">terminate the exam immediately</span>.
                            </p>
                            <Button
                                onClick={examMode.dismissTabWarning}
                                className="w-full h-14 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-white font-black shadow-lg"
                            >
                                I Understand — Continue Exam
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Exam Terminated Popup ── */}
            <AnimatePresence>
                {examMode.isTerminated && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            className="bg-white rounded-[2rem] max-w-md w-full p-8 text-center space-y-6 shadow-2xl"
                        >
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                                <XCircle className="w-10 h-10 text-red-500" />
                            </div>
                            <h2 className="text-2xl font-[900] text-red-600">Exam Terminated</h2>
                            <p className="text-sm font-medium text-slate-500">
                                You exited exam mode or violated exam rules.
                            </p>
                            <p className="text-xs font-bold text-slate-400">
                                Please follow the instructions carefully before attempting again.
                            </p>
                            <div className="flex flex-col gap-3 pt-2">
                                <Button
                                    onClick={handleRetryAfterTermination}
                                    variant="outline"
                                    className="w-full h-12 rounded-xl font-black text-slate-600"
                                >
                                    Try Again
                                </Button>
                                <Button
                                    onClick={handleBackToLearningPath}
                                    className="w-full h-12 rounded-xl bg-slate-900 text-white font-black"
                                >
                                    Back to {isRoadmapQuiz ? 'Roadmap' : 'Dashboard'}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
