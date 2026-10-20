import type { ResumeData } from '../types';
import { ContactLinks } from './ContactLinks';
import { buildContactItems } from './contactLinkUtils';
import { CustomSectionBlock } from './CustomSectionBlock';
import { parseCustomSectionId, resolveLayoutSections } from '../sectionModel';

interface TemplateProps {
    data: ResumeData;
    accentColor?: string;
}

export function ExecutiveTemplate({ data, accentColor = '#0f172a' }: TemplateProps) {
    const p = data.personal;
    return (
        <div className="bg-white w-full min-h-[1122px]" style={{ fontFamily: "'Garamond', 'Georgia', serif", color: '#1e293b' }}>
            {/* Executive Header — dark, bold, authoritative */}
            <div className="px-10 py-8 text-white" style={{ backgroundColor: accentColor }}>
                <h1 className="text-3xl font-bold tracking-wide">{p.full_name || 'YOUR NAME'}</h1>
                <p className="text-sm font-light mt-1 tracking-wider opacity-80 uppercase">{p.headline || data.target_role || 'Executive Professional'}</p>
                <ContactLinks items={buildContactItems(p)} gap="gap-x-4 gap-y-1" className="mt-3 text-[10px] opacity-70 tracking-wide" />
            </div>

            {/* Gold accent bar */}
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accentColor}, #b8860b, ${accentColor})` }} />

            <div className="px-10 py-8 space-y-6">
                {(() => {
                    const flow = resolveLayoutSections(data, 'executive');
                    const eduIdx = flow.indexOf('education');
                    const projIdx = flow.indexOf('projects');
                    const gridPair = eduIdx !== -1 && projIdx !== -1 && Math.abs(eduIdx - projIdx) === 1;
                    return flow.map(id => {
                        if (id === 'summary' && p.professional_summary) return (
                            <div key={id}>
                                <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-3">Executive Summary</h2>
                                <p className="text-xs text-gray-700 leading-[1.9] border-l-2 pl-4" style={{ borderLeftColor: '#b8860b' }}>{p.professional_summary}</p>
                            </div>
                        );
                        if (id === 'experience' && data.experience.some(e => e.title)) return (
                            <div key={id}>
                                <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-4">Leadership Experience</h2>
                                <div className="space-y-6">
                                    {data.experience.filter(e => e.title).map((exp, i) => (
                                        <div key={i}>
                                            <div className="flex justify-between items-baseline pb-1 mb-2" style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <div>
                                                    <span className="text-sm font-bold text-gray-900">{exp.title}</span>
                                                    <span className="text-xs text-gray-500 ml-3">{exp.organization}</span>
                                                </div>
                                                <span className="text-[10px] font-bold tracking-wider text-gray-400">{exp.duration}</span>
                                            </div>
                                            {exp.bullets && exp.bullets.length > 0 ? (
                                                <ul className="space-y-1.5 pl-1">
                                                    {exp.bullets.map((b, bi) => (
                                                        <li key={bi} className="text-[11px] text-gray-700 leading-[1.7] flex gap-2">
                                                            <span className="text-yellow-700 mt-px flex-shrink-0">▪</span>
                                                            <span>{b}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : exp.description ? (
                                                <p className="text-[11px] text-gray-700 leading-[1.7]">{exp.description}</p>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                        if (id === 'skills' && (data.skills.technical_skills.length > 0 || data.skills.soft_skills.length > 0)) return (
                            <div key={id} className="p-5 rounded-xl" style={{ backgroundColor: `${accentColor}05`, border: `1px solid ${accentColor}12` }}>
                                <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-3">Core Competencies</h2>
                                <div className="flex flex-wrap gap-2">
                                    {[...data.skills.technical_skills, ...data.skills.tools, ...data.skills.soft_skills].map((s, i) => (
                                        <span key={i} className="px-3 py-1.5 text-[10px] font-bold rounded-lg text-white" style={{ backgroundColor: accentColor }}>{s}</span>
                                    ))}
                                </div>
                            </div>
                        );
                        if (gridPair && id === (eduIdx < projIdx ? 'education' : 'projects')) return (
                            <div key={`${id}-grid`} className="grid grid-cols-2 gap-8">
                                {data.education.some(e => e.degree) && (
                                    <div>
                                        <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-3">Education</h2>
                                        <div className="space-y-2">
                                            {data.education.filter(e => e.degree).map((ed, i) => (
                                                <div key={i}>
                                                    <p className="text-xs font-bold text-gray-900">{ed.degree}</p>
                                                    <p className="text-[10px] text-gray-500">{ed.institution}</p>
                                                    <p className="text-[10px] text-gray-400">{ed.duration}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {data.projects.some(p => p.name) && (
                                    <div>
                                        <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-3">Notable Projects</h2>
                                        <div className="space-y-2">
                                            {data.projects.filter(p => p.name).map((proj, i) => (
                                                <div key={i}>
                                                    <p className="text-xs font-bold text-gray-900">{proj.name}</p>
                                                    {proj.technologies && <p className="text-[10px] text-gray-500">{proj.technologies}</p>}
                                                    {proj.description && <p className="text-[10px] text-gray-600 mt-0.5">{proj.description}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                        if (gridPair && (id === 'education' || id === 'projects')) return null;
                        if (id === 'education' && data.education.some(e => e.degree)) return (
                            <div key={id}>
                                <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-3">Education</h2>
                                <div className="space-y-2">
                                    {data.education.filter(e => e.degree).map((ed, i) => (
                                        <div key={i}>
                                            <p className="text-xs font-bold text-gray-900">{ed.degree}</p>
                                            <p className="text-[10px] text-gray-500">{ed.institution}</p>
                                            <p className="text-[10px] text-gray-400">{ed.duration}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                        if (id === 'projects' && data.projects.some(p => p.name)) return (
                            <div key={id}>
                                <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-3">Notable Projects</h2>
                                <div className="space-y-2">
                                    {data.projects.filter(p => p.name).map((proj, i) => (
                                        <div key={i}>
                                            <p className="text-xs font-bold text-gray-900">{proj.name}</p>
                                            {proj.technologies && <p className="text-[10px] text-gray-500">{proj.technologies}</p>}
                                            {proj.description && <p className="text-[10px] text-gray-600 mt-0.5">{proj.description}</p>}
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
                                wrapperClass=""
                                headingClass="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-3"
                                bodyClass="text-xs text-gray-700 leading-[1.9]"
                            />
                        );
                        return null;
                    });
                })()}
            </div>
        </div>
    );
}
