import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Palette, Download, FileText, FileType2, Eye, Sparkles,
    CheckCircle2, Loader2, Wand2, PanelRightOpen, PanelRightClose,
    ChevronDown, ChevronRight, Search, Filter, GripVertical, Save,
    Maximize2, X, AlertTriangle, FileStack, ArrowLeft, Layers, Lock
} from 'lucide-react';
import { SectionCard } from './components';
import {
    ModernTemplate, ClassicTemplate, CreativeTemplate, DeveloperTemplate,
    MinimalATSTemplate, AcademicTemplate, ExecutiveTemplate, TwoColumnTemplate,
    PortfolioTemplate, CompactTemplate, TimelineTemplate, ElegantTemplate,
    BoldHeaderTemplate, InfographicTemplate, CorporateTemplate, FreshTemplate,
    TEMPLATE_CATALOG, TEMPLATE_CATEGORIES, THEME_COLORS,
} from './templates';
import type { BaseTemplate, CatalogTemplate } from './templates';
import type { ResumeData } from './types';
import { exportToPDF, exportToDOCX } from './exportUtils';
import { optimizeResumeContent } from '../../services/resumeBuilder';
import { authorizeResumeDownload, saveResumeToProfile, updateSavedResume } from '../../services/resumeStorage';
import { extractLimitExceededError } from '../../services/api';
import { SidePanelEditor } from './SidePanelEditor';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { UsageBadge } from '../../components/FeatureLockButton';
import PremiumGate from '../../components/PremiumGate';
import UpgradeModal from '../../components/UpgradeModal';
import { useResumeProtection } from '../../hooks/useResumeProtection';
import { useUsage } from '../../context/UsageContext';

interface EditMeta {
    id: string;
    originalName: string;
    templateId: string;
    theme: string;
}

interface StepVisualBuilderProps {
    data: ResumeData;
    onChange: (d: Partial<ResumeData>) => void;
    editMeta?: EditMeta | null;
    onBack?: () => void;
    onExplicitSave?: () => void;
}

/* Render the correct base template component */
function RenderTemplate({ base, data, color }: { base: BaseTemplate; data: ResumeData; color: string }) {
    const p = { data, accentColor: color };
    switch (base) {
        case 'modern': return <ModernTemplate {...p} />;
        case 'classic': return <ClassicTemplate {...p} />;
        case 'creative': return <CreativeTemplate {...p} />;
        case 'developer': return <DeveloperTemplate {...p} />;
        case 'minimal-ats': return <MinimalATSTemplate {...p} />;
        case 'academic': return <AcademicTemplate {...p} />;
        case 'executive': return <ExecutiveTemplate {...p} />;
        case 'two-column': return <TwoColumnTemplate {...p} />;
        case 'portfolio': return <PortfolioTemplate {...p} />;
        case 'compact': return <CompactTemplate {...p} />;
        case 'timeline': return <TimelineTemplate {...p} />;
        case 'elegant': return <ElegantTemplate {...p} />;
        case 'bold-header': return <BoldHeaderTemplate {...p} />;
        case 'infographic': return <InfographicTemplate {...p} />;
        case 'corporate': return <CorporateTemplate {...p} />;
        case 'fresh': return <FreshTemplate {...p} />;
        default: return <ModernTemplate {...p} />;
    }
}

/* Tiny thumbnail for template card */
function MiniThumb({ base, color }: { base: BaseTemplate; color: string }) {
    if (base === 'developer') return <div className="w-full h-full rounded bg-[#0d1117] flex items-center justify-center text-[5px] text-green-400 font-mono">{'{ }'}</div>;
    if (base === 'two-column' || base === 'infographic') return (
        <div className="w-full h-full rounded overflow-hidden flex"><div className="w-2/5 h-full" style={{ backgroundColor: color }} /><div className="w-3/5 p-1"><div className="h-0.5 w-4 bg-gray-200 rounded mt-0.5" /></div></div>
    );
    if (base === 'executive') return (
        <div className="w-full h-full rounded overflow-hidden"><div className="h-3 w-full" style={{ backgroundColor: color }} /><div className="h-px w-full" style={{ background: `linear-gradient(90deg, ${color}, #b8860b, ${color})` }} /><div className="p-0.5"><div className="h-0.5 w-4 bg-gray-200 rounded" /></div></div>
    );
    if (base === 'portfolio' || base === 'creative') return (
        <div className="w-full h-full rounded overflow-hidden"><div className="h-4 w-full" style={{ background: `linear-gradient(135deg, ${color}, ${color}88)` }} /><div className="p-0.5"><div className="h-0.5 w-3 bg-gray-200 rounded" /></div></div>
    );
    if (base === 'bold-header') return (
        <div className="w-full h-full rounded p-1"><div className="text-[6px] font-black" style={{ color }}> NAME</div><div className="h-0.5 w-3 mt-0.5 rounded" style={{ backgroundColor: color }} /></div>
    );
    if (base === 'timeline') return (
        <div className="w-full h-full rounded p-1 flex gap-1"><div className="flex flex-col items-center"><div className="w-1 h-1 rounded-full" style={{ backgroundColor: color }} /><div className="w-px flex-1" style={{ backgroundColor: `${color}40` }} /><div className="w-1 h-1 rounded-full border" style={{ borderColor: color }} /></div><div><div className="h-0.5 w-4 bg-gray-200 rounded" /><div className="h-0.5 w-3 bg-gray-100 rounded mt-1" /></div></div>
    );
    if (base === 'elegant') return (
        <div className="w-full h-full rounded flex flex-col items-center justify-center"><div className="text-[5px] tracking-widest uppercase" style={{ color }}>Name</div><div className="w-4 h-px mt-0.5" style={{ backgroundColor: color }} /></div>
    );
    if (base === 'compact') return (
        <div className="w-full h-full rounded p-0.5"><div className="text-center text-[5px] font-bold" style={{ color }}>NAME</div><div className="w-full h-px mt-0.5" style={{ backgroundColor: color }} /><div className="h-0.5 w-6 bg-gray-200 rounded mt-0.5 mx-auto" /></div>
    );
    if (base === 'fresh') return (
        <div className="w-full h-full rounded overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}12, white)` }}><div className="p-1 flex items-center gap-0.5"><div className="w-2 h-2 rounded" style={{ backgroundColor: color }} /><div className="h-0.5 w-4 rounded" style={{ backgroundColor: color }} /></div></div>
    );
    if (base === 'corporate') return (
        <div className="w-full h-full rounded overflow-hidden"><div className="h-3 px-1 flex justify-between items-center" style={{ backgroundColor: `${color}08`, borderBottom: `1.5px solid ${color}` }}><div className="h-0.5 w-4 rounded" style={{ backgroundColor: color }} /><div className="h-0.5 w-2 bg-gray-300 rounded" /></div></div>
    );
    // modern/classic/minimal-ats defaults
    if (base === 'modern') return (
        <div className="w-full h-full rounded overflow-hidden flex"><div className="w-1/3 h-full" style={{ backgroundColor: `${color}10` }} /><div className="w-2/3 p-1"><div className="h-0.5 w-4 rounded" style={{ backgroundColor: color }} /></div></div>
    );
    return (
        <div className="w-full h-full rounded p-1"><div className="h-0.5 w-6 mx-auto rounded" style={{ backgroundColor: color }} /><div className="h-0.5 w-4 bg-gray-200 rounded mt-1 mx-auto" /></div>
    );
}

/* A4 page height in pixels at 96dpi (794px width) */
const A4_PAGE_HEIGHT = 1122;

export function StepVisualBuilder({ data, onChange, editMeta, onBack, onExplicitSave }: StepVisualBuilderProps) {
    // ── Subscription gate for download/export features ──
    const { isLocked: isDownloadLocked, guardAction: guardDownload, gateProps: downloadGateProps } = useFeatureGate(
        'resume_download',
        'Resume Download',
        1,
        'Download your resume as PDF, DOCX, or JSON. Upgrade to unlock this feature.',
    );
    const { isLocked: isSaveLocked, guardAction: guardSave, gateProps: saveGateProps } = useFeatureGate(
        'resume_builder',
        'Resume Save',
        1,
        'Save your resume to your profile for future editing. Upgrade to unlock this feature.',
    );
    const { usage, refreshUsage, isLimitExceeded, getCounter, resolved } = useUsage();

    const [selectedId, setSelectedId] = useState('ats-modern');
    const [customColor, setCustomColor] = useState<string | null>(null);
    const [exporting, setExporting] = useState<string | null>(null);
    const [optimizing, setOptimizing] = useState(false);
    const [optimized, setOptimized] = useState(false);
    const [previewScale, setPreviewScale] = useState(0.55);
    const [showPanel, setShowPanel] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(TEMPLATE_CATEGORIES));
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showFullPreview, setShowFullPreview] = useState(false);
    const [pageCount, setPageCount] = useState(1);
    const [fsScale, setFsScale] = useState(0.7); // Fullscreen preview dynamic scale
    const [rightPanelOpen, setRightPanelOpen] = useState(true);
    const [recentTemplates, setRecentTemplates] = useState<string[]>([]);
    const previewRef = useRef<HTMLDivElement>(null);
    const fsScrollRef = useRef<HTMLDivElement>(null);
    const inlinePaperRef = useRef<HTMLDivElement>(null);
    const fsPaperRef = useRef<HTMLDivElement>(null);

    // ── Resume naming & save-mode modals ──
    const [showNameModal, setShowNameModal] = useState(false);
    const [resumeNameInput, setResumeNameInput] = useState('');
    const [showSaveModeModal, setShowSaveModeModal] = useState(false);
    const [copyNameInput, setCopyNameInput] = useState('');
    const [saveModeStep, setSaveModeStep] = useState<'choose' | 'copy-name'>('choose');
    const [limitModal, setLimitModal] = useState<{
        isOpen: boolean;
        counter?: string;
        current?: number;
        limit?: number;
        message?: string;
    }>({ isOpen: false });

    // ── Screenshot protection (applies to ALL users, including admin) ──
    const {
        isCapturing,
        paperProtectionStyle,
        paperProtectionHandlers,
        setupVideoOverlay,
    } = useResumeProtection();

    // Setup DRM video overlay on inline and fullscreen paper when they mount
    useEffect(() => {
        if (inlinePaperRef.current) {
            setupVideoOverlay(inlinePaperRef.current);
        }
    }, [setupVideoOverlay, selectedId]);

    useEffect(() => {
        if (showFullPreview && fsPaperRef.current) {
            // Small delay to let the portal render
            const timer = setTimeout(() => {
                if (fsPaperRef.current) setupVideoOverlay(fsPaperRef.current);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showFullPreview, setupVideoOverlay, selectedId]);

    const selected = useMemo(() => {
        // In edit mode, try to match the original template first
        if (editMeta?.templateId && selectedId === 'ats-modern') {
            const editTmpl = TEMPLATE_CATALOG.find(t => t.template_id === editMeta.templateId);
            if (editTmpl) return editTmpl;
        }
        return TEMPLATE_CATALOG.find(t => t.template_id === selectedId) || TEMPLATE_CATALOG[0];
    }, [selectedId, editMeta]);
    const accentColor = customColor || (editMeta?.theme && editMeta.theme !== 'default' ? editMeta.theme : null) || selected.default_color;
    const storageCounter = getCounter('resume_count');
    const downloadCounter = getCounter('resume_edit_monthly');
    const storageLimitReached = isLimitExceeded('resume_count');
    const downloadLimitReached = isLimitExceeded('resume_edit_monthly');
    const downloadActionLocked = isDownloadLocked || (resolved && downloadLimitReached);
    const saveActionLocked = isSaveLocked || (!editMeta && resolved && storageLimitReached);
    const saveCopyLocked = isSaveLocked || (resolved && storageLimitReached);

    const openUsageLimitModal = useCallback(
        (counter: 'resume_count' | 'resume_edit_monthly', message?: string) => {
            const counterData = getCounter(counter);
            setLimitModal({
                isOpen: true,
                counter,
                current: counterData?.current,
                limit: counterData?.limit,
                message,
            });
        },
        [getCounter],
    );

    // In edit mode, initialise selected template from editMeta
    useEffect(() => {
        if (editMeta?.templateId) {
            setSelectedId(editMeta.templateId);
        }
        if (editMeta?.theme && editMeta.theme !== 'default') {
            setCustomColor(editMeta.theme);
        }
    }, [editMeta]);

    // Filtered catalog
    const filteredCatalog = useMemo(() => {
        if (!searchQuery.trim()) return TEMPLATE_CATALOG;
        const q = searchQuery.toLowerCase();
        return TEMPLATE_CATALOG.filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.recommended_for_roles.some(r => r.toLowerCase().includes(q)) ||
            t.ats_priority.includes(q) ||
            t.layout_type.includes(q)
        );
    }, [searchQuery]);

    // ── PAGE COUNT: measure resume height and compute pages ───────
    const measurePages = useCallback(() => {
        if (previewRef.current) {
            const h = previewRef.current.scrollHeight;
            setPageCount(Math.max(1, Math.ceil(h / A4_PAGE_HEIGHT)));
        }
    }, []);

    // Re-measure whenever data, template, or color changes
    useEffect(() => {
        // Small delay to allow React to render the updated template
        const timer = setTimeout(measurePages, 200);
        return () => clearTimeout(timer);
    }, [data, selectedId, customColor, measurePages]);

    // Also observe resize changes in the preview container
    useEffect(() => {
        const el = previewRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => measurePages());
        ro.observe(el);
        return () => ro.disconnect();
    }, [measurePages]);

    // ── FULLSCREEN PREVIEW: compute dynamic scale to fit viewport ──
    useEffect(() => {
        if (!showFullPreview) return;

        const computeScale = () => {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const hPad = 48; // 24px padding on each side
            const headerHeight = 100; // header + footer roughly

            // Scale to fit width
            const scaleW = Math.min(1, (vw - hPad) / 794);
            // Scale to fit height (for single page, try to fit fully)
            const scaleH = Math.min(1, (vh - headerHeight) / A4_PAGE_HEIGHT);
            // Use the smaller of the two, but at least 0.3
            setFsScale(Math.max(0.3, Math.min(scaleW, scaleH)));
        };

        computeScale();
        window.addEventListener('resize', computeScale);
        return () => window.removeEventListener('resize', computeScale);
    }, [showFullPreview]);

    // Lock body scroll when fullscreen preview is open + ESC key handler
    useEffect(() => {
        if (showFullPreview) {
            document.body.style.overflow = 'hidden';
            const handleKey = (e: KeyboardEvent) => {
                if (e.key === 'Escape') setShowFullPreview(false);
            };
            window.addEventListener('keydown', handleKey);
            return () => {
                document.body.style.overflow = '';
                window.removeEventListener('keydown', handleKey);
            };
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [showFullPreview]);

    const toggleCategory = (cat: string) => {
        setExpandedCats(prev => {
            const next = new Set(prev);
            next.has(cat) ? next.delete(cat) : next.add(cat);
            return next;
        });
    };

    const selectTemplate = (id: string) => {
        setSelectedId(id);
        setOptimized(false);
        setRecentTemplates(prev => {
            const next = [id, ...prev.filter(t => t !== id)].slice(0, 5);
            return next;
        });
    };

    const handleOptimize = async () => {
        setOptimizing(true);
        try {
            const result = await optimizeResumeContent({
                resume_data: {
                    personal: data.personal,
                    education: data.education,
                    experience: data.experience,
                    projects: data.projects,
                    skills: { technical_skills: data.skills.technical_skills, tools: data.skills.tools, soft_skills: data.skills.soft_skills },
                },
                target_role: data.target_role,
                template_style: selected.base,
            });
            if (result && !result.error) {
                if (result.personal) onChange({ personal: { ...data.personal, ...result.personal } });
                if (result.experience) onChange({ experience: result.experience });
                if (result.projects) onChange({ projects: result.projects });
                setOptimized(true);
            }
        } catch (e) { console.error('Optimization error:', e); }
        setOptimizing(false);
    };

    const handleExportPDF = async () => {
        guardDownload(async () => {
            if (resolved && downloadLimitReached) {
                openUsageLimitModal('resume_edit_monthly');
                return;
            }
            setExporting('pdf');
            try {
                await authorizeResumeDownload();
                await refreshUsage();
                const name = data.personal.full_name?.replace(/\s+/g, '_') || 'resume';
                await exportToPDF('resume-preview-container', `${name}_Resume.pdf`);
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
                    console.error('PDF export error:', e);
                }
            }
            setExporting(null);
        });
    };

    const handleExportDOCX = async () => {
        guardDownload(async () => {
            if (resolved && downloadLimitReached) {
                openUsageLimitModal('resume_edit_monthly');
                return;
            }
            setExporting('docx');
            try {
                await authorizeResumeDownload();
                await refreshUsage();
                const name = data.personal.full_name?.replace(/\s+/g, '_') || 'resume';
                await exportToDOCX('resume-preview-container', `${name}_Resume.doc`);
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
                    console.error('DOCX export error:', e);
                }
            }
            setExporting(null);
        });
    };

    // Build common payload
    const buildPayload = (name: string) => ({
        resume_name: name,
        resume_data: {
            personal: data.personal,
            education: data.education,
            experience: data.experience,
            projects: data.projects,
            skills: data.skills
        },
        template_id: selectedId,
        theme: accentColor || 'default',
        target_role: data.target_role,
        ats_score: data.ats?.score,
        is_primary: true
    });

    // Entry point: user clicks "Save to Profile"
    const handleSaveToProfile = () => {
        if (!editMeta && resolved && storageLimitReached) {
            openUsageLimitModal(
                'resume_count',
                'You have reached your saved resume limit. You can keep editing this draft, but saving a new resume to your profile requires more storage.',
            );
            return;
        }
        guardSave(() => {
            if (editMeta) {
                // Editing mode → ask replace or copy
                setSaveModeStep('choose');
                setCopyNameInput('');
                setShowSaveModeModal(true);
            } else {
                // Fresh resume → ask for a name
                setResumeNameInput(`${data.target_role || 'Untitled'} Resume`);
                setShowNameModal(true);
            }
        });
    };

    // Save fresh resume with a name
    const handleSaveWithName = async () => {
        if (!resumeNameInput.trim()) return;
        if (resolved && storageLimitReached) {
            openUsageLimitModal(
                'resume_count',
                'You have reached your saved resume limit. You can keep editing this draft, but saving another resume to your profile requires more storage.',
            );
            return;
        }
        setSaving(true);
        setShowNameModal(false);
        try {
            await saveResumeToProfile(buildPayload(resumeNameInput.trim()));
            await refreshUsage();
            onExplicitSave?.();
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
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
                console.error('Error saving resume to profile:', e);
            }
        }
        setSaving(false);
    };

    // Replace the original resume
    const handleReplaceOriginal = async () => {
        if (!editMeta) return;
        setSaving(true);
        setShowSaveModeModal(false);
        try {
            await updateSavedResume(editMeta.id, buildPayload(editMeta.originalName));
            await refreshUsage();
            onExplicitSave?.();
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
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
                console.error('Error updating resume:', e);
            }
        }
        setSaving(false);
    };

    // Save as a new copy with custom name
    const handleSaveAsCopy = async () => {
        if (!copyNameInput.trim()) return;
        if (resolved && storageLimitReached) {
            openUsageLimitModal(
                'resume_count',
                'You have reached your saved resume limit. You can still replace the current saved resume, but saving a new copy requires more storage.',
            );
            return;
        }
        setSaving(true);
        setShowSaveModeModal(false);
        try {
            await saveResumeToProfile(buildPayload(copyNameInput.trim()));
            await refreshUsage();
            onExplicitSave?.();
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
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
                console.error('Error saving resume copy:', e);
            }
        }
        setSaving(false);
    };

    const handleDownloadJSON = () => {
        guardDownload(() => {
            const run = async () => {
                if (resolved && downloadLimitReached) {
                    openUsageLimitModal('resume_edit_monthly');
                    return;
                }

                try {
                    await authorizeResumeDownload();
                    await refreshUsage();

                    const output = {
                        meta: { generated_at: new Date().toISOString(), target_role: data.target_role, template: selectedId, ats_score: data.ats?.score },
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
                        console.error('JSON export error:', e);
                    }
                }
            };

            void run();
        });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] w-full" style={{ minHeight: 0 }}>
            {/* ── EDITOR HEADER BAR ── */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200/60 dark:border-slate-700/60 flex-shrink-0 z-20">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onBack}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Back
                        </motion.button>
                    )}
                    <div className="w-px h-5 bg-gray-200 dark:bg-slate-700 hidden sm:block" />
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#5c52d2] to-[#7c3aed] rounded-lg flex items-center justify-center shadow-md shadow-purple-200/40">
                            <Palette className="w-4 h-4 text-white" />
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="text-sm font-black text-gray-900 dark:text-white tracking-tight">Visual Resume Studio</h1>
                            <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">{TEMPLATE_CATALOG.length} templates • Live editor</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* Zoom Control */}
                    <div className="hidden sm:flex items-center gap-2 bg-gray-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">Zoom</span>
                        <input type="range" min="0.3" max="1" step="0.05" value={previewScale} onChange={e => setPreviewScale(parseFloat(e.target.value))} className="w-16 h-1 accent-[#5c52d2]" />
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 w-7">{Math.round(previewScale * 100)}%</span>
                    </div>

                    {/* Page Indicator */}
                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5">
                        <FileStack className="w-3 h-3 text-gray-400" />
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${pageCount > 1 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'}`}>
                            {pageCount} {pageCount === 1 ? 'pg' : 'pgs'}
                        </span>
                    </div>

                    {/* Preview Button */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowFullPreview(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] text-white rounded-lg text-[10px] font-bold shadow-md shadow-purple-200/40 hover:shadow-lg transition-all"
                    >
                        <Maximize2 className="w-3 h-3" /> Preview
                    </motion.button>

                    {/* Template Panel Toggle */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setRightPanelOpen(prev => !prev)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                            rightPanelOpen
                                ? 'bg-purple-100 dark:bg-purple-900/40 text-[#5c52d2] dark:text-purple-300'
                                : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                        }`}
                        title={rightPanelOpen ? 'Close Templates' : 'Open Templates'}
                    >
                        {rightPanelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">Templates</span>
                    </motion.button>
                </div>
            </div>

            {/* ── MAIN 3-PANEL BODY ── */}
            <div className="flex flex-1 overflow-hidden relative">

                {/* ═══════════════════════════════════════════════ */}
                {/* CENTER EDITOR AREA                              */}
                {/* ═══════════════════════════════════════════════ */}
                <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300">

                    {/* AI Optimizer Bar */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 py-2.5 bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-purple-900/20 dark:to-indigo-900/20 border-b border-purple-100/50 dark:border-purple-800/30 flex-shrink-0">
                        <Wand2 className="w-4 h-4 text-[#5c52d2]" />
                        <div className="flex-1 min-w-[120px]">
                            <p className="text-[10px] font-bold text-gray-800 dark:text-gray-200">AI Content Optimizer</p>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleOptimize}
                            disabled={optimizing}
                            className="px-4 py-1.5 bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] text-white rounded-lg font-bold text-[10px] shadow-md shadow-purple-200/40 hover:shadow-lg transition-all disabled:opacity-60 flex items-center gap-1.5"
                        >
                            {optimizing ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Optimizing...</>
                            ) : optimized ? (
                                <><CheckCircle2 className="w-3 h-3" /> Re-optimize</>
                            ) : (
                                <><Sparkles className="w-3 h-3" /> Optimize</>
                            )}
                        </motion.button>
                        {optimized && (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Enhanced
                            </span>
                        )}

                        {/* Color swatches inline in optimizer bar */}
                        <div className="hidden sm:flex items-center gap-0.5 ml-auto">
                            {THEME_COLORS.map(theme => (
                                <button
                                    key={theme.id}
                                    onClick={() => setCustomColor(customColor === theme.color ? null : theme.color)}
                                    className={`w-4 h-4 rounded transition-all flex items-center justify-center ${customColor === theme.color ? 'ring-2 ring-offset-1 ring-gray-300 scale-110' : 'opacity-50 hover:opacity-100 hover:scale-105'}`}
                                    style={{ backgroundColor: theme.color }}
                                    title={theme.label}
                                >
                                    {customColor === theme.color && <CheckCircle2 className="w-2 h-2 text-white" />}
                                </button>
                            ))}
                            {customColor && (
                                <button onClick={() => setCustomColor(null)} className="text-[8px] text-gray-400 hover:text-gray-600 ml-1 underline">Reset</button>
                            )}
                        </div>
                    </div>

                    {/* Page Overflow Warning */}
                    {pageCount > 1 && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-200/50 dark:border-amber-700/40 flex-shrink-0"
                        >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex-1">Resume exceeds one page — consider trimming or using a compact template.</p>
                            <span className="text-[9px] font-black text-amber-500 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-md">{pageCount} pages</span>
                        </motion.div>
                    )}

                    {/* Selected template info strip */}
                    <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-50/80 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-700/40 flex-shrink-0 text-[9px] text-gray-400 dark:text-gray-500 font-medium overflow-x-auto">
                        <span><span className="font-bold text-gray-600 dark:text-gray-300">Template:</span> {selected.name}</span>
                        <span className="w-px h-3 bg-gray-200 dark:bg-slate-600" />
                        <span><span className="font-bold text-gray-600 dark:text-gray-300">Layout:</span> {selected.layout_type}</span>
                        <span className="w-px h-3 bg-gray-200 dark:bg-slate-600" />
                        <span><span className="font-bold text-gray-600 dark:text-gray-300">ATS:</span> {selected.ats_priority}</span>
                        <span className="w-px h-3 bg-gray-200 dark:bg-slate-600 hidden sm:block" />
                        <span className="hidden sm:inline"><span className="font-bold text-gray-600 dark:text-gray-300">For:</span> {selected.recommended_for_roles.slice(0, 3).join(', ')}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-white/90 dark:bg-slate-900/70 border-b border-gray-100 dark:border-slate-700/40 text-[10px] text-gray-500 dark:text-slate-300">
                        <span className="inline-flex items-center rounded-full bg-[#5c52d2]/10 px-2.5 py-1 font-black uppercase tracking-[0.18em] text-[#5c52d2]">
                            {(usage?.plan || 'free').toUpperCase()} Plan
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="font-semibold text-gray-600 dark:text-slate-200">Saved Resumes</span>
                            <UsageBadge counter="resume_count" showWhenUnlimited />
                            {storageCounter?.limit === -1 && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Unlimited</span>}
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="font-semibold text-gray-600 dark:text-slate-200">Monthly Downloads</span>
                            <UsageBadge counter="resume_edit_monthly" showWhenUnlimited />
                            {downloadCounter?.limit === -1 && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Unlimited</span>}
                        </span>
                        {resolved && storageLimitReached && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                <AlertTriangle className="w-3 h-3" />
                                Storage full. You can still edit your existing saved resume.
                            </span>
                        )}
                        {resolved && downloadLimitReached && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                                <Lock className="w-3 h-3" />
                                Monthly download limit reached.
                            </span>
                        )}
                    </div>

                    {/* ── RESUME PREVIEW CANVAS ── */}
                    <div className="flex-1 overflow-auto bg-gray-100 dark:bg-slate-900/60" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                        <div className="flex justify-center py-6 px-4" style={{ minHeight: '100%' }}>
                            <div
                                className={`shadow-2xl border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden relative bg-white flex-shrink-0 resume-protected-paper ${isCapturing ? 'resume-capturing' : ''}`}
                                style={{ width: `${794 * previewScale}px`, transformOrigin: 'top center', ...paperProtectionStyle }}
                                ref={inlinePaperRef}
                                {...paperProtectionHandlers}
                            >
                                <div
                                    id="resume-preview-container"
                                    ref={previewRef}
                                    style={{ width: '794px', transform: `scale(${previewScale})`, transformOrigin: 'top left' }}
                                >
                                    <RenderTemplate base={selected.base} data={data} color={accentColor} />
                                </div>

                                {/* Page Break Indicators */}
                                {pageCount > 1 && Array.from({ length: pageCount - 1 }, (_, i) => (
                                    <div
                                        key={`page-break-${i}`}
                                        className="absolute left-0 right-0 pointer-events-none z-10"
                                        style={{ top: `${(i + 1) * A4_PAGE_HEIGHT * previewScale}px` }}
                                    >
                                        <div className="relative">
                                            <div className="w-full border-t-2 border-dashed border-red-300" />
                                            <span className="absolute right-2 -top-3 bg-red-100 text-red-500 text-[8px] font-black px-2 py-0.5 rounded-full shadow-sm">
                                                Page {i + 2} starts here
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── EXPORT ACTIONS BAR ── */}
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200/60 dark:border-slate-700/60 flex-shrink-0">
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleExportPDF} disabled={!!exporting}
                            className={`relative px-5 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-bold text-xs shadow-md shadow-red-200/40 hover:shadow-lg transition-all disabled:opacity-60 flex items-center gap-1.5 ${downloadActionLocked ? 'opacity-75' : ''}`}>
                            {exporting === 'pdf' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</> : <><FileText className="w-3.5 h-3.5" /> PDF</>}
                            {downloadActionLocked && <Lock className="w-3 h-3 ml-1 text-white/70" />}
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleExportDOCX} disabled={!!exporting}
                            className={`relative px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-200/40 hover:shadow-lg transition-all disabled:opacity-60 flex items-center gap-1.5 ${downloadActionLocked ? 'opacity-75' : ''}`}>
                            {exporting === 'docx' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</> : <><FileType2 className="w-3.5 h-3.5" /> DOCX</>}
                            {downloadActionLocked && <Lock className="w-3 h-3 ml-1 text-white/70" />}
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleDownloadJSON}
                            className={`relative px-5 py-2 bg-gray-900 dark:bg-slate-700 text-white rounded-xl font-bold text-xs shadow-md hover:bg-gray-800 transition-all flex items-center gap-1.5 ${downloadActionLocked ? 'opacity-75' : ''}`}>
                            <Download className="w-3.5 h-3.5" /> JSON
                            {downloadActionLocked && <Lock className="w-3 h-3 ml-1 text-white/70" />}
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSaveToProfile} disabled={saving}
                            className={`relative px-5 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold text-xs shadow-md shadow-green-200/40 hover:shadow-lg transition-all disabled:opacity-60 flex items-center gap-1.5 ${saveActionLocked ? 'opacity-75' : ''}`}>
                            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : saved ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</> : <><Save className="w-3.5 h-3.5" /> Save</>}
                            {saveActionLocked && <Lock className="w-3 h-3 ml-1 text-white/70" />}
                        </motion.button>
                    </div>

                    {/* Premium Gate Modals */}
                    <PremiumGate {...downloadGateProps} />
                    <PremiumGate {...saveGateProps} />
                    <UpgradeModal
                        isOpen={limitModal.isOpen}
                        onClose={() => setLimitModal({ isOpen: false })}
                        counter={limitModal.counter}
                        current={limitModal.current}
                        limit={limitModal.limit}
                        message={limitModal.message}
                    />
                </div>

                {/* ═══════════════════════════════════════════════ */}
                {/* RIGHT TEMPLATE PANEL (toggleable)               */}
                {/* ═══════════════════════════════════════════════ */}
                {/* Desktop inline panel */}
                <div
                    className="hidden md:flex flex-col border-l border-gray-200/60 dark:border-slate-700/60 bg-white/98 dark:bg-slate-900/98 backdrop-blur-md flex-shrink-0 overflow-hidden"
                    style={{
                        width: rightPanelOpen ? '320px' : '0px',
                        opacity: rightPanelOpen ? 1 : 0,
                        transition: 'all 0.25s ease',
                    }}
                >
                    {/* Panel Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700/60 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-[#5c52d2]" />
                            <h3 className="text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider">Templates</h3>
                            <span className="text-[9px] font-bold text-[#5c52d2] bg-purple-50 dark:bg-purple-900/40 px-1.5 py-0.5 rounded-full">{TEMPLATE_CATALOG.length}</span>
                        </div>
                        <button
                            onClick={() => setRightPanelOpen(false)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-gray-500 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="px-3 py-2 flex-shrink-0">
                        <div className="relative">
                            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600" />
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-7 pr-3 py-2 text-[11px] border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 focus:border-[#5c52d2] bg-gray-50/50 dark:bg-slate-800/50 text-gray-700 dark:text-gray-300"
                            />
                        </div>
                    </div>

                    {/* Scrollable Template Content */}
                    <div className="flex-1 overflow-y-auto px-3 pb-3" style={{ scrollBehavior: 'smooth' }}>
                        {/* Recent Templates */}
                        {recentTemplates.length > 0 && !searchQuery && (
                            <div className="mb-3">
                                <h4 className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-1 flex items-center gap-1">
                                    <Filter className="w-2.5 h-2.5" /> Recent
                                </h4>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {recentTemplates.map(tid => {
                                        const tmpl = TEMPLATE_CATALOG.find(t => t.template_id === tid);
                                        if (!tmpl) return null;
                                        const isSelected = selectedId === tmpl.template_id;
                                        const displayColor = customColor || tmpl.default_color;
                                        return (
                                            <button
                                                key={`recent-${tmpl.template_id}`}
                                                onClick={() => selectTemplate(tmpl.template_id)}
                                                className={`relative p-1.5 rounded-xl border-2 text-left transition-all ${isSelected
                                                    ? 'border-[#5c52d2] bg-purple-50/50 dark:bg-purple-900/30 shadow-md'
                                                    : 'border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 bg-white dark:bg-slate-800/50'
                                                }`}
                                            >
                                                {isSelected && (
                                                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#5c52d2] rounded-full flex items-center justify-center shadow z-10">
                                                        <CheckCircle2 className="w-2 h-2 text-white" />
                                                    </div>
                                                )}
                                                <div className="w-full h-8 rounded-lg border border-gray-100 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 mb-0.5">
                                                    <MiniThumb base={tmpl.base} color={displayColor} />
                                                </div>
                                                <p className="text-[7px] font-bold text-gray-600 dark:text-gray-400 truncate">{tmpl.name}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Category Groups */}
                        {TEMPLATE_CATEGORIES.map(cat => {
                            const templates = filteredCatalog.filter(t => t.category === cat);
                            if (templates.length === 0) return null;
                            const isExpanded = expandedCats.has(cat);
                            return (
                                <div key={cat} className="mb-1">
                                    <button
                                        onClick={() => toggleCategory(cat)}
                                        className="sticky top-0 z-10 w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm"
                                    >
                                        <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                            {isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                                            {cat}
                                            <span className="text-[8px] font-normal text-gray-300 dark:text-gray-600">({templates.length})</span>
                                        </span>
                                    </button>
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="grid grid-cols-3 gap-1.5 p-1">
                                                    {templates.map(tmpl => {
                                                        const isSelected = selectedId === tmpl.template_id;
                                                        const displayColor = customColor || tmpl.default_color;
                                                        return (
                                                            <motion.button
                                                                key={tmpl.template_id}
                                                                whileHover={{ scale: 1.05 }}
                                                                whileTap={{ scale: 0.95 }}
                                                                onClick={() => selectTemplate(tmpl.template_id)}
                                                                className={`relative p-1.5 rounded-xl border-2 text-left transition-all ${isSelected
                                                                    ? 'border-[#5c52d2] bg-purple-50/50 dark:bg-purple-900/30 shadow-md'
                                                                    : 'border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 bg-white dark:bg-slate-800/50'
                                                                }`}
                                                                title={`${tmpl.name} — ATS: ${tmpl.ats_priority}`}
                                                            >
                                                                {isSelected && (
                                                                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#5c52d2] rounded-full flex items-center justify-center shadow z-10">
                                                                        <CheckCircle2 className="w-2 h-2 text-white" />
                                                                    </div>
                                                                )}
                                                                <div className="w-full h-10 rounded-lg border border-gray-100 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 mb-1">
                                                                    <MiniThumb base={tmpl.base} color={displayColor} />
                                                                </div>
                                                                <p className="text-[7px] font-bold text-gray-700 dark:text-gray-300 truncate leading-tight">{tmpl.name}</p>
                                                                <span className={`text-[6px] font-bold px-1 py-px rounded ${tmpl.ats_priority === 'high' ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-500' :
                                                                    tmpl.ats_priority === 'medium' ? 'bg-amber-50 dark:bg-amber-900/40 text-amber-500' :
                                                                        'bg-gray-50 dark:bg-slate-700 text-gray-400'
                                                                }`}>{tmpl.ats_priority}</span>
                                                            </motion.button>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Mobile slide drawer */}
                <AnimatePresence>
                    {rightPanelOpen && (
                        <motion.div
                            key="mobile-template-drawer"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                            className="md:hidden fixed right-0 top-0 h-full w-[320px] z-50 bg-white dark:bg-slate-900 shadow-2xl border-l border-gray-200 dark:border-slate-700 flex flex-col"
                        >
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-[#5c52d2]" />
                                    <h3 className="text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider">Templates</h3>
                                </div>
                                <button onClick={() => setRightPanelOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            {/* Mobile Search */}
                            <div className="px-3 py-2 flex-shrink-0">
                                <div className="relative">
                                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                                    <input
                                        type="text"
                                        placeholder="Search templates..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-7 pr-3 py-2 text-[11px] border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-[#5c52d2] bg-gray-50/50 dark:bg-slate-800/50"
                                    />
                                </div>
                            </div>
                            {/* Mobile Template Grid */}
                            <div className="flex-1 overflow-y-auto px-3 pb-3">
                                {TEMPLATE_CATEGORIES.map(cat => {
                                    const templates = filteredCatalog.filter(t => t.category === cat);
                                    if (templates.length === 0) return null;
                                    const isExpanded = expandedCats.has(cat);
                                    return (
                                        <div key={cat} className="mb-1">
                                            <button
                                                onClick={() => toggleCategory(cat)}
                                                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
                                            >
                                                <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                                    {isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                                                    {cat} <span className="text-[8px] text-gray-300">({templates.length})</span>
                                                </span>
                                            </button>
                                            {isExpanded && (
                                                <div className="grid grid-cols-3 gap-1.5 p-1">
                                                    {templates.map(tmpl => {
                                                        const isSelected = selectedId === tmpl.template_id;
                                                        const displayColor = customColor || tmpl.default_color;
                                                        return (
                                                            <button
                                                                key={tmpl.template_id}
                                                                onClick={() => { selectTemplate(tmpl.template_id); setRightPanelOpen(false); }}
                                                                className={`relative p-1.5 rounded-xl border-2 text-left transition-all ${isSelected
                                                                    ? 'border-[#5c52d2] bg-purple-50/50 shadow-md'
                                                                    : 'border-gray-100 hover:border-gray-200 bg-white'
                                                                }`}
                                                            >
                                                                {isSelected && (
                                                                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#5c52d2] rounded-full flex items-center justify-center shadow z-10">
                                                                        <CheckCircle2 className="w-2 h-2 text-white" />
                                                                    </div>
                                                                )}
                                                                <div className="w-full h-10 rounded-lg border border-gray-100 overflow-hidden bg-white mb-1">
                                                                    <MiniThumb base={tmpl.base} color={displayColor} />
                                                                </div>
                                                                <p className="text-[7px] font-bold text-gray-700 truncate">{tmpl.name}</p>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mobile backdrop */}
                <AnimatePresence>
                    {rightPanelOpen && (
                        <motion.div
                            key="mobile-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="md:hidden fixed inset-0 bg-black/40 z-40"
                            onClick={() => setRightPanelOpen(false)}
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* FLOATING DRAGGABLE SIDE PANEL                       */}
            {/* ═══════════════════════════════════════════════════ */}
            <AnimatePresence>
                {showPanel ? (
                    <motion.div
                        key="editor-panel"
                        drag
                        dragMomentum={false}
                        dragElastic={0}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className="fixed z-50"
                        style={{
                            right: '16px',
                            top: 'calc(50% - 260px)',
                            width: '340px',
                            height: '520px',
                        }}
                    >
                        <div className="w-full h-full bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
                            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(92,82,210,0.12)' }}
                        >
                            {/* Drag Handle + Header */}
                            <div
                                className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] rounded-t-2xl shrink-0 cursor-grab active:cursor-grabbing select-none"
                            >
                                <div className="flex items-center gap-2">
                                    <GripVertical className="w-3.5 h-3.5 text-white/60" />
                                    <span className="text-white text-xs font-black">✏️ Resume Editor</span>
                                    <span className="text-[9px] text-white/50 font-medium">drag to move</span>
                                </div>
                                <button
                                    onClick={() => setShowPanel(false)}
                                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                                    title="Minimize Editor"
                                >
                                    <PanelRightClose className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            {/* Panel Body */}
                            <div className="flex-1 overflow-hidden">
                                <SidePanelEditor
                                    data={data}
                                    onChange={onChange}
                                    selectedTemplate={selected.base}
                                />
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    /* Minimized tab — small button on right side */
                    <motion.button
                        key="editor-tab"
                        initial={{ x: 60, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 60, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        onClick={() => setShowPanel(true)}
                        className="fixed z-50 right-0 bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] text-white rounded-l-2xl shadow-xl hover:shadow-2xl transition-shadow flex items-center gap-2 px-4 py-3"
                        style={{ top: '50%', transform: 'translateY(-50%)' }}
                        title="Open Resume Editor"
                    >
                        <PanelRightOpen className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Editor</span>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ═══════════════════════════════════════════════════ */}
            {/* FULLSCREEN PREVIEW MODAL — Portal to body so it    */}
            {/* escapes SectionCard's overflow/transform context    */}
            {/* ═══════════════════════════════════════════════════ */}
            {createPortal(
                <AnimatePresence>
                    {showFullPreview && (
                        <motion.div
                            key="fullscreen-preview"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="fixed inset-0 z-[100] flex flex-col"
                            style={{ backgroundColor: 'rgba(15, 15, 25, 0.95)', backdropFilter: 'blur(12px)' }}
                        >
                            {/* ── Close Button — absolute top-right ── */}
                            <motion.button
                                whileHover={{ scale: 1.15, rotate: 90 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setShowFullPreview(false)}
                                className="absolute top-4 right-4 z-[110] w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-red-500/80 text-white/80 hover:text-white transition-all duration-200 shadow-lg backdrop-blur-sm border border-white/10 hover:border-red-400/50"
                                title="Close Preview (ESC)"
                            >
                                <X className="w-5 h-5" strokeWidth={2.5} />
                            </motion.button>

                            {/* ── Small header info bar ── */}
                            <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-[#5c52d2]" />
                                    <span className="text-white/80 text-xs font-bold">Resume Preview</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${pageCount > 1
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'bg-emerald-500/20 text-emerald-400'
                                        }`}>
                                        {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 ml-auto mr-12">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleExportPDF}
                                        disabled={!!exporting}
                                        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50"
                                    >
                                        <FileText className="w-3 h-3" /> PDF
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleExportDOCX}
                                        disabled={!!exporting}
                                        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50"
                                    >
                                        <FileType2 className="w-3 h-3" /> Word
                                    </motion.button>
                                </div>
                            </div>

                            {/* ── Overflow warning ── */}
                            {pageCount > 1 && (
                                <div className="mx-auto flex items-center gap-2 px-4 py-2 bg-amber-500/15 border border-amber-500/30 rounded-xl max-w-lg flex-shrink-0">
                                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                    <p className="text-[10px] text-amber-300 font-medium">
                                        Your resume exceeds one page. Recruiters usually prefer one-page resumes.
                                    </p>
                                </div>
                            )}

                            {/* ── Preview Body — scrollable with CSS zoom ── */}
                            <div
                                className="flex-1 overflow-y-auto overflow-x-hidden"
                                style={{ WebkitOverflowScrolling: 'touch' }}
                            >
                                <div
                                    className="mx-auto my-4"
                                    style={{
                                        width: '794px',
                                        minHeight: `${A4_PAGE_HEIGHT}px`,
                                        /* 
                                         * CSS zoom actually changes layout dimensions (unlike 
                                         * transform: scale which only visually scales). This means
                                         * scrolling works natively.
                                         */
                                        zoom: fsScale,
                                    }}
                                >
                                    <div
                                        className={`bg-white shadow-2xl relative resume-protected-paper ${isCapturing ? 'resume-capturing' : ''}`}
                                        style={{
                                            width: '794px',
                                            minHeight: `${A4_PAGE_HEIGHT}px`,
                                            ...paperProtectionStyle,
                                        }}
                                        ref={fsPaperRef}
                                        {...paperProtectionHandlers}
                                    >
                                        <RenderTemplate base={selected.base} data={data} color={accentColor} />

                                        {/* Page break lines in fullscreen */}
                                        {pageCount > 1 && Array.from({ length: pageCount - 1 }, (_, i) => (
                                            <div
                                                key={`fs-page-break-${i}`}
                                                className="absolute left-0 right-0 pointer-events-none z-10"
                                                style={{ top: `${(i + 1) * A4_PAGE_HEIGHT}px` }}
                                            >
                                                <div className="relative">
                                                    <div className="w-full border-t-2 border-dashed border-red-400/60" />
                                                    <span className="absolute right-3 -top-3 bg-red-500/80 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full shadow">
                                                        Page {i + 2}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* ── Keyboard hint ── */}
                            <div className="text-center pb-3 flex-shrink-0">
                                <span className="text-[10px] text-white/30 font-medium">Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/50 text-[9px] font-bold">ESC</kbd> to close · Scroll to see full resume</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
            {/* ═══════════════════════════════════════════════════ */}
            {/* RESUME NAME MODAL — for fresh saves                  */}
            {/* ═══════════════════════════════════════════════════ */}
            {createPortal(
                <AnimatePresence>
                    {showNameModal && (
                        <motion.div
                            key="name-modal"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
                            style={{ backgroundColor: 'rgba(15, 15, 25, 0.7)', backdropFilter: 'blur(8px)' }}
                            onClick={() => setShowNameModal(false)}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] px-8 py-6">
                                    <h3 className="text-xl font-black text-white">Name Your Resume</h3>
                                    <p className="text-white/70 text-sm font-medium mt-1">Give it a memorable name so you can find it later</p>
                                </div>
                                <div className="p-8 space-y-6">
                                    {resolved && storageLimitReached && (
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                                            Your current plan is full for saved resumes. You can keep editing this draft, but saving a new resume to your profile requires more storage.
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Resume Name</label>
                                        <input
                                            type="text"
                                            value={resumeNameInput}
                                            onChange={e => setResumeNameInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSaveWithName()}
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 font-bold focus:outline-none focus:border-[#5c52d2] focus:ring-4 focus:ring-purple-100 transition-all"
                                            placeholder="e.g. Software Engineer Resume"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowNameModal(false)}
                                            className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveWithName}
                                            disabled={!resumeNameInput.trim()}
                                            className={`flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold shadow-lg shadow-green-200 hover:shadow-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2 ${resolved && storageLimitReached ? 'opacity-80' : ''}`}
                                        >
                                            <Save className="w-4 h-4" /> Save Resume
                                            {resolved && storageLimitReached && <Lock className="w-4 h-4 text-white/80" />}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* ═══════════════════════════════════════════════════ */}
            {/* SAVE MODE MODAL — Replace or Save Copy (edit mode)  */}
            {/* ═══════════════════════════════════════════════════ */}
            {createPortal(
                <AnimatePresence>
                    {showSaveModeModal && (
                        <motion.div
                            key="save-mode-modal"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
                            style={{ backgroundColor: 'rgba(15, 15, 25, 0.7)', backdropFilter: 'blur(8px)' }}
                            onClick={() => setShowSaveModeModal(false)}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] px-8 py-6">
                                    <h3 className="text-xl font-black text-white">Save Changes</h3>
                                    <p className="text-white/70 text-sm font-medium mt-1">
                                        How would you like to save "<span className="text-white font-bold">{editMeta?.originalName}</span>"?
                                    </p>
                                </div>

                                <div className="p-8">
                                    <AnimatePresence mode="wait">
                                        {saveModeStep === 'choose' && (
                                            <motion.div
                                                key="choose"
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                                className="space-y-4"
                                            >
                                                <button
                                                    onClick={handleReplaceOriginal}
                                                    className="w-full p-5 rounded-2xl border-2 border-gray-200 hover:border-[#5c52d2] hover:bg-purple-50/50 transition-all group text-left flex items-start gap-4"
                                                >
                                                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0 group-hover:bg-[#5c52d2] transition-colors">
                                                        <Save className="w-5 h-5 text-[#5c52d2] group-hover:text-white transition-colors" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-gray-800 text-base">Replace Original</h4>
                                                        <p className="text-gray-400 text-sm font-medium mt-0.5">Overwrite "{editMeta?.originalName}" with your changes. Editing the same saved resume stays available.</p>
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        if (resolved && storageLimitReached) {
                                                            openUsageLimitModal(
                                                                'resume_count',
                                                                'You have reached your saved resume limit. You can still replace the current saved resume, but saving a new copy requires more storage.',
                                                            );
                                                            return;
                                                        }
                                                        setCopyNameInput(`${editMeta?.originalName || 'Resume'} (Copy)`);
                                                        setSaveModeStep('copy-name');
                                                    }}
                                                    className={`w-full p-5 rounded-2xl border-2 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group text-left flex items-start gap-4 ${saveCopyLocked ? 'opacity-80' : ''}`}
                                                >
                                                    <div className={`w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 transition-colors ${saveCopyLocked ? '' : 'group-hover:bg-emerald-500'}`}>
                                                        <FileText className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-gray-800 text-base flex items-center gap-2">
                                                            Save as New Copy
                                                            {saveCopyLocked && <Lock className="w-4 h-4 text-amber-500" />}
                                                        </h4>
                                                        <p className="text-gray-400 text-sm font-medium mt-0.5">Keep the original and create a separate version, if your plan still has saved resume space.</p>
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={() => setShowSaveModeModal(false)}
                                                    className="w-full py-3 text-center text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </motion.div>
                                        )}

                                        {saveModeStep === 'copy-name' && (
                                            <motion.div
                                                key="copy-name"
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -10 }}
                                                className="space-y-6"
                                            >
                                                {resolved && storageLimitReached && (
                                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                                                        Your saved resume storage is full. You can still replace the original, but saving an extra copy requires more storage.
                                                    </div>
                                                )}
                                                <div className="space-y-2">
                                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Name for the Copy</label>
                                                    <input
                                                        type="text"
                                                        value={copyNameInput}
                                                        onChange={e => setCopyNameInput(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleSaveAsCopy()}
                                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all"
                                                        placeholder="e.g. Senior Developer Resume v2"
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => setSaveModeStep('choose')}
                                                        className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-colors"
                                                    >
                                                        ← Back
                                                    </button>
                                                    <button
                                                        onClick={handleSaveAsCopy}
                                                        disabled={!copyNameInput.trim()}
                                                        className={`flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold shadow-lg shadow-green-200 hover:shadow-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2 ${saveCopyLocked ? 'opacity-80' : ''}`}
                                                    >
                                                        <Save className="w-4 h-4" /> Save Copy
                                                        {saveCopyLocked && <Lock className="w-4 h-4 text-white/80" />}
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
