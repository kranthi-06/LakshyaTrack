import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Volume2, SkipForward, RotateCcw, Send,
  Lightbulb, MessageSquare, Users, ChevronRight,
  CheckCircle2, AlertCircle, Sparkles, BookOpen,
  Award, TrendingUp, Play, Square, RefreshCw, X
} from 'lucide-react';
import api from '../services/api';

/* ═══════════════════════════════════════════════════════════════
   SAMPLE DATA
   ═══════════════════════════════════════════════════════════════ */

const PRACTICE_SENTENCES = [
  "I am preparing for my placement interview.",
  "Good communication skills are essential for professional success.",
  "I have experience working on team projects during my college.",
  "My strongest skill is problem solving and analytical thinking.",
  "I am confident that I can contribute to your organization.",
  "I have completed an internship in software development.",
  "Team work and collaboration are my core strengths.",
  "I am a quick learner and adapt to new technologies easily.",
  "I believe continuous learning is important for career growth.",
  "I enjoy solving complex problems and building efficient solutions.",
  "Effective communication helps build strong professional relationships.",
  "I have developed several projects using modern technologies.",
];

const SPEAKING_TIPS = [
  {
    title: "Think in English",
    desc: "Don't translate from your native language. Try to form thoughts directly in English.",
    example: 'Instead of translating "मुझे यह पसंद है", think "I like this" directly.',
    icon: "💭",
  },
  {
    title: "Use Simple Sentences",
    desc: "Start with short, clear sentences. Complex sentences can come later.",
    example: '"I work hard." is better than a long, broken sentence.',
    icon: "✏️",
  },
  {
    title: "Speak Slowly & Clearly",
    desc: "Speed doesn't equal fluency. Pace yourself and pronounce each word.",
    example: "Pause between sentences. Take a breath before responding.",
    icon: "🐢",
  },
  {
    title: "Use Connectors",
    desc: 'Link your ideas with words like "and", "because", "however", "therefore".',
    example: '"I like coding because it is creative and challenging."',
    icon: "🔗",
  },
  {
    title: "Practice Daily",
    desc: "Even 10 minutes of daily practice makes a huge difference over time.",
    example: "Read one paragraph aloud every morning. Record yourself.",
    icon: "📅",
  },
  {
    title: "Listen Actively",
    desc: "Watch English videos, podcasts, or news to improve natural pronunciation.",
    example: "Try shadowing — repeat what the speaker says immediately after them.",
    icon: "👂",
  },
  {
    title: "Don't Fear Mistakes",
    desc: "Every mistake is a learning opportunity. Confidence comes from practice.",
    example: "Even native speakers make errors. Focus on being understood.",
    icon: "💪",
  },
];

const PRACTICE_TOPICS = [
  "Talk about your favorite subject and why you enjoy it.",
  "Describe your daily routine in detail.",
  "Explain your final year project.",
  "What motivates you to work hard every day?",
  "Describe a challenge you overcame in college.",
  "Talk about a skill you recently learned.",
  "Describe your ideal work environment.",
  "What do you do in your free time?",
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
   SPEECH UTILITIES
   ═══════════════════════════════════════════════════════════════ */

function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser. Please use Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(final.trim());
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript('');
    setInterimTranscript('');
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
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
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

// ── Reusable Feedback Card ──────────────────────────────────────
function FeedbackCard({ analysis, type, onTryAgain }: {
  analysis: any;
  type: 'sentence' | 'topic' | 'interview';
  onTryAgain: () => void;
}) {
  if (!analysis) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getLevelColor = (level: string) => {
    const l = (level || '').toLowerCase();
    if (l.includes('excellent') || l.includes('high') || l.includes('advanced')) return 'text-emerald-400';
    if (l.includes('good') || l.includes('medium') || l.includes('intermediate')) return 'text-sky-400';
    if (l.includes('average') || l.includes('basic')) return 'text-amber-400';
    return 'text-red-400';
  };

  const getBadgeColor = (level: string) => {
    const l = (level || '').toLowerCase();
    if (l.includes('excellent') || l.includes('high') || l.includes('advanced')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (l.includes('good') || l.includes('medium') || l.includes('intermediate') || l.includes('relevant')) return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    if (l.includes('average') || l.includes('basic') || l.includes('partial')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-red-500/15 text-red-400 border-red-500/30';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-[#6C63FF]/10 to-violet-500/10 border-b border-slate-700/50">
        <h4 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#6C63FF]" />
          AI Analysis Results
        </h4>
      </div>

      <div className="p-6 space-y-5">
        {/* Sentence mode: Accuracy score */}
        {type === 'sentence' && analysis.accuracy !== undefined && (
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-700" />
                <circle
                  cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                  stroke="url(#scoreGrad)"
                  strokeLinecap="round"
                  strokeDasharray={`${(analysis.accuracy / 100) * 264} 264`}
                />
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6C63FF" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-extrabold ${getScoreColor(analysis.accuracy)}`}>
                  {analysis.accuracy}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-400">Accuracy Score</p>
              <p className={`text-lg font-bold ${getScoreColor(analysis.accuracy)}`}>
                {analysis.accuracy >= 90 ? 'Excellent!' : analysis.accuracy >= 70 ? 'Good job!' : 'Keep practicing!'}
              </p>
              {analysis.fluency && (
                <span className={`inline-block mt-1 text-xs px-3 py-1 rounded-full border ${getBadgeColor(analysis.fluency)}`}>
                  Fluency: {analysis.fluency}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Topic / Interview mode: Metric badges */}
        {(type === 'topic' || type === 'interview') && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Fluency', value: analysis.fluency },
              { label: 'Vocabulary', value: analysis.vocabulary },
              { label: 'Structure', value: analysis.sentence_structure },
              { label: 'Grammar', value: analysis.grammar },
              { label: 'Confidence', value: analysis.confidence },
              ...(type === 'interview' && analysis.relevance ? [{ label: 'Relevance', value: analysis.relevance }] : []),
            ].filter(m => m.value).map((metric) => (
              <div key={metric.label} className="rounded-xl bg-slate-900/50 border border-slate-700/50 p-3 text-center">
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{metric.label}</p>
                <p className={`text-sm font-bold ${getLevelColor(metric.value)}`}>{metric.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Missing words */}
        {analysis.missing_words?.length > 0 && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
            <p className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Missing Words
            </p>
            <div className="flex flex-wrap gap-2">
              {analysis.missing_words.map((word: string, i: number) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 text-sm font-medium border border-red-500/25">
                  {word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Incorrect words */}
        {analysis.incorrect_words?.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <p className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Incorrect / Extra Words
            </p>
            <div className="flex flex-wrap gap-2">
              {analysis.incorrect_words.map((word: string, i: number) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-sm font-medium border border-amber-500/25">
                  {word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {analysis.tips?.length > 0 && (
          <div className="p-4 rounded-xl bg-[#6C63FF]/5 border border-[#6C63FF]/20">
            <p className="text-sm font-semibold text-[#8B83FF] mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" /> Tips for Improvement
            </p>
            <ul className="space-y-2">
              {analysis.tips.map((tip: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <ChevronRight className="w-4 h-4 text-[#6C63FF] mt-0.5 flex-shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improved answer */}
        {analysis.improved_answer && (
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Improved Version
            </p>
            <p className="text-sm text-slate-300 leading-relaxed italic">
              "{analysis.improved_answer}"
            </p>
            <button
              onClick={() => speakText(analysis.improved_answer)}
              className="mt-3 flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" /> Listen to improved version
            </button>
          </div>
        )}

        {/* Try Again */}
        <button
          onClick={onTryAgain}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6C63FF] to-violet-500 text-white font-semibold
            hover:shadow-lg hover:shadow-[#6C63FF]/25 transition-all duration-300 flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" /> Try Again
        </button>
      </div>
    </motion.div>
  );
}

// ── Speech Controller ───────────────────────────────────────────
function SpeechController({ onSubmit, disabled }: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}) {
  const { isListening, transcript, interimTranscript, startListening, stopListening, resetTranscript } = useSpeechRecognition();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (transcript.trim()) {
      onSubmit(transcript.trim());
      setSubmitted(true);
    }
  };

  const handleReset = () => {
    resetTranscript();
    setSubmitted(false);
  };

  return (
    <div className="space-y-4">
      {/* Live transcript display */}
      <div className="min-h-[80px] rounded-xl bg-slate-900/60 border border-slate-700/50 p-4">
        {transcript || interimTranscript ? (
          <p className="text-slate-200 text-sm leading-relaxed">
            {transcript}
            {interimTranscript && (
              <span className="text-slate-500 italic"> {interimTranscript}</span>
            )}
          </p>
        ) : (
          <p className="text-slate-500 text-sm italic">
            {isListening ? 'Listening... Start speaking now' : 'Click "Start Speaking" to begin'}
          </p>
        )}
      </div>

      {/* Waveform animation when listening */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-center gap-1 py-2"
          >
            {[...Array(16)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1 rounded-full bg-gradient-to-t from-[#6C63FF] to-violet-400"
                animate={{
                  height: [8, Math.random() * 28 + 8, 8],
                }}
                transition={{
                  duration: 0.6 + Math.random() * 0.4,
                  repeat: Infinity,
                  delay: i * 0.05,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        {!isListening ? (
          <button
            onClick={startListening}
            disabled={disabled || submitted}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30
              hover:bg-emerald-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
          >
            <Mic className="w-4 h-4" /> Start Speaking
          </button>
        ) : (
          <button
            onClick={stopListening}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30
              hover:bg-red-500/25 transition-all font-medium text-sm animate-pulse"
          >
            <Square className="w-4 h-4" /> Stop
          </button>
        )}

        <button
          onClick={handleSubmit}
          disabled={!transcript.trim() || disabled || submitted}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6C63FF]/15 text-[#8B83FF] border border-[#6C63FF]/30
            hover:bg-[#6C63FF]/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
        >
          <Send className="w-4 h-4" /> Submit
        </button>

        <button
          onClick={handleReset}
          disabled={isListening}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700/30 text-slate-400 border border-slate-600/30
            hover:bg-slate-700/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Reset
        </button>
      </div>
    </div>
  );
}

// ── SECTION 1: Read & Speak ─────────────────────────────────────
function ReadSpeakModule() {
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const currentSentence = PRACTICE_SENTENCES[sentenceIdx];

  const handleSubmit = async (spokenText: string) => {
    setLoading(true);
    setAnalysis(null);
    try {
      const { data } = await api.post('/english/analyze-speaking', {
        type: 'sentence',
        original_text: currentSentence,
        user_text: spokenText,
      });
      setAnalysis(data.analysis);
    } catch (err) {
      console.error('Analysis failed:', err);
      setAnalysis({
        accuracy: 0,
        missing_words: [],
        incorrect_words: [],
        fluency: 'Error',
        tips: ['The AI service is temporarily unavailable. Please try again.'],
      });
    } finally {
      setLoading(false);
    }
  };

  const nextSentence = () => {
    setSentenceIdx((prev) => (prev + 1) % PRACTICE_SENTENCES.length);
    setAnalysis(null);
  };

  const tryAgain = () => {
    setAnalysis(null);
  };

  return (
    <div className="space-y-5">
      {/* Sentence display */}
      <div className="relative p-6 rounded-2xl bg-gradient-to-br from-[#6C63FF]/8 to-violet-500/5 border border-[#6C63FF]/20">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-semibold">Read This Sentence</p>
        <p className="text-xl sm:text-2xl font-semibold text-white leading-relaxed">
          "{currentSentence}"
        </p>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => speakText(currentSentence)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/25
              hover:bg-sky-500/20 transition-all text-sm font-medium"
          >
            <Volume2 className="w-4 h-4" /> Listen
          </button>
          <button
            onClick={nextSentence}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/30 text-slate-400 border border-slate-600/30
              hover:bg-slate-700/50 transition-all text-sm font-medium"
          >
            <SkipForward className="w-4 h-4" /> Next
          </button>
        </div>
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-500 font-medium">
          {sentenceIdx + 1}/{PRACTICE_SENTENCES.length}
        </div>
      </div>

      {/* Speech controller */}
      <SpeechController onSubmit={handleSubmit} disabled={loading} />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full"
          />
          <span className="text-sm text-slate-400">Analyzing your speech...</span>
        </div>
      )}

      {/* Analysis results */}
      {analysis && (
        <FeedbackCard analysis={analysis} type="sentence" onTryAgain={tryAgain} />
      )}
    </div>
  );
}

// ── SECTION 2: Speaking Tips ────────────────────────────────────
function TipsModule() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {SPEAKING_TIPS.map((tip, i) => (
        <motion.div
          key={tip.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="group p-5 rounded-2xl bg-slate-800/40 border border-slate-700/40 hover:border-[#6C63FF]/30
            hover:bg-slate-800/60 transition-all duration-300"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0 mt-0.5">{tip.icon}</span>
            <div>
              <h4 className="font-bold text-white text-sm mb-1">{tip.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-2">{tip.desc}</p>
              <p className="text-xs text-[#8B83FF] italic bg-[#6C63FF]/5 rounded-lg px-3 py-2 border border-[#6C63FF]/10">
                📌 {tip.example}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── SECTION 3: Practice Speaking ────────────────────────────────
function PracticeModule() {
  const [topicIdx, setTopicIdx] = useState(0);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const currentTopic = PRACTICE_TOPICS[topicIdx];

  const handleSubmit = async (spokenText: string) => {
    setLoading(true);
    setAnalysis(null);
    try {
      const { data } = await api.post('/english/analyze-speaking', {
        type: 'topic',
        user_text: spokenText,
      });
      setAnalysis(data.analysis);
    } catch (err) {
      console.error('Analysis failed:', err);
      setAnalysis({
        fluency: 'Error',
        vocabulary: 'Error',
        sentence_structure: 'Error',
        grammar: 'Error',
        confidence: 'Error',
        tips: ['The AI service is temporarily unavailable. Please try again.'],
        improved_answer: spokenText,
      });
    } finally {
      setLoading(false);
    }
  };

  const nextTopic = () => {
    setTopicIdx((prev) => (prev + 1) % PRACTICE_TOPICS.length);
    setAnalysis(null);
  };

  return (
    <div className="space-y-5">
      <div className="relative p-6 rounded-2xl bg-gradient-to-br from-sky-500/8 to-indigo-500/5 border border-sky-500/20">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-semibold">Your Topic</p>
        <p className="text-xl sm:text-2xl font-semibold text-white leading-relaxed">
          "{currentTopic}"
        </p>
        <div className="flex gap-3 mt-4">
          <button
            onClick={nextTopic}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/25
              hover:bg-sky-500/20 transition-all text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" /> Try Another Topic
          </button>
        </div>
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-500 font-medium">
          {topicIdx + 1}/{PRACTICE_TOPICS.length}
        </div>
      </div>

      <SpeechController onSubmit={handleSubmit} disabled={loading} />

      {loading && (
        <div className="flex items-center justify-center gap-3 py-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full"
          />
          <span className="text-sm text-slate-400">AI is evaluating your speech...</span>
        </div>
      )}

      {analysis && (
        <FeedbackCard analysis={analysis} type="topic" onTryAgain={() => setAnalysis(null)} />
      )}
    </div>
  );
}

// ── SECTION 4: Interview Simulation ─────────────────────────────
function InterviewModule() {
  const [questionIdx, setQuestionIdx] = useState(0);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const currentQuestion = INTERVIEW_QUESTIONS[questionIdx];

  const handleSubmit = async (spokenText: string) => {
    setLoading(true);
    setAnalysis(null);
    try {
      const { data } = await api.post('/english/analyze-speaking', {
        type: 'interview',
        original_text: currentQuestion,
        user_text: spokenText,
      });
      setAnalysis(data.analysis);
    } catch (err) {
      console.error('Analysis failed:', err);
      setAnalysis({
        fluency: 'Error',
        vocabulary: 'Error',
        sentence_structure: 'Error',
        grammar: 'Error',
        confidence: 'Error',
        relevance: 'Error',
        tips: ['The AI service is temporarily unavailable. Please try again.'],
        improved_answer: spokenText,
      });
    } finally {
      setLoading(false);
    }
  };

  const nextQuestion = () => {
    setQuestionIdx((prev) => (prev + 1) % INTERVIEW_QUESTIONS.length);
    setAnalysis(null);
  };

  return (
    <div className="space-y-5">
      <div className="relative p-6 rounded-2xl bg-gradient-to-br from-rose-500/8 to-orange-500/5 border border-rose-500/20">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-bold uppercase border border-rose-500/25">
            HR Interview
          </span>
        </div>
        <p className="text-xl sm:text-2xl font-semibold text-white leading-relaxed">
          "{currentQuestion}"
        </p>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => speakText(currentQuestion)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/25
              hover:bg-rose-500/20 transition-all text-sm font-medium"
          >
            <Volume2 className="w-4 h-4" /> Listen
          </button>
          <button
            onClick={nextQuestion}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/30 text-slate-400 border border-slate-600/30
              hover:bg-slate-700/50 transition-all text-sm font-medium"
          >
            <SkipForward className="w-4 h-4" /> Next Question
          </button>
        </div>
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-500 font-medium">
          {questionIdx + 1}/{INTERVIEW_QUESTIONS.length}
        </div>
      </div>

      <SpeechController onSubmit={handleSubmit} disabled={loading} />

      {loading && (
        <div className="flex items-center justify-center gap-3 py-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-6 h-6 border-2 border-rose-400 border-t-transparent rounded-full"
          />
          <span className="text-sm text-slate-400">AI is evaluating your response...</span>
        </div>
      )}

      {analysis && (
        <FeedbackCard analysis={analysis} type="interview" onTryAgain={() => setAnalysis(null)} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

type SectionId = 'read-speak' | 'tips' | 'practice' | 'interview';

const sections: { id: SectionId; label: string; icon: any; gradient: string; desc: string }[] = [
  { id: 'read-speak', label: 'Read & Speak', icon: BookOpen, gradient: 'from-[#6C63FF] to-violet-500', desc: 'Read sentences aloud & get AI accuracy feedback' },
  { id: 'tips', label: 'Speaking Tips', icon: Lightbulb, gradient: 'from-amber-500 to-orange-500', desc: 'Essential tips to improve your English speaking' },
  { id: 'practice', label: 'Practice Speaking', icon: MessageSquare, gradient: 'from-sky-500 to-indigo-500', desc: 'Speak freely on topics & get AI evaluation' },
  { id: 'interview', label: 'Interview Sim', icon: Users, gradient: 'from-rose-500 to-pink-500', desc: 'Practice HR interview questions with AI feedback' },
];

export default function EnglishSpeaking() {
  const [activeSection, setActiveSection] = useState<SectionId>('read-speak');

  return (
    <div className="min-h-screen bg-[#060611]">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#6C63FF]/8 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#6C63FF]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#6C63FF]/10 border border-[#6C63FF]/20 mb-4">
              <Sparkles className="w-4 h-4 text-[#6C63FF]" />
              <span className="text-xs font-bold text-[#8B83FF] uppercase tracking-wider">AI English Coach</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-3">
              Speak English{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6C63FF] via-violet-400 to-purple-400">
                Fluently
              </span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl leading-relaxed">
              Practice speaking, get real-time AI feedback, and become confident for your placement interviews
            </p>
          </motion.div>

          {/* ── Section Tabs ── */}
          <div className="flex flex-wrap justify-center gap-3 mb-2">
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`group relative flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all duration-300 text-sm font-semibold
                  ${activeSection === sec.id
                    ? `bg-gradient-to-r ${sec.gradient} text-white shadow-lg shadow-${sec.gradient.split('-')[1]}/20`
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/40 hover:border-slate-600/60 hover:text-slate-200'
                  }`}
              >
                <sec.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{sec.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        {/* Active section header */}
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          {sections.filter(s => s.id === activeSection).map((sec) => (
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

        {/* Section content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeSection === 'read-speak' && <ReadSpeakModule />}
            {activeSection === 'tips' && <TipsModule />}
            {activeSection === 'practice' && <PracticeModule />}
            {activeSection === 'interview' && <InterviewModule />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
