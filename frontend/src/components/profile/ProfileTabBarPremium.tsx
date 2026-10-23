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

export function ProfileTabBarPremium({ active, onChange, resumeCount }: Props) {
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
            <div 
                role="tablist" 
                aria-label="Profile sections" 
                className="flex min-w-max gap-2 rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/50 backdrop-blur-sm p-2"
            >
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
                            className={`
                                relative inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950
                                ${selected
                                    ? 'bg-gradient-to-r from-violet-500 to-indigo-500 dark:from-violet-600 dark:to-indigo-600 text-white shadow-lg shadow-violet-500/25 dark:shadow-violet-500/30'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200'
                                }
                            `}
                        >
                            {selected && (
                                <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 dark:from-violet-600 dark:to-indigo-600 opacity-30 blur" />
                            )}
                            <span className="relative">
                                <meta.icon className="h-4 w-4" />
                            </span>
                            <span className="relative">{meta.label}</span>
                            {tab === 'resumes' && typeof resumeCount === 'number' && (
                                <span className={`relative rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    selected 
                                        ? 'bg-white/20 text-white' 
                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
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
