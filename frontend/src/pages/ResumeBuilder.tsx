import { useState, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FileText,
    Upload,
    Sparkles,
    TrendingUp,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    ArrowLeft,
    Download,
    User,
    GraduationCap,
    Briefcase,
    Laptop,
    Wrench,
    XCircle,
    ShieldCheck,
    Target,
    Cpu,
    Layers,
    Award,
    Lightbulb,
    PlusCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { analyzeResumeText } from '@/services/resume';
import { extractTextFromFile } from '@/utils/ocr';
import { usePerformanceMode } from '../hooks/usePerformanceMode';

const AIBuilder = lazy(() => import('./ResumeBuilder/index'));

type Step = 'selection' | 'upload' | 'builder' | 'analysis' | 'templates';

export default function ResumeBuilder() {
    const location = useLocation();
    const { liteMode, isMobile } = usePerformanceMode();
    const editResume = (location.state as any)?.editResume || null;
    const [step, setStep] = useState<Step>(editResume ? 'builder' : 'selection');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [ocrProgress, setOcrProgress] = useState('');
    const [analysis, setAnalysis] = useState<any>(null);
    const [error, setError] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('modern');
    const [selectedTheme, setSelectedTheme] = useState('indigo');
    const [showPreview, setShowPreview] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        personal: { first: '', last: '', email: '', phone: '', location: '', summary: '' },
        education: [{ degree: '', institution: '', year: '', gpa: '' }],
        experience: [{ role: '', company: '', period: '', desc: '' }],
        projects: [{ name: '', tech: '', desc: '' }],
        skills: ''
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setError('');
        setOcrProgress('Initializing extraction...');
        try {
            // Extract text with OCR fallback
            const text = await extractTextFromFile(file, (msg) => setOcrProgress(msg));

            if (!text.trim()) {
                throw new Error('Could not extract any text from the document. Please try a different file.');
            }

            setOcrProgress('Performing AI Analysis...');
            const result = await analyzeResumeText(text, file.name);
            const parsedAnalysis = typeof result.analysis === 'string' ? JSON.parse(result.analysis) : result.analysis;
            setAnalysis(parsedAnalysis);
            setStep('analysis');
        } catch (err: any) {
            console.error('Resume Analysis Error:', err);
            let errorMsg = 'Failed to analyze resume. Please confirm it is a valid PDF and try again.';
            if (err.response?.data?.detail) {
                errorMsg = typeof err.response.data.detail === 'string'
                    ? err.response.data.detail
                    : JSON.stringify(err.response.data.detail);
            } else if (err.message) {
                errorMsg = err.message;
            }
            setError(errorMsg);
        } finally {
            setLoading(false);
            setOcrProgress('');
        }
    };

    const resetFlow = () => {
        setStep('selection');
        setFile(null);
        setAnalysis(null);
        setError('');
    };


    // Create Spline background directly on document.body (outside React tree)
    // to guarantee it covers the full viewport without any parent CSS interference
    useEffect(() => {
        if (step !== 'selection') return;

        const useLightweightSpline = liteMode || isMobile;

        // Hide the network background canvas on this page
        const networkBg = document.querySelector('.fixed.inset-0.pointer-events-none') as HTMLElement;
        if (networkBg) networkBg.style.display = 'none';

        // Make all parent backgrounds transparent
        const layoutRoot = document.querySelector('.flex.h-screen.overflow-hidden') as HTMLElement;
        if (layoutRoot) layoutRoot.style.background = 'transparent';

        const pageContent = document.querySelector('.min-h-full.relative.z-10') as HTMLElement;
        if (pageContent) {
            pageContent.style.background = 'transparent';
            pageContent.style.zIndex = 'auto';
            pageContent.style.position = 'static';
        }

        const mainArea = document.querySelector('main.flex-1.overflow-y-auto') as HTMLElement;
        if (mainArea) {
            mainArea.style.background = 'transparent';
            mainArea.style.overflow = 'visible';
            mainArea.style.transition = 'none';
        }

        const updateBgForTheme = () => {
            const isDark = document.documentElement.classList.contains('dark');
            const sceneBg = isDark ? '#0a0a1a' : '#ffffff';
            document.body.style.background = sceneBg;
            document.documentElement.style.background = sceneBg;
        };
        updateBgForTheme();

        const themeObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'class') updateBgForTheme();
            }
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        const rootEl = document.getElementById('root');
        if (rootEl) rootEl.style.background = 'transparent';

        let splineContainer: HTMLDivElement | null = null;
        let interval: ReturnType<typeof setInterval> | null = null;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        let visibilityHandler: (() => void) | null = null;

        if (useLightweightSpline) {
            const splineFallback = document.createElement('div');
            splineFallback.id = 'spline-bg-fallback';
            splineFallback.style.cssText = `
                position: fixed;
                inset: 0;
                z-index: 0;
                pointer-events: none;
                background:
                    radial-gradient(circle at 20% 20%, rgba(92,82,210,0.18), transparent 45%),
                    radial-gradient(circle at 80% 30%, rgba(124,58,237,0.14), transparent 42%),
                    radial-gradient(circle at 50% 80%, rgba(59,130,246,0.12), transparent 45%);
                transform: translateZ(0);
            `;
            document.body.insertBefore(splineFallback, document.body.firstChild);
        } else {
            const SPLINE_SCRIPT_URL = 'https://unpkg.com/@splinetool/viewer@1.12.68/build/spline-viewer.js';
            if (!document.querySelector(`script[src="${SPLINE_SCRIPT_URL}"]`)) {
                const splineScript = document.createElement('script');
                splineScript.type = 'module';
                splineScript.src = SPLINE_SCRIPT_URL;
                document.head.appendChild(splineScript);
            }

            splineContainer = document.createElement('div');
            splineContainer.id = 'spline-bg-container';
            splineContainer.style.cssText = `
                position: fixed;
                top: -15vh;
                left: -15vw;
                width: 130vw;
                height: 130vh;
                z-index: 0;
                pointer-events: none;
                cursor: default;
                overflow: hidden;
                transform: translateZ(0);
            `;

            const splineViewer = document.createElement('spline-viewer');
            splineViewer.setAttribute('url', 'https://prod.spline.design/A2iZA6xU4DxAyFHi/scene.splinecode');
            splineViewer.style.cssText = `
                width: 100%;
                height: 100%;
                display: block;
                pointer-events: none;
                cursor: default;
            `;

            splineContainer.appendChild(splineViewer);
            document.body.insertBefore(splineContainer, document.body.firstChild);

            const fixSplineViewer = () => {
                const viewer = document.querySelector('#spline-bg-container spline-viewer') as any;
                if (!viewer?.shadowRoot) return;

                const logo = viewer.shadowRoot.getElementById('logo');
                if (logo) logo.style.display = 'none';

                viewer.shadowRoot.querySelectorAll('a').forEach((a: HTMLAnchorElement) => {
                    if (a.href?.includes('spline.design')) a.style.display = 'none';
                });

                viewer.shadowRoot.querySelectorAll('canvas').forEach((canvas: HTMLCanvasElement) => {
                    canvas.style.cursor = 'default';
                    canvas.style.pointerEvents = 'none';
                });

                if (!viewer.shadowRoot.getElementById('cursor-fix-style')) {
                    const styleEl = document.createElement('style');
                    styleEl.id = 'cursor-fix-style';
                    styleEl.textContent = `
                        * { cursor: default !important; pointer-events: none !important; }
                        canvas { cursor: default !important; pointer-events: none !important; }
                        #logo, a[href*="spline"] { display: none !important; }
                    `;
                    viewer.shadowRoot.appendChild(styleEl);
                }
            };

            visibilityHandler = () => {
                if (!splineContainer) return;
                const viewer = document.querySelector('#spline-bg-container spline-viewer') as any;
                if (document.hidden) {
                    splineContainer.style.visibility = 'hidden';
                    if (typeof viewer?.pause === 'function') viewer.pause();
                } else {
                    splineContainer.style.visibility = 'visible';
                    if (typeof viewer?.play === 'function') viewer.play();
                }
            };
            document.addEventListener('visibilitychange', visibilityHandler);

            fixSplineViewer();
            visibilityHandler();
            interval = setInterval(fixSplineViewer, 1000);
            timeout = setTimeout(() => {
                if (interval) clearInterval(interval);
            }, 8000);
        }

        return () => {
            const splineEl = document.getElementById('spline-bg-container');
            if (splineEl) splineEl.remove();
            const fallbackEl = document.getElementById('spline-bg-fallback');
            if (fallbackEl) fallbackEl.remove();

            themeObserver.disconnect();
            if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);

            if (networkBg) networkBg.style.display = '';
            if (layoutRoot) layoutRoot.style.background = '';
            if (pageContent) {
                pageContent.style.background = '';
                pageContent.style.zIndex = '';
                pageContent.style.position = '';
            }
            if (mainArea) {
                mainArea.style.background = '';
                mainArea.style.overflow = '';
                mainArea.style.transition = '';
            }

            document.body.style.background = '';
            document.documentElement.style.background = '';
            if (rootEl) rootEl.style.background = '';

            if (interval) clearInterval(interval);
            if (timeout) clearTimeout(timeout);

            splineContainer = null;
        };
    }, [step, liteMode, isMobile]);

    return (
        <div className={`font-sans ${step === 'selection' ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
                <main className={step === 'builder' ? 'w-full' : 'max-w-[1200px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8'}>
                    <AnimatePresence mode="wait">
                        {step === 'selection' && (
                            <motion.div
                                key="selection"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.4 }}
                                className="h-[calc(100vh-6rem)] flex items-center justify-center"
                            >

                                {/* Content — dynamic text interaction with Spline ribbons */}
                                <div className="max-w-3xl mx-auto text-center space-y-12 py-10">
                                    <div className="space-y-6">
                                        <div className="w-20 h-20 bg-white/30 dark:bg-white/10 backdrop-blur-xl rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-lg border border-white/20">
                                            <FileText className="w-10 h-10 text-indigo-600 dark:text-white" />
                                        </div>
                                        <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight spline-blend-heading">
                                            Let's Start Your Career Journey!
                                        </h1>
                                        <p className="text-lg font-semibold max-w-xl mx-auto spline-blend-paragraph">
                                            To provide you with the best career guidance, we need to understand your current profile.
                                        </p>
                                    </div>

                                    <div className="space-y-8">
                                        <h2 className="text-2xl font-black tracking-tight spline-blend-subheading">
                                            Do you have an existing resume?
                                        </h2>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                                            <button
                                                onClick={() => setStep('upload')}
                                                className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl p-6 sm:p-10 rounded-2xl sm:rounded-[3rem] shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all border-2 border-white/40 dark:border-white/10 hover:border-white/60 group text-center space-y-4 sm:space-y-6"
                                            >
                                                <div className="w-16 h-16 bg-green-50 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto text-green-500 group-hover:scale-110 transition-transform">
                                                    <CheckCircle2 className="w-8 h-8" />
                                                </div>
                                                <div className="space-y-2">
                                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white">Yes, I have one</h3>
                                                    <p className="text-gray-500 dark:text-gray-400 font-medium text-sm px-4">Upload your existing resume for analysis</p>
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => setStep('builder')}
                                                className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl p-6 sm:p-10 rounded-2xl sm:rounded-[3rem] shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all border-2 border-white/40 dark:border-white/10 hover:border-white/60 group text-center space-y-4 sm:space-y-6"
                                            >
                                                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto text-red-400 group-hover:scale-110 transition-transform">
                                                    <XCircle className="w-8 h-8" />
                                                </div>
                                                <div className="space-y-2">
                                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white">No, I need help</h3>
                                                    <p className="text-gray-400 font-medium text-sm px-4">Let our AI help you build a professional resume</p>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* CSS animation for the text gradient shift effect */}
                                <style>{`
                                    @keyframes textGradientShift {
                                        0% {
                                            background-position: 0% 50%;
                                        }
                                        50% {
                                            background-position: 100% 50%;
                                        }
                                        100% {
                                            background-position: 0% 50%;
                                        }
                                    }
                                `}</style>
                            </motion.div>
                        )}

                        {step === 'builder' && (
                            <Suspense
                                fallback={
                                    <div className="max-w-4xl mx-auto py-10 space-y-6 animate-pulse">
                                        <div className="h-16 bg-white/80 rounded-3xl border border-slate-100" />
                                        <div className="h-10 bg-white/80 rounded-2xl border border-slate-100" />
                                        <div className="h-[480px] bg-white/80 rounded-[3rem] border border-slate-100" />
                                    </div>
                                }
                            >
                                <AIBuilder onBack={() => setStep('selection')} editResume={editResume} />
                            </Suspense>
                        )}

                        {step === 'upload' && (
                            <motion.div
                                key="upload"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="max-w-3xl mx-auto py-10 space-y-12"
                            >
                                <div className="text-center space-y-6">
                                    <div className="w-16 h-16 bg-blue-50 dark:bg-[#0a1628] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                                        <div className="relative">
                                            <FileText className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                                            <div className="absolute -top-2 -right-2 bg-red-400 text-white rounded-lg p-1 shadow-sm">
                                                <Upload className="w-3 h-3" />
                                            </div>
                                        </div>
                                    </div>
                                    <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight drop-shadow-md">Upload Your Resume</h1>
                                    <p className="text-slate-600 dark:text-blue-100 text-lg font-medium drop-shadow-sm">Upload your existing resume and let our AI analyze your skills, experience, and qualifications</p>
                                </div>

                                <div className="relative border-2 border-dashed border-white/30 rounded-2xl sm:rounded-[3rem] p-8 sm:p-16 text-center group hover:border-white/50 transition-all bg-white/10 backdrop-blur-md shadow-xl overflow-hidden">
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="flex flex-col items-center justify-center space-y-6">
                                        <div className="w-20 h-20 bg-gray-50 rounded-[1.5rem] flex items-center justify-center text-gray-300 group-hover:text-[#5c52d2] group-hover:bg-purple-50 transition-all shadow-inner">
                                            <Upload className="w-10 h-10" />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xl font-black text-gray-900">
                                                {file ? file.name : "Drag & drop your resume here"}
                                            </p>
                                            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
                                                or click to browse files
                                            </p>
                                        </div>
                                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Supported formats: PDF, DOC, DOCX (Max 5MB)</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-center gap-6">
                                    <Button
                                        onClick={() => setStep('selection')}
                                        variant="outline"
                                        className="h-14 px-10 rounded-2xl font-black border-gray-200 text-gray-400 hover:text-gray-600"
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleUpload}
                                        disabled={!file || loading}
                                        className="h-14 px-10 rounded-2xl font-black bg-[#5c52d2] hover:bg-[#4b43b0] text-white shadow-xl shadow-purple-100 disabled:opacity-50 relative overflow-hidden"
                                    >
                                        {loading ? (
                                            <div className="flex flex-col items-center">
                                                <span>{ocrProgress || 'Analyzing...'}</span>
                                            </div>
                                        ) : "Analyze Resume"}
                                        {loading && (
                                            <motion.div
                                                className="absolute bottom-0 left-0 h-1 bg-white/30"
                                                initial={{ width: 0 }}
                                                animate={{ width: '100%' }}
                                                transition={{ duration: 15, ease: "linear" }}
                                            />
                                        )}
                                    </Button>
                                </div>

                                <div className="bg-[#eff6ff]/60 border border-blue-100 rounded-[2rem] p-8 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <ShieldCheck className="w-5 h-5 text-blue-500" />
                                        <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Your Privacy Matters</h4>
                                    </div>
                                    <p className="text-sm font-medium text-gray-500 leading-relaxed">
                                        Your resume is processed securely and used only for analysis. We extract skills, experience, and qualifications to provide personalized career guidance. Your data is never shared with third parties.
                                    </p>
                                </div>

                                {error && (
                                    <div className="p-6 bg-red-50 text-red-600 rounded-3xl border border-red-100 flex items-center gap-4 font-black">
                                        <AlertCircle className="w-6 h-6" />
                                        {error}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {step === 'templates' && (
                            <motion.div
                                key="templates"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="max-w-6xl mx-auto py-10 space-y-12"
                            >
                                <div className="text-center space-y-6">
                                    <h1 className="text-5xl font-black text-gray-900 tracking-tight leading-tight">Customize Your Resume</h1>
                                    <p className="text-gray-400 text-lg font-medium max-w-2xl mx-auto">
                                        Select a professional template and theme color that matches your brand. You can preview each style before finalization.
                                    </p>
                                </div>

                                <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-50 space-y-8 max-w-4xl mx-auto">
                                    <div className="text-center space-y-2">
                                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">Step 1: Choose Document Theme</h3>
                                        <p className="text-sm font-bold text-gray-500">Pick a primary color for your professional brand</p>
                                    </div>
                                    <div className="flex items-center justify-center gap-6">
                                        {[
                                            { id: 'indigo', color: '#5c52d2', bg: 'bg-[#5c52d2]' },
                                            { id: 'blue', color: '#3b82f6', bg: 'bg-[#3b82f6]' },
                                            { id: 'rose', color: '#f43f5e', bg: 'bg-[#f43f5e]' },
                                            { id: 'slate', color: '#334155', bg: 'bg-[#334155]' }
                                        ].map((theme) => (
                                            <button
                                                key={theme.id}
                                                onClick={() => setSelectedTheme(theme.id)}
                                                className={`w-16 h-16 rounded-[1.5rem] transition-all flex items-center justify-center shadow-lg ${theme.bg} ${selectedTheme === theme.id
                                                    ? 'ring-8 ring-offset-4 ring-gray-50 scale-110'
                                                    : 'hover:scale-105 opacity-80 hover:opacity-100'
                                                    }`}
                                            >
                                                {selectedTheme === theme.id && <CheckCircle2 className="w-7 h-7 text-white" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-3 gap-8">
                                    {[
                                        {
                                            id: 'modern',
                                            name: 'Modern Professional',
                                            desc: 'Clean, modern design with subtle colors and excellent readability',
                                            badge: 'Minimalist with accent colors',
                                            color: 'bg-blue-500',
                                            preview: (
                                                <div className="w-full h-full bg-slate-50 p-4 text-[6px] space-y-2 border-b">
                                                    <div className="border-b pb-2">
                                                        <div className="font-black text-[10px] text-gray-900">John Doe</div>
                                                        <div className="text-blue-500 font-bold">Software Engineer</div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="font-black text-gray-400 uppercase tracking-tighter">Experience</div>
                                                        <div className="font-bold">Senior Developer • Tech Corp</div>
                                                        <div className="text-gray-400 text-[4px]">2022 - Present</div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="font-black text-gray-400 uppercase tracking-tighter">Skills</div>
                                                        <div className="flex gap-1">
                                                            <span className="bg-white border rounded px-1">React</span>
                                                            <span className="bg-white border rounded px-1">Node.js</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        },
                                        {
                                            id: 'classic',
                                            name: 'Classic Traditional',
                                            desc: 'Traditional format preferred by conservative industries',
                                            badge: 'Black & white, formal layout',
                                            color: 'bg-slate-800',
                                            preview: (
                                                <div className="w-full h-full bg-white p-4 text-[6px] space-y-3 border-b">
                                                    <div className="text-center uppercase tracking-widest border-b pb-2">
                                                        <div className="font-black text-[10px]">JOHN DOE</div>
                                                        <div className="text-[4px]">john.doe@email.com • +1 555 123 4567</div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="font-black border-b border-gray-900 pb-0.5 uppercase">Professional Experience</div>
                                                        <div className="font-bold">Senior Developer</div>
                                                        <div className="italic">Tech Corp, 2022 - Present</div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="font-black border-b border-gray-900 pb-0.5 uppercase">Technical Skills</div>
                                                        <div className="text-[5px]">React, Node.js, Python, JavaScript, SQL</div>
                                                    </div>
                                                </div>
                                            )
                                        },
                                        {
                                            id: 'creative',
                                            name: 'Creative Designer',
                                            desc: 'Eye-catching design for creative professionals',
                                            badge: 'Colorful with creative elements',
                                            color: 'bg-pink-500',
                                            preview: (
                                                <div className="w-full h-full bg-pink-50/30 p-4 text-[6px] space-y-2 border-b relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-full h-6 bg-pink-500 p-2 text-white font-black text-[8px]">John Doe</div>
                                                    <div className="pt-6">
                                                        <div className="text-pink-600 font-bold">Creative Software Engineer</div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <div className="font-black text-pink-400 uppercase">Contact</div>
                                                            <div>john.doe@email.com</div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="font-black text-pink-400 uppercase">Experience</div>
                                                            <div className="font-bold">Senior Developer</div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-white rounded-lg p-2 border border-pink-100">
                                                        <div className="font-black text-pink-400 uppercase mb-1">Skills</div>
                                                        <div className="flex gap-1 text-[4px]">
                                                            <span className="text-pink-600">React • Node.js • Python</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }
                                    ].map((tmpl) => (
                                        <Card key={tmpl.id} className={`group cursor-pointer border-2 transition-all overflow-hidden rounded-[2.5rem] ${selectedTemplate === tmpl.id ? `border-[${selectedTheme === 'indigo' ? '#5c52d2' : selectedTheme === 'blue' ? '#3b82f6' : selectedTheme === 'rose' ? '#f43f5e' : '#334155'}] shadow-2xl ring-4 ring-purple-100` : 'border-transparent hover:border-gray-200'}`} onClick={() => setSelectedTemplate(tmpl.id)}>
                                            <div className="h-48 overflow-hidden relative">
                                                {tmpl.preview}
                                                <div className="absolute top-4 right-4">
                                                    <div className={`w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-all ${selectedTemplate === tmpl.id ? tmpl.color : 'bg-gray-100'}`}>
                                                        {selectedTemplate === tmpl.id && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                    </div>
                                                </div>
                                            </div>
                                            <CardContent className="p-8 space-y-4">
                                                <div className="space-y-2">
                                                    <h3 className="text-xl font-black text-gray-900 tracking-tight">{tmpl.name}</h3>
                                                    <p className="text-gray-400 font-medium text-sm leading-relaxed">{tmpl.desc}</p>
                                                </div>
                                                <div className="flex items-center gap-2 text-[#5c52d2]/60">
                                                    <FileText className="w-4 h-4" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">{tmpl.badge}</span>
                                                </div>
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowPreview(tmpl.id);
                                                    }}
                                                    variant="outline"
                                                    style={{
                                                        borderColor: selectedTemplate === tmpl.id ? (selectedTheme === 'indigo' ? '#5c52d2' : selectedTheme === 'blue' ? '#3b82f6' : selectedTheme === 'rose' ? '#f43f5e' : '#334155') : undefined,
                                                        color: selectedTemplate === tmpl.id ? (selectedTheme === 'indigo' ? '#5c52d2' : selectedTheme === 'blue' ? '#3b82f6' : selectedTheme === 'rose' ? '#f43f5e' : '#334155') : undefined
                                                    }}
                                                    className={`w-full h-12 rounded-xl font-black transition-all ${selectedTemplate === tmpl.id ? 'bg-purple-50' : 'border-gray-100 text-gray-400 group-hover:border-gray-200'}`}
                                                >
                                                    <Sparkles className="w-4 h-4 mr-2" /> Preview
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                <div className="max-w-2xl mx-auto">
                                    <Card className={`group cursor-pointer border-2 transition-all overflow-hidden rounded-[2.5rem] bg-[#0d1117] ${selectedTemplate === 'developer' ? 'border-[#5c52d2] shadow-2xl ring-4 ring-purple-100' : 'border-transparent hover:border-gray-800'}`} onClick={() => setSelectedTemplate('developer')}>
                                        <div className="flex md:flex-row flex-col p-8 gap-8 items-center">
                                            <div className="w-64 h-40 bg-[#161b22] rounded-2xl border border-gray-800 p-4 font-mono text-[8px] text-green-400 overflow-hidden relative group-hover:bg-[#1c2128] transition-all flex-shrink-0">
                                                <div className="flex gap-1.5 mb-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-gray-500">$ whoami</div>
                                                    <div className="text-white">john_doe@developer:~</div>
                                                    <div className="text-gray-500 mt-2">class Experience &#123;</div>
                                                    <div className="pl-2">position: "Senior Developer"</div>
                                                    <div className="pl-2">company: "Tech Corp"</div>
                                                    <div className="text-gray-500">&#125;</div>
                                                    <div className="text-blue-400 mt-1">const skills = ["React", "Node.js"]</div>
                                                </div>
                                            </div>
                                            <div className="space-y-4 flex-grow">
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-1">
                                                        <h3 className="text-2xl font-black text-white tracking-tight">Code / Developer</h3>
                                                        <p className="text-gray-500 font-medium text-sm">A unique terminal-inspired layout for tech roles</p>
                                                    </div>
                                                    <div className={`w-8 h-8 rounded-full border-4 border-[#161b22] shadow-sm flex items-center justify-center transition-all ${selectedTemplate === 'developer' ? '' : 'bg-gray-800'}`}
                                                        style={{ backgroundColor: selectedTemplate === 'developer' ? (selectedTheme === 'indigo' ? '#5c52d2' : selectedTheme === 'blue' ? '#3b82f6' : selectedTheme === 'rose' ? '#f43f5e' : '#334155') : undefined }}
                                                    >
                                                        {selectedTemplate === 'developer' && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                    </div>
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="flex items-center gap-2 text-green-500/60 uppercase tracking-widest font-black text-[10px]">
                                                        <Laptop className="w-4 h-4" /> Dark Terminal
                                                    </div>
                                                    <div className="flex items-center gap-2 text-blue-500/60 uppercase tracking-widest font-black text-[10px]">
                                                        <PlusCircle className="w-4 h-4" /> JSON-Powered
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>

                                <div className="flex items-center justify-center gap-6 pb-20">
                                    <Button
                                        onClick={() => setStep('builder')}
                                        variant="outline"
                                        className="h-16 px-12 rounded-2xl font-black border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-white"
                                    >
                                        Back to Editor
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setStep('builder');
                                        }}
                                        style={{ backgroundColor: selectedTheme === 'indigo' ? '#5c52d2' : selectedTheme === 'blue' ? '#3b82f6' : selectedTheme === 'rose' ? '#f43f5e' : '#334155' }}
                                        className="h-16 px-12 rounded-2xl font-black text-white shadow-2xl shadow-purple-200 gap-3 group"
                                    >
                                        Confirm Layout <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </div>

                                {/* Preview Modal */}
                                <AnimatePresence>
                                    {showPreview && (
                                        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] overflow-hidden shadow-2xl relative flex flex-col"
                                            >
                                                <button
                                                    onClick={() => setShowPreview(null)}
                                                    className="absolute top-6 right-6 w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center hover:bg-gray-100 transition-all z-10"
                                                >
                                                    <XCircle className="w-6 h-6 text-gray-400" />
                                                </button>

                                                <div className="p-12 overflow-y-auto">
                                                    <div className="space-y-4 mb-10">
                                                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Template Preview</h2>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-3 h-3 rounded-full ${selectedTheme === 'indigo' ? 'bg-[#5c52d2]' : selectedTheme === 'blue' ? 'bg-blue-500' : selectedTheme === 'rose' ? 'bg-rose-500' : 'bg-slate-600'}`}></div>
                                                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{showPreview} Template</p>
                                                        </div>
                                                    </div>

                                                    <div className="aspect-[1/1.4] bg-gray-50 rounded-3xl border-2 border-gray-100 shadow-inner p-10 overflow-hidden relative">
                                                        {/* Full Scale Preview Mockup */}
                                                        <div className="space-y-10 scale-150 origin-top transform">
                                                            <div className="flex justify-between items-start border-b pb-8">
                                                                <div>
                                                                    <h1 className="text-2xl font-black text-gray-900">{formData.personal.first} {formData.personal.last}</h1>
                                                                    <p className="text-blue-500 font-bold text-sm">Software Engineer</p>
                                                                </div>
                                                                <div className="text-[8px] text-gray-400 text-right font-medium">
                                                                    {formData.personal.email}<br />
                                                                    {formData.personal.phone}<br />
                                                                    {formData.personal.location}
                                                                </div>
                                                            </div>

                                                            <div className="space-y-6">
                                                                <div className="flex gap-10">
                                                                    <div className="w-1/3 space-y-4">
                                                                        <div className="space-y-2">
                                                                            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Skills</h3>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {formData.skills.split(',').map((s: string) => (
                                                                                    <span key={s} className="bg-white border text-[6px] px-1 rounded-sm">{s.trim()}</span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="w-2/3 space-y-6">
                                                                        <div className="space-y-2">
                                                                            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Experience</h3>
                                                                            {formData.experience.map((exp: any, i: number) => (
                                                                                <div key={i} className="space-y-1">
                                                                                    <div className="font-bold text-[8px]">{exp.role} • {exp.company}</div>
                                                                                    <div className="text-[6px] text-gray-400 italic">{exp.period}</div>
                                                                                    <p className="text-[6px] text-gray-500 leading-relaxed">{exp.desc}</p>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Gradient Overlay for Fade Out */}
                                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-50 via-transparent to-transparent pointer-events-none"></div>
                                                    </div>
                                                </div>

                                                <div className="p-8 bg-gray-50 border-t flex justify-end gap-4">
                                                    <Button onClick={() => setShowPreview(null)} variant="ghost" className="font-black text-gray-400">Close Preview</Button>
                                                    <Button
                                                        onClick={() => {
                                                            setSelectedTemplate(showPreview!);
                                                            setShowPreview(null);
                                                        }}
                                                        style={{ backgroundColor: selectedTheme === 'indigo' ? '#5c52d2' : selectedTheme === 'blue' ? '#3b82f6' : selectedTheme === 'rose' ? '#f43f5e' : '#334155' }}
                                                        className="font-black text-white px-8 rounded-xl"
                                                    >
                                                        Select This Template
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}

                        {step === 'analysis' && analysis && (
                            <motion.div
                                key="analysis"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="max-w-5xl mx-auto py-10 space-y-10"
                            >
                                {/* Header Section */}
                                <div className="text-center space-y-6">
                                    <div className="w-20 h-20 bg-yellow-50 rounded-[2rem] flex items-center justify-center mx-auto shadow-sm">
                                        <Sparkles className="w-10 h-10 text-yellow-500" />
                                    </div>
                                    <div className="space-y-4">
                                        <h1 className="text-5xl font-black text-gray-900 tracking-tight">Your Career Audit is Ready</h1>
                                        <p className="text-gray-400 text-lg font-medium">We've powered through your profile with advanced AI</p>
                                    </div>
                                </div>

                                {/* Main Stats Grid */}
                                <div className="grid md:grid-cols-3 gap-8">
                                    {/* Overall Score */}
                                    <Card className="md:col-span-2 border-none shadow-sm bg-white p-12 rounded-[3.5rem] relative overflow-hidden group">
                                        <div className="absolute -top-10 -right-10 text-blue-50/40 group-hover:scale-110 transition-transform">
                                            <Target className="w-64 h-64" />
                                        </div>
                                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                                            <div className="flex flex-col items-center">
                                                <div className="relative">
                                                    <span className="text-[120px] leading-none font-black text-[#5c52d2] tracking-tighter drop-shadow-sm">
                                                        {analysis.ats_score}
                                                    </span>
                                                    <span className="text-4xl font-black text-[#5c52d2]/40 absolute top-4 -right-8">%</span>
                                                </div>
                                                <div className="bg-[#5c52d2]/10 px-6 py-2 rounded-full mt-4">
                                                    <p className="text-[#5c52d2] font-black uppercase text-xs tracking-widest">ATS Readiness</p>
                                                </div>
                                            </div>
                                            <div className="space-y-6 flex-1 text-center md:text-left">
                                                <h3 className="text-3xl font-black text-gray-900">
                                                    {analysis.ats_score > 85 ? 'Exceptional Profile!' : analysis.ats_score > 70 ? 'Strong Candidate' : 'Growth Potential'}
                                                </h3>
                                                <p className="text-gray-500 font-medium leading-relaxed">
                                                    Your resume has been benchmarked against top-tier industry standards. {analysis.industry_fit?.verdict}
                                                </p>
                                                <div className="flex items-center gap-4 justify-center md:justify-start">
                                                    <div className="flex -space-x-3">
                                                        {[1, 2, 3].map(i => (
                                                            <div key={i} className="w-10 h-10 rounded-xl bg-purple-50 border-4 border-white flex items-center justify-center">
                                                                <Award className="w-4 h-4 text-[#5c52d2]" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <span className="text-gray-400 font-bold text-xs uppercase tracking-widest">Benchmarked against Fortune 500 standards</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    {/* Industry Fit Card */}
                                    <Card className="border-none shadow-sm bg-gradient-to-br from-[#5c52d2] to-[#7c3aed] p-10 rounded-[3.5rem] text-white space-y-8 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-6 opacity-20">
                                            <Layers className="w-24 h-24" />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Industry Alignment</p>
                                            <h3 className="text-2xl font-black">Top Industries</h3>
                                        </div>
                                        <div className="space-y-4">
                                            {analysis.industry_fit?.top_industries?.map((industry: string, i: number) => (
                                                <div key={i} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center justify-between">
                                                    <span className="font-bold">{industry}</span>
                                                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="pt-4 border-t border-white/10 text-center">
                                            <span className="text-4xl font-black">{analysis.industry_fit?.score}%</span>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mt-2">Overall Fit Score</p>
                                        </div>
                                    </Card>
                                </div>

                                {/* Skills & Keywords Analysis */}
                                <div className="grid md:grid-cols-2 gap-8">
                                    <Card className="border-none shadow-sm bg-white p-12 rounded-[3.5rem] space-y-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
                                                <Cpu className="w-7 h-7" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Keyword Mapping</h3>
                                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Detected Technical Expertise</p>
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <div>
                                                <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Matched Skills</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {analysis.keyword_analysis?.matched?.map((skill: string, i: number) => (
                                                        <span key={i} className="px-4 py-2 bg-green-50 text-green-600 rounded-xl font-bold text-xs border border-green-100/50">
                                                            {skill}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {analysis.keyword_analysis?.missing?.length > 0 && (
                                                <div>
                                                    <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Critical Gaps</Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {analysis.keyword_analysis?.missing?.map((skill: string, i: number) => (
                                                            <span key={i} className="px-4 py-2 bg-orange-50 text-orange-400 rounded-xl font-bold text-xs border border-orange-100/50">
                                                                {skill}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </Card>

                                    <Card className="border-none shadow-sm bg-white p-12 rounded-[3.5rem] space-y-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-500">
                                                <Award className="w-7 h-7" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Profile Strengths</h3>
                                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Competitive Advantages</p>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            {analysis.strengths?.map((strength: string, i: number) => (
                                                <div key={i} className="flex gap-4 group">
                                                    <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center text-green-600 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </div>
                                                    <p className="font-bold text-gray-600 leading-relaxed text-sm">{strength}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                </div>

                                {/* Improvement Plan */}
                                <Card className="border-none shadow-sm bg-[#fafafa] p-12 rounded-[3.5rem] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-8 text-gray-200">
                                        <Lightbulb className="w-32 h-32" />
                                    </div>
                                    <div className="relative z-10 space-y-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500">
                                                <Target className="w-7 h-7" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Optimization Roadmap</h3>
                                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Actionable Improvement Steps</p>
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-12">
                                            <div className="space-y-6">
                                                <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Core Weaknesses</Label>
                                                {analysis.weaknesses?.map((weakness: string, i: number) => (
                                                    <div key={i} className="flex gap-4">
                                                        <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-400 flex-shrink-0 mt-0.5">
                                                            <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                                                        </div>
                                                        <p className="font-bold text-gray-500 text-sm">{weakness}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="space-y-6">
                                                <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Action Items</Label>
                                                {analysis.improvement_plan?.map((step: string, i: number) => (
                                                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4 hover:shadow-md transition-shadow">
                                                        <div className="w-8 h-8 rounded-xl bg-[#5c52d2] flex items-center justify-center text-white font-black text-xs">
                                                            {i + 1}
                                                        </div>
                                                        <p className="font-black text-gray-700 text-sm leading-snug">{step}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                {/* Footer Action */}
                                <div className="flex flex-col items-center gap-8 pt-10">
                                    <div className="flex flex-wrap justify-center gap-6">
                                        <Button
                                            onClick={() => setStep('builder')}
                                            variant="outline"
                                            className="h-16 px-12 rounded-2xl font-black border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-white text-lg"
                                        >
                                            Optimize Details
                                        </Button>
                                        <Button
                                            onClick={() => window.location.href = '/career'}
                                            style={{ background: 'linear-gradient(135deg, #5c52d2 0%, #7c3aed 100%)' }}
                                            className="h-16 px-12 rounded-2xl font-black text-white text-lg gap-4 shadow-2xl shadow-purple-200 group hover:scale-[1.02] transition-all"
                                        >
                                            Continue to Career Paths <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </div>
                                    <p className="text-gray-400 font-bold text-sm">Pro Tip: Complete the optimization steps above to boost your score by up to 25%</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
        </div>
    );
}
