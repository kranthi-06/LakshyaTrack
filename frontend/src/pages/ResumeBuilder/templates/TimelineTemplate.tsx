import type { ResumeData } from '../types';
import { ContactLinks } from './ContactLinks';
import { buildContactItems } from './contactLinkUtils';
import { customSectionId, resolveLayoutSections } from '../sectionModel';

interface TemplateProps { data: ResumeData; accentColor?: string; }

export function TimelineTemplate({ data, accentColor = '#6366f1' }: TemplateProps) {
    const p = data.personal;
    const flow = resolveLayoutSections(data, 'timeline');
    const rankOf = (id: string) => {
        const i = flow.indexOf(id as typeof flow[number]);
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };

    interface TimelineItem { key: string; rank: number; type: 'exp' | 'edu' | 'proj' | 'summary' | 'custom'; title: string; sub: string; duration: string; desc: string; }

    const items: TimelineItem[] = [
        ...data.experience.filter(e => e.title).map((e, i): TimelineItem => ({ key: `exp-${i}`, rank: rankOf('experience'), type: 'exp', title: e.title, sub: e.organization, duration: e.duration, desc: e.bullets?.join(' • ') || e.description || '' })),
        ...data.education.filter(e => e.degree).map((e, i): TimelineItem => ({ key: `edu-${i}`, rank: rankOf('education'), type: 'edu', title: e.degree, sub: e.institution, duration: e.duration, desc: e.description || '' })),
        ...data.projects.filter(pr => pr.name).map((pr, i): TimelineItem => ({ key: `proj-${i}`, rank: rankOf('projects'), type: 'proj', title: pr.name, sub: pr.technologies || '', duration: '', desc: pr.description || '' })),
    ];
    if (flow.includes('summary') && p.professional_summary) {
        items.push({ key: 'summary', rank: rankOf('summary'), type: 'summary', title: 'Summary', sub: '', duration: '', desc: p.professional_summary });
    }
    for (const cs of data.custom_sections ?? []) {
        const cid = customSectionId(cs.id);
        if (!flow.includes(cid) || !cs.title.trim()) continue;
        items.push({ key: `custom-${cs.id}`, rank: rankOf(cid), type: 'custom', title: cs.title, sub: '', duration: '', desc: cs.content });
    }
    items.sort((a, b) => a.rank - b.rank);

    const summaryFirst = items[0]?.key === 'summary';
    const timelineItems = summaryFirst ? items.slice(1) : items;

    const skillsIdx = flow.indexOf('skills');
    const firstEntryRank = Math.min(...items.filter(i => i.type !== 'summary' && i.type !== 'custom').map(i => i.rank), Number.MAX_SAFE_INTEGER);
    const skillsFirst = skillsIdx !== -1 && skillsIdx < firstEntryRank;

    const badge = (type: TimelineItem['type']) =>
        type === 'exp' ? 'bg-blue-50 text-blue-600'
        : type === 'edu' ? 'bg-emerald-50 text-emerald-600'
        : type === 'proj' ? 'bg-purple-50 text-purple-600'
        : 'bg-gray-100 text-gray-600';
    const badgeLabel = (type: TimelineItem['type']) =>
        type === 'exp' ? 'Experience' : type === 'edu' ? 'Education' : type === 'proj' ? 'Project' : type === 'summary' ? 'Summary' : 'Custom';

    return (
        <div className="bg-white w-full min-h-[1122px] px-10 py-9" style={{ fontFamily: "'Inter', sans-serif", color: '#1f2937' }}>
            <div className="mb-6">
                <h1 className="text-2xl font-black" style={{ color: accentColor }}>{p.full_name || 'Your Name'}</h1>
                {(p.headline || data.target_role) && <p className="text-xs text-gray-500 mt-0.5">{p.headline || data.target_role}</p>}
                <ContactLinks items={buildContactItems(p)} gap="gap-x-3 gap-y-1" className="mt-2 text-[10px] text-gray-400" />
                {summaryFirst && p.professional_summary && <p className="text-[11px] text-gray-600 leading-[1.7] mt-3 border-l-3 pl-4" style={{ borderLeftColor: accentColor }}>{p.professional_summary}</p>}
            </div>
            {/* Skills bar */}
            {skillsFirst && skillsIdx !== -1 && (
                <div className="flex flex-wrap gap-1.5 mb-6">
                    {[...data.skills.technical_skills, ...data.skills.tools].map((s, i) => (
                        <span key={i} className="px-2.5 py-1 text-[9px] font-bold rounded-full text-white" style={{ backgroundColor: accentColor }}>{s}</span>
                    ))}
                </div>
            )}
            {/* Timeline — entries sorted by the saved section order */}
            <div className="relative pl-8">
                <div className="absolute left-3 top-0 bottom-0 w-0.5" style={{ backgroundColor: `${accentColor}30` }} />
                {timelineItems.map((entry, i) => (
                    <div key={entry.key} className="relative mb-6">
                        <div className="absolute -left-5 top-1 w-4 h-4 rounded-full border-2 bg-white" style={{ borderColor: accentColor, backgroundColor: i === 0 ? accentColor : 'white' }} />
                        <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${badge(entry.type)}`}>
                            {badgeLabel(entry.type)}
                        </span>
                        <h3 className="text-xs font-bold text-gray-900 mt-1">{entry.title}</h3>
                        <div className="flex justify-between items-baseline">
                            <p className="text-[10px]" style={{ color: accentColor }}>{entry.sub}</p>
                            {entry.duration && <span className="text-[9px] text-gray-400">{entry.duration}</span>}
                        </div>
                        {entry.desc && <p className="text-[10px] text-gray-600 leading-[1.6] mt-1" style={entry.type === 'summary' ? { whiteSpace: 'pre-wrap' } : undefined}>{entry.desc}</p>}
                    </div>
                ))}
            </div>
            {!skillsFirst && skillsIdx !== -1 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {[...data.skills.technical_skills, ...data.skills.tools].map((s, i) => (
                        <span key={i} className="px-2.5 py-1 text-[9px] font-bold rounded-full text-white" style={{ backgroundColor: accentColor }}>{s}</span>
                    ))}
                </div>
            )}
        </div>
    );
}
