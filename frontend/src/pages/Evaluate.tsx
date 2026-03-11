import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Target, Search, BarChart3, FileSearch, Sparkles, ChevronRight, Zap,
    TrendingUp, ShieldCheck, Upload, FileText, CheckCircle2, AlertCircle,
    BrainCircuit, ArrowRight, Loader2, MinusCircle, FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeResume } from '../services/resume';

interface AnalysisResult {
    ats_score: number;
    keyword_analysis: {
        matched: string[];
        missing: string[];
        extra: string[];
    };
    industry_fit: {
        score: number;
        verdict: string;
        top_industries: string[];
    };
    strengths: string[];
    weaknesses: string[];
    improvement_plan: string[];
}

export default function Evaluate() {
    const [file, setFile] = useState<File | null>(null);
    const [jobDescription, setJobDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleAnalyze = async () => {
        if (!file) {
            setError('Please upload a resume first.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const data = await analyzeResume(file, jobDescription);
            setResult(data.analysis);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Analysis failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderFileUploader = () => (
        <Card className="p-12 rounded-[3.5rem] border-dashed border-2 border-slate-200 bg-white/50 backdrop-blur-xl shadow-2xl shadow-slate-200/50 max-w-3xl mx-auto mb-16 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            <div className="relative z-10 text-center space-y-8">
                <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500">
                    {file ? (
                        <FileCheck className="w-12 h-12 text-[#5c52d2]" />
                    ) : (
                        <Upload className="w-12 h-12 text-[#5c52d2]" />
                    )}
                </div>

                <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900 leading-none">
                        {file ? file.name : 'Upload Your Resume'}
                    </h3>
                    <p className="text-slate-400 font-bold">
                        {file ? `${(file.size / 1024).toFixed(1)} KB • Ready to analyze` : 'Drag and drop your PDF here, or click to browse'}
                    </p>
                </div>

                <div className="max-w-md mx-auto">
                    <textarea
                        placeholder="Paste target Job Description (optional) for gap analysis..."
                        className="w-full p-6 rounded-3xl bg-slate-50 border-none text-sm font-bold text-slate-600 focus:ring-2 focus:ring-indigo-100 transition-all min-h-[120px] resize-none"
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                    />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <input
                        type="file"
                        id="resume-upload"
                        className="hidden"
                        accept=".pdf"
                        onChange={handleFileChange}
                    />
                    <Button
                        onClick={() => document.getElementById('resume-upload')?.click()}
                        variant="outline"
                        className="rounded-2xl h-14 px-8 font-black border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                        {file ? 'Change File' : 'Select PDF'}
                    </Button>

                    <Button
                        disabled={!file || loading}
                        onClick={handleAnalyze}
                        className="bg-[#5c52d2] hover:bg-[#4a41a8] text-white rounded-2xl h-14 px-10 font-black shadow-xl shadow-indigo-200 min-w-[180px]"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Analyzing...
                            </div>
                        ) : 'Start Analysis'}
                    </Button>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-center gap-2 text-rose-500 font-bold text-sm"
                    >
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </motion.div>
                )}
            </div>
        </Card>
    );

    const renderResults = () => {
        if (!result) return null;

        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-12 pb-20"
            >
                {/* Score Section */}
                <div className="grid md:grid-cols-3 gap-8">
                    {/* ATS SCORE CARD */}
                    <Card className="p-10 rounded-[3.5rem] bg-white shadow-2xl shadow-slate-200/50 border-none flex flex-col items-center text-center space-y-6">
                        <div className="relative">
                            <svg className="w-32 h-32 transform -rotate-90">
                                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent"
                                    strokeDasharray={364}
                                    strokeDashoffset={364 - (364 * result.ats_score) / 100}
                                    className="text-emerald-500 stroke-[10]"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-black text-slate-800 tracking-tighter">{result.ats_score}%</span>
                                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">ATS Score</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-slate-900">Optimization Level</h3>
                            <p className="text-slate-400 text-sm font-bold">Your document's visibility to corporate screening systems.</p>
                        </div>
                    </Card>

                    {/* INDUSTRY FIT CARD */}
                    <Card className="p-10 rounded-[3.5rem] bg-indigo-600 shadow-2xl shadow-indigo-200/50 border-none text-white flex flex-col justify-between overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
                        <div className="space-y-6 relative z-10">
                            <div className="flex justify-between items-start">
                                <FileSearch className="w-10 h-10 text-blue-200" />
                                <div className="bg-blue-200/20 px-4 py-1.5 rounded-full backdrop-blur-md">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">Compatibility: {result.industry_fit.score}%</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black tracking-tight">Industry Verdict</h3>
                                <p className="text-blue-100/80 text-sm font-bold leading-relaxed">{result.industry_fit.verdict}</p>
                            </div>
                        </div>
                        <div className="pt-6 relative z-10">
                            <div className="flex flex-wrap gap-2">
                                {result.industry_fit.top_industries.map((ind, i) => (
                                    <span key={i} className="bg-white/10 border border-white/20 px-3 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase">
                                        {ind}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {/* KEYWORD ANALYTICS */}
                    <Card className="p-10 rounded-[3.5rem] bg-white shadow-2xl shadow-slate-200/50 border-none space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
                                <Search className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-xl text-slate-900">Keyword Gaps</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Skill Alignment</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-emerald-50 rounded-2xl p-4 space-y-2">
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Matched</span>
                                <span className="text-2xl font-black text-emerald-700">{result.keyword_analysis.matched.length}</span>
                            </div>
                            <div className="bg-rose-50 rounded-2xl p-4 space-y-2">
                                <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest block">Missing</span>
                                <span className="text-2xl font-black text-rose-700">{result.keyword_analysis.missing.length}</span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Detailed Analysis Section */}
                <div className="grid lg:grid-cols-2 gap-10">
                    <Card className="p-12 rounded-[3.5rem] bg-white border-none shadow-xl shadow-slate-100 space-y-10">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                            <BrainCircuit className="w-8 h-8 text-[#5c52d2]" />
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Strengths & Insights</h3>
                        </div>
                        <div className="space-y-4">
                            {result.strengths.map((s, i) => (
                                <div key={i} className="flex items-start gap-4 p-4 rounded-3xl bg-emerald-50/50 group hover:bg-emerald-50 transition-colors">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-1" />
                                    <span className="text-slate-700 font-bold leading-relaxed">{s}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="p-12 rounded-[3.5rem] bg-white border-none shadow-xl shadow-slate-100 space-y-10">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                            <AlertCircle className="w-8 h-8 text-rose-500" />
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Critical Weaknesses</h3>
                        </div>
                        <div className="space-y-4">
                            {result.weaknesses.map((w, i) => (
                                <div key={i} className="flex items-start gap-4 p-4 rounded-3xl bg-rose-50/50 group hover:bg-rose-50 transition-colors">
                                    <MinusCircle className="w-5 h-5 text-rose-500 shrink-0 mt-1" />
                                    <span className="text-slate-700 font-bold leading-relaxed">{w}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Improvement Roadmap */}
                <Card className="p-12 rounded-[4rem] bg-gradient-to-br from-slate-900 to-slate-800 border-none shadow-2xl shadow-slate-200 text-white space-y-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#5c52d2] opacity-20 rounded-full -mr-48 -mt-48 blur-[100px]" />

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10 border-b border-white/10 pb-10">
                        <div className="space-y-4">
                            <h3 className="text-4xl font-black leading-tight">Optimization Roadmap</h3>
                            <p className="text-slate-400 font-bold max-w-xl">Actionable steps generated by our AI core to propel your application to the top 1% of the candidate pool.</p>
                        </div>
                        <Button
                            onClick={() => { setResult(null); setFile(null); setJobDescription(''); }}
                            className="bg-white text-slate-900 hover:bg-slate-100 rounded-3xl h-14 px-10 font-black shadow-xl shrink-0"
                        >
                            Reset & Re-upload
                        </Button>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 relative z-10">
                        {result.improvement_plan.map((plan, i) => (
                            <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-6 hover:bg-white/10 transition-colors">
                                <div className="w-12 h-12 bg-[#5c52d2] rounded-2xl flex items-center justify-center font-black text-xl">
                                    {i + 1}
                                </div>
                                <p className="text-lg font-bold leading-relaxed">{plan}</p>
                            </div>
                        ))}
                    </div>
                </Card>
            </motion.div>
        );
    };

    return (
        <div className="min-h-screen font-sans pb-20 relative overflow-hidden bg-slate-50 dark:bg-[#050510]">
<main className="max-w-[1300px] mx-auto px-3 sm:px-6 pt-8 sm:pt-16 relative z-10">
                {/* Header Section */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-16 text-center max-w-3xl mx-auto space-y-6"
                >
                    <div className="relative inline-block">
                        <div className="w-20 h-20 bg-gradient-to-br from-[#5c52d2] to-[#7c66dc] text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-purple-200 transform -rotate-6">
                            <Target className="w-10 h-10" />
                        </div>
                        <motion.div
                            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, 0] }}
                            transition={{ duration: 4, repeat: Infinity }}
                            className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center text-white shadow-lg"
                        >
                            <Sparkles className="w-4 h-4" />
                        </motion.div>
                    </div>

                    <div className="space-y-4">
                        <AnimatePresence mode="wait">
                            {result ? (
                                <motion.h1
                                    key="result-h1"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                            className="text-5xl md:text-6xl font-[1000] text-slate-900 tracking-tight leading-[1.1]"
                                >
                                    Analysis <span className="bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">Complete</span>
                                </motion.h1>
                            ) : (
                                <motion.h1
                                    key="initial-h1"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                            className="text-5xl md:text-6xl font-[1000] text-slate-900 tracking-tight leading-[1.1]"
                                >
                                    Evaluate Your <span className="bg-gradient-to-r from-[#5c52d2] to-[#7c66dc] bg-clip-text text-transparent">Potential</span>
                                </motion.h1>
                            )}
                        </AnimatePresence>
                        <p className="text-slate-500 text-base sm:text-xl font-medium max-w-2xl mx-auto">
                            {result ? 'Strategic deep-dive into your professional architecture and market alignment.' : 'Leverage advanced AI to dissect your professional profile and uncover hidden growth opportunities.'}
                        </p>
                    </div>
                </motion.div>

                {/* Upload or Results View */}
                {!result ? renderFileUploader() : renderResults()}

                {/* Audit Summary Mini Cards (Visible only on initial state) */}
                {!result && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid md:grid-cols-3 gap-10 mb-20"
                    >
                        {[
                            {
                                title: 'ATS Score',
                                desc: 'How well your resume ranks against industry standards and automated filters.',
                                icon: BarChart3,
                                color: 'emerald',
                                stat: 'High Accuracy'
                            },
                            {
                                title: 'Keyword Gaps',
                                desc: 'Pinpoint missing technical and soft skills critical for your desired job roles.',
                                icon: Search,
                                color: 'amber',
                                stat: 'Real-time Data'
                            },
                            {
                                title: 'Industry Fit',
                                desc: 'Identify which sectors and company cultures best match your unique skill profile.',
                                icon: FileSearch,
                                color: 'indigo',
                                stat: 'AI-Driven'
                            }
                        ].map((feature, idx) => (
                            <div key={idx} className="group relative p-10 rounded-[3.5rem] border-none shadow-2xl shadow-slate-200/50 bg-white hover:shadow-purple-200/50 transition-all duration-500 flex flex-col overflow-hidden">
                                <div className={`absolute top-0 right-0 w-32 h-32 bg-${feature.color}-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                                <div className="relative z-10 flex flex-col h-full">
                                    <div className={`w-16 h-16 bg-${feature.color}-50 text-${feature.color}-600 rounded-2xl flex items-center justify-center mb-8 shadow-sm group-hover:scale-110 transition-transform duration-500`}>
                                        <feature.icon className="w-8 h-8" />
                                    </div>
                                    <div className="space-y-4 mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] text-${feature.color}-500/80`}>{feature.stat}</span>
                                        </div>
                                        <h3 className="font-[900] text-3xl text-slate-900 tracking-tight leading-none">{feature.title}</h3>
                                        <p className="text-base font-bold text-slate-400 leading-relaxed">
                                            {feature.desc}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}

                {/* Audit Section */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="relative rounded-2xl sm:rounded-[4rem] p-6 sm:p-12 md:p-20 overflow-hidden shadow-2xl shadow-purple-200/50"
                >
                    <div className="absolute inset-0 bg-[#5c52d2]" />
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-[#5c52d2] to-purple-700" />
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white opacity-[0.05] rounded-full -mr-64 -mt-64 blur-[100px]" />

                    <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-12">
                        <div className="space-y-8 max-w-2xl">
                            <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-2 rounded-full border border-white/20">
                                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white">Advanced Career Intelligence</span>
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight">Ready for a <span className="text-blue-200">Full Profile Audit?</span></h2>
                                <p className="text-white/80 text-lg font-bold leading-relaxed">
                                    Our Deep-Dive Evaluation generates a comprehensive 10-page trajectory report.
                                </p>
                            </div>
                        </div>

                        <Button className="group bg-white text-[#5c52d2] hover:bg-slate-50 transition-all rounded-2xl sm:rounded-[2rem] h-14 sm:h-20 px-8 sm:px-12 text-base sm:text-xl font-black shadow-2xl hover:scale-105 active:scale-95 shrink-0 w-full sm:w-auto">
                            Start Full Evaluation
                            <div className="ml-4 w-8 h-8 bg-[#5c52d2]/10 rounded-full flex items-center justify-center group-hover:bg-[#5c52d2] group-hover:text-white transition-all">
                                <ChevronRight className="w-5 h-5" />
                            </div>
                        </Button>
                    </div>
                </motion.div>
            </main>

        </div>
    );
}
