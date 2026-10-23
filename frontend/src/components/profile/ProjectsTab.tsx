import { FolderKanban } from 'lucide-react';
import type { ProfileProject } from './profileUtils';

interface Props {
    projects: ProfileProject[];
    onOpenResume: (resumeId: string) => void;
}

export function ProjectsTab({ projects, onOpenResume }: Props) {
    if (projects.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-950">
                <FolderKanban className="mx-auto h-10 w-10 text-slate-300" />
                <h3 className="mt-4 text-lg font-black text-slate-800 dark:text-white">No projects on file</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                    Projects appear here when they exist in your saved resumes. Add them in Resume Studio, then save.
                </p>
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
                <article key={project.key} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                    {project.imageUrl && (
                        <img src={project.imageUrl} alt="" className="mb-4 h-36 w-full rounded-xl object-cover" />
                    )}
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{project.name}</h3>
                    {project.technologies && (
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#6C63FF]">{project.technologies}</p>
                    )}
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {project.description || 'No project description saved on this resume.'}
                    </p>
                    <button
                        type="button"
                        onClick={() => onOpenResume(project.sourceResumeId)}
                        className="mt-4 text-xs font-semibold text-[#6C63FF] hover:underline"
                    >
                        From {project.sourceResumeName}
                    </button>
                </article>
            ))}
        </div>
    );
}
