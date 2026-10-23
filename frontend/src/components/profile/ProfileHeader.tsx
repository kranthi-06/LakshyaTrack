import { useRef } from 'react';
import {
    Award,
    Briefcase,
    Calendar,
    Camera,
    Edit2,
    FileText,
    Flame,
    Github,
    Globe,
    Linkedin,
    Loader2,
    Mail,
    MapPin,
    Phone,
    Save,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { normalizeProfileUrl } from '../../pages/ResumeBuilder/templates/contactLinkUtils';

export interface ProfileFormState {
    role: string;
    location: string;
    joined: string;
    phone: string;
    bio: string;
    skills: string[];
    socials: {
        linkedin: string;
        github: string;
        portfolio: string;
    };
    image: string | null;
}

interface Stats {
    resumes: number | null;
    badges: number | null;
    streak: number | null;
    skills: number | null;
}

interface Props {
    displayName: string;
    displayEmail: string;
    displayInitial: string;
    profile: ProfileFormState;
    editName: string;
    isEditing: boolean;
    isSaving: boolean;
    stats: Stats;
    onStartEdit: () => void;
    onCancel: () => void;
    onSave: () => void;
    onEditName: (value: string) => void;
    onProfileChange: (next: ProfileFormState) => void;
    onImageUpload: (file: File) => void;
}

function SocialLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Globe }) {
    const safeHref = normalizeProfileUrl(href);
    if (!safeHref) return null;
    return (
        <a
            href={safeHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-[#6C63FF]/40 hover:text-[#6C63FF] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
            <Icon className="h-3.5 w-3.5" />
            {label}
        </a>
    );
}

export function ProfileHeader({
    displayName,
    displayEmail,
    displayInitial,
    profile,
    editName,
    isEditing,
    isSaving,
    stats,
    onStartEdit,
    onCancel,
    onSave,
    onEditName,
    onProfileChange,
    onImageUpload,
}: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[var(--shadow-card)] dark:border-slate-800 dark:bg-slate-950">
            <div className="relative h-36 bg-gradient-to-r from-[#4F46E5] via-[#6C63FF] to-[#8B5CF6] sm:h-44">
                <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
                <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-fuchsia-300/20 blur-3xl" />
                <div className="absolute right-4 top-4 z-10 flex gap-2 sm:right-6 sm:top-6">
                    {isEditing ? (
                        <>
                            <Button size="sm" variant="outline" onClick={onCancel} className="border-white/30 bg-white/15 text-white hover:bg-white/25">
                                <X className="mr-1.5 h-4 w-4" /> Cancel
                            </Button>
                            <Button size="sm" onClick={onSave} disabled={isSaving} className="bg-white text-[#5c52d2] hover:bg-slate-100">
                                {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                                {isSaving ? 'Saving' : 'Save'}
                            </Button>
                        </>
                    ) : (
                        <Button size="sm" onClick={onStartEdit} className="border-white/30 bg-white/15 text-white hover:bg-white/25">
                            <Edit2 className="mr-1.5 h-4 w-4" /> Edit Profile
                        </Button>
                    )}
                </div>
            </div>

            <div className="px-4 pb-6 sm:px-8">
                <div className="-mt-14 flex flex-col gap-5 sm:-mt-16 md:flex-row md:items-end">
                    <div className="relative mx-auto group md:mx-0">
                        <div className="h-28 w-28 overflow-hidden rounded-3xl border-4 border-white bg-slate-100 shadow-xl dark:border-slate-950 sm:h-32 sm:w-32">
                            {profile.image ? (
                                <img src={profile.image} alt={`${displayName} profile`} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#6C63FF] to-[#4F46E5] text-4xl font-black text-white">
                                    {displayInitial}
                                </div>
                            )}
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                    aria-label="Upload profile photo"
                                >
                                    <Camera className="h-7 w-7" />
                                </button>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) onImageUpload(file);
                                }}
                            />
                        </div>
                    </div>

                    <div className="min-w-0 flex-1 text-center md:pb-2 md:text-left">
                        {isEditing ? (
                            <Input
                                value={editName}
                                onChange={(event) => onEditName(event.target.value)}
                                className="mx-auto h-12 max-w-md text-2xl font-black tracking-tight md:mx-0"
                                placeholder="Your name"
                            />
                        ) : (
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                                {displayName}
                            </h1>
                        )}

                        {isEditing ? (
                            <Input
                                value={profile.role}
                                onChange={(event) => onProfileChange({ ...profile, role: event.target.value })}
                                className="mx-auto mt-2 h-10 max-w-md md:mx-0"
                                placeholder="Career headline, e.g. Aspiring Software Engineer"
                            />
                        ) : profile.role ? (
                            <p className="mt-1 flex items-center justify-center gap-2 text-base font-semibold text-slate-500 dark:text-slate-400 md:justify-start">
                                <Briefcase className="h-4 w-4 text-[#6C63FF]" />
                                {profile.role}
                            </p>
                        ) : (
                            <p className="mt-1 text-sm text-slate-400">Add a career headline to introduce yourself.</p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400 md:justify-start">
                            <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {displayEmail}</span>
                            {isEditing ? (
                                <Input
                                    value={profile.location}
                                    onChange={(event) => onProfileChange({ ...profile, location: event.target.value })}
                                    className="h-8 w-44"
                                    placeholder="Location"
                                />
                            ) : profile.location ? (
                                <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {profile.location}</span>
                            ) : null}
                            <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Joined {profile.joined}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        { label: 'Saved resumes', value: stats.resumes, icon: FileText },
                        { label: 'Badges unlocked', value: stats.badges, icon: Award },
                        { label: 'Day streak', value: stats.streak, icon: Flame },
                        { label: 'Skills listed', value: stats.skills, icon: Award },
                    ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
                                <item.icon className="h-4 w-4 text-[#6C63FF]" />
                            </div>
                            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white" aria-label={item.value === null ? `${item.label} unavailable` : `${item.label}: ${item.value}`}>
                                {item.value === null ? '—' : item.value}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Biography</h2>
                        {isEditing ? (
                            <Textarea
                                value={profile.bio}
                                onChange={(event) => onProfileChange({ ...profile, bio: event.target.value })}
                                className="mt-2 min-h-[110px]"
                                placeholder="Share your career story, interests, and what you are working toward."
                            />
                        ) : (
                            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                {profile.bio || 'No biography yet. Edit your profile to add one.'}
                            </p>
                        )}
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Contact & social</h2>
                        {isEditing ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-slate-400" />
                                    <Input value={profile.phone} onChange={(event) => onProfileChange({ ...profile, phone: event.target.value })} placeholder="Phone" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Linkedin className="h-4 w-4 text-slate-400" />
                                    <Input value={profile.socials.linkedin} onChange={(event) => onProfileChange({ ...profile, socials: { ...profile.socials, linkedin: event.target.value } })} placeholder="LinkedIn URL" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Github className="h-4 w-4 text-slate-400" />
                                    <Input value={profile.socials.github} onChange={(event) => onProfileChange({ ...profile, socials: { ...profile.socials, github: event.target.value } })} placeholder="GitHub URL" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-slate-400" />
                                    <Input value={profile.socials.portfolio} onChange={(event) => onProfileChange({ ...profile, socials: { ...profile.socials, portfolio: event.target.value } })} placeholder="Portfolio URL" />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {profile.phone && (
                                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                        <Phone className="h-3.5 w-3.5" /> {profile.phone}
                                    </span>
                                )}
                                <SocialLink href={profile.socials.linkedin} label="LinkedIn" icon={Linkedin} />
                                <SocialLink href={profile.socials.github} label="GitHub" icon={Github} />
                                <SocialLink href={profile.socials.portfolio} label="Portfolio" icon={Globe} />
                                {!profile.phone && !profile.socials.linkedin && !profile.socials.github && !profile.socials.portfolio && (
                                    <p className="text-sm text-slate-400">No social links yet.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
