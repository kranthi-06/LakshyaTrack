import { Link } from 'react-router-dom';
import { Award, FolderKanban, History, ScrollText } from 'lucide-react';
import type { Badge } from '../../progress-system/types';
import type { ProfileProject } from './profileUtils';
import type { SavedResumeRecord } from '../../services/resumeStorage';
import { formatResumeDate } from './profileUtils';
import BadgeArtwork from '../../badges/BadgeArtwork';

interface Props {
    bio: string;
    projects: ProfileProject[];
    recentBadges: Badge[];
    skills: string[];
    resumes: SavedResumeRecord[];
    loading?: boolean;
    badgesUnavailable?: boolean;
    onOpenTab: (tab: 'projects' | 'achievements' | 'skills' | 'activity' | 'resumes') => void;
}

export function OverviewTab({ bio, projects, recentBadges, skills, resumes, loading = false, badgesUnavailable = false, onOpenTab }: Props) {
    return (
        <div className="grid gap-5 lg:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 lg:col-span-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Career snapshot</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {bio || 'Your biography will appear here after you add it from Edit Profile.'}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => onOpenTab('projects')} className="rounded-xl border border-slate-100 p-4 text-left hover:border-[#6C63FF]/40 dark:border-slate-800">
                        <FolderKanban className="h-5 w-5 text-[#6C63FF]" />
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{loading ? '—' : projects.length}</p>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Projects from saved resumes</p>
                    </button>
                    <button type="button" onClick={() => onOpenTab('resumes')} className="rounded-xl border border-slate-100 p-4 text-left hover:border-[#6C63FF]/40 dark:border-slate-800">
                        <ScrollText className="h-5 w-5 text-[#6C63FF]" />
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{loading ? '—' : resumes.length}</p>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Saved resume versions</p>
                    </button>
                </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-900 dark:text-white">Recent badges</h3>
                    <button type="button" onClick={() => onOpenTab('achievements')} className="text-xs font-semibold text-[#6C63FF]">View all</button>
                </div>
                {badgesUnavailable ? (
                    <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">Achievements could not be loaded right now. Use Retry above.</p>
                ) : recentBadges.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-400">No badges unlocked yet. Keep using LakshyaTrack to earn them.</p>
                ) : (
                    <ul className="mt-4 space-y-3">
                        {recentBadges.slice(0, 4).map((badge) => (
                            <li key={badge.id} className="flex items-center gap-3">
                                <BadgeArtwork
                                    badgeId={badge.id}
                                    name={badge.name}
                                    rarity={badge.rarity}
                                    isUnlocked
                                    size={40}
                                    decorative
                                />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{badge.name}</p>
                                    <p className="truncate text-xs text-slate-400">{badge.description}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-900 dark:text-white">Skill highlights</h3>
                    <button type="button" onClick={() => onOpenTab('skills')} className="text-xs font-semibold text-[#6C63FF]">Manage</button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    {skills.length === 0 ? (
                        <p className="text-sm text-slate-400">No skills listed yet.</p>
                    ) : skills.slice(0, 10).map((skill) => (
                        <span key={skill} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
                            {skill}
                        </span>
                    ))}
                </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 lg:col-span-2">
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-900 dark:text-white">Latest resumes</h3>
                    <button type="button" onClick={() => onOpenTab('resumes')} className="text-xs font-semibold text-[#6C63FF]">Open library</button>
                </div>
                {loading ? (
                    <p className="mt-4 text-sm text-slate-400">Loading your saved resumes…</p>
                ) : resumes.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-400">Save a resume from Resume Studio to see it here.</p>
                ) : (
                    <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                        {resumes.slice(0, 3).map((item) => (
                            <li key={item.id} className="flex items-center justify-between py-3">
                                <div>
                                    <p className="font-semibold text-slate-800 dark:text-slate-100">{item.resume_name}</p>
                                    <p className="text-xs text-slate-400">{formatResumeDate(item.updated_at || item.created_at)}</p>
                                </div>
                                <Award className="h-4 w-4 text-slate-300" />
                            </li>
                        ))}
                    </ul>
                )}
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                    <History className="h-3.5 w-3.5" />
                    Deep analytics stay on
                    <Link to="/progress" className="font-semibold text-[#6C63FF]">Progress Intelligence</Link>
                </div>
            </article>
        </div>
    );
}
