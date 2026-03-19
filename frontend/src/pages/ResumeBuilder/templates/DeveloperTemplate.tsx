import type { ResumeData } from '../types';

interface TemplateProps {
    data: ResumeData;
    accentColor?: string;
}

export function DeveloperTemplate({ data, accentColor = '#22c55e' }: TemplateProps) {
    const p = data.personal;
    return (
        <div className="w-full min-h-[1122px] font-mono text-gray-300" style={{ fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace", backgroundColor: '#0d1117' }}>
            {/* Terminal Header */}
            <div className="flex items-center gap-2 px-6 py-3 bg-[#161b22] border-b border-gray-800">
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-[10px] text-gray-500 ml-2">{p.full_name ? `${p.full_name.toLowerCase().replace(/\s/g, '_')}_resume.ts` : 'resume.ts'} — Terminal</span>
            </div>

            <div className="px-8 py-6 space-y-5 text-[11px] leading-[1.9]">
                {/* Header as Code */}
                <div>
                    <span className="text-purple-400">const</span> <span style={{ color: accentColor }}>developer</span> <span className="text-white">=</span> {'{'}
                    <div className="pl-6 space-y-0.5">
                        <div><span className="text-blue-400">name</span>: <span className="text-amber-300">"{p.full_name || 'Your Name'}"</span>,</div>
                        <div><span className="text-blue-400">role</span>: <span className="text-amber-300">"{data.target_role || 'Developer'}"</span>,</div>
                        {p.email && <div><span className="text-blue-400">email</span>: <span className="text-amber-300">"{p.email}"</span>,</div>}
                        {p.phone && <div><span className="text-blue-400">phone</span>: <span className="text-amber-300">"{p.phone}"</span>,</div>}
                        {p.location && <div><span className="text-blue-400">location</span>: <span className="text-amber-300">"{p.location}"</span>,</div>}
                    </div>
                    {'}'};
                </div>

                {/* Summary */}
                {p.professional_summary && (
                    <div>
                        <span className="text-gray-500">{'/**'}</span>
                        <div className="text-gray-400 pl-2" style={{ whiteSpace: 'pre-wrap' }}>
                            <span className="text-gray-500"> * </span>{p.professional_summary}
                        </div>
                        <span className="text-gray-500">{' */'}</span>
                    </div>
                )}

                {/* Experience */}
                {data.experience.some(e => e.title) && (
                    <div>
                        <span className="text-purple-400">const</span> <span style={{ color: accentColor }}>experience</span>: <span className="text-blue-400">Career[]</span> = [
                        <div className="pl-4 space-y-3">
                            {data.experience.filter(e => e.title).map((exp, i) => (
                                <div key={i} className="pl-2">
                                    {'{'}
                                    <div className="pl-4 space-y-0.5">
                                        <div><span className="text-blue-400">title</span>: <span className="text-amber-300">"{exp.title}"</span>,</div>
                                        <div><span className="text-blue-400">company</span>: <span className="text-amber-300">"{exp.organization}"</span>,</div>
                                        <div><span className="text-blue-400">period</span>: <span className="text-amber-300">"{exp.duration}"</span>,</div>
                                        {exp.bullets && exp.bullets.length > 0 && (
                                            <div>
                                                <span className="text-blue-400">achievements</span>: [
                                                <div className="pl-4">
                                                    {exp.bullets.map((b, bi) => (
                                                        <div key={bi}><span className="text-amber-300">"{b}"</span>{bi < exp.bullets.length - 1 ? ',' : ''}</div>
                                                    ))}
                                                </div>
                                                ],
                                            </div>
                                        )}
                                    </div>
                                    {'}'}{i < data.experience.filter(e => e.title).length - 1 ? ',' : ''}
                                </div>
                            ))}
                        </div>
                        ];
                    </div>
                )}

                {/* Skills */}
                {(data.skills.technical_skills.length > 0 || data.skills.tools.length > 0) && (
                    <div>
                        <span className="text-purple-400">const</span> <span style={{ color: accentColor }}>techStack</span> = {'{'}
                        <div className="pl-4 space-y-1">
                            {data.skills.technical_skills.length > 0 && (
                                <div>
                                    <span className="text-blue-400">languages</span>: [
                                    <span className="text-amber-300">
                                        {data.skills.technical_skills.map(s => `"${s}"`).join(', ')}
                                    </span>
                                    ],
                                </div>
                            )}
                            {data.skills.tools.length > 0 && (
                                <div>
                                    <span className="text-blue-400">tools</span>: [
                                    <span className="text-amber-300">
                                        {data.skills.tools.map(s => `"${s}"`).join(', ')}
                                    </span>
                                    ],
                                </div>
                            )}
                            {data.skills.soft_skills.length > 0 && (
                                <div>
                                    <span className="text-blue-400">softSkills</span>: [
                                    <span className="text-amber-300">
                                        {data.skills.soft_skills.map(s => `"${s}"`).join(', ')}
                                    </span>
                                    ],
                                </div>
                            )}
                        </div>
                        {'}'};
                    </div>
                )}

                {/* Education */}
                {data.education.some(e => e.degree) && (
                    <div>
                        <span className="text-purple-400">const</span> <span style={{ color: accentColor }}>education</span> = [
                        <div className="pl-4">
                            {data.education.filter(e => e.degree).map((ed, i) => (
                                <div key={i} className="pl-2">
                                    {'{'}
                                    <div className="pl-4 space-y-0.5">
                                        <div><span className="text-blue-400">degree</span>: <span className="text-amber-300">"{ed.degree}"</span>,</div>
                                        <div><span className="text-blue-400">institution</span>: <span className="text-amber-300">"{ed.institution}"</span>,</div>
                                        <div><span className="text-blue-400">year</span>: <span className="text-amber-300">"{ed.duration}"</span>,</div>
                                    </div>
                                    {'}'},
                                </div>
                            ))}
                        </div>
                        ];
                    </div>
                )}

                {/* Projects */}
                {data.projects.some(p => p.name) && (
                    <div>
                        <span className="text-purple-400">const</span> <span style={{ color: accentColor }}>projects</span> = [
                        <div className="pl-4">
                            {data.projects.filter(p => p.name).map((proj, i) => (
                                <div key={i} className="pl-2">
                                    {'{'}
                                    <div className="pl-4 space-y-0.5">
                                        <div><span className="text-blue-400">name</span>: <span className="text-amber-300">"{proj.name}"</span>,</div>
                                        {proj.technologies && <div><span className="text-blue-400">stack</span>: <span className="text-amber-300">"{proj.technologies}"</span>,</div>}
                                        {proj.description && <div><span className="text-blue-400">desc</span>: <span className="text-amber-300">"{proj.description}"</span>,</div>}
                                    </div>
                                    {'}'},
                                </div>
                            ))}
                        </div>
                        ];
                    </div>
                )}

                {/* Footer */}
                <div className="pt-4 border-t border-gray-800">
                    <span className="text-gray-500">{'// '}</span>
                    <span style={{ color: accentColor }}>export default</span>
                    <span className="text-gray-500">{' developer; // Generated by LakshyaTrack AI'}</span>
                </div>
            </div>
        </div>
    );
}
