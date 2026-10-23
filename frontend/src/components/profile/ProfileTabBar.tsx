import { useRef, type KeyboardEvent } from 'react';
import { Award, FolderKanban, History, LayoutDashboard, ScrollText, Sparkles } from 'lucide-react';
import { PROFILE_TABS, type ProfileTab } from './profileUtils';

const TAB_META: Record<ProfileTab, { label: string; icon: typeof LayoutDashboard }> = {
    overview: { label: 'Overview', icon: LayoutDashboard },
    projects: { label: 'Projects', icon: FolderKanban },
    achievements: { label: 'Achievements', icon: Award },
    skills: { label: 'Skills', icon: Sparkles },
    activity: { label: 'Activity', icon: History },
    resumes: { label: 'Resumes', icon: ScrollText },
};

interface Props {
    active: ProfileTab;
    onChange: (tab: ProfileTab) => void;
    resumeCount?: number;
}

export function ProfileTabBar({ active, onChange, resumeCount }: Props) {
    const refs = useRef<Array<HTMLButtonElement | null>>([]);

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        let nextIndex = index;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % PROFILE_TABS.length;
        else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + PROFILE_TABS.length) % PROFILE_TABS.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = PROFILE_TABS.length - 1;
        else return;

        event.preventDefault();
        onChange(PROFILE_TABS[nextIndex]);
        refs.current[nextIndex]?.focus();
    };

    return (
        <div className="overflow-x-auto no-scrollbar">
            <div role="tablist" aria-label="Profile sections" className="flex min-w-max gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-950">
                {PROFILE_TABS.map((tab, index) => {
                    const meta = TAB_META[tab];
                    const selected = active === tab;
                    return (
                        <button
                            key={tab}
                            type="button"
                            role="tab"
                            id={`profile-tab-${tab}`}
                            aria-selected={selected}
                            aria-controls={`profile-panel-${tab}`}
                            tabIndex={selected ? 0 : -1}
                            ref={(node) => { refs.current[index] = node; }}
                            onClick={() => onChange(tab)}
                            onKeyDown={(event) => handleKeyDown(event, index)}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
                                selected
                                    ? 'bg-[#6C63FF] text-white shadow-sm'
                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                            }`}
                        >
                            <meta.icon className="h-4 w-4" />
                            {meta.label}
                            {tab === 'resumes' && typeof resumeCount === 'number' && (
                                <span className={`rounded-full px-1.5 text-[10px] ${selected ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                    {resumeCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
