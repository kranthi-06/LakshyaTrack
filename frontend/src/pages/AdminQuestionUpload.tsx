import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload, FileText, Brain, Loader2, CheckCircle2, AlertCircle,
  Sparkles, Database, RefreshCw, Trash2, ChevronDown, ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface ExtractedQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty?: string;
  topic?: string;
  company?: string;
}

const TOPICS = [
  { key: 'coding-decoding', label: 'Coding-Decoding' },
  { key: 'blood-relations', label: 'Blood Relations' },
  { key: 'seating-arrangement', label: 'Seating Arrangement' },
  { key: 'puzzles', label: 'Puzzles' },
  { key: 'syllogisms', label: 'Syllogisms' },
  { key: 'number-series', label: 'Number Series' },
  { key: 'analogy', label: 'Analogy' },
  { key: 'percentages', label: 'Percentages' },
  { key: 'profit-loss', label: 'Profit & Loss' },
  { key: 'time-work', label: 'Time & Work' },
  { key: 'averages', label: 'Averages' },
  { key: 'ratio-proportion', label: 'Ratio & Proportion' },
];

const COMPANIES = [
  { key: 'tcs', label: 'TCS' },
  { key: 'infosys', label: 'Infosys' },
  { key: 'wipro', label: 'Wipro' },
  { key: 'accenture', label: 'Accenture' },
  { key: 'cognizant', label: 'Cognizant' },
  { key: 'capgemini', label: 'Capgemini' },
  { key: 'hcl', label: 'HCL Technologies' },
  { key: 'deloitte', label: 'Deloitte' },
];

export default function AdminQuestionUpload() {
  const [tab, setTab] = useState<'upload' | 'populate' | 'stats'>('upload');
  const [topic, setTopic] = useState('');
  const [company, setCompany] = useState('');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [populateResult, setPopulateResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!textContent.trim() && !file) {
      setError('Please provide text content or upload a PDF file.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      formData.append('text_content', textContent);
      formData.append('topic', topic);
      formData.append('company', company);

      const { data } = await api.post('/reasoning/upload-extract', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Upload failed');
    }
    setLoading(false);
  };

  const handlePopulateAll = async () => {
    setLoading(true);
    setError('');
    setPopulateResult(null);
    try {
      const { data } = await api.post('/reasoning/admin/populate-all');
      setPopulateResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Population failed');
    }
    setLoading(false);
  };

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/reasoning/stats');
      setStats(data);
    } catch { }
    setLoading(false);
  }, []);

  const tabs = [
    { key: 'upload', label: 'Upload & Extract', icon: Upload, gradient: 'from-[#6C63FF] to-violet-500' },
    { key: 'populate', label: 'Auto Populate', icon: Sparkles, gradient: 'from-emerald-500 to-teal-500' },
    { key: 'stats', label: 'Database Stats', icon: Database, gradient: 'from-sky-500 to-indigo-500' },
  ];

  return (
    <div className="min-h-screen bg-[#060611]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#6C63FF]/8 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-[#6C63FF]/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <Link to="/admin/users"
              className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 mb-1">
                <Brain className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider">Admin Panel</span>
              </div>
              <h1 className="text-2xl font-extrabold text-white">
                Question <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6C63FF] to-violet-400">Management</span>
              </h1>
            </div>
          </div>

          <div className="flex gap-3 mb-2">
            {tabs.map(t => (
              <button key={t.key}
                onClick={() => { setTab(t.key as any); if (t.key === 'stats') fetchStats(); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
                  ${tab === t.key ? `bg-gradient-to-r ${t.gradient} text-white shadow-lg` : 'bg-slate-800/50 text-slate-400 border border-slate-700/40 hover:text-slate-200'}`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        {/* UPLOAD TAB */}
        {tab === 'upload' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Topic</label>
                <select value={topic} onChange={e => setTopic(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#6C63FF]/50 transition-all">
                  <option value="">— Select Topic (optional) —</option>
                  {TOPICS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Company</label>
                <select value={company} onChange={e => setCompany(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#6C63FF]/50 transition-all">
                  <option value="">— Select Company (optional) —</option>
                  {COMPANIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
            </div>

            {/* File Upload */}
            <div className="p-6 rounded-2xl bg-slate-800/30 border border-dashed border-slate-600/50 text-center space-y-3 hover:border-[#6C63FF]/40 transition-all cursor-pointer"
              onClick={() => fileRef.current?.click()}>
              <Upload className="w-10 h-10 text-slate-500 mx-auto" />
              <p className="text-sm text-slate-400">
                {file ? <span className="text-[#8B83FF] font-medium">{file.name}</span> : 'Click to upload a PDF file'}
              </p>
              <p className="text-xs text-slate-600">PDF files only • Max 10MB</p>
              <input ref={fileRef} type="file" accept=".pdf,.txt" className="hidden"
                onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
            </div>

            {/* Text Input */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Or paste text content</label>
              <textarea value={textContent} onChange={e => setTextContent(e.target.value)}
                rows={8}
                placeholder="Paste question text here... The AI will extract questions, options, answers, and generate step-by-step solutions."
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#6C63FF]/50 transition-all resize-none font-mono" />
            </div>

            {/* Submit */}
            <button onClick={handleUpload} disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6C63FF] to-violet-500 text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Extracting with AI...' : 'Extract & Insert Questions'}
            </button>

            {/* Error */}
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Result */}
            {result && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-5 h-5" />
                  {result.message}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/40 p-3 rounded-xl text-center">
                    <p className="text-2xl font-bold text-white">{result.extracted}</p>
                    <p className="text-xs text-slate-500">Extracted</p>
                  </div>
                  <div className="bg-slate-800/40 p-3 rounded-xl text-center">
                    <p className="text-2xl font-bold text-emerald-400">{result.inserted}</p>
                    <p className="text-xs text-slate-500">Inserted to DB</p>
                  </div>
                </div>

                {/* Preview extracted questions */}
                {result.questions?.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Preview</p>
                    {result.questions.slice(0, 5).map((q: ExtractedQuestion, i: number) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-900/40 border border-slate-700/30">
                        <p className="text-sm text-white font-medium mb-1">{q.question}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {q.options?.map((opt, j) => (
                            <span key={j} className={`px-2 py-0.5 rounded-md border
                              ${['A', 'B', 'C', 'D'][j] === q.correct_answer
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-slate-800 border-slate-700/50 text-slate-400'}`}>
                              {['A', 'B', 'C', 'D'][j]}. {opt}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* POPULATE TAB */}
        {tab === 'populate' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="p-8 rounded-2xl bg-slate-800/40 border border-slate-700/40 text-center space-y-4">
              <Sparkles className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-xl font-bold text-white">Auto-Populate All Topics & Companies</h3>
              <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                This will cycle through all 12 topics and 8 companies, generating AI questions for any that are below the minimum threshold (10 per topic, 5 per company).
                Fallback questions are also seeded into MongoDB.
              </p>
              <button onClick={handlePopulateAll} disabled={loading}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 inline-flex items-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {loading ? 'Populating (takes a few minutes)...' : 'Start Auto-Population'}
              </button>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400" /> <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {populateResult && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-5 h-5" /> Population Complete
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800/40 p-3 rounded-xl text-center">
                    <p className="text-2xl font-bold text-white">{populateResult.results?.fallback_seeded || 0}</p>
                    <p className="text-xs text-slate-500">Fallback Seeded</p>
                  </div>
                  <div className="bg-slate-800/40 p-3 rounded-xl text-center">
                    <p className="text-2xl font-bold text-[#8B83FF]">
                      {Object.values(populateResult.results?.topics || {}).filter((v): v is number => typeof v === 'number').reduce((a, b) => a + b, 0)}
                    </p>
                    <p className="text-xs text-slate-500">Topic Qs Added</p>
                  </div>
                  <div className="bg-slate-800/40 p-3 rounded-xl text-center">
                    <p className="text-2xl font-bold text-sky-400">
                      {Object.values(populateResult.results?.companies || {}).filter((v): v is number => typeof v === 'number').reduce((a, b) => a + b, 0)}
                    </p>
                    <p className="text-xs text-slate-500">Company Qs Added</p>
                  </div>
                </div>

                {/* Topic details */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Topic Breakdown</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(populateResult.results?.topics || {}).map(([k, v]) => (
                      <div key={k} className="bg-slate-900/40 p-2 rounded-lg flex justify-between items-center">
                        <span className="text-xs text-slate-400">{k}</span>
                        <span className={`text-xs font-bold ${typeof v === 'number' && v > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {typeof v === 'number' ? `+${v}` : '⚠️'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* STATS TAB */}
        {tab === 'stats' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-[#6C63FF] animate-spin" />
              </div>
            )}

            {stats && (
              <>
                <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/40 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Total Questions in DB</p>
                    <p className="text-3xl font-extrabold text-white">{stats.total_questions}</p>
                  </div>
                  <button onClick={fetchStats}
                    className="p-2 rounded-xl bg-slate-700/30 text-slate-400 hover:text-white transition-all">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Topic Distribution</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Object.entries(stats.topics || {}).map(([key, count]) => {
                      const t = TOPICS.find(t => t.key === key);
                      return (
                        <div key={key} className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                          <p className="text-sm font-medium text-white">{t?.label || key}</p>
                          <p className={`text-2xl font-bold mt-1 ${(count as number) > 0 ? 'text-[#8B83FF]' : 'text-slate-600'}`}>
                            {count as number}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Company Distribution</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Object.entries(stats.companies || {}).map(([key, count]) => {
                      const c = COMPANIES.find(c => c.key === key);
                      return (
                        <div key={key} className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                          <p className="text-sm font-medium text-white">{c?.label || key}</p>
                          <p className={`text-2xl font-bold mt-1 ${(count as number) > 0 ? 'text-sky-400' : 'text-slate-600'}`}>
                            {count as number}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
