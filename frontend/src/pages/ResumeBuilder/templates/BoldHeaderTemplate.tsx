import type { ResumeData } from '../types';
import { ContactLinks } from './ContactLinks';
import { buildContactItems } from './contactLinkUtils';
import { CustomSectionBlock } from './CustomSectionBlock';
import { parseCustomSectionId, resolveLayoutSections } from '../sectionModel';

interface TemplateProps { data: ResumeData; accentColor?: string; }

export function BoldHeaderTemplate({ data, accentColor = '#dc2626' }: TemplateProps) {
    const p = data.personal;
    return (
        <div className="bg-white w-full min-h-[1122px]" style={{ fontFamily: "'Inter', sans-serif", color: '#1f2937' }}>
            <div className="px-10 py-8">
                <h1 className="text-5xl font-black tracking-tight leading-none" style={{ color: accentColor }}>{p.full_name || 'YOUR NAME'}</h1>
                <p className="text-lg font-bold text-gray-400 mt-1">{p.headline || data.target_role}</p>
                <ContactLinks items={buildContactItems(p)} gap="gap-x-4 gap-y-1" className="mt-3 text-[10px] text-gray-400 font-medium" />
                <div className="h-1 w-20 mt-4 rounded-full" style={{ backgroundColor: accentColor }} />
            </div>
            <div className="px-10 pb-8 space-y-6">
                {(() => {
                    const flow = resolveLayoutSections(data, 'bold-header');
                    const eduIdx = flow.indexOf('education');
                    const projIdx = flow.indexOf('projects');
                    const gridPair = eduIdx !== -1 && projIdx !== -1 && Math.abs(eduIdx - projIdx) === 1;
                    return flow.map(id => {
                        if (id === 'summary' && p.professional_summary) return (
                            <p key={id} className="text-xs text-gray-600 leading-[1.8] max-w-2xl">{p.professional_summary}</p>
                        );
                        if (id === 'experience' && data.experience.some(e => e.title)) return (
                            <div key={id}>
                                <h2 className="text-sm font-black uppercase mb-3" style={{ color: accentColor }}>Experience</h2>
                                {data.experience.filter(e => e.title).map((exp, i) => (
                                    <div key={i} className="mb-4 pl-4" style={{ borderLeft: `3px solid ${accentColor}20` }}>
                                        <div className="flex justify-between"><span className="text-xs font-bold">{exp.title}</span><span className="text-[10px] text-gray-400 font-bold">{exp.duration}</span></div>
                                        <p className="text-[10px]" style={{ color: accentColor }}>{exp.organization}</p>
                                        {exp.bullets?.length ? <ul className="mt-1 space-y-0.5 pl-3">{exp.bullets.map((b, bi) => <li key={bi} className="text-[10px] text-gray-600 leading-[1.6] list-disc">{b}</li>)}</ul> : exp.description && <p className="text-[10px] text-gray-600 mt-1">{exp.description}</p>}
                                    </div>
                                ))}
                            </div>
                        );
                        if (gridPair && id === (eduIdx < projIdx ? 'education' : 'projects')) return (
                            <div key={`${id}-grid`} className="grid grid-cols-2 gap-6">
                                {data.education.some(e => e.degree) && (
                                    <div>
                                        <h2 className="text-sm font-black uppercase mb-2" style={{ color: accentColor }}>Education</h2>
                                        {data.education.filter(e => e.degree).map((ed, i) => (
                                            <div key={i} className="mb-2"><p className="text-xs font-bold">{ed.degree}</p><p className="text-[10px] text-gray-500">{ed.institution} · {ed.duration}</p></div>
                                        ))}
                                    </div>
                                )}
                                {data.projects.some(p => p.name) && (
                                    <div>
                                        <h2 className="text-sm font-black uppercase mb-2" style={{ color: accentColor }}>Projects</h2>
                                        {data.projects.filter(p => p.name).map((proj, i) => (
                                            <div key={i} className="mb-2"><p className="text-xs font-bold">{proj.name}</p>{proj.technologies && <p className="text-[9px]" style={{ color: accentColor }}>{proj.technologies}</p>}{proj.description && <p className="text-[10px] text-gray-500 mt-0.5">{proj.description}</p>}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                        if (gridPair && (id === 'education' || id === 'projects')) return null;
                        if (id === 'education' && data.education.some(e => e.degree)) return (
                            <div key={id}>
                                <h2 className="text-sm font-black uppercase mb-2" style={{ color: accentColor }}>Education</h2>
                                {data.education.filter(e => e.degree).map((ed, i) => (
                                    <div key={i} className="mb-2"><p className="text-xs font-bold">{ed.degree}</p><p className="text-[10px] text-gray-500">{ed.institution} · {ed.duration}</p></div>
                                ))}
                            </div>
                        );
                        if (id === 'projects' && data.projects.some(p => p.name)) return (
                            <div key={id}>
                                <h2 className="text-sm font-black uppercase mb-2" style={{ color: accentColor }}>Projects</h2>
                                {data.projects.filter(p => p.name).map((proj, i) => (
                                    <div key={i} className="mb-2"><p className="text-xs font-bold">{proj.name}</p>{proj.technologies && <p className="text-[9px]" style={{ color: accentColor }}>{proj.technologies}</p>}{proj.description && <p className="text-[10px] text-gray-500 mt-0.5">{proj.description}</p>}</div>
                                ))}
                            </div>
                        );
                        if (id === 'skills' && (data.skills.technical_skills.length > 0)) return (
                            <div key={id}>
                                <h2 className="text-sm font-black uppercase mb-2" style={{ color: accentColor }}>Skills</h2>
                                <div className="flex flex-wrap gap-1.5">
                                    {[...data.skills.technical_skills, ...data.skills.tools, ...data.skills.soft_skills].map((s, i) => (
                                        <span key={i} className="px-2.5 py-1 text-[9px] font-bold rounded-lg border-2" style={{ borderColor: accentColor, color: accentColor }}>{s}</span>
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
                                headingClass="text-sm font-black uppercase mb-2"
                                headingStyle={{ color: accentColor }}
                                bodyClass="text-[10px] text-gray-600 leading-[1.7]"
                            />
                        );
                        return null;
                    });
                })()}
            </div>
        </div>
    );
}
