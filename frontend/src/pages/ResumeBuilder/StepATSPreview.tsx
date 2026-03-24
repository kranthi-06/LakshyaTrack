import { useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, Download, Trophy, ArrowRight, Lock } from 'lucide-react';
import { SectionCard, AIButton } from './components';
import { runATSCheck } from '../../services/resumeBuilder';
import { authorizeResumeDownload } from '../../services/resumeStorage';
import { extractLimitExceededError } from '../../services/api';
import UpgradeModal from '../../components/UpgradeModal';
import { useUsage } from '../../context/UsageContext';
import type { ResumeData } from './types';

export function StepATSPreview({ data, onChange }: { data: ResumeData; onChange: (d: Partial<ResumeData>) => void }) {
    const [aiLoading, setAiLoading] = useState(false);
    const [limitModal, setLimitModal] = useState<{
        isOpen: boolean;
        counter?: string;
        current?: number;
        limit?: number;
        message?: string;
    }>({ isOpen: false });
    const { refreshUsage, isLimitExceeded, getCounter, resolved } = useUsage();
    const ats = data.ats;

    const handleCheck = async () => {
        setAiLoading(true);
        try {
            const payload = {
                personal: data.personal,
                education: data.education,
                experience: data.experience,
                projects: data.projects,
                skills: { technical_skills: data.skills.technical_skills, tools: data.skills.tools, soft_skills: data.skills.soft_skills },
            };
            const result = await runATSCheck({ resume_data: payload, target_role: data.target_role });
            if (!result.error) {
                onChange({ ats: { score: result.score || 0, strengths: result.strengths || [], improvements: result.improvements || [] } });
            }
        } catch (e) { console.error(e); }
        setAiLoading(false);
    };

    const scoreColor = ats ? (ats.score >= 80 ? 'text-emerald-500' : ats.score >= 60 ? 'text-amber-500' : 'text-red-500') : '';
    const scoreBg = ats ? (ats.score >= 80 ? 'from-emerald-500 to-green-500' : ats.score >= 60 ? 'from-amber-500 to-yellow-500' : 'from-red-500 to-rose-500') : '';

    const downloadCounter = getCounter('resume_edit_monthly');
    const downloadLimitReached = isLimitExceeded('resume_edit_monthly');

    const openDownloadLimitModal = (message?: string) => {
        setLimitModal({
            isOpen: true,
            counter: 'resume_edit_monthly',
            current: downloadCounter?.current,
            limit: downloadCounter?.limit,
            message,
        });
    };

    const downloadJSON = async () => {
        if (resolved && downloadLimitReached) {
            openDownloadLimitModal();
            return;
        }

        try {
            await authorizeResumeDownload();
            await refreshUsage();

            const output = {
                meta: { generated_at: new Date().toISOString(), target_role: data.target_role, ats_score: ats?.score },
                personal_info: data.personal,
                education: data.education,
                experience: data.experience,
                projects: data.projects,
                skills: { technical_skills: data.skills.technical_skills, tools: data.skills.tools, soft_skills: data.skills.soft_skills },
            };
            const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `resume-${Date.now()}.json`; a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            const limitInfo = extractLimitExceededError(e);
            if (limitInfo) {
                setLimitModal({
                    isOpen: true,
                    counter: limitInfo.counter,
                    current: limitInfo.current,
                    limit: limitInfo.limit,
                    message: limitInfo.message,
                });
            } else {
                console.error(e);
            }
        }
    };

    return (
        <SectionCard icon={ShieldCheck} title="ATS Check & Final Preview" subtitle="See how your resume scores with Applicant Tracking Systems">
            {!ats && (
                <div className="text-center py-10 space-y-6">
                    <div className="w-24 h-24 mx-auto bg-indigo-50 rounded-3xl flex items-center justify-center">
                        <Trophy className="w-12 h-12 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Ready for the final check?</h3>
                        <p className="text-gray-400 text-sm mt-1">Our AI will evaluate your complete resume for ATS compatibility.</p>
                    </div>
                    <AIButton onClick={handleCheck} loading={aiLoading} label="Run ATS Analysis" />
                </div>
            )}

            {ats && (
                <div className="space-y-6">
                    <div className="text-center p-8 bg-gradient-to-br from-gray-50 to-white rounded-3xl border border-gray-100 shadow-sm">
                        <div className={`text-7xl font-black ${scoreColor}`}>{ats.score}<span className="text-3xl opacity-50">%</span></div>
                        <div className={`mt-3 inline-block px-4 py-1.5 rounded-full text-xs font-bold text-white bg-gradient-to-r ${scoreBg}`}>
                            {ats.score >= 80 ? 'Excellent' : ats.score >= 60 ? 'Good — Needs Work' : 'Needs Improvement'}
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-3">
                            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Strengths</p>
                            {ats.strengths.map((s, i) => (
                                <div key={i} className="flex gap-2 items-start text-sm text-gray-700 font-medium">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />{s}
                                </div>
                            ))}
                        </div>
                        <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 space-y-3">
                            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Improvements</p>
                            {ats.improvements.map((s, i) => (
                                <div key={i} className="flex gap-2 items-start text-sm text-gray-700 font-medium">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />{s}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 justify-center pt-4">
                        <AIButton onClick={handleCheck} loading={aiLoading} label="Re-run ATS Check" />
                        <button
                            onClick={downloadJSON}
                            className={`px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg hover:bg-gray-800 transition-all ${downloadLimitReached ? 'opacity-80' : ''}`}
                        >
                            <Download className="w-4 h-4" />
                            Download Resume JSON
                            {downloadLimitReached && <Lock className="w-4 h-4 text-white/70" />}
                        </button>
                    </div>
                </div>
            )}
            <UpgradeModal
                isOpen={limitModal.isOpen}
                onClose={() => setLimitModal({ isOpen: false })}
                counter={limitModal.counter}
                current={limitModal.current}
                limit={limitModal.limit}
                message={limitModal.message}
            />
        </SectionCard>
    );
}
