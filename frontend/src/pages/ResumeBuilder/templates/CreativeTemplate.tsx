import type { ResumeData } from '../types';
import { ContactLinks } from './ContactLinks';
import { buildContactItems } from './contactLinkUtils';
import { CustomSectionBlock } from './CustomSectionBlock';
import { parseCustomSectionId, resolveZoneSections } from '../sectionModel';

interface TemplateProps {
    data: ResumeData;
    accentColor?: string;
}

export function CreativeTemplate({ data, accentColor = '#e11d48' }: TemplateProps) {
    const p = data.personal;
    return (
        <div className="bg-white w-full min-h-[1122px] font-sans" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            {/* Colored Header Banner */}
            <div className="px-10 py-8 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}>
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 bg-white" style={{ transform: 'translate(30%, -50%)' }} />
                <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-10 bg-white" style={{ transform: 'translate(-30%, 50%)' }} />
                <div className="relative z-10">
                    <h1 className="text-3xl font-black tracking-tight">{p.full_name || 'Your Name'}</h1>
                    <p className="text-sm font-bold mt-1 opacity-90">{p.headline || data.target_role || 'Professional Title'}</p>
                </div>
            </div>

            {/* Contact Bar */}
            <ContactLinks items={buildContactItems(p)} showIcons compactNames gap="gap-x-6 gap-y-1" className="px-10 py-3 text-[10px] font-bold text-gray-500 border-b border-gray-100 bg-gray-50" />

            <div className="flex">
                {/* Left Column */}
                <div className="w-[35%] p-8 space-y-6 bg-gray-50/50">
                    {resolveZoneSections(data, 'creative', 'sidebar').map(id => {
                        if (id === 'skills' && (data.skills.technical_skills.length > 0 || data.skills.tools.length > 0 || data.skills.soft_skills.length > 0)) return (
                            <div key={id} className="space-y-6">
                                {data.skills.technical_skills.length > 0 && (
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>
                                            <span className="inline-block w-5 h-0.5 mr-2 align-middle" style={{ backgroundColor: accentColor }} />
                                            Skills
                                        </h3>
                                        <div className="space-y-2">
                                            {data.skills.technical_skills.map((s, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                                                    <span className="text-[11px] font-medium text-gray-700">{s}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {data.skills.tools.length > 0 && (
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>
                                            <span className="inline-block w-5 h-0.5 mr-2 align-middle" style={{ backgroundColor: accentColor }} />
                                            Tools
                                        </h3>
                                        <div className="flex flex-wrap gap-1.5">
                                            {data.skills.tools.map((s, i) => (
                                                <span key={i} className="px-2 py-1 text-[10px] font-bold rounded-lg text-white" style={{ backgroundColor: `${accentColor}cc` }}>{s}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {data.skills.soft_skills.length > 0 && (
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>
                                            <span className="inline-block w-5 h-0.5 mr-2 align-middle" style={{ backgroundColor: accentColor }} />
                                            Soft Skills
                                        </h3>
                                        <div className="space-y-1.5">
                                            {data.skills.soft_skills.map((s, i) => (
                                                <p key={i} className="text-[11px] font-medium text-gray-600">{s}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                        if (id === 'education' && data.education.some(e => e.degree)) return (
                            <div key={id}>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>
                                    <span className="inline-block w-5 h-0.5 mr-2 align-middle" style={{ backgroundColor: accentColor }} />
                                    Education
                                </h3>
                                <div className="space-y-3">
                                    {data.education.filter(e => e.degree).map((ed, i) => (
                                        <div key={i} className="p-3 bg-white rounded-xl border border-gray-100">
                                            <p className="text-xs font-bold text-gray-800">{ed.degree}</p>
                                            <p className="text-[10px] text-gray-500">{ed.institution}</p>
                                            <p className="text-[10px] text-gray-400">{ed.duration}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                        return null;
                    })}
                </div>

                {/* Right Column */}
                <div className="w-[65%] p-8 space-y-6">
                    {resolveZoneSections(data, 'creative', 'main').map(id => {
                        if (id === 'summary' && p.professional_summary) return (
                            <div key={id} className="p-5 rounded-2xl border-l-4" style={{ borderLeftColor: accentColor, backgroundColor: `${accentColor}08` }}>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: accentColor }}>About Me</h3>
                                <p className="text-xs text-gray-600 leading-[1.8]">{p.professional_summary}</p>
                            </div>
                        );
                        if (id === 'experience' && data.experience.some(e => e.title)) return (
                            <div key={id}>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4" style={{ color: accentColor }}>
                                    <span className="inline-block w-5 h-0.5 mr-2 align-middle" style={{ backgroundColor: accentColor }} />
                                    Experience
                                </h3>
                                <div className="space-y-5">
                                    {data.experience.filter(e => e.title).map((exp, i) => (
                                        <div key={i} className="relative pl-5">
                                            <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                                            {i < data.experience.filter(e => e.title).length - 1 && (
                                                <div className="absolute left-[3px] top-4 w-0.5 h-full" style={{ backgroundColor: `${accentColor}20` }} />
                                            )}
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">{exp.title}</p>
                                                    <p className="text-xs font-medium" style={{ color: accentColor }}>{exp.organization}</p>
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap ml-4 px-2 py-0.5 bg-gray-50 rounded-full">{exp.duration}</span>
                                            </div>
                                            {exp.bullets && exp.bullets.length > 0 ? (
                                                <ul className="mt-2 space-y-1">
                                                    {exp.bullets.map((b, bi) => (
                                                        <li key={bi} className="text-xs text-gray-600 leading-relaxed flex gap-2">
                                                            <span style={{ color: accentColor }} className="mt-0.5 flex-shrink-0">▸</span>
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
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4" style={{ color: accentColor }}>
                                    <span className="inline-block w-5 h-0.5 mr-2 align-middle" style={{ backgroundColor: accentColor }} />
                                    Projects
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {data.projects.filter(p => p.name).map((proj, i) => (
                                        <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                            <p className="text-xs font-bold text-gray-900">{proj.name}</p>
                                            {proj.technologies && <p className="text-[10px] font-bold mt-1" style={{ color: accentColor }}>{proj.technologies}</p>}
                                            {proj.description && <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{proj.description}</p>}
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
                                    headingClass="text-[10px] font-black uppercase tracking-[0.2em] mb-2"
                                    headingStyle={{ color: accentColor }}
                                    bodyClass="text-xs text-gray-600 leading-[1.8]"
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
