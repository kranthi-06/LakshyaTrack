import { Link } from 'react-router-dom';
import { Award, FolderKanban, History, ScrollText, TrendingUp, Zap, Target } from 'lucide-react';
import type { Badge } from '../../progress-system/types';
import type { ProfileProject } from './profileUtils';
import type { SavedResumeRecord } from '../../services/resumeStorage';
import { formatResumeDate } from './profileUtils';

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

export function OverviewTabPremium({ bio, projects, recentBadges, skills, resumes, loading = false, badgesUnavailable = false, onOpenTab }: Props) {
    return (
        <div className="grid gap-6 lg:grid-cols-3">
            {/* Career Snapshot */}
            <article className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/50 backdrop-blur-sm p-6 lg:col-span-2">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-violet-300 to-indigo-300 dark:from-violet-600 dark:to-indigo-600 opacity-10 blur-3xl" />
                
                <div className="relative">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">Career Snapshot</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {bio || 'Your biography will appear here after you add it from Edit Profile.'}
                    </p>
                    
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <button 
                            type="button" 
                            onClick={() => onOpenTab('projects')} 
                            className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50 p-5 text-left transition-all hover:border-blue-400/50 dark:hover:border-blue-500/50 hover:bg-slate-100 dark:hover:bg-slate-900/70"
                        >
                            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-blue-300 to-cyan-300 dark:from-blue-500 dark:to-cyan-500 opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" />
                            <div className="relative">
                                <FolderKanban className="h-6 w-6 text-blue-500 dark:text-blue-400" />
                                <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{loading ? '—' : projects.length}</p>
                                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Projects from saved resumes</p>
                            </div>
                        </button>
                        
                        <button 
                            type="button" 
                            onClick={() => onOpenTab('resumes')} 
                            className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50 p-5 text-left transition-all hover:border-violet-400/50 dark:hover:border-violet-500/50 hover:bg-slate-100 dark:hover:bg-slate-900/70"
                        >
                            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-violet-300 to-purple-300 dark:from-violet-500 dark:to-purple-500 opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" />
                            <div className="relative">
                                <ScrollText className="h-6 w-6 text-violet-500 dark:text-violet-400" />
                                <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{loading ? '—' : resumes.length}</p>
                                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Saved resume versions</p>
                            </div>
                        </button>
                    </div>
                </div>
            </article>

            {/* Recent Badges */}
            <article className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/50 backdrop-blur-sm p-6">
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-amber-300 to-orange-300 dark:from-amber-500 dark:to-orange-500 opacity-10 blur-3xl" />
                
                <div className="relative flex items-center justify-between">
                    <h3 className="font-black text-slate-900 dark:text-white">Recent Badges</h3>
                    <button 
                        type="button" 
                        onClick={() => onOpenTab('achievements')} 
                        className="flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                    >
                        View all
                        <TrendingUp className="h-3 w-3" />
                    </button>
                </div>
                
                {badgesUnavailable ? (
                    <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">Achievements could not be loaded right now. Use Retry above.</p>
                ) : recentBadges.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No badges unlocked yet. Keep using LakshyaTrack to earn them.</p>
                ) : (
                    <ul className="mt-4 space-y-3">
                        {recentBadges.slice(0, 4).map((badge) => (
                            <li key={badge.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800/30 bg-slate-50 dark:bg-slate-900/30">
                                <span className="text-2xl" aria-hidden>{badge.icon}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{badge.name}</p>
                                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{badge.description}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </article>

            {/* Skill Highlights */}
            <article className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/50 backdrop-blur-sm p-6">
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-300 to-teal-300 dark:from-emerald-500 dark:to-teal-500 opacity-10 blur-3xl" />
                
                <div className="relative flex items-center justify-between">
                    <h3 className="font-black text-slate-900 dark:text-white">Skill Highlights</h3>
                    <button 
                        type="button" 
                        onClick={() => onOpenTab('skills')} 
                        className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                    >
                        Manage
                    </button>
                </div>
                
                <div className="relative mt-4 flex flex-wrap gap-2">
                    {skills.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No skills listed yet.</p>
                    ) : skills.slice(0, 10).map((skill) => (
                        <span 
                            key={skill} 
                            className="rounded-full border border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 px-4 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-300"
                        >
                            {skill}
                        </span>
                    ))}
                </div>
            </article>

            {/* Latest Resumes */}
            <article className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/50 backdrop-blur-sm p-6 lg:col-span-2">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-cyan-300 to-blue-300 dark:from-cyan-500 dark:to-blue-500 opacity-10 blur-3xl" />
                
                <div className="relative flex items-center justify-between">
                    <h3 className="font-black text-slate-900 dark:text-white">Latest Resumes</h3>
                    <button 
                        type="button" 
                        onClick={() => onOpenTab('resumes')} 
                        className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                    >
                        Open library
                    </button>
                </div>
                
                {loading ? (
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading your saved resumes…</p>
                ) : resumes.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Save a resume from Resume Studio to see it here.</p>
                ) : (
                    <ul className="relative mt-4 divide-y divide-slate-200 dark:divide-slate-800/50">
                        {resumes.slice(0, 3).map((item) => (
                            <li key={item.id} className="flex items-center justify-between py-4">
                                <div>
                                    <p className="font-semibold text-slate-800 dark:text-white">{item.resume_name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatResumeDate(item.updated_at || item.created_at)}</p>
                                </div>
                                <Award className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                            </li>
                        ))}
                    </ul>
                )}
                
                <div className="relative mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <History className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                    Deep analytics stay on
                    <Link to="/progress" className="font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors">
                        Progress Intelligence
                    </Link>
                </div>
            </article>
        </div>
    );
}
