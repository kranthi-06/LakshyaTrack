import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
    AlertCircle,
    ArrowRight,
    Copy,
    Download,
    Edit2,
    Eye,
    FileText,
    Lock,
    Pencil,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UsageBadge } from '../FeatureLockButton';
import { ResumeRenderer } from '../../pages/ResumeBuilder/templates/ResumeRenderer';
import { resolveCatalogTemplate } from '../../pages/ResumeBuilder/templates';
import type { SavedResumeRecord } from '../../services/resumeStorage';
import {
    asResumeData,
    filterAndSortResumes,
    formatResumeDate,
    resumeAccentColor,
    type ResumeSortKey,
} from './profileUtils';

const RESUME_PAGE_WIDTH = 794;
const RESUME_PAGE_HEIGHT = 1123;

/** Scale an A4 resume page down to the width of its container. */
function useFitToWidth(baseWidth: number) {
    const ref = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const element = ref.current;
        if (!element || typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(() => {
            const width = element.clientWidth;
            if (width > 0) setScale(width < baseWidth ? width / baseWidth : 1);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [baseWidth]);

    return [ref, scale] as const;
}

interface Props {
    resumes: SavedResumeRecord[];
    loading: boolean;
    error: string | null;
    planLabel: string;
    downloadLocked: boolean;
    storageLimitReached: boolean;
    downloadLimitReached: boolean;
    previewResume: SavedResumeRecord | null;
    onRetry: () => void;
    onSearchChange?: (query: string) => void;
    onEdit: (resume: SavedResumeRecord) => void;
    onPreview: (resume: SavedResumeRecord | null) => void;
    onDownloadPdf: (resume: SavedResumeRecord) => void;
    onDownloadDocx: (resume: SavedResumeRecord) => void;
    onRename: (resume: SavedResumeRecord, name: string) => Promise<void>;
    onDuplicate: (resume: SavedResumeRecord) => Promise<void>;
    onDelete: (resume: SavedResumeRecord) => Promise<void>;
}

export function ResumesTab({
    resumes,
    loading,
    error,
    planLabel,
    downloadLocked,
    storageLimitReached,
    downloadLimitReached,
    previewResume,
    onRetry,
    onEdit,
    onPreview,
    onDownloadPdf,
    onDownloadDocx,
    onRename,
    onDuplicate,
    onDelete,
}: Props) {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<ResumeSortKey>('updated');
    const visible = useMemo(() => filterAndSortResumes(resumes, query, sort), [resumes, query, sort]);

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span className="rounded-full bg-[#6C63FF]/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-[#6C63FF]">
                        {planLabel} Plan
                    </span>
                    <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                        Saved resumes <UsageBadge counter="resume_count" showWhenUnlimited />
                    </span>
                    <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                        Monthly downloads <UsageBadge counter="resume_edit_monthly" showWhenUnlimited />
                    </span>
                </div>
                {(storageLimitReached || downloadLimitReached) && (
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                        {storageLimitReached && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700"><Lock className="h-3.5 w-3.5" /> Storage full</span>}
                        {downloadLimitReached && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-700"><Lock className="h-3.5 w-3.5" /> Download limit reached</span>}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or template" className="pl-9" type="search" aria-label="Search resumes" />
                </div>
                <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as ResumeSortKey)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    aria-label="Sort resumes"
                >
                    <option value="updated">Last updated</option>
                    <option value="created">Date created</option>
                    <option value="name">Name</option>
                </select>
            </div>

            {error && (
                <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <span>{error}</span>
                    <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
                </div>
            )}

            {loading ? (
                <p className="py-10 text-center text-slate-400">Loading your resumes…</p>
            ) : !error && visible.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-950">
                    <FileText className="mx-auto h-10 w-10 text-slate-300" />
                    <h3 className="mt-4 text-lg font-black text-slate-800 dark:text-white">{resumes.length === 0 ? 'No saved resumes' : 'No matching resumes'}</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                        {resumes.length === 0
                            ? 'Create and save a resume in Resume Studio. This tab reads the same owned records — it does not create a second library.'
                            : 'Try a different search term.'}
                    </p>
                    {resumes.length === 0 && (
                        <Link
                            to="/resume-builder"
                            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#6C63FF] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#5B54E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
                        >
                            Open Resume Studio
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid gap-5 lg:grid-cols-2">
                    {visible.map((resume) => (
                        <SavedResumeCard
                            key={resume.id}
                            resume={resume}
                            downloadLocked={downloadLocked}
                            onEdit={onEdit}
                            onPreview={onPreview}
                            onDownloadPdf={onDownloadPdf}
                            onDownloadDocx={onDownloadDocx}
                            onRename={onRename}
                            onDuplicate={onDuplicate}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}

            {previewResume && (
                <ResumePreviewModal
                    resume={previewResume}
                    downloadLocked={downloadLocked}
                    onClose={() => onPreview(null)}
                    onEdit={onEdit}
                    onDownloadPdf={onDownloadPdf}
                    onDownloadDocx={onDownloadDocx}
                />
            )}
        </div>
    );
}

function SavedResumeCard({
    resume,
    downloadLocked,
    onEdit,
    onPreview,
    onDownloadPdf,
    onDownloadDocx,
    onRename,
    onDuplicate,
    onDelete,
}: {
    resume: SavedResumeRecord;
    downloadLocked: boolean;
    onEdit: (resume: SavedResumeRecord) => void;
    onPreview: (resume: SavedResumeRecord) => void;
    onDownloadPdf: (resume: SavedResumeRecord) => void;
    onDownloadDocx: (resume: SavedResumeRecord) => void;
    onRename: (resume: SavedResumeRecord, name: string) => Promise<void>;
    onDuplicate: (resume: SavedResumeRecord) => Promise<void>;
    onDelete: (resume: SavedResumeRecord) => Promise<void>;
}) {
    const [visible, setVisible] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [name, setName] = useState(resume.resume_name);
    const [busy, setBusy] = useState(false);
    const [cardError, setCardError] = useState<string | null>(null);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const confirmTitleId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const [thumbnailRef, thumbnailScale] = useFitToWidth(RESUME_PAGE_WIDTH);
    const catalog = resolveCatalogTemplate(resume.template_id);
    const data = asResumeData(resume.resume_data);
    const color = resumeAccentColor(resume);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '200px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <article ref={containerRef} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="min-w-0">
                    {renaming ? (
                        <div className="flex items-center gap-2">
                            <Input value={name} onChange={(event) => setName(event.target.value)} className="h-8" />
                            <Button
                                size="sm"
                                disabled={busy || !name.trim()}
                                onClick={async () => {
                                    setBusy(true);
                                    setCardError(null);
                                    try {
                                        await onRename(resume, name.trim());
                                        setRenaming(false);
                                    } catch (error) {
                                        setCardError(error instanceof Error ? error.message : 'Could not rename this resume.');
                                    } finally {
                                        setBusy(false);
                                    }
                                }}
                            >
                                Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setRenaming(false); setName(resume.resume_name); }}>
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <h4 className="truncate font-bold text-slate-900 dark:text-white">{resume.resume_name}</h4>
                    )}
                    <p className="text-xs text-slate-400">
                        {catalog.name} · {formatResumeDate(resume.updated_at || resume.created_at)}
                    </p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => onPreview(resume)}><Eye className="mr-1 h-3.5 w-3.5" /> Preview</Button>
                    <Button size="sm" variant="outline" onClick={() => onEdit(resume)}><Edit2 className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                </div>
            </div>

            <div ref={thumbnailRef} className="relative h-[280px] overflow-hidden bg-slate-100 dark:bg-slate-900">
                {visible ? (
                    <div
                        className="pointer-events-none absolute left-0 top-0 origin-top-left bg-white"
                        style={{ width: RESUME_PAGE_WIDTH, height: RESUME_PAGE_HEIGHT, transform: `scale(${thumbnailScale})` }}
                    >
                        <div id={`resume-preview-${resume.id}`} className="h-full w-full">
                            <ResumeRenderer base={catalog.base} data={data} color={color} />
                        </div>
                    </div>
                ) : (
                    <div className="h-[280px] animate-pulse bg-slate-200 dark:bg-slate-800" />
                )}
            </div>

            <div className="flex flex-wrap gap-2 px-4 py-3">
                <Button size="sm" variant="outline" onClick={() => onDownloadPdf(resume)} className={downloadLocked ? 'opacity-80' : ''} title={downloadLocked ? 'Monthly download limit reached' : 'Download PDF'} aria-label={`Download ${resume.resume_name} as PDF`}>
                    <Download className="mr-1 h-3.5 w-3.5" /> PDF {downloadLocked && <Lock className="ml-1 h-3.5 w-3.5 text-rose-500" />}
                </Button>
                <Button size="sm" variant="outline" onClick={() => onDownloadDocx(resume)} className={downloadLocked ? 'opacity-80' : ''} title={downloadLocked ? 'Monthly download limit reached' : 'Download DOCX'} aria-label={`Download ${resume.resume_name} as DOCX`}>
                    <Download className="mr-1 h-3.5 w-3.5" /> DOCX {downloadLocked && <Lock className="ml-1 h-3.5 w-3.5 text-rose-500" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setCardError(null); setRenaming(true); }}><Pencil className="mr-1 h-3.5 w-3.5" /> Rename</Button>
                <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={async () => {
                        setBusy(true);
                        setCardError(null);
                        try {
                            await onDuplicate(resume);
                        } catch (error) {
                            setCardError(error instanceof Error ? error.message : 'Could not duplicate this resume.');
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-500 hover:text-rose-600"
                    onClick={() => { setCardError(null); setConfirmingDelete(true); }}
                >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
            </div>
            {cardError && (
                <p role="alert" className="flex items-start gap-2 border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {cardError}
                </p>
            )}
            {confirmingDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby={confirmTitleId} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setConfirmingDelete(false); }}>
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-950">
                        <h3 id={confirmTitleId} className="text-lg font-black text-slate-900 dark:text-white">Delete resume?</h3>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            “{resume.resume_name}” will be permanently removed from your saved resumes. This cannot be undone.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setConfirmingDelete(false)} disabled={busy} autoFocus>Cancel</Button>
                            <Button
                                size="sm"
                                className="bg-rose-500 text-white hover:bg-rose-600"
                                disabled={busy}
                                onClick={async () => {
                                    setBusy(true);
                                    setCardError(null);
                                    try {
                                        await onDelete(resume);
                                        setConfirmingDelete(false);
                                    } catch (error) {
                                        setCardError(error instanceof Error ? error.message : 'Could not delete this resume.');
                                    } finally {
                                        setBusy(false);
                                    }
                                }}
                            >
                                {busy ? 'Deleting…' : 'Delete'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </article>
    );
}

function ResumePreviewModal({
    resume,
    downloadLocked,
    onClose,
    onEdit,
    onDownloadPdf,
    onDownloadDocx,
}: {
    resume: SavedResumeRecord;
    downloadLocked: boolean;
    onClose: () => void;
    onEdit: (resume: SavedResumeRecord) => void;
    onDownloadPdf: (resume: SavedResumeRecord) => void;
    onDownloadDocx: (resume: SavedResumeRecord) => void;
}) {
    const catalog = resolveCatalogTemplate(resume.template_id);
    const data = asResumeData(resume.resume_data);
    const color = resumeAccentColor(resume);
    const [previewRef, previewScale] = useFitToWidth(RESUME_PAGE_WIDTH);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [onClose]);

    const modal = (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="resume-preview-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-950">
                <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                    <h3 id="resume-preview-title" className="min-w-0 truncate font-black text-slate-900 dark:text-white">{resume.resume_name}</h3>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button size="sm" onClick={() => onEdit(resume)}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => onDownloadPdf(resume)} title={downloadLocked ? 'Monthly download limit reached' : 'Download PDF'}>PDF</Button>
                        <Button size="sm" variant="outline" onClick={() => onDownloadDocx(resume)} title={downloadLocked ? 'Monthly download limit reached' : 'Download DOCX'}>DOCX</Button>
                        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close preview" autoFocus><X className="h-4 w-4" /></Button>
                    </div>
                </div>
                <div className="overflow-auto bg-slate-100 p-3 dark:bg-slate-900 sm:p-4">
                    <div
                        ref={previewRef}
                        className="relative mx-auto w-full max-w-[794px] overflow-hidden bg-white shadow-xl"
                        style={{ aspectRatio: `${RESUME_PAGE_WIDTH} / ${RESUME_PAGE_HEIGHT}` }}
                    >
                        <div
                            className="origin-top-left"
                            style={{ width: RESUME_PAGE_WIDTH, height: RESUME_PAGE_HEIGHT, transform: `scale(${previewScale})` }}
                        >
                            <div id={`resume-preview-modal-${resume.id}`}>
                                <ResumeRenderer base={catalog.base} data={data} color={color} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return typeof document === 'undefined' ? modal : createPortal(modal, document.body);
}
