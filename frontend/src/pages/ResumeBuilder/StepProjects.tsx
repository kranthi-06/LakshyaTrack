import { useState } from 'react';
import { ImagePlus, Laptop, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { SectionCard, FieldInput, FieldTextarea, AIButton } from './components';
import { enhanceProjects } from '../../services/resumeBuilder';
import { uploadUserMedia } from '../../services/media';
import type { ResumeData, ProjectItem } from './types';

const empty: ProjectItem = { name: '', technologies: '', description: '' };

export function StepProjects({ data, onChange }: { data: ResumeData; onChange: (d: Partial<ResumeData>) => void }) {
    const [aiLoading, setAiLoading] = useState(false);
    const [enhanced, setEnhanced] = useState(false);
    const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
    const [uploadErrors, setUploadErrors] = useState<Record<number, string>>({});
    const items = data.projects;

    const setItem = (idx: number, field: keyof ProjectItem, val: string) => {
        const next = [...items];
        next[idx] = { ...next[idx], [field]: val };
        onChange({ projects: next });
    };

    const add = () => onChange({ projects: [...items, { ...empty }] });
    const remove = (i: number) => items.length > 1 && onChange({ projects: items.filter((_, idx) => idx !== i) });

    const handleEnhance = async () => {
        setAiLoading(true);
        try {
            const result = await enhanceProjects({ items, target_role: data.target_role });
            if (result.items) {
                onChange({
                    projects: result.items.map((it: any, idx: number) => ({
                        ...(items[idx] || empty),
                        ...it,
                        technologies: Array.isArray(it.technologies) ? it.technologies.join(', ') : it.technologies,
                    })),
                });
                setEnhanced(true);
            }
        } catch (e) {
            console.error(e);
        }
        setAiLoading(false);
    };

    const handleProjectImageUpload = async (idx: number, file?: File | null) => {
        if (!file) return;

        setUploadingIndex(idx);
        setUploadErrors(prev => ({ ...prev, [idx]: '' }));
        try {
            const uploadResult = await uploadUserMedia(file, 'project_image');
            setItem(idx, 'project_image_url', uploadResult.secure_url);
        } catch (error) {
            console.error('Project image upload failed:', error);
            setUploadErrors(prev => ({
                ...prev,
                [idx]: 'Failed to upload the screenshot. Please try again.',
            }));
        } finally {
            setUploadingIndex(null);
        }
    };

    return (
        <SectionCard icon={Laptop} title="Projects" subtitle="Showcase your best work">
            {items.map((proj, i) => (
                <div key={i} className="p-6 bg-gray-50/80 rounded-2xl border border-gray-100 space-y-4 relative">
                    {items.length > 1 && (
                        <button
                            onClick={() => remove(i)}
                            className="absolute top-4 right-4 text-gray-300 hover:text-red-400 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                    <FieldInput label="Project Name" value={proj.name} onChange={v => setItem(i, 'name', v)} placeholder="AI Resume Builder" />
                    <FieldInput label="Technologies Used" value={proj.technologies} onChange={v => setItem(i, 'technologies', v)} placeholder="React, Python, FastAPI, OpenAI" />
                    <FieldTextarea label="Description (raw - AI will polish it)" value={proj.description} onChange={v => setItem(i, 'description', v)} placeholder="Describe what you built and what problem it solves..." rows={3} />

                    <div className="space-y-3">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Project Screenshot</label>
                        <div className="rounded-2xl border border-dashed border-indigo-100 bg-white p-4">
                            {proj.project_image_url ? (
                                <img
                                    src={proj.project_image_url}
                                    alt={proj.name || `Project ${i + 1}`}
                                    className="w-full h-48 object-cover rounded-xl border border-gray-100"
                                    loading="lazy"
                                    decoding="async"
                                />
                            ) : (
                                <div className="h-40 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-center text-center px-6">
                                    <p className="text-sm font-semibold text-indigo-500">
                                        Upload a portfolio image or project screenshot for this project.
                                    </p>
                                </div>
                            )}

                            <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 font-bold text-sm cursor-pointer hover:bg-indigo-100 transition-colors">
                                {uploadingIndex === i ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                                    </>
                                ) : (
                                    <>
                                        <ImagePlus className="w-4 h-4" /> {proj.project_image_url ? 'Replace image' : 'Upload image'}
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleProjectImageUpload(i, e.target.files?.[0])}
                                    disabled={uploadingIndex === i}
                                />
                            </label>

                            {uploadErrors[i] ? (
                                <p className="mt-3 text-xs font-semibold text-red-500">{uploadErrors[i]}</p>
                            ) : null}
                        </div>
                    </div>
                </div>
            ))}

            <button onClick={add} className="w-full h-14 border-2 border-dashed border-indigo-100 rounded-2xl flex items-center justify-center gap-2 text-indigo-400 font-bold hover:bg-indigo-50/50 transition-all text-sm">
                <PlusCircle className="w-5 h-5" /> Add Project
            </button>
            <div className="flex items-center justify-between">
                <AIButton onClick={handleEnhance} loading={aiLoading} />
                {enhanced && <span className="text-xs font-bold text-emerald-600">AI Enhanced</span>}
            </div>
        </SectionCard>
    );
}
