import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, FileText, Sparkles, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Stepper } from './components';
import { StepTargetRole } from './StepTargetRole';
import { StepPersonalInfo } from './StepPersonalInfo';
import { StepEducation } from './StepEducation';
import { StepExperience } from './StepExperience';
import { StepProjects } from './StepProjects';
import { StepSkills } from './StepSkills';
import { StepATSPreview } from './StepATSPreview';
import { StepVisualBuilder } from './StepVisualBuilder';
import type { BuilderStep, ResumeData } from './types';
import { defaultResumeData } from './types';

interface AIBuilderProps {
    onBack: () => void;
    editResume?: any;
}

export default function AIBuilder({ onBack, editResume }: AIBuilderProps) {
    // If editResume is provided, start at step 8 (Visual Studio) directly
    const [step, setStep] = useState<BuilderStep>(editResume ? 8 : 1);
    const [data, setData] = useState<ResumeData>(() => {
        if (editResume?.resume_data) {
            const rd = editResume.resume_data;
            return {
                target_role: editResume.target_role || rd.target_role || '',
                personal: rd.personal || defaultResumeData.personal,
                education: rd.education || defaultResumeData.education,
                experience: rd.experience || defaultResumeData.experience,
                projects: rd.projects || defaultResumeData.projects,
                skills: rd.skills || defaultResumeData.skills,
                ats: rd.ats || null,
            };
        }
        return { ...defaultResumeData };
    });

    const update = (partial: Partial<ResumeData>) => setData(prev => ({ ...prev, ...partial }));
    const next = () => step < 8 && setStep((step + 1) as BuilderStep);
    const prev = () => step > 1 ? setStep((step - 1) as BuilderStep) : onBack();

    const canProceed = () => {
        if (step === 1) return data.target_role.trim().length > 0;
        return true;
    };

    // Edit mode metadata — passed to visual builder for save logic
    const editMeta = editResume ? {
        id: editResume.id,
        originalName: editResume.resume_name,
        templateId: editResume.template_id,
        theme: editResume.theme,
    } : null;

    // Step 8 (Visual Studio) gets full-width 3-panel layout
    if (step === 8) {
        return (
            <motion.div
                key="ai-builder-studio"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full"
            >
                <StepVisualBuilder data={data} onChange={update} editMeta={editMeta} onBack={prev} />
            </motion.div>
        );
    }

    return (
        <motion.div
            key="ai-builder"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="max-w-4xl mx-auto py-10"
        >
            {/* Header Bar */}
            <div className="bg-white/90 backdrop-blur-sm rounded-[2rem] shadow-xl p-6 mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#5c52d2] to-[#7c3aed] rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
                        <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                            AI Resume Architect
                            {editResume && (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                    <Edit2 className="w-3 h-3" /> Editing: {editResume.resume_name}
                                </span>
                            )}
                        </h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Step {step} of 8</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#5c52d2] bg-purple-50 px-3 py-1.5 rounded-xl">
                    <Sparkles className="w-3.5 h-3.5" /> AI-Powered
                </div>
            </div>

            <Stepper current={step} />

            <div className="bg-white/90 backdrop-blur-sm rounded-[3rem] shadow-2xl border border-white/50 p-8 md:p-12">
                <AnimatePresence mode="wait">
                    <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                        {step === 1 && <StepTargetRole data={data} onChange={update} />}
                        {step === 2 && <StepPersonalInfo data={data} onChange={update} />}
                        {step === 3 && <StepEducation data={data} onChange={update} />}
                        {step === 4 && <StepExperience data={data} onChange={update} />}
                        {step === 5 && <StepProjects data={data} onChange={update} />}
                        {step === 6 && <StepSkills data={data} onChange={update} />}
                        {step === 7 && <StepATSPreview data={data} onChange={update} />}
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-12 pt-12 border-t border-gray-50">
                    <Button
                        onClick={prev}
                        variant="ghost"
                        className="h-14 px-10 rounded-2xl font-black text-gray-400 hover:text-gray-600"
                    >
                        {step === 1 ? '← Back' : 'Previous'}
                    </Button>
                    {step < 8 ? (
                        <Button
                            onClick={next}
                            disabled={!canProceed()}
                            className="h-14 px-10 rounded-2xl bg-[#5c52d2] hover:bg-[#4b43b0] text-white font-black group gap-3 shadow-lg shadow-purple-100 disabled:opacity-40"
                        >
                            {step === 7 ? (
                                <>Visual Studio <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                            ) : (
                                <>Next <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                            )}
                        </Button>
                    ) : (
                        <div className="text-xs text-gray-400 font-medium">Download your resume above ↑</div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
