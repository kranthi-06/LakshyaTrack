import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Brain, Building2, Lightbulb, CheckCircle2, XCircle,
  ChevronRight, Timer, ArrowLeft, Trophy, BarChart3, Sparkles,
  Loader2, RefreshCw, Play, Clock, Target, Zap, Eye, EyeOff,
  ChevronDown, Award, AlertCircle, ArrowRight, FileText,
  Star, MessageSquareText
} from 'lucide-react';
import api from '../services/api';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface Question {
  id?: string;
  question: string;
  options: string[];
  correct_answer: string; // "A" | "B" | "C" | "D"
  explanation: string;
  difficulty?: string;
  topic?: string;
  company?: string;
}

interface TopicInfo {
  key: string; label: string; icon: string; desc: string; question_count: number;
}

interface CompanyInfo {
  key: string; label: string; icon: string; question_count: number;
}

type ViewState =
  | { view: 'topics' }
  | { view: 'topic-detail'; topic: string; topicLabel: string }
  | { view: 'companies' }
  | { view: 'company-detail'; company: string; companyLabel: string };

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════ */

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getDifficultyColor(d: string) {
  const v = (d || '').toLowerCase();
  if (v === 'easy') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (v === 'hard') return 'bg-red-500/15 text-red-400 border-red-500/30';
  return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
}

/* ═══════════════════════════════════════════════════════════════
   QUESTION CARD (Learn/Practice mode — show explanation)
   ═══════════════════════════════════════════════════════════════ */

function QuestionCard({ question, index, total, onAnswer }: {
  question: Question; index: number; total: number;
  onAnswer?: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const correct = question.correct_answer;
  const isAnswered = selected !== null;
  const isCorrect = selected === correct;

  const handleSelect = (opt: string) => {
    if (isAnswered) return;
    setSelected(opt);
    setShowExplanation(true);
    onAnswer?.(opt === correct);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-slate-800/50 border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-slate-800/80 border-b border-slate-700/50 flex items-center justify-between">
        <span className="text-sm text-slate-400 font-medium">Question {index + 1} of {total}</span>
        {question.difficulty && (
          <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase ${getDifficultyColor(question.difficulty)}`}>
            {question.difficulty}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        <p className="text-[15px] text-white font-medium leading-relaxed">{question.question}</p>

        <div className="space-y-2">
          {question.options.map((opt, i) => {
            const label = OPTION_LABELS[i];
            const isThis = selected === label;
            const isCorrectOpt = label === correct;

            let cls = 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600/60 text-slate-300 hover:text-white cursor-pointer';
            if (isAnswered) {
              if (isCorrectOpt) cls = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300';
              else if (isThis && !isCorrect) cls = 'bg-red-500/10 border-red-500/40 text-red-300';
              else cls = 'bg-slate-900/30 border-slate-700/30 text-slate-500 cursor-default';
            }

            return (
              <button key={i} onClick={() => handleSelect(label)} disabled={isAnswered}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm flex items-center gap-3 ${cls}`}>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${isAnswered && isCorrectOpt ? 'bg-emerald-500 text-white' : isAnswered && isThis && !isCorrect ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400 border border-slate-600'}`}>
                  {label}
                </span>
                <span className="flex-1">{opt}</span>
                {isAnswered && isCorrectOpt && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {isAnswered && isThis && !isCorrect && <XCircle className="w-4 h-4 text-red-400" />}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        <AnimatePresence>
          {showExplanation && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className={`p-4 rounded-xl border ${isCorrect ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <p className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {isCorrect ? 'Correct!' : `Incorrect — Correct answer is ${correct}`}
                </p>
                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{question.explanation}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEARN CARD — Scrollable study mode (no answer required)
   ═══════════════════════════════════════════════════════════════ */

function LearnCard({ question, index }: { question: Question; index: number }) {
  const [showSolution, setShowSolution] = useState(false);
  const [starred, setStarred] = useState(false);
  const [aiExplaining, setAiExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');

  const correct = question.correct_answer;
  const correctIdx = OPTION_LABELS.indexOf(correct);

  const handleExplainMore = async () => {
    if (aiExplanation) { setAiExplaining(false); return; }
    setAiExplaining(true);
    try {
      const { data } = await api.post('/reasoning/generate', {
        topic: question.topic || 'general',
        difficulty: question.difficulty || 'medium',
        count: 1,
      });
      const generatedQ = data.questions?.[0];
      setAiExplanation(
        generatedQ?.explanation ||
        'The AI was unable to generate a deeper explanation at this time. Please review the existing step-by-step solution carefully.'
      );
    } catch {
      setAiExplanation('AI explanation unavailable. Please try again later.');
    }
    setAiExplaining(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`rounded-2xl border overflow-hidden transition-all duration-300
        ${starred
          ? 'bg-amber-500/[0.03] border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.04)]'
          : 'bg-slate-800/40 border-slate-700/40'}`}
    >
      {/* Header */}
      <div className="px-5 py-3 bg-slate-800/60 border-b border-slate-700/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#6C63FF]/15 text-[#8B83FF] text-xs font-extrabold">
            {index + 1}
          </span>
          {question.difficulty && (
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase ${getDifficultyColor(question.difficulty)}`}>
              {question.difficulty}
            </span>
          )}
        </div>
        <button onClick={() => setStarred(s => !s)}
          className={`p-1.5 rounded-lg transition-all ${starred ? 'text-amber-400 bg-amber-500/10' : 'text-slate-600 hover:text-slate-400'}`}
          title={starred ? 'Remove bookmark' : 'Mark as important'}>
          <Star className={`w-4 h-4 ${starred ? 'fill-amber-400' : ''}`} />
        </button>
      </div>

      {/* Question */}
      <div className="p-5 space-y-4">
        <p className="text-[15px] text-white font-medium leading-relaxed">{question.question}</p>

        {/* Options — always visible, correct one highlighted when solution shown */}
        <div className="space-y-2">
          {question.options.map((opt, i) => {
            const label = OPTION_LABELS[i];
            const isCorrectOpt = i === correctIdx;

            let cls = 'bg-slate-900/40 border-slate-700/40 text-slate-400';
            if (showSolution && isCorrectOpt) {
              cls = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
            }

            return (
              <div key={i}
                className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm flex items-center gap-3 transition-all duration-300 ${cls}`}>
                <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${showSolution && isCorrectOpt
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-800/80 text-slate-500 border border-slate-600/50'}`}>
                  {label}
                </span>
                <span className="flex-1">{opt}</span>
                {showSolution && isCorrectOpt && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* Show Solution Button */}
        <button onClick={() => setShowSolution(s => !s)}
          className={`w-full py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300
            ${showSolution
              ? 'bg-[#6C63FF]/10 border-[#6C63FF]/30 text-[#8B83FF]'
              : 'bg-slate-800/50 border-slate-700/40 text-slate-400 hover:text-white hover:border-slate-600'}`}>
          {showSolution ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showSolution ? 'Hide Solution' : 'Show Solution'}
        </button>

        {/* Expandable Solution */}
        <AnimatePresence>
          {showSolution && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 space-y-3">
                <p className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" /> Step-by-Step Solution
                </p>
                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {question.explanation}
                </div>

                {/* AI Explain More */}
                <div className="pt-2 border-t border-emerald-500/10">
                  <button onClick={handleExplainMore} disabled={aiExplaining}
                    className="flex items-center gap-2 text-xs font-semibold text-[#8B83FF] hover:text-[#A59BFF] transition-colors disabled:opacity-50">
                    {aiExplaining
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <MessageSquareText className="w-3.5 h-3.5" />}
                    {aiExplanation ? 'AI Explanation ↓' : 'Explain More with AI'}
                  </button>

                  <AnimatePresence>
                    {aiExplanation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 p-3 rounded-lg bg-[#6C63FF]/5 border border-[#6C63FF]/15 text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                          {aiExplanation}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TEST MODE
   ═══════════════════════════════════════════════════════════════ */

function TestMode({ questions, onFinish }: { questions: Question[]; onFinish: (score: number, answers: any[]) => void }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>(new Array(questions.length).fill(null));
  const [timeLeft, setTimeLeft] = useState(questions.length * 60); // 1 min per question
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(intervalRef.current); submitTest(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const handleSelect = (label: string) => {
    setAnswers(prev => { const n = [...prev]; n[currentIdx] = label; return n; });
  };

  const submitTest = () => {
    clearInterval(intervalRef.current);
    setFinished(true);
    let score = 0;
    const detailed = questions.map((q, i) => {
      const correct = answers[i] === q.correct_answer;
      if (correct) score++;
      return { question_id: q.id, selected: answers[i], correct: q.correct_answer, is_correct: correct };
    });
    onFinish(score, detailed);
  };

  const q = questions[currentIdx];
  if (!q) return null;

  const timerColor = timeLeft < 60 ? 'text-red-400' : timeLeft < 180 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="space-y-5">
      {/* Timer & Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className={`w-5 h-5 ${timerColor}`} />
          <span className={`text-lg font-mono font-bold ${timerColor}`}>{formatTime(timeLeft)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>{currentIdx + 1} / {questions.length}</span>
          <div className="w-32 h-2 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full bg-[#6C63FF] rounded-full transition-all" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Question (without explanation) */}
      <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5 space-y-4">
        <p className="text-[15px] text-white font-medium leading-relaxed">{q.question}</p>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            const label = OPTION_LABELS[i];
            const isSelected = answers[currentIdx] === label;
            return (
              <button key={i} onClick={() => handleSelect(label)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm flex items-center gap-3
                  ${isSelected
                    ? 'bg-[#6C63FF]/15 border-[#6C63FF]/40 text-[#8B83FF]'
                    : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600/60 text-slate-300 hover:text-white cursor-pointer'}`}>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${isSelected ? 'bg-[#6C63FF] text-white' : 'bg-slate-800 text-slate-400 border border-slate-600'}`}>
                  {label}
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}
          className="px-5 py-2.5 rounded-xl bg-slate-700/30 text-slate-400 border border-slate-600/30 hover:bg-slate-700/50 transition-all text-sm font-medium disabled:opacity-40">
          Previous
        </button>
        {currentIdx < questions.length - 1 ? (
          <button onClick={() => setCurrentIdx(i => i + 1)}
            className="px-5 py-2.5 rounded-xl bg-[#6C63FF]/15 text-[#8B83FF] border border-[#6C63FF]/30 hover:bg-[#6C63FF]/25 transition-all text-sm font-medium">
            Next <ArrowRight className="w-4 h-4 inline ml-1" />
          </button>
        ) : (
          <button onClick={submitTest}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-violet-500 text-white font-semibold hover:shadow-lg transition-all text-sm">
            Submit Test
          </button>
        )}
      </div>

      {/* Question navigator */}
      <div className="flex flex-wrap gap-2">
        {questions.map((_, i) => (
          <button key={i} onClick={() => setCurrentIdx(i)}
            className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all
              ${i === currentIdx ? 'bg-[#6C63FF] text-white' : answers[i] ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700/50'}`}>
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TEST RESULTS
   ═══════════════════════════════════════════════════════════════ */

function TestResults({ score, total, questions, answers, onRetry }: {
  score: number; total: number; questions: Question[]; answers: any[]; onRetry: () => void;
}) {
  const [showSolutions, setShowSolutions] = useState(false);
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;
  const color = accuracy >= 80 ? 'text-emerald-400' : accuracy >= 50 ? 'text-amber-400' : 'text-red-400';
  const gradColor = accuracy >= 80 ? '#10b981' : accuracy >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-6">
      {/* Score card */}
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
        <Trophy className={`w-12 h-12 mx-auto mb-3 ${color}`} />
        <h3 className="text-2xl font-extrabold text-white mb-1">Test Complete!</h3>
        <div className="flex justify-center gap-8 mt-6">
          <div>
            <div className="relative w-24 h-24 mx-auto">
              <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-700" />
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="7" stroke={gradColor} strokeLinecap="round"
                  strokeDasharray={`${(accuracy / 100) * 264} 264`} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xl font-extrabold ${color}`}>{accuracy}%</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Accuracy</p>
          </div>
          <div className="text-left space-y-2 pt-3">
            <p className="text-sm text-slate-400">Score: <span className="text-white font-bold">{score}/{total}</span></p>
            <p className="text-sm text-slate-400">Correct: <span className="text-emerald-400 font-bold">{score}</span></p>
            <p className="text-sm text-slate-400">Wrong: <span className="text-red-400 font-bold">{total - score}</span></p>
          </div>
        </div>

        <div className="flex gap-3 justify-center mt-6">
          <button onClick={onRetry}
            className="px-6 py-2.5 rounded-xl bg-[#6C63FF]/15 text-[#8B83FF] border border-[#6C63FF]/30 text-sm font-medium hover:bg-[#6C63FF]/25 transition-all">
            <RefreshCw className="w-4 h-4 inline mr-1" /> Try Again
          </button>
          <button onClick={() => setShowSolutions(s => !s)}
            className="px-6 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-sm font-medium hover:bg-emerald-500/25 transition-all">
            {showSolutions ? <EyeOff className="w-4 h-4 inline mr-1" /> : <Eye className="w-4 h-4 inline mr-1" />}
            {showSolutions ? 'Hide' : 'Show'} Solutions
          </button>
        </div>
      </motion.div>

      {/* Solutions */}
      {showSolutions && (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <QuestionCard key={i} question={q} index={i} total={questions.length} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOPIC DETAIL PAGE (Learn / Practice / Test tabs)
   ═══════════════════════════════════════════════════════════════ */

function TopicDetailPage({ topic, topicLabel, onBack }: { topic: string; topicLabel: string; onBack: () => void }) {
  const [tab, setTab] = useState<'learn' | 'practice' | 'test'>('learn');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<{ score: number; total: number; answers: any[] } | null>(null);
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [testStarted, setTestStarted] = useState(false);

  const fetchQuestions = useCallback(async (mode: string) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/reasoning/questions/topic/${topic}?mode=${mode}&limit=36`);
      return data.questions || [];
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, [topic]);

  useEffect(() => { fetchQuestions('learn').then(setQuestions); }, [topic]);

  const generateNew = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/reasoning/generate', { topic, difficulty: 'medium', count: 10 });
      setQuestions(data.questions || []);
    } catch { /* keep existing */ }
    setLoading(false);
  };

  const startTest = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/reasoning/generate', { topic, difficulty: 'medium', count: 10 });
      setTestQuestions(data.questions || []);
      setTestStarted(true);
      setTestResults(null);
    } catch { /* use existing questions */ setTestQuestions(questions.slice(0, 10)); setTestStarted(true); }
    setLoading(false);
  };

  const handleTestFinish = (score: number, answers: any[]) => {
    setTestResults({ score, total: testQuestions.length, answers });
    setTestStarted(false);
    // Save result
    api.post('/reasoning/submit-test', {
      user_id: 'anonymous', test_type: 'topic_test', category: topic, score, total: testQuestions.length, answers,
    }).catch(() => {});
  };

  const tabs = [
    { key: 'learn', label: 'Learn', icon: BookOpen, gradient: 'from-[#6C63FF] to-violet-500' },
    { key: 'practice', label: 'Practice', icon: Target, gradient: 'from-sky-500 to-indigo-500' },
    { key: 'test', label: 'Test', icon: Timer, gradient: 'from-rose-500 to-pink-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white">{topicLabel}</h2>
          <p className="text-xs text-slate-500">{questions.length} questions available</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key as any); setTestStarted(false); setTestResults(null); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${tab === t.key ? `bg-gradient-to-r ${t.gradient} text-white shadow-lg` : 'bg-slate-800/50 text-slate-400 border border-slate-700/40 hover:text-slate-200'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
        <button onClick={generateNew} disabled={loading}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-sm font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-40">
          <Sparkles className="w-4 h-4" /> AI Generate
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-12">
          <Loader2 className="w-6 h-6 text-[#6C63FF] animate-spin" />
          <span className="text-sm text-slate-400">Loading questions...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* LEARN MODE — Scrollable study page */}
          {tab === 'learn' && questions.length > 0 && (
            <div className="space-y-4">
              {/* Learn header */}
              <div className="p-4 rounded-xl bg-[#6C63FF]/5 border border-[#6C63FF]/15 flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-[#8B83FF]" />
                <div>
                  <p className="text-sm font-semibold text-white">Study Mode</p>
                  <p className="text-xs text-slate-400">{questions.length} questions — Read, understand, and learn at your own pace</p>
                </div>
              </div>

              {/* Scrollable question list */}
              {questions.map((q, i) => (
                <LearnCard key={`learn-${q.id || i}-${q.question.substring(0, 20)}`} question={q} index={i} />
              ))}
            </div>
          )}

          {/* PRACTICE MODE */}
          {tab === 'practice' && questions.length > 0 && (
            <div className="space-y-4">
              {questions.map((q, i) => (
                <QuestionCard key={`${q.id || i}-${q.question.substring(0, 20)}`} question={q} index={i} total={questions.length} />
              ))}
            </div>
          )}

          {/* TEST MODE */}
          {tab === 'test' && !testStarted && !testResults && (
            <div className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center space-y-4">
              <Timer className="w-12 h-12 text-rose-400 mx-auto" />
              <h3 className="text-xl font-bold text-white">Timed Test — {topicLabel}</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">10 questions with a countdown timer. Explanations will only be shown after you submit.</p>
              <button onClick={startTest} disabled={loading}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold hover:shadow-lg transition-all disabled:opacity-40">
                <Play className="w-4 h-4 inline mr-2" /> Start Test
              </button>
            </div>
          )}

          {tab === 'test' && testStarted && testQuestions.length > 0 && (
            <TestMode questions={testQuestions} onFinish={handleTestFinish} />
          )}

          {tab === 'test' && testResults && (
            <TestResults score={testResults.score} total={testResults.total} questions={testQuestions}
              answers={testResults.answers} onRetry={startTest} />
          )}

          {/* Empty state */}
          {questions.length === 0 && !loading && (
            <div className="p-12 rounded-2xl bg-slate-800/30 border border-slate-700/30 text-center space-y-3">
              <Brain className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-slate-400">No questions available yet.</p>
              <button onClick={generateNew}
                className="px-6 py-2.5 rounded-xl bg-[#6C63FF]/15 text-[#8B83FF] border border-[#6C63FF]/30 text-sm font-medium hover:bg-[#6C63FF]/25 transition-all">
                <Sparkles className="w-4 h-4 inline mr-1" /> Generate with AI
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPANY DETAIL PAGE (Questions / Simulator / AI Test)
   ═══════════════════════════════════════════════════════════════ */

function CompanyDetailPage({ company, companyLabel, onBack }: { company: string; companyLabel: string; onBack: () => void }) {
  const [tab, setTab] = useState<'questions' | 'simulator' | 'ai-test'>('questions');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [testStarted, setTestStarted] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/reasoning/questions/company/${company}?limit=30`)
      .then(({ data }) => setQuestions(data.questions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [company]);

  const generateAITest = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/reasoning/generate', { topic: 'coding-decoding', difficulty: 'medium', count: 10, company });
      setTestQuestions(data.questions || []);
      setTestStarted(true);
      setTestResults(null);
    } catch {}
    setLoading(false);
  };

  const startSimulator = () => {
    const pool = questions.length >= 10 ? questions.slice(0, 10) : questions;
    if (pool.length === 0) { generateAITest(); return; }
    setTestQuestions(pool);
    setTestStarted(true);
    setTestResults(null);
  };

  const handleFinish = (score: number, answers: any[]) => {
    setTestResults({ score, total: testQuestions.length, answers });
    setTestStarted(false);
    api.post('/reasoning/submit-test', {
      user_id: 'anonymous', test_type: 'company_test', category: company, score, total: testQuestions.length, answers,
    }).catch(() => {});
  };

  const tabs = [
    { key: 'questions', label: 'Questions', icon: FileText, gradient: 'from-[#6C63FF] to-violet-500' },
    { key: 'simulator', label: 'Simulator', icon: Timer, gradient: 'from-sky-500 to-indigo-500' },
    { key: 'ai-test', label: 'AI Test', icon: Sparkles, gradient: 'from-rose-500 to-pink-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white">{companyLabel}</h2>
          <p className="text-xs text-slate-500">Previous year questions & AI practice</p>
        </div>
      </div>

      <div className="flex gap-3">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key as any); setTestStarted(false); setTestResults(null); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${tab === t.key ? `bg-gradient-to-r ${t.gradient} text-white shadow-lg` : 'bg-slate-800/50 text-slate-400 border border-slate-700/40 hover:text-slate-200'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-12">
          <Loader2 className="w-6 h-6 text-[#6C63FF] animate-spin" /><span className="text-sm text-slate-400">Loading...</span>
        </div>
      )}

      {!loading && (
        <>
          {tab === 'questions' && (
            <div className="space-y-4">
              {questions.length > 0 ? questions.map((q, i) => (
                <QuestionCard key={i} question={q} index={i} total={questions.length} />
              )) : (
                <div className="p-12 rounded-2xl bg-slate-800/30 border border-slate-700/30 text-center space-y-3">
                  <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
                  <p className="text-slate-400">No previous year questions yet. Try the AI Test tab!</p>
                </div>
              )}
            </div>
          )}

          {tab === 'simulator' && !testStarted && !testResults && (
            <div className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center space-y-4">
              <Timer className="w-12 h-12 text-sky-400 mx-auto" />
              <h3 className="text-xl font-bold text-white">{companyLabel} Exam Simulator</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">Full exam simulation with timer. No explanations during the test.</p>
              <button onClick={startSimulator}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-semibold hover:shadow-lg transition-all">
                <Play className="w-4 h-4 inline mr-2" /> Start Simulator
              </button>
            </div>
          )}

          {tab === 'ai-test' && !testStarted && !testResults && (
            <div className="p-8 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center space-y-4">
              <Sparkles className="w-12 h-12 text-rose-400 mx-auto" />
              <h3 className="text-xl font-bold text-white">AI-Generated {companyLabel} Test</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">Unlimited AI-generated questions styled like {companyLabel} exams.</p>
              <button onClick={generateAITest} disabled={loading}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold hover:shadow-lg transition-all disabled:opacity-40">
                <Zap className="w-4 h-4 inline mr-2" /> Generate AI Test
              </button>
            </div>
          )}

          {(tab === 'simulator' || tab === 'ai-test') && testStarted && testQuestions.length > 0 && (
            <TestMode questions={testQuestions} onFinish={handleFinish} />
          )}

          {(tab === 'simulator' || tab === 'ai-test') && testResults && (
            <TestResults score={testResults.score} total={testResults.total} questions={testQuestions}
              answers={testResults.answers} onRetry={tab === 'ai-test' ? generateAITest : startSimulator} />
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOPICS LIST PAGE
   ═══════════════════════════════════════════════════════════════ */

function TopicsListPage({ onSelect }: { onSelect: (topic: string, label: string) => void }) {
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reasoning/topics')
      .then(({ data }) => setTopics(data.topics || []))
      .catch(() => {
        // Fallback topics
        setTopics([
          { key: 'coding-decoding', label: 'Coding-Decoding', icon: '🔐', desc: 'Letter/number coding patterns', question_count: 0 },
          { key: 'blood-relations', label: 'Blood Relations', icon: '👨‍👩‍👧‍👦', desc: 'Family relationship puzzles', question_count: 0 },
          { key: 'seating-arrangement', label: 'Seating Arrangement', icon: '🪑', desc: 'Circular & linear arrangement', question_count: 0 },
          { key: 'puzzles', label: 'Puzzles', icon: '🧩', desc: 'Logic puzzles & brain teasers', question_count: 0 },
          { key: 'syllogisms', label: 'Syllogisms', icon: '🔄', desc: 'Statement & conclusion logic', question_count: 0 },
          { key: 'number-series', label: 'Number Series', icon: '🔢', desc: 'Find the pattern in sequences', question_count: 0 },
          { key: 'analogy', label: 'Analogy', icon: '🔗', desc: 'Word & number analogies', question_count: 0 },
          { key: 'percentages', label: 'Percentages', icon: '📊', desc: 'Percentage calculations', question_count: 0 },
          { key: 'profit-loss', label: 'Profit & Loss', icon: '💰', desc: 'Business math problems', question_count: 0 },
          { key: 'time-work', label: 'Time & Work', icon: '⏱️', desc: 'Work rate problems', question_count: 0 },
          { key: 'averages', label: 'Averages', icon: '📈', desc: 'Mean, median calculations', question_count: 0 },
          { key: 'ratio-proportion', label: 'Ratio & Proportion', icon: '⚖️', desc: 'Ratio-based problems', question_count: 0 },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 text-[#6C63FF] animate-spin" />
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {topics.map((t, i) => (
        <motion.button key={t.key} onClick={() => onSelect(t.key, t.label)}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
          className="group text-left p-5 rounded-2xl bg-slate-800/40 border border-slate-700/40 hover:border-[#6C63FF]/30 hover:bg-slate-800/60 transition-all duration-300">
          <div className="flex items-start gap-3">
            <span className="text-3xl">{t.icon}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-sm group-hover:text-[#8B83FF] transition-colors">{t.label}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
              {t.question_count > 0 && (
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-[#6C63FF]/10 text-[#8B83FF] border border-[#6C63FF]/20 font-medium">
                  {t.question_count} questions
                </span>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-[#6C63FF] transition-colors mt-1" />
          </div>
        </motion.button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPANIES LIST PAGE
   ═══════════════════════════════════════════════════════════════ */

function CompaniesListPage({ onSelect }: { onSelect: (company: string, label: string) => void }) {
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reasoning/companies')
      .then(({ data }) => setCompanies(data.companies || []))
      .catch(() => {
        setCompanies([
          { key: 'tcs', label: 'TCS', icon: '🏢', question_count: 0 },
          { key: 'infosys', label: 'Infosys', icon: '🏛️', question_count: 0 },
          { key: 'wipro', label: 'Wipro', icon: '🌐', question_count: 0 },
          { key: 'accenture', label: 'Accenture', icon: '💼', question_count: 0 },
          { key: 'cognizant', label: 'Cognizant', icon: '🔷', question_count: 0 },
          { key: 'capgemini', label: 'Capgemini', icon: '🔶', question_count: 0 },
          { key: 'hcl', label: 'HCL Technologies', icon: '🏭', question_count: 0 },
          { key: 'deloitte', label: 'Deloitte', icon: '📐', question_count: 0 },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 text-[#6C63FF] animate-spin" />
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {companies.map((c, i) => (
        <motion.button key={c.key} onClick={() => onSelect(c.key, c.label)}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          className="group text-left p-6 rounded-2xl bg-slate-800/40 border border-slate-700/40 hover:border-sky-500/30 hover:bg-slate-800/60 transition-all duration-300">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{c.icon}</span>
            <div className="flex-1">
              <h3 className="font-bold text-white text-base group-hover:text-sky-400 transition-colors">{c.label}</h3>
              {c.question_count > 0 && (
                <span className="text-xs text-slate-500">{c.question_count} questions</span>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-sky-400 transition-colors" />
          </div>
        </motion.button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function Reasoning() {
  const [viewState, setViewState] = useState<ViewState>({ view: 'topics' });
  const [mainTab, setMainTab] = useState<'topics' | 'companies'>('topics');

  const isListView = viewState.view === 'topics' || viewState.view === 'companies';

  return (
    <div className="theme-override-wrapper min-h-screen bg-[#060611]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#6C63FF]/8 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#6C63FF]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#6C63FF]/10 border border-[#6C63FF]/20 mb-4">
              <Brain className="w-4 h-4 text-[#6C63FF]" />
              <span className="text-xs font-bold text-[#8B83FF] uppercase tracking-wider">AI Problem Solving</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-3">
              Problem Solving{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6C63FF] via-violet-400 to-purple-400">& Reasoning</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl leading-relaxed">
              Master aptitude and reasoning with AI-generated questions, step-by-step solutions, and company-specific practice
            </p>
          </motion.div>

          {/* Main tabs (only on list views) */}
          {isListView && (
            <div className="flex justify-center gap-3 mb-2">
              <button onClick={() => { setMainTab('topics'); setViewState({ view: 'topics' }); }}
                className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all
                  ${mainTab === 'topics' ? 'bg-gradient-to-r from-[#6C63FF] to-violet-500 text-white shadow-lg' : 'bg-slate-800/50 text-slate-400 border border-slate-700/40 hover:text-slate-200'}`}>
                <BookOpen className="w-4 h-4" /> Topic-wise
              </button>
              <button onClick={() => { setMainTab('companies'); setViewState({ view: 'companies' }); }}
                className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all
                  ${mainTab === 'companies' ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg' : 'bg-slate-800/50 text-slate-400 border border-slate-700/40 hover:text-slate-200'}`}>
                <Building2 className="w-4 h-4" /> Company-wise
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <AnimatePresence mode="wait">
          <motion.div key={JSON.stringify(viewState)} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.25 }}>
            {viewState.view === 'topics' && (
              <TopicsListPage onSelect={(key, label) => setViewState({ view: 'topic-detail', topic: key, topicLabel: label })} />
            )}
            {viewState.view === 'companies' && (
              <CompaniesListPage onSelect={(key, label) => setViewState({ view: 'company-detail', company: key, companyLabel: label })} />
            )}
            {viewState.view === 'topic-detail' && (
              <TopicDetailPage topic={viewState.topic} topicLabel={viewState.topicLabel}
                onBack={() => setViewState({ view: 'topics' })} />
            )}
            {viewState.view === 'company-detail' && (
              <CompanyDetailPage company={viewState.company} companyLabel={viewState.companyLabel}
                onBack={() => setViewState({ view: 'companies' })} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
