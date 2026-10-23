import { Plus, X, Code, Database, Server, Layout, Zap, Cpu, Globe, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TopicBubble } from '../../progress-system/types';

interface Props {
    skills: string[];
    isEditing: boolean;
    newSkill: string;
    onNewSkillChange: (value: string) => void;
    onAddSkill: () => void;
    onRemoveSkill: (skill: string) => void;
    topics: TopicBubble[];
}

function matchTopic(skill: string, topics: TopicBubble[]): TopicBubble | undefined {
    const needle = skill.trim().toLowerCase();
    return topics.find((topic) => topic.name.trim().toLowerCase() === needle);
}

function getSkillIcon(skill: string): typeof Code {
    const lower = skill.toLowerCase();
    if (lower.includes('react') || lower.includes('vue') || lower.includes('angular') || lower.includes('frontend') || lower.includes('ui')) return Layout;
    if (lower.includes('python') || lower.includes('javascript') || lower.includes('typescript') || lower.includes('java') || lower.includes('code')) return Code;
    if (lower.includes('sql') || lower.includes('database') || lower.includes('mongo') || lower.includes('postgres')) return Database;
    if (lower.includes('node') || lower.includes('server') || lower.includes('api') || lower.includes('backend')) return Server;
    if (lower.includes('performance') || lower.includes('optimization') || lower.includes('fast')) return Zap;
    if (lower.includes('ai') || lower.includes('machine learning') || lower.includes('ml')) return Cpu;
    if (lower.includes('web') || lower.includes('http') || lower.includes('network')) return Globe;
    if (lower.includes('mobile') || lower.includes('ios') || lower.includes('android')) return Smartphone;
    return Code;
}

function getSkillColor(skill: string): string {
    const lower = skill.toLowerCase();
    if (lower.includes('react') || lower.includes('vue') || lower.includes('angular')) return 'from-cyan-500 to-blue-500';
    if (lower.includes('python')) return 'from-yellow-500 to-orange-500';
    if (lower.includes('javascript') || lower.includes('typescript')) return 'from-yellow-400 to-amber-500';
    if (lower.includes('java')) return 'from-red-500 to-orange-500';
    if (lower.includes('sql') || lower.includes('database')) return 'from-blue-500 to-indigo-500';
    if (lower.includes('node')) return 'from-green-500 to-emerald-500';
    if (lower.includes('ai') || lower.includes('machine learning')) return 'from-purple-500 to-pink-500';
    return 'from-violet-500 to-indigo-500';
}

export function SkillsTabPremium({ skills, isEditing, newSkill, onNewSkillChange, onAddSkill, onRemoveSkill, topics }: Props) {
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h3 className="text-2xl font-black text-white">Core Skills</h3>
                    <p className="mt-1 text-sm text-slate-400">
                        Profile skills you saved, plus proficiency only when Progress Intelligence has tracked that topic.
                    </p>
                </div>
                {isEditing && (
                    <div className="flex items-center gap-3">
                        <Input
                            value={newSkill}
                            onChange={(event) => onNewSkillChange(event.target.value)}
                            onKeyDown={(event) => event.key === 'Enter' && onAddSkill()}
                            placeholder="Add a skill"
                            className="h-10 w-52 bg-slate-900/50 border-slate-700 text-white"
                        />
                        <Button size="sm" onClick={onAddSkill} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            {skills.length === 0 && topics.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800/50 bg-slate-950/50 px-6 py-16 text-center text-sm text-slate-500">
                    No skills saved yet. Edit your profile or save a resume that includes a skills section.
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {skills.map((skill) => {
                        const tracked = matchTopic(skill, topics);
                        const Icon = getSkillIcon(skill);
                        const color = getSkillColor(skill);
                        
                        return (
                            <article 
                                key={skill} 
                                className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-5 transition-all hover:border-slate-700/50 hover:bg-slate-900/70"
                            >
                                {/* Background gradient */}
                                <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${color} opacity-10 blur-2xl`} />
                                
                                <div className="relative">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                                                <Icon className="h-6 w-6 text-white" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-white">{skill}</h4>
                                                {tracked ? (
                                                    <p className="mt-1 text-xs font-bold uppercase tracking-wider text-violet-400">{tracked.proficiencyLevel}</p>
                                                ) : (
                                                    <p className="mt-1 text-xs text-slate-500">Listed on profile</p>
                                                )}
                                            </div>
                                        </div>
                                        {isEditing && (
                                            <button 
                                                type="button" 
                                                onClick={() => onRemoveSkill(skill)} 
                                                className="text-slate-500 hover:text-rose-400 transition-colors" 
                                                aria-label={`Remove ${skill}`}
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    
                                    {tracked ? (
                                        <>
                                            <div className="mt-4">
                                                <div className="mb-2 flex justify-between text-xs text-slate-400">
                                                    <span>Proficiency</span>
                                                    <span>{tracked.proficiencyScore}%</span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                                                    <div 
                                                        className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
                                                        style={{ width: `${Math.min(100, tracked.proficiencyScore)}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                                                <span>{tracked.problemsSolved} problems solved</span>
                                                <span>•</span>
                                                <span>{tracked.timeSpentMinutes} min tracked</span>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="mt-4 text-xs text-slate-500">
                                            Proficiency data appears after this topic is tracked in Progress Intelligence.
                                        </p>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                    
                    {topics
                        .filter((topic) => !skills.some((skill) => skill.trim().toLowerCase() === topic.name.trim().toLowerCase()))
                        .map((topic) => {
                            const Icon = getSkillIcon(topic.name);
                            const color = getSkillColor(topic.name);
                            
                            return (
                                <article 
                                    key={topic.id} 
                                    className="relative overflow-hidden rounded-2xl border border-dashed border-slate-800/50 bg-slate-900/30 p-5"
                                >
                                    <div className="relative">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${color} opacity-50 flex items-center justify-center`}>
                                                <Icon className="h-6 w-6 text-white" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-slate-300">{topic.name}</h4>
                                                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">Tracked topic</p>
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <div className="mb-2 flex justify-between text-xs text-slate-500">
                                                <span>Proficiency</span>
                                                <span>{topic.proficiencyScore}%</span>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                                                <div 
                                                    className="h-full rounded-full bg-slate-600 transition-all duration-500"
                                                    style={{ width: `${Math.min(100, topic.proficiencyScore)}%` }}
                                                />
                                            </div>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-500">
                                            {topic.proficiencyLevel} · from practice data
                                        </p>
                                    </div>
                                </article>
                            );
                        })}
                </div>
            )}
        </div>
    );
}
