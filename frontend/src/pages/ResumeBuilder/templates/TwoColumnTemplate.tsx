import type { ResumeData } from '../types';
import { makeStableRandom } from '@/lib/utils';

interface TemplateProps {
    data: ResumeData;
    accentColor?: string;
}

export function TwoColumnTemplate({ data, accentColor = '#0ea5e9' }: TemplateProps) {
    const p = data.personal;
    return (
        <div className="bg-white w-full min-h-[1122px] flex" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            {/* Left Column — 38% */}
            <div className="w-[38%] text-white p-7 space-y-6" style={{ backgroundColor: accentColor }}>
                {/* Name & Contact */}
                <div>
                    <h1 className="text-xl font-black leading-tight">{p.full_name || 'Your Name'}</h1>
                    <p className="text-[10px] font-bold mt-1 opacity-80 uppercase tracking-wider">{data.target_role || 'Professional'}</p>
                    <div className="mt-4 space-y-1.5">
                        {p.email && (
                            <div className="flex items-center gap-2 text-[10px] opacity-90">
                                <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-[8px]">✉</div>
                                <span className="break-all">{p.email}</span>
                            </div>
                        )}
                        {p.phone && (
                            <div className="flex items-center gap-2 text-[10px] opacity-90">
                                <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-[8px]">📱</div>
                                <span>{p.phone}</span>
                            </div>
                        )}
                        {p.location && (
                            <div className="flex items-center gap-2 text-[10px] opacity-90">
                                <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-[8px]">📍</div>
                                <span>{p.location}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Skills */}
                {data.skills.technical_skills.length > 0 && (
                    <div>
                        <h3 className="text-[9px] font-black uppercase tracking-[0.2em] mb-2 opacity-70">Technical Skills</h3>
                        <div className="space-y-1.5">
                            {data.skills.technical_skills.map((s, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <span className="text-[10px] font-bold">{s}</span>
                                    </div>
                                    <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-white/80 rounded-full" style={{ width: `${80 + makeStableRandom(0xBEEF + i)() * 20}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {data.skills.tools.length > 0 && (
                    <div>
                        <h3 className="text-[9px] font-black uppercase tracking-[0.2em] mb-2 opacity-70">Tools</h3>
                        <div className="flex flex-wrap gap-1">
                            {data.skills.tools.map((s, i) => (
                                <span key={i} className="px-2 py-0.5 text-[9px] font-bold rounded bg-white/20">{s}</span>
                            ))}
                        </div>
                    </div>
                )}

                {data.skills.soft_skills.length > 0 && (
                    <div>
                        <h3 className="text-[9px] font-black uppercase tracking-[0.2em] mb-2 opacity-70">Soft Skills</h3>
                        <div className="space-y-1">
                            {data.skills.soft_skills.map((s, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-white/70" />
                                    <span className="text-[10px] opacity-90">{s}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Education */}
                {data.education.some(e => e.degree) && (
                    <div>
                        <h3 className="text-[9px] font-black uppercase tracking-[0.2em] mb-2 opacity-70">Education</h3>
                        <div className="space-y-3">
                            {data.education.filter(e => e.degree).map((ed, i) => (
                                <div key={i}>
                                    <p className="text-[11px] font-bold">{ed.degree}</p>
                                    <p className="text-[10px] opacity-80">{ed.institution}</p>
                                    <p className="text-[9px] opacity-60">{ed.duration}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column — 62% */}
            <div className="w-[62%] p-8 space-y-6">
                {/* Summary */}
                {p.professional_summary && (
                    <div>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 pb-1" style={{ color: accentColor, borderBottom: `2px solid ${accentColor}` }}>Profile</h2>
                        <p className="text-[11px] text-gray-600 leading-[1.8]">{p.professional_summary}</p>
                    </div>
                )}

                {/* Experience */}
                {data.experience.some(e => e.title) && (
                    <div>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 pb-1" style={{ color: accentColor, borderBottom: `2px solid ${accentColor}` }}>Work Experience</h2>
                        <div className="space-y-4">
                            {data.experience.filter(e => e.title).map((exp, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs font-bold text-gray-900">{exp.title}</p>
                                            <p className="text-[10px]" style={{ color: accentColor }}>{exp.organization}</p>
                                        </div>
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-gray-500 bg-gray-100 whitespace-nowrap">{exp.duration}</span>
                                    </div>
                                    {exp.bullets && exp.bullets.length > 0 ? (
                                        <ul className="mt-1.5 space-y-0.5 pl-3">
                                            {exp.bullets.map((b, bi) => (
                                                <li key={bi} className="text-[11px] text-gray-600 leading-[1.6] flex gap-1.5">
                                                    <span style={{ color: accentColor }} className="flex-shrink-0">›</span>
                                                    <span>{b}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : exp.description ? (
                                        <p className="text-[11px] text-gray-600 mt-1">{exp.description}</p>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Projects */}
                {data.projects.some(p => p.name) && (
                    <div>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 pb-1" style={{ color: accentColor, borderBottom: `2px solid ${accentColor}` }}>Projects</h2>
                        <div className="space-y-3">
                            {data.projects.filter(p => p.name).map((proj, i) => (
                                <div key={i}>
                                    <p className="text-xs font-bold text-gray-900">{proj.name}</p>
                                    {proj.technologies && <p className="text-[10px] font-bold" style={{ color: accentColor }}>{proj.technologies}</p>}
                                    {proj.description && <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">{proj.description}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
