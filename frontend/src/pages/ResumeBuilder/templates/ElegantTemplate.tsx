import type { ResumeData } from '../types';
import { ContactLinks } from './ContactLinks';
import { buildContactItems } from './contactLinkUtils';
import { CustomSectionBlock } from './CustomSectionBlock';
import { parseCustomSectionId, resolveLayoutSections } from '../sectionModel';

interface TemplateProps { data: ResumeData; accentColor?: string; }

export function ElegantTemplate({ data, accentColor = '#78716c' }: TemplateProps) {
    const p = data.personal;
    return (
        <div className="bg-white w-full min-h-[1122px] px-14 py-12" style={{ fontFamily: "'Georgia', serif", color: '#44403c' }}>
            <div className="text-center mb-8">
                <h1 className="text-2xl font-normal tracking-[0.3em] uppercase" style={{ color: accentColor }}>{p.full_name || 'Your Name'}</h1>
                <div className="w-16 h-px mx-auto mt-3 mb-2" style={{ backgroundColor: accentColor }} />
                <p className="text-[10px] tracking-[0.15em] text-gray-400 uppercase">{p.headline || data.target_role}</p>
                <ContactLinks items={buildContactItems(p)} gap="gap-x-4 gap-y-1" className="justify-center mt-3 text-[10px] text-gray-400" />
            </div>
            {resolveLayoutSections(data, 'elegant').map(id => {
                if (id === 'summary' && p.professional_summary) return (
                    <div key={id} className="mb-8 text-center max-w-lg mx-auto">
                        <p className="text-[11px] text-gray-500 leading-[2] italic">{p.professional_summary}</p>
                    </div>
                );
                if (id === 'experience' && data.experience.some(e => e.title)) return (
                    <div key={id} className="mb-8">
                        <h2 className="text-[10px] font-normal uppercase tracking-[0.3em] text-center mb-4" style={{ color: accentColor }}>Experience</h2>
                        <div className="space-y-5">
                            {data.experience.filter(e => e.title).map((exp, i) => (
                                <div key={i} className="text-center">
                                    <p className="text-xs font-bold text-gray-800">{exp.title}</p>
                                    <p className="text-[10px] italic text-gray-500">{exp.organization} · {exp.duration}</p>
                                    {exp.bullets?.length ? (
                                        <ul className="mt-2 space-y-0.5">{exp.bullets.map((b, bi) => <li key={bi} className="text-[10px] text-gray-500 leading-[1.7]">{b}</li>)}</ul>
                                    ) : exp.description && <p className="text-[10px] text-gray-500 mt-1">{exp.description}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                );
                if (id === 'education' && data.education.some(e => e.degree)) return (
                    <div key={id} className="mb-8">
                        <h2 className="text-[10px] font-normal uppercase tracking-[0.3em] text-center mb-4" style={{ color: accentColor }}>Education</h2>
                        {data.education.filter(e => e.degree).map((ed, i) => (
                            <div key={i} className="text-center mb-2">
                                <p className="text-xs font-bold text-gray-800">{ed.degree}</p>
                                <p className="text-[10px] italic text-gray-500">{ed.institution} · {ed.duration}</p>
                            </div>
                        ))}
                    </div>
                );
                if (id === 'projects' && data.projects.some(p => p.name)) return (
                    <div key={id} className="mb-8">
                        <h2 className="text-[10px] font-normal uppercase tracking-[0.3em] text-center mb-4" style={{ color: accentColor }}>Projects</h2>
                        {data.projects.filter(p => p.name).map((proj, i) => (
                            <div key={i} className="text-center mb-2">
                                <p className="text-xs font-bold text-gray-800">{proj.name}</p>
                                {proj.technologies && <p className="text-[9px] italic" style={{ color: accentColor }}>{proj.technologies}</p>}
                                {proj.description && <p className="text-[10px] text-gray-500 mt-0.5">{proj.description}</p>}
                            </div>
                        ))}
                    </div>
                );
                if (id === 'skills' && (data.skills.technical_skills.length > 0 || data.skills.tools.length > 0)) return (
                    <div key={id} className="text-center">
                        <h2 className="text-[10px] font-normal uppercase tracking-[0.3em] mb-3" style={{ color: accentColor }}>Skills</h2>
                        <p className="text-[10px] text-gray-500 tracking-wide">{[...data.skills.technical_skills, ...data.skills.tools, ...data.skills.soft_skills].join('  ·  ')}</p>
                    </div>
                );
                const customId = parseCustomSectionId(id);
                const entry = customId ? data.custom_sections?.find(cs => cs.id === customId) : undefined;
                if (entry) return (
                    <CustomSectionBlock
                        key={id}
                        entry={entry}
                        wrapperClass="mb-8 text-center"
                        headingClass="text-[10px] font-normal uppercase tracking-[0.3em] mb-3"
                        headingStyle={{ color: accentColor }}
                        bodyClass="text-[10px] text-gray-500 leading-[2] italic"
                    />
                );
                return null;
            })}
        </div>
    );
}
