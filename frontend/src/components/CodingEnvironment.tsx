/**
 * CodingEnvironment — LeetCode-style coding environment for interview coding round.
 * Features:
 * - Monaco Editor (VSCode engine) with syntax highlighting, auto-indent, bracket matching
 * - Split-panel layout: Problem description | Code editor
 * - Bottom panel: Test cases, Run/Submit, Output console
 * - Language switching (Python, JavaScript, Java, C++)
 * - Visible & hidden test case system
 * - Runtime + memory display
 * - Dark theme editor with VS Code keybindings
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import {
    Play, Send, ArrowRight, CheckCircle2, XCircle,
    Clock, HardDrive, Code2, Terminal, ChevronDown,
    ChevronRight, Lightbulb, Loader2, Maximize2, Minimize2,
    RotateCcw, Eye, EyeOff, Zap, Trophy, AlertTriangle,
    Copy, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────
interface TestCase {
    input: string;
    expected_output: string;
    is_hidden?: boolean;
}

interface CodingProblem {
    title: string;
    description: string;
    difficulty?: string;
    examples?: { input: string; output: string; explanation?: string }[];
    constraints?: string[];
    hints?: string[];
    test_cases?: TestCase[];
    starter_code?: Record<string, string>;
}

interface TestResult {
    index: number;
    passed: boolean;
    input: string;
    expected: string;
    actual: string;
    is_hidden: boolean;
}

interface RunResult {
    status: 'success' | 'error' | 'timeout' | 'runtime_error';
    test_results: TestResult[];
    passed: number;
    total: number;
    runtime_ms?: number;
    memory_mb?: number;
    error?: string;
    stdout?: string;
}

type SupportedLanguage = 'python' | 'javascript' | 'java' | 'cpp';

interface CodingEnvironmentProps {
    problem: CodingProblem;
    onSubmitSolution: (code: string, language: string, passed: number, total: number, attempts: number) => void;
    onFinish: () => void;
    isLoading?: boolean;
}

// ─── Language Configuration ─────────────────────────────
const LANGUAGES: { id: SupportedLanguage; label: string; monacoId: string; icon: string }[] = [
    { id: 'python', label: 'Python', monacoId: 'python', icon: '🐍' },
    { id: 'javascript', label: 'JavaScript', monacoId: 'javascript', icon: '⚡' },
    { id: 'java', label: 'Java', monacoId: 'java', icon: '☕' },
    { id: 'cpp', label: 'C++', monacoId: 'cpp', icon: '⚙️' },
];

const DEFAULT_STARTER: Record<SupportedLanguage, string> = {
    python: '# Write your solution here\ndef solution():\n    pass\n',
    javascript: '// Write your solution here\nfunction solution() {\n    \n}\n',
    java: '// Write your solution here\nclass Solution {\n    public void solve() {\n        \n    }\n}\n',
    cpp: '// Write your solution here\n#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
};

// ─── Main Component ─────────────────────────────────────
export default function CodingEnvironment({ problem, onSubmitSolution, onFinish, isLoading }: CodingEnvironmentProps) {
    const [language, setLanguage] = useState<SupportedLanguage>('python');
    const [code, setCode] = useState(problem.starter_code?.python || DEFAULT_STARTER.python);
    const [activeTab, setActiveTab] = useState<'testcases' | 'output'>('testcases');
    const [selectedTestCase, setSelectedTestCase] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [runResult, setRunResult] = useState<RunResult | null>(null);
    const [attempts, setAttempts] = useState(0);
    const [bestResult, setBestResult] = useState<{ passed: number; total: number } | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showHints, setShowHints] = useState(false);
    const [copied, setCopied] = useState(false);
    const [panelSizes, setPanelSizes] = useState({ left: 40, right: 60 });
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const visibleTests = (problem.test_cases || []).filter(tc => !tc.is_hidden);
    const hiddenTests = (problem.test_cases || []).filter(tc => tc.is_hidden);
    const allTests = problem.test_cases || [];

    // Safely normalize fields that AI may return as string instead of array
    const safeArray = (val: any): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(String);
        if (typeof val === 'string') return val.split('\n').map(s => s.trim()).filter(Boolean);
        return [];
    };
    const constraints = safeArray(problem.constraints);
    const hints = safeArray(problem.hints);
    const examples = Array.isArray(problem.examples) ? problem.examples : [];

    // ─── Language Switch ────────────────────────────────
    const handleLanguageChange = useCallback((lang: SupportedLanguage) => {
        setLanguage(lang);
        setCode(problem.starter_code?.[lang] || DEFAULT_STARTER[lang]);
        setRunResult(null);
    }, [problem.starter_code]);

    // ─── Editor Mount ───────────────────────────────────
    const handleEditorMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
        editorRef.current = editor;
        editor.focus();
        // Add keyboard shortcuts
        editor.addCommand(
            // Ctrl+Enter to run
            2048 + 3, // KeyMod.CtrlCmd + KeyCode.Enter
            () => handleRunCode()
        );
    }, []);

    // ─── Real Code Execution via Backend API ──────────────
    // Calls the actual code execution engine that compiles and runs code.
    const handleRunCode = useCallback(async () => {
        if (isRunning || isSubmitting) return;
        setIsRunning(true);
        setActiveTab('output');

        try {
            const { runCode } = await import('../services/careerPlatform');
            const result = await runCode(code, language, allTests);

            // Map backend response to our RunResult format
            const mappedResult: RunResult = {
                status: result.status === 'accepted' ? 'success' :
                        result.status === 'compilation_error' ? 'error' :
                        result.status === 'timeout' ? 'timeout' :
                        result.status === 'runtime_error' ? 'runtime_error' : 'error',
                test_results: (result.test_results || []).map((tr: any, i: number) => ({
                    index: tr.index ?? i,
                    passed: tr.passed,
                    input: tr.input || '',
                    expected: tr.expected || '',
                    actual: tr.actual || '',
                    is_hidden: tr.is_hidden || false,
                })),
                passed: result.passed || 0,
                total: result.total || 0,
                runtime_ms: result.runtime_ms,
                memory_mb: result.memory_mb,
                error: result.error || result.compilation_output || undefined,
                stdout: result.stdout,
            };
            setRunResult(mappedResult);
        } catch (e: any) {
            setRunResult({
                status: 'error',
                test_results: [],
                passed: 0,
                total: visibleTests.length,
                error: e?.response?.data?.error || e?.message || 'Execution failed. Please try again.',
            });
        }

        setIsRunning(false);
    }, [code, language, allTests, visibleTests.length, isRunning, isSubmitting]);

    // ─── Submit Solution (all tests including hidden) ────
    const handleSubmit = useCallback(async () => {
        if (isRunning || isSubmitting) return;
        setIsSubmitting(true);
        setActiveTab('output');
        setAttempts(prev => prev + 1);

        try {
            const { submitCode } = await import('../services/careerPlatform');
            const result = await submitCode(code, language, allTests);

            const mappedResult: RunResult = {
                status: result.status === 'accepted' ? 'success' :
                        result.status === 'compilation_error' ? 'error' :
                        result.status === 'timeout' ? 'timeout' :
                        result.status === 'runtime_error' ? 'runtime_error' : 'error',
                test_results: (result.test_results || []).map((tr: any, i: number) => ({
                    index: tr.index ?? i,
                    passed: tr.passed,
                    input: tr.input || '',
                    expected: tr.expected || '',
                    actual: tr.actual || '',
                    is_hidden: tr.is_hidden || false,
                })),
                passed: result.passed || 0,
                total: result.total || 0,
                runtime_ms: result.runtime_ms,
                memory_mb: result.memory_mb,
                error: result.error || result.compilation_output || undefined,
                stdout: result.stdout,
            };
            setRunResult(mappedResult);

            if (!bestResult || mappedResult.passed > bestResult.passed) {
                setBestResult({ passed: mappedResult.passed, total: mappedResult.total });
            }

            onSubmitSolution(code, language, mappedResult.passed, mappedResult.total, attempts + 1);
        } catch (e: any) {
            setRunResult({
                status: 'error',
                test_results: [],
                passed: 0,
                total: allTests.length,
                error: e?.response?.data?.error || e?.message || 'Submission failed. Please try again.',
            });
        }

        setIsSubmitting(false);
    }, [code, language, allTests, attempts, bestResult, onSubmitSolution, isRunning, isSubmitting]);

    // ─── Copy Code ──────────────────────────────────────
    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [code]);

    // ─── Reset Code ─────────────────────────────────────
    const handleReset = useCallback(() => {
        setCode(problem.starter_code?.[language] || DEFAULT_STARTER[language]);
        setRunResult(null);
    }, [problem.starter_code, language]);

    // ─── Fullscreen Toggle ──────────────────────────────
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement && containerRef.current) {
            containerRef.current.requestFullscreen?.();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen?.();
            setIsFullscreen(false);
        }
    }, []);

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    // ─── Difficulty Badge ───────────────────────────────
    const difficultyColor = {
        easy: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        intermediate: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        hard: 'bg-red-500/10 text-red-500 border-red-500/20',
    }[problem.difficulty || 'intermediate'] || 'bg-amber-500/10 text-amber-500 border-amber-500/20';

    // ═══════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════
    return (
        <div
            ref={containerRef}
            className={`flex flex-col bg-[#1e1e2e] rounded-2xl overflow-hidden border border-[#313244] shadow-2xl ${isFullscreen ? 'fixed inset-0 z-50 rounded-none h-[100dvh]' : 'min-h-[1000px] md:min-h-[700px] flex-1'}`}
        >
            {/* ═══ TOP BAR ═══ */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#181825] border-b border-[#313244]">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-[#f38ba8]" />
                        <div className="w-3 h-3 rounded-full bg-[#fab387]" />
                        <div className="w-3 h-3 rounded-full bg-[#a6e3a1]" />
                    </div>
                    <span className="text-[#cdd6f4] text-sm font-bold">{problem.title || 'Coding Challenge'}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md border ${difficultyColor}`}>
                        {problem.difficulty || 'Medium'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {bestResult && (
                        <span className="text-[10px] font-bold text-[#a6e3a1] flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            Best: {bestResult.passed}/{bestResult.total}
                        </span>
                    )}
                    <button onClick={toggleFullscreen} className="p-1.5 rounded-lg hover:bg-[#313244] transition-colors">
                        {isFullscreen ? <Minimize2 className="w-4 h-4 text-[#6c7086]" /> : <Maximize2 className="w-4 h-4 text-[#6c7086]" />}
                    </button>
                </div>
            </div>

            {/* ═══ MAIN SPLIT PANELS ═══ */}
            <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
                {/* ── LEFT: Problem Description ── */}
                <div 
                    className="border-b md:border-b-0 md:border-r border-[#313244] overflow-y-auto w-full md:w-[var(--panel-width)] min-h-[50vh] md:min-h-0" 
                    style={{ '--panel-width': `${panelSizes.left}%` } as React.CSSProperties}
                >
                    <div className="p-5 space-y-5">
                        {/* Problem Title */}
                        <div>
                            <h2 className="text-xl font-black text-[#cdd6f4] mb-2">{problem.title}</h2>
                            <div className="flex gap-2 flex-wrap">
                                <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border ${difficultyColor}`}>
                                    {problem.difficulty || 'Medium'}
                                </span>
                                {attempts > 0 && (
                                    <span className="px-2.5 py-1 text-[10px] font-bold text-[#89b4fa] bg-[#89b4fa]/10 rounded-lg border border-[#89b4fa]/20">
                                        {attempts} attempt{attempts !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Description */}
                        <div className="text-sm text-[#a6adc8] leading-relaxed whitespace-pre-wrap font-medium">
                            {problem.description}
                        </div>

                        {/* Examples */}
                        {examples.map((ex, i) => (
                            <div key={i} className="space-y-2">
                                <h4 className="text-xs font-black text-[#6c7086] uppercase tracking-widest">Example {i + 1}</h4>
                                <div className="bg-[#181825] rounded-xl p-4 font-mono text-sm space-y-1.5 border border-[#313244]">
                                    <div className="flex gap-2">
                                        <span className="text-[#89b4fa] font-bold">Input:</span>
                                        <span className="text-[#cdd6f4]">{ex.input}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="text-[#a6e3a1] font-bold">Output:</span>
                                        <span className="text-[#cdd6f4]">{ex.output}</span>
                                    </div>
                                    {ex.explanation && (
                                        <div className="flex gap-2 pt-1 border-t border-[#313244] mt-1.5">
                                            <span className="text-[#fab387] font-bold">Note:</span>
                                            <span className="text-[#a6adc8]">{ex.explanation}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Constraints */}
                        {constraints.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-black text-[#6c7086] uppercase tracking-widest">Constraints</h4>
                                <ul className="space-y-1">
                                    {constraints.map((c, i) => (
                                        <li key={i} className="text-sm text-[#a6adc8] font-mono flex items-start gap-2">
                                            <span className="text-[#f38ba8] mt-0.5">•</span> {c}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Hints */}
                        {hints.length > 0 && (
                            <div className="space-y-2">
                                <button
                                    onClick={() => setShowHints(!showHints)}
                                    className="flex items-center gap-2 text-xs font-black text-[#fab387] uppercase tracking-widest hover:text-[#f9e2af] transition-colors"
                                >
                                    <Lightbulb className="w-3.5 h-3.5" />
                                    {showHints ? 'Hide' : 'Show'} Hints ({hints.length})
                                    {showHints ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                                <AnimatePresence>
                                    {showHints && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-2 overflow-hidden"
                                        >
                                            {hints.map((hint, i) => (
                                                <div key={i} className="p-3 bg-[#fab387]/5 border border-[#fab387]/10 rounded-lg text-sm text-[#f9e2af] flex items-start gap-2">
                                                    <Lightbulb className="w-4 h-4 text-[#fab387] shrink-0 mt-0.5" />
                                                    {hint}
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT: Code Editor + Bottom Panel ── */}
                <div className="flex flex-col flex-1 min-h-0">
                    {/* Language Selector + Actions */}
                    <div className="flex items-center justify-between px-3 py-2 bg-[#181825] border-b border-[#313244]">
                        <div className="flex items-center gap-1">
                            {LANGUAGES.map(lang => (
                                <button
                                    key={lang.id}
                                    onClick={() => handleLanguageChange(lang.id)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                                        language === lang.id
                                            ? 'bg-[#89b4fa]/15 text-[#89b4fa] border border-[#89b4fa]/30'
                                            : 'text-[#6c7086] hover:text-[#a6adc8] hover:bg-[#313244]'
                                    }`}
                                >
                                    <span className="text-xs">{lang.icon}</span>
                                    {lang.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={handleCopy}
                                className="p-1.5 rounded-lg hover:bg-[#313244] transition-colors"
                                title="Copy code"
                            >
                                {copied ? <Check className="w-3.5 h-3.5 text-[#a6e3a1]" /> : <Copy className="w-3.5 h-3.5 text-[#6c7086]" />}
                            </button>
                            <button
                                onClick={handleReset}
                                className="p-1.5 rounded-lg hover:bg-[#313244] transition-colors"
                                title="Reset code"
                            >
                                <RotateCcw className="w-3.5 h-3.5 text-[#6c7086]" />
                            </button>
                        </div>
                    </div>

                    {/* Monaco Editor */}
                    <div className="flex-1 min-h-[300px]">
                        <Editor
                            height="100%"
                            language={LANGUAGES.find(l => l.id === language)?.monacoId || 'python'}
                            value={code}
                            onChange={(val) => setCode(val || '')}
                            onMount={handleEditorMount}
                            theme="vs-dark"
                            options={{
                                fontSize: 14,
                                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
                                fontLigatures: true,
                                minimap: { enabled: false },
                                automaticLayout: true,
                                autoIndent: 'full',
                                formatOnType: true,
                                formatOnPaste: true,
                                tabSize: 4,
                                insertSpaces: true,
                                wordWrap: 'on',
                                lineNumbers: 'on',
                                renderLineHighlight: 'all',
                                scrollBeyondLastLine: false,
                                smoothScrolling: true,
                                cursorBlinking: 'smooth',
                                cursorSmoothCaretAnimation: 'on',
                                bracketPairColorization: { enabled: true },
                                autoClosingBrackets: 'always',
                                autoClosingQuotes: 'always',
                                autoSurround: 'languageDefined',
                                folding: true,
                                suggest: { showSnippets: true, showWords: true },
                                quickSuggestions: true,
                                suggestOnTriggerCharacters: true,
                                padding: { top: 12, bottom: 12 },
                            }}
                        />
                    </div>

                    {/* ═══ BOTTOM PANEL: Test Cases + Output ═══ */}
                    <div className="border-t border-[#313244] bg-[#181825]">
                        {/* Tabs */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 border-b border-[#313244] gap-2 sm:gap-0 pb-2 sm:pb-0">
                            <div className="flex overflow-x-auto scrollbar-hide no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 border-b sm:border-none border-[#313244]/50">
                                <button
                                    onClick={() => setActiveTab('testcases')}
                                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                                        activeTab === 'testcases'
                                            ? 'border-[#89b4fa] text-[#89b4fa]'
                                            : 'border-transparent text-[#6c7086] hover:text-[#a6adc8]'
                                    }`}
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Terminal className="w-3.5 h-3.5" />
                                        Testcases
                                        <span className="px-1.5 py-0.5 text-[9px] bg-[#313244] rounded-md">
                                            {visibleTests.length}
                                        </span>
                                    </span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('output')}
                                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                                        activeTab === 'output'
                                            ? 'border-[#a6e3a1] text-[#a6e3a1]'
                                            : 'border-transparent text-[#6c7086] hover:text-[#a6adc8]'
                                    }`}
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Code2 className="w-3.5 h-3.5" />
                                        Output
                                        {runResult && (
                                            <span className={`px-1.5 py-0.5 text-[9px] rounded-md ${
                                                runResult.status === 'success' ? 'bg-[#a6e3a1]/15 text-[#a6e3a1]' : 'bg-[#f38ba8]/15 text-[#f38ba8]'
                                            }`}>
                                                {runResult.passed}/{runResult.total}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            </div>

                            {/* Run + Submit Buttons */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleRunCode}
                                    disabled={isRunning || isSubmitting}
                                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] rounded-lg transition-all disabled:opacity-50"
                                >
                                    {isRunning ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Play className="w-3.5 h-3.5" />
                                    )}
                                    Run
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isRunning || isSubmitting}
                                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-[#a6e3a1]/15 hover:bg-[#a6e3a1]/25 text-[#a6e3a1] border border-[#a6e3a1]/30 rounded-lg transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Send className="w-3.5 h-3.5" />
                                    )}
                                    Submit
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="h-[180px] overflow-y-auto p-3">
                            <AnimatePresence mode="wait">
                                {activeTab === 'testcases' && (
                                    <motion.div key="tc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        {/* Test case selector */}
                                        <div className="flex gap-1.5 mb-3 flex-wrap">
                                            {visibleTests.map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setSelectedTestCase(i)}
                                                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                                                        selectedTestCase === i
                                                            ? 'bg-[#313244] text-[#cdd6f4]'
                                                            : 'text-[#6c7086] hover:text-[#a6adc8]'
                                                    }`}
                                                >
                                                    {runResult && runResult.test_results[i] && (
                                                        runResult.test_results[i].passed
                                                            ? <CheckCircle2 className="w-3 h-3 text-[#a6e3a1]" />
                                                            : <XCircle className="w-3 h-3 text-[#f38ba8]" />
                                                    )}
                                                    Case {i + 1}
                                                </button>
                                            ))}
                                            {hiddenTests.length > 0 && (
                                                <span className="px-3 py-1 text-[10px] font-bold text-[#6c7086] flex items-center gap-1">
                                                    <EyeOff className="w-3 h-3" />
                                                    +{hiddenTests.length} hidden
                                                </span>
                                            )}
                                        </div>

                                        {/* Selected test case details */}
                                        {visibleTests[selectedTestCase] && (
                                            <div className="space-y-2">
                                                <div className="bg-[#1e1e2e] rounded-lg p-3 border border-[#313244]">
                                                    <span className="text-[10px] font-bold text-[#6c7086] uppercase tracking-widest block mb-1">Input</span>
                                                    <pre className="text-sm font-mono text-[#cdd6f4] whitespace-pre-wrap">{visibleTests[selectedTestCase].input}</pre>
                                                </div>
                                                <div className="bg-[#1e1e2e] rounded-lg p-3 border border-[#313244]">
                                                    <span className="text-[10px] font-bold text-[#6c7086] uppercase tracking-widest block mb-1">Expected Output</span>
                                                    <pre className="text-sm font-mono text-[#a6e3a1] whitespace-pre-wrap">{visibleTests[selectedTestCase].expected_output}</pre>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {activeTab === 'output' && (
                                    <motion.div key="out" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        {isRunning || isSubmitting ? (
                                            <div className="flex items-center justify-center gap-3 h-[140px]">
                                                <Loader2 className="w-5 h-5 text-[#89b4fa] animate-spin" />
                                                <span className="text-sm font-bold text-[#6c7086]">
                                                    {isSubmitting ? 'Judging solution...' : 'Running code...'}
                                                </span>
                                            </div>
                                        ) : runResult ? (
                                            <div className="space-y-3">
                                                {/* Status Header */}
                                                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                                                    runResult.status === 'success'
                                                        ? 'bg-[#a6e3a1]/5 border-[#a6e3a1]/20'
                                                        : 'bg-[#f38ba8]/5 border-[#f38ba8]/20'
                                                }`}>
                                                    <div className="flex items-center gap-2">
                                                        {runResult.status === 'success' ? (
                                                            <CheckCircle2 className="w-5 h-5 text-[#a6e3a1]" />
                                                        ) : (
                                                            <XCircle className="w-5 h-5 text-[#f38ba8]" />
                                                        )}
                                                        <span className={`text-sm font-black ${
                                                            runResult.status === 'success' ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'
                                                        }`}>
                                                            {runResult.status === 'success' ? 'Accepted' :
                                                             runResult.status === 'runtime_error' ? 'Runtime Error' :
                                                             runResult.status === 'timeout' ? 'Time Limit Exceeded' :
                                                             runResult.error?.includes('SyntaxError') ? 'Compilation Error' :
                                                             'Wrong Answer'}
                                                        </span>
                                                        <span className="text-xs font-bold text-[#6c7086]">
                                                            {runResult.passed}/{runResult.total} testcases passed
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs font-bold text-[#6c7086]">
                                                        {runResult.runtime_ms !== undefined && (
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {runResult.runtime_ms} ms
                                                            </span>
                                                        )}
                                                        {runResult.memory_mb !== undefined && (
                                                            <span className="flex items-center gap-1">
                                                                <HardDrive className="w-3 h-3" />
                                                                {runResult.memory_mb} MB
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Test Results List */}
                                                <div className="space-y-1.5">
                                                    {runResult.test_results.map((tr) => (
                                                        <div key={tr.index} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold ${
                                                            tr.passed ? 'bg-[#a6e3a1]/5 text-[#a6e3a1]' : 'bg-[#f38ba8]/5 text-[#f38ba8]'
                                                        }`}>
                                                            <span className="flex items-center gap-2">
                                                                {tr.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                                {tr.is_hidden ? `Hidden Test ${tr.index + 1}` : `Test Case ${tr.index + 1}`}
                                                            </span>
                                                            {!tr.passed && !tr.is_hidden && (
                                                                <span className="text-[10px] text-[#6c7086] font-mono">
                                                                    Expected: {tr.expected} | Got: {tr.actual}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Error Message */}
                                                {runResult.error && (
                                                    <div className="p-3 bg-[#f38ba8]/5 border border-[#f38ba8]/20 rounded-lg">
                                                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#f38ba8] mb-1">
                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                            Error
                                                        </span>
                                                        <pre className="text-xs font-mono text-[#f38ba8]/80 whitespace-pre-wrap">{runResult.error}</pre>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-[140px] text-[#6c7086]">
                                                <Terminal className="w-8 h-8 mb-2 opacity-30" />
                                                <span className="text-sm font-bold">Click "Run" to execute your code</span>
                                                <span className="text-xs mt-1">or press Ctrl+Enter</span>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ BOTTOM ACTION BAR ═══ */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#11111b] border-t border-[#313244]">
                <div className="flex items-center gap-3 text-xs text-[#6c7086]">
                    <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {LANGUAGES.find(l => l.id === language)?.label}
                    </span>
                    <span>•</span>
                    <span>Attempts: {attempts}</span>
                    {bestResult && (
                        <>
                            <span>•</span>
                            <span className="text-[#a6e3a1]">Best: {bestResult.passed}/{bestResult.total}</span>
                        </>
                    )}
                </div>
                <button
                    onClick={onFinish}
                    className="flex items-center gap-2 px-5 py-2 text-xs font-black bg-[#cba6f7]/15 hover:bg-[#cba6f7]/25 text-[#cba6f7] border border-[#cba6f7]/30 rounded-xl transition-all"
                >
                    Finish & Submit
                    <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
