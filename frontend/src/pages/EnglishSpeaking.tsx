import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, Volume2, SkipForward, RotateCcw, Send,
  Lightbulb, MessageSquare, Users, ChevronRight,
  CheckCircle2, AlertCircle, Sparkles, BookOpen,
  Square, RefreshCw, Loader2, FileText, Zap, Star,
  ArrowRight, CircleAlert
} from 'lucide-react';
import { analyzeEnglishSpeaking, generateEnglishPassage, generateEnglishTopic } from '../services/englishSpeaking';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const PASSAGE_CATEGORIES = [
  { key: 'interview', label: 'Interview', emoji: '🎯' },
  { key: 'college', label: 'College Life', emoji: '🎓' },
  { key: 'daily_life', label: 'Daily Life', emoji: '🌅' },
  { key: 'technology', label: 'Technology', emoji: '💻' },
  { key: 'general', label: 'General', emoji: '📚' },
];

const DEFAULT_TIPS = [
  { title: "Think in English", desc: "Don't translate from your native language. Form thoughts directly in English.", example: 'Instead of translating, think "I like this" directly.', icon: "💭" },
  { title: "Use Simple Sentences", desc: "Start with short, clear sentences. Complexity can come later.", example: '"I work hard." is better than a long, broken sentence.', icon: "✏️" },
  { title: "Speak Slowly & Clearly", desc: "Speed doesn't equal fluency. Pace yourself and pronounce each word.", example: "Pause between sentences. Take a breath before responding.", icon: "🐢" },
  { title: "Use Connectors", desc: 'Link ideas with words like "and", "because", "however", "therefore".', example: '"I enjoy coding because it is creative and challenging."', icon: "🔗" },
  { title: "Practice Daily", desc: "Even 10 minutes of daily speaking practice makes a huge difference.", example: "Read one paragraph aloud every morning. Record yourself.", icon: "📅" },
  { title: "Listen Actively", desc: "Watch English videos, podcasts, or news to improve pronunciation.", example: "Try shadowing — repeat what the speaker says after them.", icon: "👂" },
  { title: "Don't Fear Mistakes", desc: "Every mistake is a learning opportunity. Confidence comes from practice.", example: "Even native speakers make errors. Focus on being understood.", icon: "💪" },
];

const INTERVIEW_QUESTIONS = [
  "Tell me about yourself.",
  "Why should we hire you?",
  "What are your strengths and weaknesses?",
  "Where do you see yourself in 5 years?",
  "Why do you want to work at our company?",
  "Describe a difficult situation and how you handled it.",
  "What makes you unique compared to other candidates?",
  "How do you handle pressure and deadlines?",
];

/* ═══════════════════════════════════════════════════════════════
   SPEECH HOOK
   ═══════════════════════════════════════════════════════════════ */

function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition is not supported. Please use Chrome.'); return; }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalArr: string[] = [];
      let interimArr: string[] = [];

      for (let i = 0; i < event.results.length; i++) {
        let text = event.results[i][0].transcript.trim();
        if (!text) continue;

        if (event.results[i].isFinal) {
          if (finalArr.length > 0) {
            let prev = finalArr[finalArr.length - 1];
            if (text.toLowerCase().startsWith(prev.toLowerCase())) {
              finalArr[finalArr.length - 1] = text;
            } else {
              finalArr.push(text);
            }
          } else {
            finalArr.push(text);
          }
        } else {
          if (interimArr.length > 0) {
            let prev = interimArr[interimArr.length - 1];
            if (text.toLowerCase().startsWith(prev.toLowerCase())) {
              interimArr[interimArr.length - 1] = text;
            } else {
              interimArr.push(text);
            }
          } else {
            interimArr.push(text);
          }
        }
      }

      let finalStr = finalArr.join(' ');
      let interimStr = interimArr.join(' ');

      if (finalStr && interimStr.toLowerCase().startsWith(finalStr.toLowerCase())) {
        interimStr = interimStr.substring(finalStr.length).trim();
      }

      setTranscript(finalStr);
      setInterimTranscript(interimStr);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript('');
    setInterimTranscript('');
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return { isListening, transcript, interimTranscript, startListening, stopListening, resetTranscript };
}

function speakText(text: string) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.85; u.pitch = 1;
    window.speechSynthesis.speak(u);
  }
}

/* ═══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function LoadingSpinner({ text, color = '#6C63FF' }: { text: string; color?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-8">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: color, borderTopColor: 'transparent' }} />
      <span className="text-sm text-slate-400">{text}</span>
    </div>
  );
}

// ── Speech Controller ───────────────────────────────────────────
function SpeechController({ onSubmit, disabled, key: resetKey }: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  key?: string | number;
}) {
  const { isListening, transcript, interimTranscript, startListening, stopListening, resetTranscript } = useSpeechRecognition();
  const [submitted, setSubmitted] = useState(false);

  // Reset on key change
  useEffect(() => { setSubmitted(false); resetTranscript(); }, [resetKey]);

  const handleSubmit = () => { if (transcript.trim()) { onSubmit(transcript.trim()); setSubmitted(true); } };
  const handleReset = () => { resetTranscript(); setSubmitted(false); };

  return (
    <div className="space-y-4">
      {/* Transcript display */}
      <div className="min-h-[80px] rounded-xl bg-slate-900/60 border border-slate-700/50 p-4">
        {transcript || interimTranscript ? (
          <p className="text-slate-200 text-sm leading-relaxed">
            {transcript}
            {interimTranscript && <span className="text-slate-500 italic"> {interimTranscript}</span>}
          </p>
        ) : (
          <p className="text-slate-500 text-sm italic">
            {isListening ? '🎤 Listening... Start speaking now' : 'Click "Start Speaking" to begin recording'}
          </p>
        )}
      </div>

      {/* Waveform */}
      <AnimatePresence>
        {isListening && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-center gap-1 py-2">
            {[...Array(20)].map((_, i) => (
              <motion.div key={i} className="w-1 rounded-full bg-gradient-to-t from-[#6C63FF] to-violet-400"
                animate={{ height: [6, Math.random() * 30 + 6, 6] }}
                transition={{ duration: 0.5 + Math.random() * 0.5, repeat: Infinity, delay: i * 0.04 }} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buttons */}
      <div className="flex flex-wrap gap-3">
        {!isListening ? (
          <button onClick={startListening} disabled={disabled || submitted}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm">
            <Mic className="w-4 h-4" /> Start Speaking
          </button>
        ) : (
          <button onClick={stopListening}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all font-medium text-sm animate-pulse">
            <Square className="w-4 h-4" /> Stop
          </button>
        )}
        <button onClick={handleSubmit} disabled={!transcript.trim() || disabled || submitted}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6C63FF]/15 text-[#8B83FF] border border-[#6C63FF]/30 hover:bg-[#6C63FF]/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm">
          <Send className="w-4 h-4" /> Submit
        </button>
        <button onClick={handleReset} disabled={isListening}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700/30 text-slate-400 border border-slate-600/30 hover:bg-slate-700/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm">
          <RefreshCw className="w-4 h-4" /> Reset
        </button>
      </div>
    </div>
  );
}

// ── Feedback Card ───────────────────────────────────────────────
function FeedbackCard({ analysis, type, onTryAgain }: {
  analysis: any; type: 'sentence' | 'topic' | 'interview'; onTryAgain: () => void;
}) {
  if (!analysis) return null;

  const getScoreColor = (s: number) => s >= 80 ? 'text-emerald-400' : s >= 60 ? 'text-amber-400' : 'text-red-400';
  const getLevelColor = (l: string) => {
    const v = (l || '').toLowerCase();
    if (v.includes('excellent') || v.includes('high') || v.includes('advanced')) return 'text-emerald-400';
    if (v.includes('good') || v.includes('medium') || v.includes('intermediate') || v.includes('relevant')) return 'text-sky-400';
    if (v.includes('average') || v.includes('basic') || v.includes('partial')) return 'text-amber-400';
    return 'text-red-400';
  };
  const getBadgeColor = (l: string) => {
    const v = (l || '').toLowerCase();
    if (v.includes('excellent') || v.includes('high') || v.includes('advanced')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (v.includes('good') || v.includes('medium') || v.includes('intermediate') || v.includes('relevant')) return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    if (v.includes('average') || v.includes('basic') || v.includes('partial')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-red-500/15 text-red-400 border-red-500/30';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="mt-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm overflow-hidden">

      <div className="px-6 py-4 bg-gradient-to-r from-[#6C63FF]/10 to-violet-500/10 border-b border-slate-700/50">
        <h4 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#6C63FF]" /> AI Analysis Results
        </h4>
      </div>

      <div className="p-6 space-y-5">
        {/* Passage mode: Accuracy ring + badges */}
        {type === 'sentence' && analysis.accuracy !== undefined && (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-700" />
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="7" stroke="url(#scoreGrad)" strokeLinecap="round"
                  strokeDasharray={`${(analysis.accuracy / 100) * 264} 264`} />
                <defs><linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6C63FF" /><stop offset="100%" stopColor="#a78bfa" />
                </linearGradient></defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-extrabold ${getScoreColor(analysis.accuracy)}`}>{analysis.accuracy}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <p className={`text-lg font-bold ${getScoreColor(analysis.accuracy)}`}>
                {analysis.accuracy >= 90 ? '🎉 Excellent!' : analysis.accuracy >= 70 ? '👍 Good job!' : '💪 Keep practicing!'}
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.fluency && <span className={`text-xs px-3 py-1 rounded-full border ${getBadgeColor(analysis.fluency)}`}>Fluency: {analysis.fluency}</span>}
                {analysis.confidence && <span className={`text-xs px-3 py-1 rounded-full border ${getBadgeColor(analysis.confidence)}`}>Confidence: {analysis.confidence}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Topic / Interview mode: Grid metrics */}
        {(type === 'topic' || type === 'interview') && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Fluency', value: analysis.fluency },
              { label: 'Vocabulary', value: analysis.vocabulary },
              { label: 'Structure', value: analysis.sentence_structure },
              { label: 'Grammar', value: analysis.grammar },
              { label: 'Confidence', value: analysis.confidence },
              ...(type === 'interview' && analysis.relevance ? [{ label: 'Relevance', value: analysis.relevance }] : []),
            ].filter(m => m.value).map((m) => (
              <div key={m.label} className="rounded-xl bg-slate-900/50 border border-slate-700/50 p-3 text-center">
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{m.label}</p>
                <p className={`text-sm font-bold ${getLevelColor(m.value)}`}>{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Issues */}
        {analysis.issues?.length > 0 && (
          <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
            <p className="text-sm font-semibold text-orange-400 mb-2 flex items-center gap-2"><CircleAlert className="w-4 h-4" /> Issues Found</p>
            <ul className="space-y-1.5">
              {analysis.issues.map((issue: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-orange-400 mt-0.5">•</span> {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Missing words */}
        {analysis.missing_words?.length > 0 && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
            <p className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Missing Words</p>
            <div className="flex flex-wrap gap-2">
              {analysis.missing_words.map((w: string, i: number) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 text-sm font-medium border border-red-500/25">{w}</span>
              ))}
            </div>
          </div>
        )}

        {/* Incorrect words */}
        {analysis.incorrect_words?.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <p className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Incorrect Words</p>
            <div className="flex flex-wrap gap-2">
              {analysis.incorrect_words.map((w: string, i: number) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-sm font-medium border border-amber-500/25">{w}</span>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {analysis.tips?.length > 0 && (
          <div className="p-4 rounded-xl bg-[#6C63FF]/5 border border-[#6C63FF]/20">
            <p className="text-sm font-semibold text-[#8B83FF] mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4" /> Tips for Improvement</p>
            <ul className="space-y-2">
              {analysis.tips.map((tip: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <ChevronRight className="w-4 h-4 text-[#6C63FF] mt-0.5 flex-shrink-0" /> {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improved answer */}
        {analysis.improved_answer && (
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Improved Version</p>
            <p className="text-sm text-slate-300 leading-relaxed italic">"{analysis.improved_answer}"</p>
            <button onClick={() => speakText(analysis.improved_answer)}
              className="mt-3 flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              <Volume2 className="w-3.5 h-3.5" /> Listen to improved version
            </button>
          </div>
        )}

        <button onClick={onTryAgain}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6C63FF] to-violet-500 text-white font-semibold hover:shadow-lg hover:shadow-[#6C63FF]/25 transition-all duration-300 flex items-center justify-center gap-2">
          <RotateCcw className="w-4 h-4" /> Try Again
        </button>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 1: READ & SPEAK (PASSAGE MODE)
   ═══════════════════════════════════════════════════════════════ */

function ReadSpeakModule({ onNewTips }: { onNewTips: (tips: string[]) => void }) {
  const [passage, setPassage] = useState('');
  const [category, setCategory] = useState('interview');
  const [difficulty, setDifficulty] = useState('easy');
  const [generating, setGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [passageKey, setPassageKey] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Generate first passage on mount
  useEffect(() => { generatePassage(); }, []);

  const generatePassage = async () => {
    setGenerating(true);
    setAnalysis(null);
    setPassageKey(k => k + 1);
    try {
      const data = await generateEnglishPassage({ category, difficulty });
      setPassage(data.passage);
    } catch {
      setPassage("I am preparing for my placement interview. Good communication skills are essential for success. I have worked on several team projects during my college years. I believe continuous learning is important for career growth. I am confident that I can contribute positively to any organization.");
    } finally {
      setGenerating(false);
    }
  };

  const handleListen = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(passage);
      u.lang = 'en-US'; u.rate = 0.8; u.pitch = 1;
      u.onend = () => setIsSpeaking(false);
      u.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(u);
    }
  };

  const handleSubmit = async (spokenText: string) => {
    setLoading(true);
    setAnalysis(null);
    try {
      const data = await analyzeEnglishSpeaking({
        type: 'sentence',
        original_text: passage,
        user_text: spokenText,
      });
      setAnalysis(data.analysis);
      if (data.analysis?.tips?.length) onNewTips(data.analysis.tips);
    } catch {
      setAnalysis({
        accuracy: 0, missing_words: [], incorrect_words: [],
        fluency: 'Error', confidence: 'Error', issues: [],
        tips: ['The AI service is temporarily unavailable. Please try again.'],
      });
    } finally {
      setLoading(false);
    }
  };

  const tryAgain = () => { setAnalysis(null); setPassageKey(k => k + 1); };

  return (
    <div className="space-y-5">
      {/* Category & Difficulty selectors */}
      <div className="flex flex-wrap gap-2 items-center">
        {PASSAGE_CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCategory(c.key)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${category === c.key
              ? 'bg-[#6C63FF]/20 text-[#8B83FF] border border-[#6C63FF]/40'
              : 'bg-slate-800/40 text-slate-400 border border-slate-700/30 hover:border-slate-600/50'}`}>
            {c.emoji} {c.label}
          </button>
        ))}
        <div className="h-5 w-px bg-slate-700/50 mx-1 hidden sm:block" />
        {['easy', 'medium', 'hard'].map(d => (
          <button key={d} onClick={() => setDifficulty(d)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium capitalize transition-all ${difficulty === d
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-800/40 text-slate-500 border border-slate-700/30 hover:border-slate-600/50'}`}>
            {d}
          </button>
        ))}
      </div>

      {/* Passage box */}
      <div className="relative p-6 rounded-2xl bg-gradient-to-br from-[#6C63FF]/8 to-violet-500/5 border border-[#6C63FF]/20">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-[#6C63FF]" />
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Read This Passage Aloud</span>
        </div>
        {generating ? (
          <div className="flex items-center gap-3 py-8 justify-center">
            <Loader2 className="w-5 h-5 text-[#6C63FF] animate-spin" />
            <span className="text-sm text-slate-400">Generating passage...</span>
          </div>
        ) : (
          <p className="text-lg sm:text-xl font-medium text-white leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto custom-scrollbar">
            {passage}
          </p>
        )}
        <div className="flex flex-wrap gap-3 mt-5">
          <button onClick={handleListen} disabled={generating || !passage}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all disabled:opacity-40
              ${isSpeaking
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-sky-500/10 text-sky-400 border-sky-500/25 hover:bg-sky-500/20'}`}>
            <Volume2 className="w-4 h-4" /> {isSpeaking ? 'Stop Listening' : 'Listen'}
          </button>
          <button onClick={generatePassage} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/30 text-slate-400 border border-slate-600/30 hover:bg-slate-700/50 transition-all text-sm font-medium disabled:opacity-40">
            <SkipForward className="w-4 h-4" /> New Passage
          </button>
        </div>
      </div>

      {/* Speech controller */}
      <SpeechController key={passageKey} onSubmit={handleSubmit} disabled={loading || generating} />

      {loading && <LoadingSpinner text="AI is analyzing your passage reading..." />}
      {analysis && <FeedbackCard analysis={analysis} type="sentence" onTryAgain={tryAgain} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 2: SPEAKING TIPS (DYNAMIC)
   ═══════════════════════════════════════════════════════════════ */

function TipsModule({ personalizedTips }: { personalizedTips: string[] }) {
  return (
    <div className="space-y-6">
      {/* Dynamic AI tips */}
      {personalizedTips.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">Your Personalized AI Tips</h3>
          </div>
          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/8 to-orange-500/5 border border-amber-500/20">
            <ul className="space-y-3">
              {personalizedTips.map((tip, i) => (
                <motion.li key={`${tip}-${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-2.5 text-sm text-slate-200">
                  <Star className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" /> {tip}
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}

      {/* Static tips */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-[#6C63FF]" />
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Essential Speaking Tips</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DEFAULT_TIPS.map((tip, i) => (
            <motion.div key={tip.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="group p-5 rounded-2xl bg-slate-800/40 border border-slate-700/40 hover:border-[#6C63FF]/30 hover:bg-slate-800/60 transition-all duration-300">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">{tip.icon}</span>
                <div>
                  <h4 className="font-bold text-white text-sm mb-1">{tip.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-2">{tip.desc}</p>
                  <p className="text-xs text-[#8B83FF] italic bg-[#6C63FF]/5 rounded-lg px-3 py-2 border border-[#6C63FF]/10">📌 {tip.example}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3: PRACTICE SPEAKING (AI TOPIC MODE)
   ═══════════════════════════════════════════════════════════════ */

function PracticeModule({ onNewTips }: { onNewTips: (tips: string[]) => void }) {
  const [topic, setTopic] = useState('');
  const [samplePassage, setSamplePassage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [topicKey, setTopicKey] = useState(0);

  useEffect(() => { generateTopic(); }, []);

  const generateTopic = async () => {
    setGenerating(true);
    setAnalysis(null);
    setShowSample(false);
    setTopicKey(k => k + 1);
    try {
      const data = await generateEnglishTopic();
      setTopic(data.topic);
      setSamplePassage(data.sample_passage);
    } catch {
      setTopic("Talk about your favorite subject and why you enjoy studying it.");
      setSamplePassage("My favorite subject is computer science because I enjoy solving problems with code. I find it fascinating how we can build applications that help people in their daily lives. Learning new programming languages and frameworks keeps me motivated. I believe technology is the future and I want to be part of that journey.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (spokenText: string) => {
    setLoading(true);
    setAnalysis(null);
    try {
      const data = await analyzeEnglishSpeaking({
        type: 'topic',
        original_text: topic,
        user_text: spokenText,
      });
      setAnalysis(data.analysis);
      if (data.analysis?.tips?.length) onNewTips(data.analysis.tips);
    } catch {
      setAnalysis({
        fluency: 'Error', vocabulary: 'Error', sentence_structure: 'Error',
        grammar: 'Error', confidence: 'Error', issues: [],
        tips: ['AI service temporarily unavailable. Please try again.'],
        improved_answer: spokenText,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Topic card */}
      <div className="relative p-6 rounded-2xl bg-gradient-to-br from-sky-500/8 to-indigo-500/5 border border-sky-500/20">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-sky-400" />
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Your Topic</span>
        </div>
        {generating ? (
          <div className="flex items-center gap-3 py-6 justify-center">
            <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
            <span className="text-sm text-slate-400">Generating topic...</span>
          </div>
        ) : (
          <p className="text-xl sm:text-2xl font-semibold text-white leading-relaxed">"{topic}"</p>
        )}
        <div className="flex flex-wrap gap-3 mt-4">
          <button onClick={generateTopic} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/25 hover:bg-sky-500/20 transition-all text-sm font-medium disabled:opacity-40">
            <RefreshCw className="w-4 h-4" /> New Topic
          </button>
          {samplePassage && (
            <button onClick={() => setShowSample(s => !s)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/25 hover:bg-violet-500/20 transition-all text-sm font-medium">
              <FileText className="w-4 h-4" /> {showSample ? 'Hide' : 'Show'} Sample Answer
            </button>
          )}
        </div>
      </div>

      {/* Sample passage */}
      <AnimatePresence>
        {showSample && samplePassage && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="p-5 rounded-2xl bg-violet-500/5 border border-violet-500/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Sample Answer (for reference)</p>
                <button onClick={() => speakText(samplePassage)} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5" /> Listen
                </button>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed italic">"{samplePassage}"</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SpeechController key={topicKey} onSubmit={handleSubmit} disabled={loading || generating} />
      {loading && <LoadingSpinner text="AI is evaluating your speech..." color="#38bdf8" />}
      {analysis && <FeedbackCard analysis={analysis} type="topic" onTryAgain={() => { setAnalysis(null); setTopicKey(k => k + 1); }} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4: INTERVIEW SIMULATION
   ═══════════════════════════════════════════════════════════════ */

function InterviewModule({ onNewTips }: { onNewTips: (tips: string[]) => void }) {
  const [questionIdx, setQuestionIdx] = useState(0);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [qKey, setQKey] = useState(0);

  const currentQuestion = INTERVIEW_QUESTIONS[questionIdx];

  const handleSubmit = async (spokenText: string) => {
    setLoading(true);
    setAnalysis(null);
    try {
      const data = await analyzeEnglishSpeaking({
        type: 'interview',
        original_text: currentQuestion,
        user_text: spokenText,
      });
      setAnalysis(data.analysis);
      if (data.analysis?.tips?.length) onNewTips(data.analysis.tips);
    } catch {
      setAnalysis({
        fluency: 'Error', vocabulary: 'Error', sentence_structure: 'Error',
        grammar: 'Error', confidence: 'Error', relevance: 'Error', issues: [],
        tips: ['AI service temporarily unavailable. Please try again.'],
        improved_answer: spokenText,
      });
    } finally {
      setLoading(false);
    }
  };

  const nextQuestion = () => {
    setQuestionIdx(i => (i + 1) % INTERVIEW_QUESTIONS.length);
    setAnalysis(null);
    setQKey(k => k + 1);
  };

  return (
    <div className="space-y-5">
      <div className="relative p-6 rounded-2xl bg-gradient-to-br from-rose-500/8 to-orange-500/5 border border-rose-500/20">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-bold uppercase border border-rose-500/25">HR Interview</span>
        </div>
        <p className="text-xl sm:text-2xl font-semibold text-white leading-relaxed">"{currentQuestion}"</p>
        <div className="flex gap-3 mt-4">
          <button onClick={() => speakText(currentQuestion)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 transition-all text-sm font-medium">
            <Volume2 className="w-4 h-4" /> Listen
          </button>
          <button onClick={nextQuestion}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/30 text-slate-400 border border-slate-600/30 hover:bg-slate-700/50 transition-all text-sm font-medium">
            <SkipForward className="w-4 h-4" /> Next Question
          </button>
        </div>
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-500 font-medium">
          {questionIdx + 1}/{INTERVIEW_QUESTIONS.length}
        </div>
      </div>

      <SpeechController key={qKey} onSubmit={handleSubmit} disabled={loading} />
      {loading && <LoadingSpinner text="AI is evaluating your response..." color="#fb7185" />}
      {analysis && <FeedbackCard analysis={analysis} type="interview" onTryAgain={() => { setAnalysis(null); setQKey(k => k + 1); }} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

type SectionId = 'read-speak' | 'tips' | 'practice' | 'interview';

const sections: { id: SectionId; label: string; icon: any; gradient: string; desc: string }[] = [
  { id: 'read-speak', label: 'Read & Speak', icon: BookOpen, gradient: 'from-[#6C63FF] to-violet-500', desc: 'Read AI-generated passages aloud & get accuracy feedback' },
  { id: 'tips', label: 'Speaking Tips', icon: Lightbulb, gradient: 'from-amber-500 to-orange-500', desc: 'Personalized + essential tips to improve your English' },
  { id: 'practice', label: 'Practice Speaking', icon: MessageSquare, gradient: 'from-sky-500 to-indigo-500', desc: 'Speak freely on AI topics & get detailed evaluation' },
  { id: 'interview', label: 'Interview Sim', icon: Users, gradient: 'from-rose-500 to-pink-500', desc: 'Practice HR interview questions with AI feedback' },
];

export default function EnglishSpeaking() {
  const [activeSection, setActiveSection] = useState<SectionId>('read-speak');
  const [personalizedTips, setPersonalizedTips] = useState<string[]>([]);

  // Collect tips from all modules; keep unique, max 10 most recent
  const addTips = useCallback((newTips: string[]) => {
    setPersonalizedTips(prev => {
      const combined = [...newTips, ...prev];
      const unique = Array.from(new Set(combined));
      return unique.slice(0, 10);
    });
  }, []);

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
              <Sparkles className="w-4 h-4 text-[#6C63FF]" />
              <span className="text-xs font-bold text-[#8B83FF] uppercase tracking-wider">AI English Coach</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-3">
              Speak English{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6C63FF] via-violet-400 to-purple-400">Fluently</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl leading-relaxed">
              Read AI-generated passages, practice on dynamic topics, and get personalized feedback for your placement interviews
            </p>
          </motion.div>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-3 mb-2">
            {sections.map(sec => (
              <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                className={`group relative flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all duration-300 text-sm font-semibold
                  ${activeSection === sec.id
                    ? `bg-gradient-to-r ${sec.gradient} text-white shadow-lg`
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/40 hover:border-slate-600/60 hover:text-slate-200'}`}>
                <sec.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{sec.label}</span>
                {sec.id === 'tips' && personalizedTips.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <motion.div key={activeSection} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-6">
          {sections.filter(s => s.id === activeSection).map(sec => (
            <div key={sec.id} className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${sec.gradient} flex items-center justify-center shadow-lg`}>
                <sec.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{sec.label}</h2>
                <p className="text-xs text-slate-500">{sec.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div key={activeSection} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            {activeSection === 'read-speak' && <ReadSpeakModule onNewTips={addTips} />}
            {activeSection === 'tips' && <TipsModule personalizedTips={personalizedTips} />}
            {activeSection === 'practice' && <PracticeModule onNewTips={addTips} />}
            {activeSection === 'interview' && <InterviewModule onNewTips={addTips} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
