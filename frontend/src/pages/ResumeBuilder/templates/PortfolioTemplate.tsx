import type { ResumeData } from '../types';

interface TemplateProps {
    data: ResumeData;
    accentColor?: string;
}

export function PortfolioTemplate({ data, accentColor = '#8b5cf6' }: TemplateProps) {
    const p = data.personal;
    return (
        <div className="bg-white w-full min-h-[1122px]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            {/* Hero Banner */}
            <div className="relative px-10 py-10 overflow-hidden" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}88, ${accentColor}44)` }}>
                <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10 bg-white" style={{ transform: 'translate(40%, -60%)' }} />
                <div className="absolute bottom-0 left-20 w-48 h-48 rounded-full opacity-10 bg-white" style={{ transform: 'translate(-20%, 40%)' }} />
                <div className="absolute top-10 right-40 w-20 h-20 rounded-2xl opacity-10 bg-white rotate-12" />

                <div className="relative z-10 flex items-end gap-6">
                    {/* Avatar placeholder */}
                    <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-black border-2 border-white/30">
                        {(p.full_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="text-white pb-1">
                        <h1 className="text-3xl font-black tracking-tight">{p.full_name || 'Your Name'}</h1>
                        <p className="text-sm font-bold opacity-80">{data.target_role || 'Creative Professional'}</p>
                    </div>
                </div>
            </div>

            {/* Contact Strip */}
            <div className="flex flex-wrap gap-6 px-10 py-3 text-[10px] font-bold text-gray-400 bg-gray-50 border-b border-gray-100">
                {p.email && <span>✉ {p.email}</span>}
                {p.phone && <span>📱 {p.phone}</span>}
                {p.location && <span>📍 {p.location}</span>}
            </div>

            <div className="px-10 py-7 space-y-6">
                {/* About */}
                {p.professional_summary && (
                    <div className="p-5 rounded-2xl border border-gray-100" style={{ background: `linear-gradient(135deg, ${accentColor}06, ${accentColor}12)` }}>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: accentColor }}>About Me</h3>
                        <p className="text-xs text-gray-600 leading-[1.8]">{p.professional_summary}</p>
                    </div>
                )}

                {/* Projects as Cards — visual-heavy showcase */}
                {data.projects.some(p => p.name) && (
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4" style={{ color: accentColor }}>Featured Projects</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {data.projects.filter(p => p.name).map((proj, i) => (
                                <div key={i} className="p-4 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-12 h-12 rounded-bl-2xl opacity-20" style={{ backgroundColor: accentColor }} />
                                    <div className="w-8 h-8 rounded-xl mb-2 flex items-center justify-center text-white text-[10px] font-black" style={{ backgroundColor: accentColor }}>
                                        {String(i + 1).padStart(2, '0')}
                                    </div>
                                    <p className="text-xs font-bold text-gray-900">{proj.name}</p>
                                    {proj.technologies && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {(typeof proj.technologies === 'string' ? proj.technologies.split(',') : Array.isArray(proj.technologies) ? proj.technologies : []).slice(0, 3).map((t, ti) => (
                                                <span key={ti} className="px-1.5 py-0.5 text-[8px] font-bold rounded-md bg-gray-100 text-gray-500">{typeof t === 'string' ? t.trim() : String(t)}</span>
                                            ))}
                                        </div>
                                    )}
                                    {proj.description && <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">{proj.description}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Experience — compact */}
                {data.experience.some(e => e.title) && (
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>Experience</h3>
                        <div className="space-y-4">
                            {data.experience.filter(e => e.title).map((exp, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-3 h-3 rounded-full border-2 flex-shrink-0" style={{ borderColor: accentColor, backgroundColor: i === 0 ? accentColor : 'white' }} />
                                        {i < data.experience.filter(e => e.title).length - 1 && (
                                            <div className="w-0.5 flex-1 mt-1" style={{ backgroundColor: `${accentColor}30` }} />
                                        )}
                                    </div>
                                    <div className="pb-4 flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-xs font-bold text-gray-900">{exp.title}</p>
                                                <p className="text-[10px] font-bold" style={{ color: accentColor }}>{exp.organization}</p>
                                            </div>
                                            <span className="text-[9px] font-bold text-gray-400 px-2 py-0.5 bg-gray-50 rounded-full">{exp.duration}</span>
                                        </div>
                                        {exp.bullets && exp.bullets.length > 0 ? (
                                            <ul className="mt-1.5 space-y-0.5">
                                                {exp.bullets.map((b, bi) => (
                                                    <li key={bi} className="text-[10px] text-gray-600 leading-[1.6] flex gap-1.5">
                                                        <span style={{ color: accentColor }}>•</span><span>{b}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : exp.description ? (
                                            <p className="text-[10px] text-gray-600 mt-1">{exp.description}</p>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Bottom Row: Skills + Education */}
                <div className="grid grid-cols-2 gap-6">
                    {/* Skills as chips */}
                    {(data.skills.technical_skills.length > 0 || data.skills.tools.length > 0) && (
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: accentColor }}>Skills & Tools</h3>
                            <div className="flex flex-wrap gap-1.5">
                                {[...data.skills.technical_skills, ...data.skills.tools].map((s, i) => (
                                    <span key={i} className="px-2 py-1 text-[9px] font-bold rounded-lg border" style={{ borderColor: `${accentColor}40`, color: accentColor, backgroundColor: `${accentColor}08` }}>{s}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Education */}
                    {data.education.some(e => e.degree) && (
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: accentColor }}>Education</h3>
                            <div className="space-y-2">
                                {data.education.filter(e => e.degree).map((ed, i) => (
                                    <div key={i}>
                                        <p className="text-xs font-bold text-gray-900">{ed.degree}</p>
                                        <p className="text-[10px] text-gray-500">{ed.institution}</p>
                                        <p className="text-[9px] text-gray-400">{ed.duration}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
