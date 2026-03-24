import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { useAuth } from '../../context/AuthContext';
import { updateSavedResume } from '../../services/resumeStorage';
import { useAutoSave, type AutoSaveReason } from './useAutoSave';
import { useBeforeUnload } from './useBeforeUnload';
import { useResumeStorage } from './useResumeStorage';
import ResumeLeaveModal from './ResumeLeaveModal';

interface AIBuilderProps {
    onBack: () => void;
    editResume?: any;
}

export default function AIBuilder({ onBack, editResume }: AIBuilderProps) {
    // If editResume is provided, start at step 8 (Visual Studio) directly
    const [step, setStep] = useState<BuilderStep>(editResume ? 8 : 1);

    const location = useLocation();
    const navigate = useNavigate();

    const { user } = useAuth();
    const { loadDraft, saveDraft, clearDraft } = useResumeStorage();

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

        const draft = loadDraft();
        if (draft?.loaded) return draft.data;
        return { ...defaultResumeData };
    });

    const [isDirty, setIsDirty] = useState(false);
    const [isSaved, setIsSaved] = useState(true);
    const [leaveModalOpen, setLeaveModalOpen] = useState(false);

    // Keep latest data and counters available to event handlers without stale closures.
    const dataRef = useRef(data);
    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    const editVersionRef = useRef(0);
    const isDirtyRef = useRef(isDirty);
    useEffect(() => {
        isDirtyRef.current = isDirty;
    }, [isDirty]);

    const lastSavedDataRef = useRef<ResumeData>(data);
    useEffect(() => {
        // Keep "last saved" data in sync for the first paint and after explicit initialization.
        lastSavedDataRef.current = data;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const authTokenPresentRef = useRef(false);
    useEffect(() => {
        try {
            const token = localStorage.getItem('token');
            authTokenPresentRef.current = !!user || (!!token && token !== 'undefined' && token !== 'null');
        } catch {
            authTokenPresentRef.current = !!user;
        }
    }, [user]);

    const BACKEND_DRAFT_ID_STORAGE_KEY = 'vidhyamitra_resume_backend_draft_id';
    const backendDraftIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (editResume) {
            backendDraftIdRef.current = null;
            return;
        }
        try {
            backendDraftIdRef.current = localStorage.getItem(BACKEND_DRAFT_ID_STORAGE_KEY);
        } catch {
            backendDraftIdRef.current = null;
        }
    }, [editResume]);

    const lastBackendSyncAtRef = useRef(0);

    const update = useCallback(
        (partial: Partial<ResumeData>) => {
            editVersionRef.current += 1;
            setIsDirty(true);
            setIsSaved(false);
            setData(prev => ({ ...prev, ...partial }));
        },
        [],
    );

    const syncBackendResume = useCallback(
        async (resume: ResumeData) => {
            if (!authTokenPresentRef.current) return;
            if (!editResume) return;

            // Avoid hammering the backend. LocalStorage persistence is the source of truth for crash safety.
            const now = Date.now();
            const minMs = 15_000;
            if (now - lastBackendSyncAtRef.current < minMs) return;
            lastBackendSyncAtRef.current = now;

            const resume_data = {
                personal: resume.personal,
                education: resume.education,
                experience: resume.experience,
                projects: resume.projects,
                skills: resume.skills,
            };

            try {
                await updateSavedResume(editResume.id, {
                    resume_data,
                    target_role: resume.target_role,
                    ats_score: resume.ats?.score,
                });
            } catch {
                // Fail silently; auto-save must never break the UI.
            }
        },
        [BACKEND_DRAFT_ID_STORAGE_KEY, editResume],
    );

    const saveAll = useCallback(
        async (reason: AutoSaveReason) => {
            const versionAtStart = editVersionRef.current;
            const current = dataRef.current;

            // 1) Always persist to localStorage (crash safety for guests + logged-in users).
            const ok = saveDraft(current);
            if (ok && editVersionRef.current === versionAtStart) {
                lastSavedDataRef.current = current;
                setIsDirty(false);
                setIsSaved(true);
            }

            if (!authTokenPresentRef.current) return;

            // 2) Best-effort backend sync (throttled).
            // Visibility/manual saves should be given a chance even under throttling pressure.
            if (reason === 'visibility' || reason === 'manual') {
                lastBackendSyncAtRef.current = 0; // allow immediate backend attempt
            }
            void syncBackendResume(current);
        },
        [saveDraft, syncBackendResume],
    );

    const { saving: autoSaving, triggerSave } = useAutoSave({
        enabled: true,
        isDirty,
        onSave: saveAll,
        intervalMs: 5000,
        debounceMs: 400,
        minSavingMs: 300,
    });

    const onExplicitSave = useCallback(() => {
        const versionAtStart = editVersionRef.current;
        const current = dataRef.current;
        const ok = saveDraft(current);
        if (!ok) return;
        if (editVersionRef.current === versionAtStart) {
            lastSavedDataRef.current = current;
            setIsDirty(false);
            setIsSaved(true);
        }
    }, [saveDraft]);

    useBeforeUnload(isDirty, {
        onSyncSave: () => {
            if (!isDirtyRef.current) return;
            const versionAtStart = editVersionRef.current;
            const current = dataRef.current;
            const ok = saveDraft(current);
            if (!ok) return;
            if (editVersionRef.current === versionAtStart) {
                lastSavedDataRef.current = current;
                setIsDirty(false);
                setIsSaved(true);
            }
        },
        onSyncSaved: () => {
            // No-op: state is already updated in onSyncSave.
        },
    });

    // Ensure internal navigation (unmount/mount) doesn't lose the latest local draft.
    useEffect(() => {
        return () => {
            if (!isDirtyRef.current) return;
            try {
                saveDraft(dataRef.current);
            } catch {
                // ignore
            }
        };
    }, [saveDraft]);

    const lastLocationRef = useRef<string>(`${location.pathname}${location.search}${location.hash}`);
    useEffect(() => {
        lastLocationRef.current = `${location.pathname}${location.search}${location.hash}`;
    }, [location.pathname, location.search, location.hash]);

    const pendingNavigationRef = useRef<string | null>(null);
    const leaveModalOpenRef = useRef(false);
    useEffect(() => {
        leaveModalOpenRef.current = leaveModalOpen;
    }, [leaveModalOpen]);

    const isHandlingNavigationRef = useRef(false);

    // Intercept navigations inside this page (avoids useBlocker).
    // 1) Link clicks (<a href="...">) while dirty
    // 2) Browser back/forward (popstate) while dirty
    useEffect(() => {
        const onClickCapture = (e: MouseEvent) => {
            if (!isDirtyRef.current) return;
            if (leaveModalOpenRef.current) return;
            if (isHandlingNavigationRef.current) return;
            if (e.defaultPrevented) return;

            const target = e.target as HTMLElement | null;
            const anchor = target?.closest('a');
            if (!anchor) return;

            const targetAttr = anchor.getAttribute('target');
            if (targetAttr === '_blank') return;

            const href = anchor.getAttribute('href');
            if (!href) return;
            if (href.startsWith('#')) return;
            if (href.startsWith('javascript:')) return;
            if (href.startsWith('mailto:') || href.startsWith('tel:')) return;

            let url: URL;
            try {
                url = new URL(href, window.location.origin);
            } catch {
                return;
            }

            if (url.origin !== window.location.origin) return;

            const dest = `${url.pathname}${url.search}${url.hash}`;
            if (!dest || dest === lastLocationRef.current) return;

            pendingNavigationRef.current = dest;
            setLeaveModalOpen(true);

            e.preventDefault();
            e.stopPropagation();
        };

        document.addEventListener('click', onClickCapture, true);
        return () => document.removeEventListener('click', onClickCapture, true);
    }, []);

    useEffect(() => {
        const onPopState = () => {
            if (!isDirtyRef.current) return;
            if (leaveModalOpenRef.current) return;
            if (isHandlingNavigationRef.current) return;

            const current = lastLocationRef.current;
            const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            if (!next || next === current) return;

            pendingNavigationRef.current = next;
            setLeaveModalOpen(true);

            // Cancel back/forward by immediately returning to the last stable URL.
            isHandlingNavigationRef.current = true;
            navigate(current, { replace: true });
            setTimeout(() => {
                isHandlingNavigationRef.current = false;
            }, 0);
        };

        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [navigate]);

    const takePendingDestination = () => {
        const dest = pendingNavigationRef.current;
        pendingNavigationRef.current = null;
        return dest;
    };

    const handleStayOnPage = () => {
        setLeaveModalOpen(false);
        pendingNavigationRef.current = null;
    };

    const handleDiscardAndLeave = () => {
        const dest = takePendingDestination();
        setLeaveModalOpen(false);

        try {
            clearDraft();
        } catch {
            // ignore
        }

        // Only clear the backend draft pointer if we created one.
        if (!editResume) {
            try {
                localStorage.removeItem(BACKEND_DRAFT_ID_STORAGE_KEY);
            } catch {
                // ignore
            }
            backendDraftIdRef.current = null;
        }

        isDirtyRef.current = false;
        setIsDirty(false);
        setIsSaved(true);
        setData(lastSavedDataRef.current);

        if (dest) {
            navigate(dest);
        }
    };

    const handleSaveAndLeave = async () => {
        const dest = takePendingDestination();
        setLeaveModalOpen(false);
        await triggerSave('manual', { immediate: true });

        // User chose to leave; prevent further modal re-entry even if backend sync fails.
        isDirtyRef.current = false;
        setIsDirty(false);
        setIsSaved(true);

        if (dest) {
            navigate(dest);
        }
    };

    const leaveModalIsSaving = autoSaving;
    const statusText = autoSaving
        ? 'Saving...'
        : isDirty
            ? 'Unsaved changes'
            : 'Saved ✔';

    const statusChipClass = autoSaving
        ? 'bg-purple-50 text-[#5c52d2] border-purple-200'
        : isDirty
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200';

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
            <>
                <motion.div
                    key="ai-builder-studio"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full relative"
                >
                    <div
                        className={`absolute top-4 right-4 z-[150] px-3 py-1.5 rounded-full text-[10px] font-bold border ${statusChipClass}`}
                    >
                        {statusText}
                    </div>
                    <StepVisualBuilder
                        data={data}
                        onChange={update}
                        editMeta={editMeta}
                        onBack={prev}
                        onExplicitSave={onExplicitSave}
                    />
                </motion.div>
                <ResumeLeaveModal
                    open={leaveModalOpen}
                    isSaving={leaveModalIsSaving}
                    onSaveAndLeave={handleSaveAndLeave}
                    onDiscardAndLeave={handleDiscardAndLeave}
                    onStay={handleStayOnPage}
                />
            </>
        );
    }

    return (
        <>
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
                <div className="flex items-center gap-2">
                    <div
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${statusChipClass}`}
                    >
                        {statusText}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-[#5c52d2] bg-purple-50 px-3 py-1.5 rounded-xl">
                        <Sparkles className="w-3.5 h-3.5" /> AI-Powered
                    </div>
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
            <ResumeLeaveModal
                open={leaveModalOpen}
                isSaving={leaveModalIsSaving}
                onSaveAndLeave={handleSaveAndLeave}
                onDiscardAndLeave={handleDiscardAndLeave}
                onStay={handleStayOnPage}
            />
        </>
    );
}
