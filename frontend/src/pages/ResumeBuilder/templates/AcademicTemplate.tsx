import type { ResumeData } from '../types';
import { ContactLinks } from './ContactLinks';
import { buildContactItems } from './contactLinkUtils';
import { CustomSectionBlock } from './CustomSectionBlock';
import { parseCustomSectionId, resolveLayoutSections } from '../sectionModel';

interface TemplateProps {
    data: ResumeData;
    accentColor?: string;
}

export function AcademicTemplate({ data, accentColor = '#1e40af' }: TemplateProps) {
    const p = data.personal;
    return (
        <div className="bg-white w-full min-h-[1122px] px-10 py-9" style={{ fontFamily: "'Times New Roman', Georgia, serif", color: '#1f2937' }}>
            {/* Header — academic style */}
            <div className="text-center mb-1">
                <h1 className="text-2xl font-bold" style={{ color: accentColor }}>{p.full_name || 'Your Name'}</h1>
                {(p.headline || data.target_role) && <p className="text-sm text-gray-500 italic mt-0.5">{p.headline || data.target_role}</p>}
            </div>
            <div className="pb-3 mb-5" style={{ borderBottom: `2px double ${accentColor}` }}>
                <ContactLinks items={buildContactItems(p)} separator="|" gap="gap-x-3" className="justify-center text-[10px] text-gray-500" />
            </div>

            {/* Body — rendered in the user's saved section order */}
            {resolveLayoutSections(data, 'academic').map(id => {
                if (id === 'summary' && p.professional_summary) return (
                    <div key={id} className="mb-5">
                        <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: accentColor, borderBottom: `1px solid ${accentColor}40` }}>Career Objective</h2>
                        <p className="text-[11px] text-gray-700 leading-[1.8] italic">{p.professional_summary}</p>
                    </div>
                );
                if (id === 'education' && data.education.some(e => e.degree)) return (
                    <div key={id} className="mb-5">
                        <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: accentColor, borderBottom: `1px solid ${accentColor}40` }}>Education</h2>
                        <div className="space-y-3">
                            {data.education.filter(e => e.degree).map((ed, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-baseline">
                                        <div>
                                            <span className="text-xs font-bold text-gray-900">{ed.degree}</span>
                                        </div>
                                        <span className="text-[10px] text-gray-500 italic">{ed.duration}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-600 italic">{ed.institution}</p>
                                    {ed.description && <p className="text-[11px] text-gray-600 mt-1">{ed.description}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                );
                if (id === 'projects' && data.projects.some(p => p.name)) return (
                    <div key={id} className="mb-5">
                        <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: accentColor, borderBottom: `1px solid ${accentColor}40` }}>Academic Projects</h2>
                        <div className="space-y-3">
                            {data.projects.filter(p => p.name).map((proj, i) => (
                                <div key={i}>
                                    <p className="text-xs font-bold text-gray-900">{proj.name}</p>
                                    {proj.technologies && <p className="text-[10px] italic" style={{ color: accentColor }}>{proj.technologies}</p>}
                                    {proj.description && <p className="text-[11px] text-gray-700 leading-[1.7] mt-1">{proj.description}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                );
                if (id === 'experience' && data.experience.some(e => e.title)) return (
                    <div key={id} className="mb-5">
                        <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: accentColor, borderBottom: `1px solid ${accentColor}40` }}>Experience / Internships</h2>
                        <div className="space-y-3">
                            {data.experience.filter(e => e.title).map((exp, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-bold text-gray-900">{exp.title}</span>
                                        <span className="text-[10px] text-gray-500 italic">{exp.duration}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-600 italic">{exp.organization}</p>
                                    {exp.bullets && exp.bullets.length > 0 ? (
                                        <ul className="mt-1.5 space-y-0.5 pl-4">
                                            {exp.bullets.map((b, bi) => (
                                                <li key={bi} className="text-[11px] text-gray-700 leading-[1.6] list-disc">{b}</li>
                                            ))}
                                        </ul>
                                    ) : exp.description ? (
                                        <p className="text-[11px] text-gray-700 mt-1">{exp.description}</p>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                );
                if (id === 'skills' && (data.skills.technical_skills.length > 0 || data.skills.tools.length > 0 || data.skills.soft_skills.length > 0)) return (
                    <div key={id} className="mb-5">
                        <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: accentColor, borderBottom: `1px solid ${accentColor}40` }}>Skills & Competencies</h2>
                        <div className="grid grid-cols-3 gap-2">
                            {[...data.skills.technical_skills, ...data.skills.tools, ...data.skills.soft_skills].map((s, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <div className="w-1 h-1 rounded-full" style={{ backgroundColor: accentColor }} />
                                    <span className="text-[11px] text-gray-700">{s}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
                const customId = parseCustomSectionId(id);
                const entry = customId ? data.custom_sections?.find(cs => cs.id === customId) : undefined;
                if (entry) return (
                    <CustomSectionBlock
                        key={id}
                        entry={entry}
                        wrapperClass="mb-5"
                        headingClass="text-xs font-bold uppercase tracking-wider mb-2"
                        headingStyle={{ color: accentColor, borderBottom: `1px solid ${accentColor}40` }}
                        bodyClass="text-[11px] text-gray-700 leading-[1.8]"
                    />
                );
                return null;
            })}
        </div>
    );
}
