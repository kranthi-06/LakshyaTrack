import type { ResumeData } from '../types';
import { ContactLinks } from './ContactLinks';
import { buildContactItems } from './contactLinkUtils';
import { CustomSectionBlock } from './CustomSectionBlock';
import { parseCustomSectionId, resolveZoneSections } from '../sectionModel';

interface TemplateProps {
    data: ResumeData;
    accentColor?: string;
}

export function ModernTemplate({ data, accentColor = '#5c52d2' }: TemplateProps) {
    const p = data.personal;
    return (
        <div className="bg-white w-full min-h-[1122px] font-sans" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            {/* Header */}
            <div className="px-10 pt-10 pb-6" style={{ borderBottom: `3px solid ${accentColor}` }}>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">{p.full_name || 'Your Name'}</h1>
                <p className="text-sm font-bold mt-1" style={{ color: accentColor }}>{p.headline || data.target_role || 'Professional Title'}</p>
                <ContactLinks items={buildContactItems(p)} showIcons compactNames gap="gap-x-4 gap-y-1" className="mt-3 text-xs text-gray-500 font-medium" />
            </div>

            <div className="flex">
                {/* Sidebar */}
                <div className="w-[32%] p-8 space-y-7" style={{ backgroundColor: `${accentColor}08` }}>
                    {resolveZoneSections(data, 'modern', 'sidebar').map(id => {
                        if (id === 'skills' && (data.skills.technical_skills.length > 0 || data.skills.tools.length > 0 || data.skills.soft_skills.length > 0)) return (
                            <div key={id} className="space-y-5">
                                {data.skills.technical_skills.length > 0 && (
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>Technical Skills</h3>
                                        <div className="flex flex-wrap gap-1.5">
                                            {data.skills.technical_skills.map((s, i) => (
                                                <span key={i} className="px-2 py-1 text-[10px] font-bold rounded-md border bg-white text-gray-700" style={{ borderColor: `${accentColor}30` }}>{s}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {data.skills.tools.length > 0 && (
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>Tools & Frameworks</h3>
                                        <div className="flex flex-wrap gap-1.5">
                                            {data.skills.tools.map((s, i) => (
                                                <span key={i} className="px-2 py-1 text-[10px] font-bold rounded-md border bg-white text-gray-700" style={{ borderColor: `${accentColor}30` }}>{s}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {data.skills.soft_skills.length > 0 && (
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>Soft Skills</h3>
                                        <div className="flex flex-wrap gap-1.5">
                                            {data.skills.soft_skills.map((s, i) => (
                                                <span key={i} className="px-2 py-1 text-[10px] font-bold rounded-md border bg-white text-gray-600" style={{ borderColor: `${accentColor}20` }}>{s}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                        if (id === 'education' && data.education.some(e => e.degree)) return (
                            <div key={id}>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>Education</h3>
                                <div className="space-y-3">
                                    {data.education.filter(e => e.degree).map((ed, i) => (
                                        <div key={i}>
                                            <p className="text-xs font-bold text-gray-800">{ed.degree}</p>
                                            <p className="text-[10px] text-gray-500 font-medium">{ed.institution}</p>
                                            <p className="text-[10px] text-gray-400">{ed.duration}</p>
                                            {ed.description && <p className="text-[10px] text-gray-500 mt-1">{ed.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                        const customId = parseCustomSectionId(id);
                        if (customId) {
                            const entry = data.custom_sections?.find(cs => cs.id === customId);
                            if (entry && entry.title) return (
                                <CustomSectionBlock
                                    key={id}
                                    entry={entry}
                                    wrapperClass=""
                                    headingClass="text-[10px] font-black uppercase tracking-[0.2em] mb-3"
                                    headingStyle={{ color: accentColor }}
                                    bodyClass="text-xs text-gray-600 leading-relaxed font-medium"
                                />
                            );
                            return null;
                        }
                        return null;
                    })}
                </div>

                {/* Main Content */}
                <div className="w-[68%] p-8 space-y-7">
                    {resolveZoneSections(data, 'modern', 'main').map(id => {
                        if (id === 'summary' && p.professional_summary) return (
                            <div key={id}>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>Professional Summary</h3>
                                <p className="text-xs text-gray-600 leading-relaxed font-medium">{p.professional_summary}</p>
                            </div>
                        );
                        if (id === 'experience' && data.experience.some(e => e.title)) return (
                            <div key={id}>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4" style={{ color: accentColor }}>Professional Experience</h3>
                                <div className="space-y-5">
                                    {data.experience.filter(e => e.title).map((exp, i) => (
                                        <div key={i} className="pl-4" style={{ borderLeft: `2px solid ${accentColor}30` }}>
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900">{exp.title}</p>
                                                    <p className="text-xs text-gray-500 font-medium">{exp.organization}</p>
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap ml-1 flex-shrink-0">{exp.duration}</span>
                                            </div>
                                            {exp.bullets && exp.bullets.length > 0 ? (
                                                <ul className="mt-2 space-y-1">
                                                    {exp.bullets.map((b, bi) => (
                                                        <li key={bi} className="text-xs text-gray-600 leading-relaxed flex gap-2">
                                                            <span style={{ color: accentColor }} className="mt-0.5 flex-shrink-0">•</span>
                                                            <span>{b}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : exp.description ? (
                                                <p className="text-xs text-gray-600 leading-relaxed mt-2">{exp.description}</p>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                        if (id === 'projects' && data.projects.some(p => p.name)) return (
                            <div key={id}>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4" style={{ color: accentColor }}>Projects</h3>
                                <div className="space-y-4">
                                    {data.projects.filter(p => p.name).map((proj, i) => (
                                        <div key={i}>
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-bold text-gray-900">{proj.name}</p>
                                            </div>
                                            {proj.technologies && (
                                                <p className="text-[10px] font-bold mt-0.5" style={{ color: accentColor }}>{proj.technologies}</p>
                                            )}
                                            {proj.description && (
                                                <p className="text-xs text-gray-600 leading-relaxed mt-1">{proj.description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                        const customId = parseCustomSectionId(id);
                        if (customId) {
                            const entry = data.custom_sections?.find(cs => cs.id === customId);
                            if (entry && entry.title) return (
                                <CustomSectionBlock
                                    key={id}
                                    entry={entry}
                                    wrapperClass=""
                                    headingClass="text-[10px] font-black uppercase tracking-[0.2em] mb-3"
                                    headingStyle={{ color: accentColor }}
                                    bodyClass="text-xs text-gray-600 leading-relaxed font-medium"
                                />
                            );
                            return null;
                        }
                        return null;
                    })}
                </div>
            </div>
        </div>
    );
}
