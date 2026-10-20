import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, GraduationCap, Briefcase, Laptop, Wrench, Sparkles, Loader2, Plus, Trash2, CheckCircle2, AlertCircle, ListPlus } from 'lucide-react';
import type { ResumeData, PersonalInfo, EducationItem, ExperienceItem, ProjectItem, CustomSectionItem } from './types';
import { enhancePersonalInfo, enhanceEducation, enhanceExperience, enhanceProjects, enhanceSkills } from '../../services/resumeBuilder';
import type { BaseTemplate } from './templates';

type PanelTab = 'personal' | 'education' | 'experience' | 'projects' | 'skills' | 'sections';

interface SidePanelEditorProps {
    data: ResumeData;
    onChange: (d: Partial<ResumeData>) => void;
    selectedTemplate: BaseTemplate;
}

const TABS: { id: PanelTab; label: string; icon: any }[] = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'education', label: 'Education', icon: GraduationCap },
    { id: 'experience', label: 'Experience', icon: Briefcase },
    { id: 'projects', label: 'Projects', icon: Laptop },
    { id: 'skills', label: 'Skills', icon: Wrench },
    { id: 'sections', label: 'Custom', icon: ListPlus },
];

function newCustomId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `cs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function SkillTextarea({ value, onChange, placeholder }: { value: string[], onChange: (val: string) => void, placeholder: string }) {
    const [localVal, setLocalVal] = useState(value.join(', '));

    // Sync from props if the external value fundamentally changes (e.g., from AI improve)
    // We compare the arrays to avoid overriding mid-typing commas
    if (JSON.stringify(localVal.split(',').map(s => s.trim()).filter(Boolean)) !== JSON.stringify(value)) {
        setLocalVal(value.join(', '));
    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value;
        setLocalVal(newVal);
        onChange(newVal);
    };

    return (
        <textarea
            className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-[#5c52d2] transition-all resize-none placeholder-gray-300"
            rows={3}
            value={localVal}
            onChange={handleChange}
            placeholder={placeholder}
        />
    );
}

export function SidePanelEditor({ data, onChange }: SidePanelEditorProps) {
    const [activeTab, setActiveTab] = useState<PanelTab>('personal');
    const [aiLoading, setAiLoading] = useState<string | null>(null);
    const [aiMessage, setAiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const showMsg = (type: 'success' | 'error', text: string) => {
        setAiMessage({ type, text });
        setTimeout(() => setAiMessage(null), 4000);
    };

    const handleAIImprove = async (section: PanelTab) => {
        setAiLoading(section);
        setAiMessage(null);
        try {
            switch (section) {
                case 'personal': {
                    // Backend PersonalInfoRequest: flat fields
                    const result = await enhancePersonalInfo({
                        full_name: data.personal.full_name || '',
                        email: data.personal.email || '',
                        phone: data.personal.phone || '',
                        location: data.personal.location || '',
                        professional_summary: data.personal.professional_summary || '',
                        target_role: data.target_role || '',
                    });
                    if (result && !result.error) {
                        onChange({
                            personal: {
                                ...data.personal,
                                full_name: result.full_name || data.personal.full_name,
                                email: result.email || data.personal.email,
                                phone: result.phone || data.personal.phone,
                                location: result.location || data.personal.location,
                                professional_summary: result.professional_summary || data.personal.professional_summary,
                            }
                        });
                        showMsg('success', '✅ Personal info enhanced!');
                    } else {
                        showMsg('error', result?.detail || 'Enhancement failed');
                    }
                    break;
                }
                case 'education': {
                    // Backend EducationRequest: { items: [...], target_role }
                    const result = await enhanceEducation({
                        items: data.education.map(e => ({
                            degree: e.degree || '',
                            institution: e.institution || '',
                            duration: e.duration || '',
                            description: e.description || '',
                        })),
                        target_role: data.target_role || '',
                    });
                    if (result && !result.error && result.items) {
                        onChange({ education: result.items });
                        showMsg('success', '✅ Education enhanced!');
                    } else {
                        showMsg('error', result?.detail || 'Enhancement failed');
                    }
                    break;
                }
                case 'experience': {
                    // Backend ExperienceRequest: { items: [...], target_role }
                    const result = await enhanceExperience({
                        items: data.experience.map(e => ({
                            title: e.title || '',
                            organization: e.organization || '',
                            duration: e.duration || '',
                            description: (e.bullets && e.bullets.length > 0) ? e.bullets.join('. ') : (e.description || ''),
                        })),
                        target_role: data.target_role || '',
                    });
                    if (result && !result.error && result.items) {
                        onChange({ experience: result.items });
                        showMsg('success', '✅ Experience enhanced with bullet points!');
                    } else {
                        showMsg('error', result?.detail || 'Enhancement failed');
                    }
                    break;
                }
                case 'projects': {
                    // Backend ProjectRequest: { items: [...], target_role }
                    const result = await enhanceProjects({
                        items: data.projects.map(p => ({
                            name: p.name || '',
                            technologies: p.technologies || '',
                            description: p.description || '',
                        })),
                        target_role: data.target_role || '',
                    });
                    if (result && !result.error && result.items) {
                        onChange({ projects: result.items });
                        showMsg('success', '✅ Projects enhanced!');
                    } else {
                        showMsg('error', result?.detail || 'Enhancement failed');
                    }
                    break;
                }
                case 'skills': {
                    // Backend SkillsRequest: { raw_skills: "comma string", target_role }
                    const allSkills = [
                        ...data.skills.technical_skills,
                        ...data.skills.tools,
                        ...data.skills.soft_skills,
                    ].join(', ');
                    const result = await enhanceSkills({
                        raw_skills: allSkills,
                        target_role: data.target_role || '',
                    });
                    if (result && !result.error) {
                        onChange({
                            skills: {
                                ...data.skills,
                                technical_skills: result.technical_skills || data.skills.technical_skills,
                                tools: result.tools || data.skills.tools,
                                soft_skills: result.soft_skills || data.skills.soft_skills,
                            }
                        });
                        showMsg('success', '✅ Skills optimized!');
                    } else {
                        showMsg('error', result?.detail || 'Enhancement failed');
                    }
                    break;
                }
            }
        } catch (e: any) {
            console.error('AI improve error:', e);
            const errMsg = e?.response?.data?.detail || e?.message || 'AI service unavailable';
            showMsg('error', `❌ ${errMsg}`);
        }
        setAiLoading(null);
    };

    const updatePersonal = (field: keyof PersonalInfo, value: string) => {
        onChange({ personal: { ...data.personal, [field]: value } });
    };

    const updateEducation = (index: number, field: keyof EducationItem, value: string) => {
        const updated = [...data.education];
        updated[index] = { ...updated[index], [field]: value };
        onChange({ education: updated });
    };

    const addEducation = () => {
        onChange({ education: [...data.education, { degree: '', institution: '', duration: '', description: '' }] });
    };

    const removeEducation = (index: number) => {
        onChange({ education: data.education.filter((_, i) => i !== index) });
    };

    const updateExperience = (index: number, field: keyof ExperienceItem, value: any) => {
        const updated = [...data.experience];
        updated[index] = { ...updated[index], [field]: value };
        onChange({ experience: updated });
    };

    const updateExperienceBullet = (expIndex: number, bulletIndex: number, value: string) => {
        const updated = [...data.experience];
        const bullets = [...(updated[expIndex].bullets || [])];
        bullets[bulletIndex] = value;
        updated[expIndex] = { ...updated[expIndex], bullets };
        onChange({ experience: updated });
    };

    const addExperienceBullet = (expIndex: number) => {
        const updated = [...data.experience];
        updated[expIndex] = { ...updated[expIndex], bullets: [...(updated[expIndex].bullets || []), ''] };
        onChange({ experience: updated });
    };

    const removeExperienceBullet = (expIndex: number, bulletIndex: number) => {
        const updated = [...data.experience];
        updated[expIndex] = { ...updated[expIndex], bullets: (updated[expIndex].bullets || []).filter((_, i) => i !== bulletIndex) };
        onChange({ experience: updated });
    };

    const addExperience = () => {
        onChange({ experience: [...data.experience, { title: '', organization: '', duration: '', description: '', bullets: [''] }] });
    };

    const removeExperience = (index: number) => {
        onChange({ experience: data.experience.filter((_, i) => i !== index) });
    };

    const updateProject = (index: number, field: keyof ProjectItem, value: string) => {
        const updated = [...data.projects];
        updated[index] = { ...updated[index], [field]: value };
        onChange({ projects: updated });
    };

    const addProject = () => {
        onChange({ projects: [...data.projects, { name: '', technologies: '', description: '' }] });
    };

    const removeProject = (index: number) => {
        onChange({ projects: data.projects.filter((_, i) => i !== index) });
    };

    const updateSkillCategory = (category: 'technical_skills' | 'tools' | 'soft_skills', value: string) => {
        onChange({
            skills: {
                ...data.skills,
                [category]: value.split(',').map(s => s.trim()).filter(Boolean),
            }
        });
    };

    const updateCustomSection = (id: string, patch: Partial<CustomSectionItem>) => {
        onChange({
            custom_sections: (data.custom_sections ?? []).map(cs => cs.id === id ? { ...cs, ...patch } : cs),
        });
    };

    const addCustomSection = () => {
        onChange({
            custom_sections: [...(data.custom_sections ?? []), { id: newCustomId(), title: 'New Section', content: '' }],
        });
    };

    const removeCustomSection = (id: string) => {
        const fullId = `custom:${id}`;
        onChange({
            custom_sections: (data.custom_sections ?? []).filter(cs => cs.id !== id),
            section_order: (data.section_order ?? []).filter(s => s !== fullId),
            hidden_sections: (data.hidden_sections ?? []).filter(s => s !== fullId),
        });
    };

    const inputCls = "w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-[#5c52d2] transition-all placeholder-gray-300";
    const textareaCls = "w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-[#5c52d2] transition-all resize-none placeholder-gray-300";
    const labelCls = "text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block";

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Tab Bar */}
            <div className="flex border-b border-gray-200 bg-white shrink-0 overflow-x-auto">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border-b-2 ${activeTab === tab.id
                                ? 'text-[#5c52d2] border-[#5c52d2] bg-purple-50/50'
                                : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* AI Improve Button (not applicable to custom sections) */}
            {activeTab !== 'sections' && (
            <div className="px-3 py-2 border-b border-gray-100 bg-white shrink-0 space-y-1.5">
                <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleAIImprove(activeTab)}
                    disabled={!!aiLoading}
                    className="w-full py-2 bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] text-white rounded-xl font-bold text-[10px] shadow-md shadow-purple-100 hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                    {aiLoading === activeTab ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Improving...</>
                    ) : (
                        <><Sparkles className="w-3 h-3" /> ✨ Improve {TABS.find(t => t.id === activeTab)?.label} with AI</>
                    )}
                </motion.button>
                {/* AI Status Message */}
                <AnimatePresence>
                    {aiMessage && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold ${aiMessage.type === 'success'
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-red-50 text-red-500'
                                }`}
                        >
                            {aiMessage.type === 'success'
                                ? <CheckCircle2 className="w-3 h-3 shrink-0" />
                                : <AlertCircle className="w-3 h-3 shrink-0" />
                            }
                            <span className="truncate">{aiMessage.text}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            )}

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-3"
                    >
                        {/* PERSONAL TAB */}
                        {activeTab === 'personal' && (
                            <>
                                <div>
                                    <label className={labelCls}>Full Name</label>
                                    <input className={inputCls} value={data.personal.full_name} onChange={e => updatePersonal('full_name', e.target.value)} placeholder="John Doe" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelCls}>Email</label>
                                        <input className={inputCls} value={data.personal.email} onChange={e => updatePersonal('email', e.target.value)} placeholder="email@example.com" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Phone</label>
                                        <input className={inputCls} value={data.personal.phone} onChange={e => updatePersonal('phone', e.target.value)} placeholder="+1 234 567 8900" />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Location</label>
                                    <input className={inputCls} value={data.personal.location} onChange={e => updatePersonal('location', e.target.value)} placeholder="City, Country" />
                                </div>
                                <div>
                                    <label className={labelCls}>Headline</label>
                                    <input className={inputCls} value={data.personal.headline || ''} onChange={e => updatePersonal('headline', e.target.value)} placeholder="Senior Backend Engineer" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelCls}>LinkedIn</label>
                                        <input className={inputCls} value={data.personal.linkedin_url || ''} onChange={e => updatePersonal('linkedin_url', e.target.value)} placeholder="linkedin.com/in/you" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>GitHub</label>
                                        <input className={inputCls} value={data.personal.github_url || ''} onChange={e => updatePersonal('github_url', e.target.value)} placeholder="github.com/you" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelCls}>Portfolio</label>
                                        <input className={inputCls} value={data.personal.portfolio_url || ''} onChange={e => updatePersonal('portfolio_url', e.target.value)} placeholder="you.dev" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Website</label>
                                        <input className={inputCls} value={data.personal.website_url || ''} onChange={e => updatePersonal('website_url', e.target.value)} placeholder="example.com" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelCls}>LeetCode</label>
                                        <input className={inputCls} value={data.personal.leetcode_url || ''} onChange={e => updatePersonal('leetcode_url', e.target.value)} placeholder="leetcode.com/you" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>HackerRank</label>
                                        <input className={inputCls} value={data.personal.hackerrank_url || ''} onChange={e => updatePersonal('hackerrank_url', e.target.value)} placeholder="hackerrank.com/you" />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Kaggle</label>
                                    <input className={inputCls} value={data.personal.kaggle_url || ''} onChange={e => updatePersonal('kaggle_url', e.target.value)} placeholder="kaggle.com/you" />
                                </div>
                                {/* Link count guidance */}
                                {(() => {
                                    const linkCount = [
                                        data.personal.linkedin_url, data.personal.github_url, data.personal.portfolio_url,
                                        data.personal.website_url, data.personal.leetcode_url, data.personal.hackerrank_url,
                                        data.personal.kaggle_url
                                    ].filter(url => url?.trim()).length;
                                    const RECOMMENDED_MAX_LINKS = 5;
                                    if (linkCount > RECOMMENDED_MAX_LINKS) {
                                        return (
                                            <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[10px]">
                                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-bold">Link Count Guidance</p>
                                                    <p className="text-amber-700">
                                                        You've added {linkCount} professional links. We recommend keeping your resume header concise (up to {RECOMMENDED_MAX_LINKS} links). Consider including only the links most relevant to this application.
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                                <div>
                                    <label className={labelCls}>Professional Summary</label>
                                    <textarea className={textareaCls} rows={5} value={data.personal.professional_summary} onChange={e => updatePersonal('professional_summary', e.target.value)} placeholder="Experienced professional with..." />
                                </div>
                            </>
                        )}

                        {/* EDUCATION TAB */}
                        {activeTab === 'education' && (
                            <>
                                {data.education.map((ed, i) => (
                                    <div key={i} className="p-3 bg-white rounded-xl border border-gray-100 space-y-2 relative">
                                        {data.education.length > 1 && (
                                            <button onClick={() => removeEducation(i)} className="absolute top-2 right-2 text-gray-300 hover:text-red-400 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <div>
                                            <label className={labelCls}>Degree</label>
                                            <input className={inputCls} value={ed.degree} onChange={e => updateEducation(i, 'degree', e.target.value)} placeholder="B.Tech in Computer Science" />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Institution</label>
                                            <input className={inputCls} value={ed.institution} onChange={e => updateEducation(i, 'institution', e.target.value)} placeholder="University Name" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className={labelCls}>Duration</label>
                                                <input className={inputCls} value={ed.duration} onChange={e => updateEducation(i, 'duration', e.target.value)} placeholder="2020 - 2024" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Description</label>
                                            <textarea className={textareaCls} rows={2} value={ed.description} onChange={e => updateEducation(i, 'description', e.target.value)} placeholder="GPA, achievements..." />
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addEducation} className="w-full py-2 flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#5c52d2] border-2 border-dashed border-purple-200 rounded-xl hover:bg-purple-50 transition-colors">
                                    <Plus className="w-3.5 h-3.5" /> Add Education
                                </button>
                            </>
                        )}

                        {/* EXPERIENCE TAB */}
                        {activeTab === 'experience' && (
                            <>
                                {data.experience.map((exp, i) => (
                                    <div key={i} className="p-3 bg-white rounded-xl border border-gray-100 space-y-2 relative">
                                        {data.experience.length > 1 && (
                                            <button onClick={() => removeExperience(i)} className="absolute top-2 right-2 text-gray-300 hover:text-red-400 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <div>
                                            <label className={labelCls}>Job Title</label>
                                            <input className={inputCls} value={exp.title} onChange={e => updateExperience(i, 'title', e.target.value)} placeholder="Software Engineer" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className={labelCls}>Company</label>
                                                <input className={inputCls} value={exp.organization} onChange={e => updateExperience(i, 'organization', e.target.value)} placeholder="Company Name" />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Duration</label>
                                                <input className={inputCls} value={exp.duration} onChange={e => updateExperience(i, 'duration', e.target.value)} placeholder="2022 - Present" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Bullet Points</label>
                                            {(exp.bullets || []).map((b, bi) => (
                                                <div key={bi} className="flex gap-1.5 mb-1.5">
                                                    <span className="text-[10px] text-gray-300 mt-2 font-bold">{bi + 1}.</span>
                                                    <input
                                                        className={inputCls + ' flex-1'}
                                                        value={b}
                                                        onChange={e => updateExperienceBullet(i, bi, e.target.value)}
                                                        placeholder="Describe achievement..."
                                                    />
                                                    <button onClick={() => removeExperienceBullet(i, bi)} className="text-gray-300 hover:text-red-400 mt-1 transition-colors">
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button onClick={() => addExperienceBullet(i)} className="text-[10px] font-bold text-[#5c52d2] hover:underline flex items-center gap-1 mt-1">
                                                <Plus className="w-3 h-3" /> Add bullet
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addExperience} className="w-full py-2 flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#5c52d2] border-2 border-dashed border-purple-200 rounded-xl hover:bg-purple-50 transition-colors">
                                    <Plus className="w-3.5 h-3.5" /> Add Experience
                                </button>
                            </>
                        )}

                        {/* PROJECTS TAB */}
                        {activeTab === 'projects' && (
                            <>
                                {data.projects.map((proj, i) => (
                                    <div key={i} className="p-3 bg-white rounded-xl border border-gray-100 space-y-2 relative">
                                        {data.projects.length > 1 && (
                                            <button onClick={() => removeProject(i)} className="absolute top-2 right-2 text-gray-300 hover:text-red-400 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <div>
                                            <label className={labelCls}>Project Name</label>
                                            <input className={inputCls} value={proj.name} onChange={e => updateProject(i, 'name', e.target.value)} placeholder="Project Name" />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Technologies</label>
                                            <input className={inputCls} value={proj.technologies} onChange={e => updateProject(i, 'technologies', e.target.value)} placeholder="React, Python, Firebase..." />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Description</label>
                                            <textarea className={textareaCls} rows={3} value={proj.description} onChange={e => updateProject(i, 'description', e.target.value)} placeholder="What does this project do..." />
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addProject} className="w-full py-2 flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#5c52d2] border-2 border-dashed border-purple-200 rounded-xl hover:bg-purple-50 transition-colors">
                                    <Plus className="w-3.5 h-3.5" /> Add Project
                                </button>
                            </>
                        )}

                        {/* SKILLS TAB */}
                        {activeTab === 'skills' && (
                            <>
                                <div>
                                    <label className={labelCls}>Technical Skills</label>
                                    <SkillTextarea
                                        value={data.skills.technical_skills}
                                        onChange={v => updateSkillCategory('technical_skills', v)}
                                        placeholder="JavaScript, Python, React..."
                                    />
                                    <p className="text-[9px] text-gray-300 mt-0.5">Separate with commas</p>
                                </div>
                                <div>
                                    <label className={labelCls}>Tools & Frameworks</label>
                                    <SkillTextarea
                                        value={data.skills.tools}
                                        onChange={v => updateSkillCategory('tools', v)}
                                        placeholder="VS Code, Docker, Git..."
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Soft Skills</label>
                                    <SkillTextarea
                                        value={data.skills.soft_skills}
                                        onChange={v => updateSkillCategory('soft_skills', v)}
                                        placeholder="Leadership, Communication..."
                                    />
                                </div>
                            </>
                        )}

                        {/* CUSTOM SECTIONS TAB */}
                        {activeTab === 'sections' && (
                            <div className="space-y-3">
                                <p className="text-[9px] text-gray-400 font-medium leading-relaxed">
                                    Add your own sections (certifications, awards, languages...). Reorder or hide them from the Sections panel next to the preview.
                                </p>
                                {(data.custom_sections ?? []).map(cs => (
                                    <div key={cs.id} className="p-2.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <input
                                                className={inputCls}
                                                value={cs.title}
                                                onChange={e => updateCustomSection(cs.id, { title: e.target.value })}
                                                placeholder="Section title"
                                            />
                                            <button
                                                onClick={() => removeCustomSection(cs.id)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                                                title="Delete section"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <textarea
                                            className={textareaCls}
                                            rows={4}
                                            value={cs.content}
                                            onChange={e => updateCustomSection(cs.id, { content: e.target.value })}
                                            placeholder="Section content..."
                                        />
                                    </div>
                                ))}
                                <button
                                    onClick={addCustomSection}
                                    className="w-full py-2 text-[10px] font-black uppercase tracking-wider text-[#5c52d2] border border-dashed border-purple-200 rounded-xl hover:bg-purple-50/60 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Plus className="w-3 h-3" /> Add Custom Section
                                </button>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
