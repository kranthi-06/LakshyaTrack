import { Plus, X } from 'lucide-react';
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

export function SkillsTab({ skills, isEditing, newSkill, onNewSkillChange, onAddSkill, onRemoveSkill, topics }: Props) {
    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Skills</h3>
                    <p className="text-sm text-slate-500">Profile skills you saved, plus proficiency only when Progress Intelligence has tracked that topic.</p>
                </div>
                {isEditing && (
                    <div className="flex items-center gap-2">
                        <Input
                            value={newSkill}
                            onChange={(event) => onNewSkillChange(event.target.value)}
                            onKeyDown={(event) => event.key === 'Enter' && onAddSkill()}
                            placeholder="Add a skill"
                            className="h-9 w-44"
                        />
                        <Button size="sm" onClick={onAddSkill} className="bg-[#6C63FF] text-white hover:bg-[#5B54E0]">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            {skills.length === 0 && topics.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                    No skills saved yet. Edit your profile or save a resume that includes a skills section.
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {skills.map((skill) => {
                        const tracked = matchTopic(skill, topics);
                        return (
                            <article key={skill} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                                <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-bold text-slate-900 dark:text-white">{skill}</h4>
                                    {isEditing && (
                                        <button type="button" onClick={() => onRemoveSkill(skill)} className="text-slate-400 hover:text-rose-500" aria-label={`Remove ${skill}`}>
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                {tracked ? (
                                    <>
                                        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-[#6C63FF]">{tracked.proficiencyLevel}</p>
                                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                            <div className="h-full rounded-full bg-[#6C63FF]" style={{ width: `${Math.min(100, tracked.proficiencyScore)}%` }} />
                                        </div>
                                        <p className="mt-2 text-xs text-slate-400">{tracked.problemsSolved} tracked problems · {tracked.timeSpentMinutes} min</p>
                                    </>
                                ) : (
                                    <p className="mt-3 text-xs text-slate-400">Listed on your profile. Proficiency appears after this topic is tracked in Progress Intelligence.</p>
                                )}
                            </article>
                        );
                    })}
                    {topics
                        .filter((topic) => !skills.some((skill) => skill.trim().toLowerCase() === topic.name.trim().toLowerCase()))
                        .map((topic) => (
                            <article key={topic.id} className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                                <h4 className="font-bold text-slate-900 dark:text-white">{topic.name}</h4>
                                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Tracked topic</p>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                    <div className="h-full rounded-full bg-slate-500" style={{ width: `${Math.min(100, topic.proficiencyScore)}%` }} />
                                </div>
                                <p className="mt-2 text-xs text-slate-400">{topic.proficiencyLevel} · from practice data</p>
                            </article>
                        ))}
                </div>
            )}
        </div>
    );
}
