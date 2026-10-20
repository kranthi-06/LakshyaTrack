import type { ResumeData } from '../types';
import { ContactLinks } from './ContactLinks';
import { buildContactItems } from './contactLinkUtils';
import { CustomSectionBlock } from './CustomSectionBlock';
import { parseCustomSectionId, resolveLayoutSections } from '../sectionModel';

interface TemplateProps {
    data: ResumeData;
    accentColor?: string;
}

export function MinimalATSTemplate({ data, accentColor = '#111827' }: TemplateProps) {
    const p = data.personal;
    return (
        <div className="bg-white w-full min-h-[1122px] px-12 py-10" style={{ fontFamily: "'Calibri', 'Arial', sans-serif", color: '#1f2937' }}>
            {/* Header — ultra clean, no graphics */}
            <div className="text-center pb-4 mb-5" style={{ borderBottom: `2px solid ${accentColor}` }}>
                <h1 className="text-2xl font-bold uppercase tracking-wider" style={{ color: accentColor }}>{p.full_name || 'YOUR NAME'}</h1>
                <ContactLinks items={buildContactItems(p)} separator="•" showIcons compactNames gap="gap-x-2" className="justify-center mt-2 text-[11px] text-gray-600" separatorClassName="text-gray-300" />
            </div>

            {/* Body — rendered in the user's saved section order */}
            {resolveLayoutSections(data, 'minimal-ats').map(id => {
                if (id === 'summary' && p.professional_summary) return (
                    <div key={id} className="mb-5">
                        <h2 className="text-[11px] font-bold uppercase tracking-wider pb-1 mb-2" style={{ color: accentColor, borderBottom: '1px solid #e5e7eb' }}>Summary</h2>
                        <p className="text-[11px] text-gray-700 leading-[1.7]">{p.professional_summary}</p>
                    </div>
                );
                if (id === 'experience' && data.experience.some(e => e.title)) return (
                    <div key={id} className="mb-5">
                        <h2 className="text-[11px] font-bold uppercase tracking-wider pb-1 mb-2" style={{ color: accentColor, borderBottom: '1px solid #e5e7eb' }}>Professional Experience</h2>
                        <div className="space-y-4">
                            {data.experience.filter(e => e.title).map((exp, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-bold text-gray-900">{exp.title}</span>
                                        <span className="text-[10px] text-gray-500">{exp.duration}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-600">{exp.organization}</p>
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
                if (id === 'skills' && (data.skills.technical_skills.length > 0 || data.skills.tools.length > 0)) return (
                    <div key={id} className="mb-5">
                        <h2 className="text-[11px] font-bold uppercase tracking-wider pb-1 mb-2" style={{ color: accentColor, borderBottom: '1px solid #e5e7eb' }}>Technical Skills</h2>
                        <div className="space-y-1">
                            {data.skills.technical_skills.length > 0 && (
                                <p className="text-[11px] text-gray-700"><span className="font-bold">Languages & Technologies:</span> {data.skills.technical_skills.join(', ')}</p>
                            )}
                            {data.skills.tools.length > 0 && (
                                <p className="text-[11px] text-gray-700"><span className="font-bold">Tools & Frameworks:</span> {data.skills.tools.join(', ')}</p>
                            )}
                            {data.skills.soft_skills.length > 0 && (
                                <p className="text-[11px] text-gray-700"><span className="font-bold">Soft Skills:</span> {data.skills.soft_skills.join(', ')}</p>
                            )}
                        </div>
                    </div>
                );
                if (id === 'education' && data.education.some(e => e.degree)) return (
                    <div key={id} className="mb-5">
                        <h2 className="text-[11px] font-bold uppercase tracking-wider pb-1 mb-2" style={{ color: accentColor, borderBottom: '1px solid #e5e7eb' }}>Education</h2>
                        <div className="space-y-2">
                            {data.education.filter(e => e.degree).map((ed, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-bold text-gray-900">{ed.degree}</span>
                                        <span className="text-[10px] text-gray-500">{ed.duration}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-600">{ed.institution}</p>
                                    {ed.description && <p className="text-[11px] text-gray-500 mt-0.5">{ed.description}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                );
                if (id === 'projects' && data.projects.some(p => p.name)) return (
                    <div key={id} className="mb-5">
                        <h2 className="text-[11px] font-bold uppercase tracking-wider pb-1 mb-2" style={{ color: accentColor, borderBottom: '1px solid #e5e7eb' }}>Projects</h2>
                        <div className="space-y-2">
                            {data.projects.filter(p => p.name).map((proj, i) => (
                                <div key={i}>
                                    <span className="text-xs font-bold text-gray-900">{proj.name}</span>
                                    {proj.technologies && <span className="text-[10px] text-gray-500 ml-2">({proj.technologies})</span>}
                                    {proj.description && <p className="text-[11px] text-gray-700 mt-0.5">{proj.description}</p>}
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
                        headingClass="text-[11px] font-bold uppercase tracking-wider pb-1 mb-2"
                        headingStyle={{ color: accentColor, borderBottom: '1px solid #e5e7eb' }}
                        bodyClass="text-[11px] text-gray-700 leading-[1.7]"
                    />
                );
                return null;
            })}
        </div>
    );
}
