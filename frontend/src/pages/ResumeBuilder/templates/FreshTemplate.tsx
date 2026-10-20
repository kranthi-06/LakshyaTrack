import type { ResumeData } from '../types';
import { ContactLinks } from './ContactLinks';
import { buildContactItems } from './contactLinkUtils';
import { CustomSectionBlock } from './CustomSectionBlock';
import { parseCustomSectionId, resolveLayoutSections } from '../sectionModel';

interface TemplateProps { data: ResumeData; accentColor?: string; }

export function FreshTemplate({ data, accentColor = '#06b6d4' }: TemplateProps) {
    const p = data.personal;
    return (
        <div className="bg-white w-full min-h-[1122px]" style={{ fontFamily: "'Inter', sans-serif", color: '#1f2937' }}>
            <div className="px-10 py-8" style={{ background: `linear-gradient(135deg, ${accentColor}12, ${accentColor}06, white)` }}>
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}>
                        {(p.full_name || 'U').charAt(0)}
                    </div>
                    <div>
                        <h1 className="text-xl font-black" style={{ color: accentColor }}>{p.full_name || 'Your Name'}</h1>
                        <p className="text-[10px] text-gray-400 font-bold">{p.headline || data.target_role} {p.location && `· ${p.location}`}</p>
                    </div>
                </div>
                <ContactLinks items={buildContactItems(p).filter(item => item.kind !== 'location')} showIcons compactNames gap="gap-x-4 gap-y-1" className="mt-3 text-[10px] text-gray-400" />
            </div>
            <div className="px-10 py-6 space-y-5">
                {(() => {
                    const flow = resolveLayoutSections(data, 'fresh');
                    const skillsIdx = flow.indexOf('skills');
                    const eduIdx = flow.indexOf('education');
                    const gridPair = skillsIdx !== -1 && eduIdx !== -1 && Math.abs(skillsIdx - eduIdx) === 1;
                    return flow.map(id => {
                        if (id === 'summary' && p.professional_summary) return (
                            <div key={id} className="p-4 rounded-2xl border" style={{ borderColor: `${accentColor}20`, background: `linear-gradient(135deg, ${accentColor}04, transparent)` }}>
                                <p className="text-[11px] text-gray-600 leading-[1.8]">{p.professional_summary}</p>
                            </div>
                        );
                        if (id === 'experience' && data.experience.some(e => e.title)) return (
                            <div key={id}>
                                <h2 className="text-[10px] font-black uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: accentColor }}>
                                    <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: accentColor }} /> Experience
                                </h2>
                                {data.experience.filter(e => e.title).map((exp, i) => (
                                    <div key={i} className="mb-4 pl-4" style={{ borderLeft: `2px solid ${accentColor}30` }}>
                                        <div className="flex justify-between gap-3"><span className="text-xs font-bold min-w-0">{exp.title}</span><span className="text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0" style={{ backgroundColor: `${accentColor}10`, color: accentColor }}>{exp.duration}</span></div>
                                        <p className="text-[10px] font-bold" style={{ color: accentColor }}>{exp.organization}</p>
                                        {exp.bullets?.length ? <ul className="mt-1 pl-3 space-y-0.5">{exp.bullets.map((b, bi) => <li key={bi} className="text-[10px] text-gray-600 leading-[1.6] list-disc">{b}</li>)}</ul> : exp.description && <p className="text-[10px] text-gray-600 mt-1">{exp.description}</p>}
                                    </div>
                                ))}
                            </div>
                        );
                        if (id === 'projects' && data.projects.some(p => p.name)) return (
                            <div key={id}>
                                <h2 className="text-[10px] font-black uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: accentColor }}>
                                    <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: accentColor }} /> Projects
                                </h2>
                                <div className="grid grid-cols-2 gap-2">
                                    {data.projects.filter(p => p.name).map((proj, i) => (
                                        <div key={i} className="p-3 rounded-xl" style={{ backgroundColor: `${accentColor}06` }}>
                                            <p className="text-[10px] font-bold">{proj.name}</p>
                                            {proj.technologies && <p className="text-[8px] mt-0.5" style={{ color: accentColor }}>{proj.technologies}</p>}
                                            {proj.description && <p className="text-[9px] text-gray-500 mt-1">{proj.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                        if (gridPair && id === (skillsIdx < eduIdx ? 'skills' : 'education')) return (
                            <div key={`${id}-grid`} className="grid grid-cols-2 gap-6">
                                {(data.skills.technical_skills.length > 0) && (
                                    <div>
                                        <h2 className="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: accentColor }}>
                                            <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: accentColor }} /> Skills
                                        </h2>
                                        <div className="flex flex-wrap gap-1.5">{[...data.skills.technical_skills, ...data.skills.tools].map((s, i) => <span key={i} className="px-2 py-0.5 text-[9px] font-bold rounded-lg" style={{ backgroundColor: `${accentColor}10`, color: accentColor }}>{s}</span>)}</div>
                                    </div>
                                )}
                                {data.education.some(e => e.degree) && (
                                    <div>
                                        <h2 className="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: accentColor }}>
                                            <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: accentColor }} /> Education
                                        </h2>
                                        {data.education.filter(e => e.degree).map((ed, i) => (
                                            <div key={i} className="mb-1.5"><p className="text-xs font-bold">{ed.degree}</p><p className="text-[10px] text-gray-500">{ed.institution} · {ed.duration}</p></div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                        if (gridPair && (id === 'skills' || id === 'education')) return null;
                        if (id === 'skills' && (data.skills.technical_skills.length > 0)) return (
                            <div key={id}>
                                <h2 className="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: accentColor }}>
                                    <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: accentColor }} /> Skills
                                </h2>
                                <div className="flex flex-wrap gap-1.5">{[...data.skills.technical_skills, ...data.skills.tools].map((s, i) => <span key={i} className="px-2 py-0.5 text-[9px] font-bold rounded-lg" style={{ backgroundColor: `${accentColor}10`, color: accentColor }}>{s}</span>)}</div>
                            </div>
                        );
                        if (id === 'education' && data.education.some(e => e.degree)) return (
                            <div key={id}>
                                <h2 className="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: accentColor }}>
                                    <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: accentColor }} /> Education
                                </h2>
                                {data.education.filter(e => e.degree).map((ed, i) => (
                                    <div key={i} className="mb-1.5"><p className="text-xs font-bold">{ed.degree}</p><p className="text-[10px] text-gray-500">{ed.institution} · {ed.duration}</p></div>
                                ))}
                            </div>
                        );
                        const customId = parseCustomSectionId(id);
                        const entry = customId ? data.custom_sections?.find(cs => cs.id === customId) : undefined;
                        if (entry) return (
                            <CustomSectionBlock
                                key={id}
                                entry={entry}
                                wrapperClass=""
                                headingClass="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-2"
                                headingStyle={{ color: accentColor }}
                                bodyClass="text-[11px] text-gray-600 leading-[1.8]"
                            />
                        );
                        return null;
                    });
                })()}
            </div>
        </div>
    );
}
