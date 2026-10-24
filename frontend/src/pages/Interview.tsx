import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowRight, BrainCircuit, CheckCircle2, ChevronDown, Clock3, FileText, Headphones, Loader2, Mic2, Radio, ShieldCheck, Sparkles, Wifi, X } from 'lucide-react';
import CodingEnvironment from '../components/CodingEnvironment';
import InterviewControls from '../components/InterviewControls';
import InterviewWebcam from '../components/InterviewWebcam';
import LiveTranscription, { type TranscriptLine } from '../components/LiveTranscription';
import { useAudioManager } from '../hooks/useAudioManager';
import { useFeatureGate } from '../hooks/useFeatureGate';
import { getSavedResumes } from '../services/resumeStorage';
import { createMultistageSession, evaluateInterviewStage, getCodingProblem, getHRQuestion, getMultistageFinalAnalysis, getScreeningQuestion, getTechnicalQuestion, saveProgressSnapshot } from '../services/careerPlatform';
import { trackCodeExecuted, trackInterviewCompleted, trackProblemSolved } from '../progress-system/services/eventTracker';
import { useUsage } from '../context/UsageContext';
import { extractLimitExceededError } from '../services/api';

type RoomPhase = 'lobby' | 'connecting' | 'room' | 'coding' | 'report';
type StageId = 'screening' | 'technical' | 'coding' | 'hr';
type InterviewType = 'resume_screening' | 'direct_skill';
interface Answer { question: string; answer: string }
interface StageEvaluation { score: number; feedback: string; strengths: string[]; weaknesses: string[]; [key: string]: unknown }
interface CodingProblem { title: string; description: string; difficulty?: string; examples?: { input: string; output: string; explanation?: string }[]; constraints?: string[]; hints?: string[]; test_cases?: { input: string; expected_output: string; is_hidden?: boolean }[]; starter_code?: Record<string, string> }
interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface RecognitionInstance { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: RecognitionEvent) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }
interface RecognitionConstructor { new(): RecognitionInstance }
type SpeechRecognitionWindow = Window & typeof globalThis & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };

const STAGES: { id: StageId; label: string; detail: string; questions: number }[] = [
    { id: 'screening', label: 'Background', detail: 'Resume & experience', questions: 2 },
    { id: 'technical', label: 'Technical', detail: 'Role knowledge', questions: 3 },
    { id: 'coding', label: 'Problem solving', detail: 'Secure code challenge', questions: 1 },
    { id: 'hr', label: 'Conversation', detail: 'Working style', questions: 2 },
];

const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === 'object' && error && 'response' in error) {
        const response = (error as { response?: { data?: { detail?: unknown } } }).response;
        if (typeof response?.data?.detail === 'string') return response.data.detail;
    }
    return fallback;
};

export default function Interview() {
    const { isLocked, guardAction } = useFeatureGate('interview_start', 'AI Interview Simulator', 2, 'Practice in a voice-first interview room with your AI interviewer.');
    const { refreshUsage } = useUsage();
    const audio = useAudioManager();
    const [phase, setPhase] = useState<RoomPhase>('lobby');
    const [position, setPosition] = useState('Software Engineer');
    const [interviewType, setInterviewType] = useState<InterviewType>('resume_screening');
    const [experience, setExperience] = useState('Intermediate');
    const [duration, setDuration] = useState('30');
    const [jobDescription, setJobDescription] = useState('');
    const [resumeName, setResumeName] = useState('No saved resume selected');
    const [resumeSummary, setResumeSummary] = useState('');
    const [skills, setSkills] = useState<string[]>([]);
    const [projects, setProjects] = useState<string[]>([]);
    const [sessionId, setSessionId] = useState('');
    const [stageIndex, setStageIndex] = useState(0);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [question, setQuestion] = useState('');
    const [answers, setAnswers] = useState<Answer[]>([]);
    const [evaluations, setEvaluations] = useState<Record<string, StageEvaluation>>({});
    const [codingProblem, setCodingProblem] = useState<CodingProblem | null>(null);
    const [codingResult, setCodingResult] = useState({ code: '', language: 'python', passed: 0, total: 0, attempts: 0 });
    const [report, setReport] = useState<Record<string, unknown> | null>(null);
    const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
    const [interim, setInterim] = useState('');
    const [captionsOpen, setCaptionsOpen] = useState(true);
    const [cameraOn, setCameraOn] = useState(false);
    const [listening, setListening] = useState(false);
    const [paused, setPaused] = useState(false);
    const [showTextInput, setShowTextInput] = useState(false);
    const [typedAnswer, setTypedAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const [micTested, setMicTested] = useState(false);
    const [endConfirmation, setEndConfirmation] = useState(false);
    const [limitMessage, setLimitMessage] = useState('');
    const recognitionRef = useRef<RecognitionInstance | null>(null);
    const answerRef = useRef('');
    const discardRecognitionRef = useRef(false);
    const spokenQuestionRef = useRef('');
    const stage = STAGES[stageIndex];
    const speechRecognitionSupported = typeof window !== 'undefined' && Boolean((window as SpeechRecognitionWindow).SpeechRecognition || (window as SpeechRecognitionWindow).webkitSpeechRecognition);
    const voiceReady = audio.speechSupported && speechRecognitionSupported;

    useEffect(() => {
        const loadResume = async () => {
            try {
                const response = await getSavedResumes();
                const resume = response.resumes.find((item) => item.is_primary) || response.resumes[0];
                if (!resume) return;
                setResumeName(resume.resume_name);
                const data = resume.resume_data as { personalInfo?: { summary?: string }; skills?: { categories?: { items?: Array<string | { name?: string }> }[] }; projects?: { title?: string; name?: string }[] };
                setResumeSummary(data.personalInfo?.summary || '');
                setSkills(data.skills?.categories?.flatMap((category) => (category.items || []).map((item) => typeof item === 'string' ? item : item.name || '').filter(Boolean)) || []);
                setProjects((data.projects || []).map((project) => project.title || project.name || '').filter(Boolean));
            } catch { /* resume context is optional */ }
        };
        void loadResume();
    }, []);

    useEffect(() => {
        if (phase !== 'room' && phase !== 'coding') return;
        const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
        return () => window.clearInterval(timer);
    }, [phase]);

    const stopListening = useCallback((discard = false) => {
        discardRecognitionRef.current = discard;
        recognitionRef.current?.stop();
        recognitionRef.current = null;
        setListening(false);
        setInterim('');
    }, []);
    const addCaption = useCallback((speaker: TranscriptLine['speaker'], text: string) => setTranscript((items) => [...items, { id: `${Date.now()}-${Math.random()}`, speaker, text }]), []);

    const getNextQuestion = useCallback(async (targetStage: StageId, history: Answer[], activeSessionId: string) => {
        setLoading(true); setError('');
        try {
            let response: { question?: string };
            const candidateContext = jobDescription.trim()
                ? `${resumeSummary}\n\nTarget job description:\n${jobDescription.slice(0, 8000)}`
                : resumeSummary;
            if (targetStage === 'screening') response = await getScreeningQuestion(activeSessionId, candidateContext, skills, projects, history);
            else if (targetStage === 'technical') response = await getTechnicalQuestion(activeSessionId, skills, history);
            else response = await getHRQuestion(activeSessionId, history);
            if (!response.question?.trim()) throw new Error('The AI provider returned an empty question.');
            setQuestion(response.question); addCaption('interviewer', response.question); spokenQuestionRef.current = '';
        } catch (requestError) { setError(getErrorMessage(requestError, 'The interviewer could not create a question. Your progress is safe; please retry.')); }
        finally { setLoading(false); }
    }, [addCaption, jobDescription, projects, resumeSummary, skills]);

    const submitAnswer = useCallback(async (rawAnswer: string) => {
        const answer = rawAnswer.trim();
        if (!answer || loading || !question || paused) return;
        stopListening(true); audio.stopSpeech(); setTypedAnswer(''); addCaption('candidate', answer);
        const nextAnswers = [...answers, { question, answer }]; setAnswers(nextAnswers);
        if (questionIndex + 1 < stage.questions) { setQuestionIndex((value) => value + 1); await getNextQuestion(stage.id, nextAnswers, sessionId); return; }
        setLoading(true); setError('');
        try {
            const payload: Parameters<typeof evaluateInterviewStage>[2] = { responses: nextAnswers };
            if (stage.id === 'screening') payload.resume_summary = resumeSummary;
            if (stage.id === 'technical') payload.skills = skills;
            const response = await evaluateInterviewStage(sessionId, stage.id, payload);
            const nextEvaluations = { ...evaluations, [stage.id]: response.evaluation as StageEvaluation };
            setEvaluations(nextEvaluations);
            const nextIndex = stageIndex + 1;
            if (nextIndex === 2) {
                setStageIndex(nextIndex); setPhase('coding');
                const coding = await getCodingProblem(sessionId, skills, experience.toLowerCase());
                if (!coding.problem) throw new Error('The AI provider returned an empty coding problem.');
                setCodingProblem(coding.problem as CodingProblem);
            } else if (nextIndex >= STAGES.length) {
                const final = await getMultistageFinalAnalysis(sessionId, nextEvaluations.screening || {}, nextEvaluations.technical || {}, nextEvaluations.coding || {}, nextEvaluations.hr || {});
                const analysis = final.analysis as Record<string, unknown>;
                setReport(analysis);
                setPhase('report');
                trackInterviewCompleted(position, typeof analysis.overall_score === 'number' ? analysis.overall_score : undefined);
                try { await saveProgressSnapshot(0); } catch { /* report persistence succeeded; a snapshot retry can happen later */ }
            } else { setStageIndex(nextIndex); setQuestionIndex(0); setAnswers([]); await getNextQuestion(STAGES[nextIndex].id, [], sessionId); }
        } catch (requestError) { setError(getErrorMessage(requestError, 'We could not save this stage. Please retry; it has not been marked complete.')); }
        finally { setLoading(false); }
    }, [addCaption, answers, audio, evaluations, experience, getNextQuestion, loading, paused, position, question, questionIndex, resumeSummary, sessionId, skills, stage, stageIndex, stopListening]);

    const beginListening = useCallback(() => {
        if (paused || loading || !voiceReady) { if (!voiceReady) setShowTextInput(true); return; }
        audio.stopSpeech(); stopListening(true);
        const Recognition = (window as SpeechRecognitionWindow).SpeechRecognition || (window as SpeechRecognitionWindow).webkitSpeechRecognition;
        if (!Recognition) return;
        const recognition = new Recognition(); recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'en-US'; answerRef.current = '';
        recognition.onresult = (event: RecognitionEvent) => {
            let finalText = ''; let partial = '';
            for (let index = event.resultIndex; index < event.results.length; index += 1) { const text = event.results[index][0].transcript; if (event.results[index].isFinal) finalText += `${text} `; else partial += text; }
            if (finalText) answerRef.current = `${answerRef.current} ${finalText}`.trim();
            setInterim(`${answerRef.current}${partial ? ` ${partial}` : ''}`.trim());
        };
        recognition.onerror = (event: { error: string }) => { setListening(false); if (event.error !== 'aborted' && event.error !== 'no-speech') setError(`Speech recognition failed (${event.error}). Use text compatibility mode or try again.`); };
        recognition.onend = () => { const discard = discardRecognitionRef.current; discardRecognitionRef.current = false; setListening(false); setInterim(''); const spoken = answerRef.current.trim(); answerRef.current = ''; if (spoken && !discard) void submitAnswer(spoken); };
        recognitionRef.current = recognition; recognition.start(); setListening(true);
    }, [audio, loading, paused, stopListening, submitAnswer, voiceReady]);

    const askQuestionAloud = useCallback((startAfter = false) => {
        if (!question || paused) return;
        if (!audio.speechSupported) { setShowTextInput(true); return; }
        stopListening(true); audio.speak(question, { onEnd: startAfter && voiceReady ? beginListening : undefined, onError: () => setError('Speech playback failed. You can read the question and answer aloud or use text compatibility mode.') });
    }, [audio, beginListening, paused, question, stopListening, voiceReady]);

    useEffect(() => {
        if (phase === 'room' && question && question !== spokenQuestionRef.current && !loading && !paused) {
            spokenQuestionRef.current = question;
            const timer = window.setTimeout(() => askQuestionAloud(true), 250);
            return () => window.clearTimeout(timer);
        }
    }, [askQuestionAloud, loading, paused, phase, question]);
    useEffect(() => () => stopListening(true), [stopListening]);

    const startInterview = async () => {
        await guardAction(async () => {
            setPhase('connecting'); setError(''); setLimitMessage('');
            try {
                const session = await createMultistageSession(position.trim(), interviewType, experience.toLowerCase()); await refreshUsage();
                setSessionId(session.id); setStageIndex(0); setQuestionIndex(0); setAnswers([]); setEvaluations({}); setTranscript([]); setElapsed(0); setPhase('room');
                await getNextQuestion('screening', [], session.id);
            } catch (requestError) { const limit = extractLimitExceededError(requestError); setLimitMessage(limit?.message || getErrorMessage(requestError, 'Unable to start an interview right now.')); setPhase('lobby'); }
        });
    };
    const finishCoding = async () => {
        if (!codingProblem) return;
        setLoading(true);
        try {
            const result = await evaluateInterviewStage(sessionId, 'coding', { code: codingResult.code, language: codingResult.language, problem: codingProblem, passed_tests: codingResult.passed, total_tests: codingResult.total, attempts: codingResult.attempts, responses: [{ question: codingProblem.title, answer: codingResult.code }] });
            setEvaluations((current) => ({ ...current, coding: result.evaluation as StageEvaluation })); setStageIndex(3); setQuestionIndex(0); setAnswers([]); setPhase('room'); await getNextQuestion('hr', [], sessionId);
        } catch (requestError) { setError(getErrorMessage(requestError, 'The code review could not be saved. Please retry.')); }
        finally { setLoading(false); }
    };
    const finishInterview = async () => {
        setLoading(true); setError('');
        try {
            const result = await getMultistageFinalAnalysis(sessionId, evaluations.screening || {}, evaluations.technical || {}, evaluations.coding || {}, evaluations.hr || {});
            const analysis = result.analysis as Record<string, unknown>; setReport(analysis); setPhase('report'); trackInterviewCompleted(position, typeof analysis.overall_score === 'number' ? analysis.overall_score : undefined);
            try { await saveProgressSnapshot(0); } catch { /* report persistence succeeded; a snapshot retry can happen later */ }
        } catch (requestError) { setError(getErrorMessage(requestError, 'Your interview is complete, but the report could not be generated. Please retry.')); }
        finally { setLoading(false); }
    };
    const handlePause = () => { if (paused) { setPaused(false); if (audio.speechState === 'paused') audio.toggleSpeechPause(); } else { setPaused(true); stopListening(true); if (audio.speechState === 'speaking') audio.toggleSpeechPause(); } };
    const endInterview = () => { if (!endConfirmation) { setEndConfirmation(true); return; } audio.stopSpeech(); stopListening(true); setCameraOn(false); setPhase('lobby'); setEndConfirmation(false); setError('The interview was ended before completion. It will not count toward progress or badges.'); };

    if (phase === 'lobby' || phase === 'connecting') return <Lobby {...{ position, setPosition, interviewType, setInterviewType, experience, setExperience, duration, setDuration, jobDescription, setJobDescription, resumeName, micTested, setMicTested, audio, speechRecognitionSupported, isLocked, phase, startInterview, limitMessage, error }} />;
    if (phase === 'coding') return <main className="min-h-screen bg-slate-950 px-3 py-4 sm:px-6"><header className="mx-auto mb-4 flex max-w-[1400px] items-center justify-between text-slate-100"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Stage 3 of 4</p><h1 className="text-xl font-semibold">Problem-solving assessment</h1></div><span className="flex items-center gap-2 text-sm text-slate-400"><Clock3 className="h-4 w-4" />{formatTime(elapsed)}</span></header>{error && <p className="mx-auto mb-3 max-w-[1400px] rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">{error}</p>}{codingProblem ? <CodingEnvironment problem={codingProblem} onSubmitSolution={(code, language, passed, total, attempts) => { setCodingResult({ code, language, passed, total, attempts }); trackCodeExecuted(language); if (total > 0 && passed === total) trackProblemSolved(codingProblem.title, codingProblem.difficulty === 'easy' ? 'easy' : codingProblem.difficulty === 'hard' ? 'hard' : 'medium', skills[0] || position, language); }} onFinish={() => void finishCoding()} /> : <div className="grid min-h-80 place-items-center text-slate-300"><Loader2 className="h-7 w-7 animate-spin" /></div>}</main>;
    if (phase === 'report') return <Report report={report} transcript={transcript} onRestart={() => { setPhase('lobby'); setReport(null); setSessionId(''); }} />;
    return <Room {...{ stage, stageIndex, questionIndex, audio, listening, paused, loading, question, position, duration, elapsed, cameraOn, setCameraOn, transcript, interim, captionsOpen, setCaptionsOpen, error, answers, sessionId, getNextQuestion, setError, showTextInput, setShowTextInput, typedAnswer, setTypedAnswer, submitAnswer, stopListening, voiceReady, beginListening, handlePause, askQuestionAloud, endInterview, endConfirmation, setEndConfirmation, finishInterview }} />;
}

type LobbyProps = { position: string; setPosition: (value: string) => void; interviewType: InterviewType; setInterviewType: (value: InterviewType) => void; experience: string; setExperience: (value: string) => void; duration: string; setDuration: (value: string) => void; jobDescription: string; setJobDescription: (value: string) => void; resumeName: string; micTested: boolean; setMicTested: (value: boolean) => void; audio: ReturnType<typeof useAudioManager>; speechRecognitionSupported: boolean; isLocked: boolean; phase: RoomPhase; startInterview: () => Promise<void>; limitMessage: string; error: string };
function Lobby(props: LobbyProps) {
    const { audio } = props;
    return <main className="min-h-screen bg-[#f6f7fb] px-4 py-8 text-slate-900 dark:bg-[#090c14] dark:text-slate-100 sm:px-8"><div className="mx-auto max-w-5xl"><header className="mb-10 flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500 text-slate-950"><BrainCircuit className="h-6 w-6" /></div><div><p className="text-sm font-bold tracking-tight">LakshyaTrack</p><p className="text-xs text-slate-500">Interview practice</p></div></div><span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 sm:block">Private by design · no audio recorded</span></header><section className="grid gap-8 lg:grid-cols-[1.15fr_.85fr]"><div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_-45px_rgba(15,23,42,.45)] dark:border-white/10 dark:bg-slate-950 sm:p-9"><div className="mb-7"><p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-cyan-700 dark:text-cyan-300"><Radio className="h-3.5 w-3.5" />Voice-first practice</p><h1 className="max-w-lg text-4xl font-semibold tracking-[-.045em] sm:text-5xl">Enter prepared. Speak naturally.</h1><p className="mt-4 max-w-xl leading-7 text-slate-600 dark:text-slate-300">Maya asks role-aware questions, listens for your answer, and continues without a Send button. Text is available only as a compatibility option.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Target role<input value={props.position} onChange={(event) => props.setPosition(event.target.value)} maxLength={160} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2 dark:border-white/10 dark:bg-white/5" /></label><label className="text-sm font-medium">Experience<select value={props.experience} onChange={(event) => props.setExperience(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2 dark:border-white/10 dark:bg-white/5"><option>Entry level</option><option>Intermediate</option><option>Senior</option></select></label><label className="text-sm font-medium">Interview type<select value={props.interviewType} onChange={(event) => props.setInterviewType(event.target.value as InterviewType)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2 dark:border-white/10 dark:bg-white/5"><option value="resume_screening">Resume-based</option><option value="direct_skill">Direct skill interview</option></select></label><label className="text-sm font-medium">Planned duration<select value={props.duration} onChange={(event) => props.setDuration(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none ring-cyan-500 focus:ring-2 dark:border-white/10 dark:bg-white/5"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option></select></label></div><details className="mt-5 rounded-xl border border-slate-200 p-3 dark:border-white/10"><summary className="cursor-pointer text-sm font-medium">Optional job description</summary><textarea value={props.jobDescription} onChange={(event) => props.setJobDescription(event.target.value)} placeholder="Paste the role description. It is used as context for resume-screening questions." className="mt-3 min-h-24 w-full resize-y rounded-lg bg-slate-50 p-3 text-sm outline-none dark:bg-white/5" /></details>{props.limitMessage && <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">{props.limitMessage}</p>}<button type="button" onClick={() => void props.startInterview()} disabled={props.phase === 'connecting' || !props.position.trim()} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:cursor-wait disabled:opacity-60">{props.phase === 'connecting' ? <><Loader2 className="h-5 w-5 animate-spin" />Preparing your room</> : <><Mic2 className="h-5 w-5" />{props.isLocked ? 'Unlock interview access' : 'Enter interview room'}<ArrowRight className="h-4 w-4" /></>}</button></div><aside className="space-y-4"><div className="rounded-[2rem] bg-slate-900 p-6 text-white shadow-xl"><div className="mb-6 flex items-center justify-between"><div><p className="text-sm font-semibold">Room check</p><p className="mt-1 text-xs text-slate-400">Use free browser capabilities</p></div><ShieldCheck className="h-6 w-6 text-emerald-300" /></div><div className="space-y-3 text-sm"><Status label="Speech playback" ready={audio.speechSupported} note={audio.speechSupported ? `${audio.voices.length || 'Loading'} English voices available` : 'Unavailable in this browser'} /><Status label="Voice recognition" ready={props.speechRecognitionSupported} note={props.speechRecognitionSupported ? 'Browser-native; your words are not audio-recorded' : 'Text compatibility mode will be available'} /><Status label="Microphone" ready={audio.mediaSupported} note={props.micTested ? 'Permission granted for test' : 'Test before you enter'} /></div><button type="button" onClick={() => { if (audio.micLevel > 0) audio.stopMeter(); else void audio.testMicrophone().then(() => props.setMicTested(true)).catch(() => undefined); }} disabled={!audio.mediaSupported} className="mt-6 flex w-full items-center justify-between rounded-xl border border-white/15 px-3 py-3 text-sm font-medium hover:bg-white/10 disabled:opacity-50"><span className="flex items-center gap-2"><Headphones className="h-4 w-4" />{audio.micLevel > 0 ? 'Stop microphone test' : 'Test microphone'}</span><span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-white/15"><span style={{ width: `${audio.micLevel * 100}%` }} className="bg-emerald-300 transition-all" /></span></button></div><div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950"><p className="text-sm font-semibold">Your interview context</p><p className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><FileText className="h-4 w-4 text-cyan-600" />{props.resumeName}</p><p className="mt-3 text-xs leading-5 text-slate-500">Camera is optional. The platform does not retain raw camera or microphone media.</p></div></aside></section></div>{props.error && <p className="mx-auto mt-5 max-w-5xl text-sm text-rose-600 dark:text-rose-300">{props.error}</p>}</main>;
}

type RoomProps = {
    stage: typeof STAGES[number]; stageIndex: number; questionIndex: number; audio: ReturnType<typeof useAudioManager>; listening: boolean; paused: boolean; loading: boolean; question: string; position: string; duration: string; elapsed: number; cameraOn: boolean; setCameraOn: (value: boolean) => void; transcript: TranscriptLine[]; interim: string; captionsOpen: boolean; setCaptionsOpen: (value: boolean | ((current: boolean) => boolean)) => void; error: string; answers: Answer[]; sessionId: string; getNextQuestion: (stage: StageId, history: Answer[], sessionId: string) => Promise<void>; setError: (value: string) => void; showTextInput: boolean; setShowTextInput: (value: boolean) => void; typedAnswer: string; setTypedAnswer: (value: string) => void; submitAnswer: (value: string) => Promise<void>; stopListening: () => void; voiceReady: boolean; beginListening: () => void; handlePause: () => void; askQuestionAloud: (startAfter?: boolean) => void; endInterview: () => void; endConfirmation: boolean; setEndConfirmation: (value: boolean) => void; finishInterview: () => Promise<void>;
};
function Room(props: RoomProps) {
    return <main className="min-h-screen overflow-hidden bg-[#edf1f6] text-slate-900 dark:bg-[#070a11] dark:text-slate-100"><div className="mx-auto flex min-h-screen max-w-[1500px] flex-col px-3 py-3 sm:px-6 sm:py-5"><header className="mb-3 flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500 text-slate-950"><BrainCircuit className="h-5 w-5" /></div><div><p className="text-sm font-bold">LakshyaTrack</p><p className="text-xs text-slate-500">Live interview room</p></div></div><div className="flex items-center gap-3 text-xs font-medium text-slate-500"><span className="hidden items-center gap-1.5 sm:flex"><Wifi className="h-3.5 w-3.5 text-emerald-500" />Connected</span><span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{formatTime(props.elapsed)} / {props.duration}:00</span></div></header><div className="mb-3 grid grid-cols-4 gap-1.5" aria-label="Interview stages">{STAGES.map((item, index) => <div key={item.id} className={`rounded-lg px-2 py-2 ${index === props.stageIndex ? 'bg-cyan-500 text-slate-950' : index < props.stageIndex ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200/70 text-slate-500 dark:bg-white/5'}`}><p className="text-[10px] font-bold uppercase tracking-wider">{index < props.stageIndex ? 'Complete' : `Stage ${index + 1}`}</p><p className="truncate text-xs font-semibold">{item.label}</p></div>)}</div><section className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="relative flex min-h-[560px] flex-col overflow-hidden rounded-[1.75rem] bg-[radial-gradient(circle_at_50%_0%,#1b3856_0%,#0b1423_42%,#090d16_100%)] p-4 shadow-2xl sm:p-7"><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" /><div className="flex items-center justify-between text-slate-300"><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium">{props.stage.label} · Question {props.questionIndex + 1}/{props.stage.questions}</span><span className="flex items-center gap-2 text-xs"><span className={`h-2 w-2 rounded-full ${props.audio.speechState === 'speaking' ? 'animate-pulse bg-cyan-300' : props.listening ? 'animate-pulse bg-emerald-300' : props.loading ? 'animate-pulse bg-amber-300' : 'bg-slate-500'}`} />{props.loading ? 'Maya is thinking' : props.audio.speechState === 'speaking' ? 'Maya is speaking' : props.listening ? 'Maya is listening' : props.paused ? 'Interview paused' : 'Ready'}</span></div><div className="flex flex-1 flex-col items-center justify-center py-7 text-center"><motion.div animate={props.audio.speechState === 'speaking' ? { scale: [1, 1.035, 1], boxShadow: ['0 0 0 0 rgba(103,232,249,.16)', '0 0 0 26px rgba(103,232,249,0)', '0 0 0 0 rgba(103,232,249,0)'] } : { scale: 1 }} transition={{ duration: 1.8, repeat: Infinity }} className="relative mb-6 grid h-32 w-32 place-items-center rounded-full border border-cyan-200/30 bg-[linear-gradient(145deg,#79dce9,#2773a8_56%,#152c50)] shadow-[0_18px_60px_rgba(0,0,0,.45)]"><div className="grid h-24 w-24 place-items-center rounded-full border border-white/25 bg-slate-950/30"><Sparkles className="h-10 w-10 text-cyan-100" /></div></motion.div><p className="text-xl font-semibold text-white">Maya</p><p className="mt-1 text-sm text-slate-400">AI interviewer · {props.position}</p><div className="mt-7 max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">{props.loading ? 'Preparing your next question' : props.audio.speechState === 'speaking' ? 'Speaking' : props.listening ? 'Listening' : 'Question'}</p><h1 className="mt-3 text-xl font-medium leading-8 text-white sm:text-3xl sm:leading-10">{props.question || 'Connecting you to Maya…'}</h1></div></div><div className="mt-auto text-center text-xs text-slate-400">Click <span className="font-semibold text-slate-200">Answer aloud</span> to interrupt playback. Reliable automatic barge-in differs by browser, so it is not enabled silently.</div></div><aside className="flex flex-col gap-3"><InterviewWebcam enabled={props.cameraOn} onEnabledChange={props.setCameraOn} /><LiveTranscription lines={props.transcript} interim={props.interim} open={props.captionsOpen} onOpenChange={props.setCaptionsOpen} /><div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-white/10 dark:bg-slate-950"><div className="flex items-center justify-between"><p className="font-semibold">Voice settings</p><ChevronDown className="h-4 w-4 text-slate-400" /></div>{props.audio.speechSupported ? <label className="mt-3 block text-xs text-slate-500">Interviewer voice<select value={props.audio.selectedVoice} onChange={(event) => props.audio.setSelectedVoice(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">{props.audio.voices.map((voice) => <option key={voice.name} value={voice.name}>{voice.name}</option>)}</select></label> : <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-200">Speech playback is unavailable. You can read questions and use the explicit text mode.</p>}<p className="mt-3 text-xs leading-5 text-slate-500">Voice recognition uses your browser. No raw microphone media is stored.</p></div></aside></section>{props.error && <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{props.error}<button type="button" onClick={() => { props.setError(''); if (props.question) void props.getNextQuestion(props.stage.id, props.answers, props.sessionId); }} className="ml-auto font-semibold underline">Retry</button></div>}{props.showTextInput && <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950"><label className="text-xs font-bold uppercase tracking-wider text-slate-500">Text compatibility mode</label><div className="mt-2 flex gap-2"><input value={props.typedAnswer} onChange={(event) => props.setTypedAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void props.submitAnswer(props.typedAnswer); }} placeholder="Type an answer only when voice recognition is unavailable" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500 dark:border-white/10 dark:bg-white/5" /><button type="button" onClick={() => void props.submitAnswer(props.typedAnswer)} className="rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white dark:bg-cyan-500 dark:text-slate-950">Send</button></div></div>}<div className="mx-auto mt-3 w-full max-w-xl"><InterviewControls listening={props.listening} paused={props.paused} captionsOpen={props.captionsOpen} canListen={props.voiceReady} onMic={() => props.listening ? props.stopListening() : props.beginListening()} onPause={props.handlePause} onCaptions={() => props.setCaptionsOpen((open) => !open)} onRepeat={() => props.askQuestionAloud(false)} onEnd={props.endInterview} /></div><AnimatePresence>{props.endConfirmation && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"><div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"><button type="button" onClick={() => props.setEndConfirmation(false)} className="float-right text-slate-500"><X className="h-5 w-5" /></button><h2 className="text-lg font-semibold">End this interview?</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">It will be discarded from progress and badges because the required stages were not finalized.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => props.setEndConfirmation(false)} className="rounded-lg px-3 py-2 text-sm font-semibold">Keep practicing</button><button type="button" onClick={props.endInterview} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white">End interview</button></div></div></motion.div>}</AnimatePresence></div></main>;
}

function Status({ label, ready, note }: { label: string; ready: boolean; note: string }) { return <div className="flex gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ready ? 'bg-emerald-300' : 'bg-amber-300'}`} /><div><p className="font-medium">{label}</p><p className="mt-0.5 text-xs leading-5 text-slate-400">{note}</p></div></div>; }
function Report({ report, transcript, onRestart }: { report: Record<string, unknown> | null; transcript: TranscriptLine[]; onRestart: () => void }) {
    const score = typeof report?.overall_score === 'number' ? Math.round(report.overall_score) : null;
    const strengths = Array.isArray(report?.strengths) ? report.strengths : [];
    const weaknesses = Array.isArray(report?.weaknesses) ? report.weaknesses : [];
    return <main className="min-h-screen bg-[#f6f7fb] px-4 py-10 dark:bg-[#090c14] sm:px-8"><section className="mx-auto max-w-4xl"><div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-xl shadow-slate-950/5 dark:border-white/10 dark:bg-slate-950 sm:p-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-700 dark:text-cyan-300">Finalized interview report</p><div className="mt-5 flex flex-wrap items-end justify-between gap-5"><div><h1 className="text-4xl font-semibold tracking-[-.04em]">{String(report?.verdict || 'Interview complete')}</h1><p className="mt-3 max-w-xl leading-7 text-slate-600 dark:text-slate-300">{String(report?.overall_feedback || 'Your evidence-based report has been saved.')}</p></div>{score !== null && <div className="grid h-24 w-24 place-items-center rounded-full border-8 border-cyan-400 bg-cyan-50 text-2xl font-semibold text-slate-900 dark:bg-cyan-400/10 dark:text-white">{score}</div>}</div><div className="mt-8 grid gap-4 md:grid-cols-2"><Evidence title="Strengths" items={strengths} positive /><Evidence title="Develop next" items={weaknesses} /><div className="rounded-2xl border border-slate-200 p-5 dark:border-white/10"><h2 className="font-semibold">Interview record</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{transcript.filter((line) => line.speaker === 'candidate').length} candidate answers were captured as text. No raw media was stored.</p></div><div className="rounded-2xl border border-slate-200 p-5 dark:border-white/10"><h2 className="font-semibold">Next practice</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Use the recommendations in the saved report before taking another attempt.</p></div></div><button type="button" onClick={onRestart} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950"><Mic2 className="h-5 w-5" />Start another interview</button></div></section></main>;
}
function Evidence({ title, items, positive = false }: { title: string; items: unknown[]; positive?: boolean }) { return <div className="rounded-2xl border border-slate-200 p-5 dark:border-white/10"><h2 className="font-semibold">{title}</h2>{items.length ? <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{items.map((item, index) => <li key={index} className="flex gap-2"><CheckCircle2 className={`mt-1 h-3.5 w-3.5 shrink-0 ${positive ? 'text-emerald-500' : 'text-amber-500'}`} />{String(item)}</li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No evidence was returned for this section.</p>}</div>; }
