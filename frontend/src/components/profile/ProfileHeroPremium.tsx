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
    Mountain,
    Star,
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
            className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-600 dark:text-violet-300 transition-all hover:border-violet-500/50 hover:bg-violet-500/20 dark:hover:bg-violet-500/20 hover:text-violet-700 dark:hover:text-violet-200"
        >
            <Icon className="h-4 w-4" />
            {label}
        </a>
    );
}

export function ProfileHeroPremium({
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
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[var(--shadow-card)] dark:border-slate-800 dark:bg-slate-950">
            {/* Premium Hero Background with Mountain Artwork */}
            <div className="relative h-48 sm:h-56 md:h-64 overflow-hidden">
                {/* Layered gradients - Light Mode */}
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-100 via-slate-50 to-white dark:hidden" />
                <div className="absolute inset-0 bg-gradient-to-r from-violet-100/50 via-transparent to-purple-100/50 dark:hidden" />
                
                {/* Layered gradients - Dark Mode */}
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-950 hidden dark:block" />
                <div className="absolute inset-0 bg-gradient-to-r from-violet-950/30 via-transparent to-purple-950/30 hidden dark:block" />
                
                {/* Mountain SVG Artwork */}
                <svg
                    className="absolute bottom-0 left-0 right-0 h-full w-full opacity-30 dark:opacity-40"
                    viewBox="0 0 1200 400"
                    preserveAspectRatio="xMidYMax slice"
                    aria-hidden
                >
                    {/* Distant mountains */}
                    <path
                        d="M0 400 L0 280 L100 200 L200 260 L300 180 L400 240 L500 160 L600 220 L700 140 L800 200 L900 120 L1000 180 L1100 100 L1200 160 L1200 400 Z"
                        className="fill-indigo-300 dark:fill-indigo-500/30"
                    />
                    {/* Mid mountains */}
                    <path
                        d="M0 400 L0 320 L150 240 L300 300 L450 220 L600 280 L750 200 L900 260 L1050 180 L1200 240 L1200 400 Z"
                        className="fill-violet-300 dark:fill-violet-500/40"
                    />
                    {/* Foreground mountains */}
                    <path
                        d="M0 400 L0 350 L200 280 L400 340 L600 270 L800 330 L1000 260 L1200 320 L1200 400 Z"
                        className="fill-purple-300 dark:fill-purple-500/50"
                    />
                    {/* Glowing trail path */}
                    <path
                        d="M600 270 Q650 310 700 350"
                        className="stroke-violet-400 dark:stroke-violet-400/60"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                    />
                    {/* Flag at summit */}
                    <circle cx="700" cy="350" r="4" className="fill-amber-400 dark:fill-amber-400/80" />
                    <path
                        d="M700 350 L700 340"
                        className="stroke-amber-400 dark:stroke-amber-400/80"
                        strokeWidth="2"
                    />
                    {/* Stars - only visible in dark mode */}
                    <circle cx="100" cy="80" r="1.5" className="fill-slate-400/60 dark:fill-white/60" />
                    <circle cx="300" cy="60" r="1" className="fill-slate-400/40 dark:fill-white/40" />
                    <circle cx="500" cy="90" r="1.2" className="fill-slate-400/50 dark:fill-white/50" />
                    <circle cx="800" cy="70" r="1" className="fill-slate-400/40 dark:fill-white/40" />
                    <circle cx="1000" cy="85" r="1.5" className="fill-slate-400/60 dark:fill-white/60" />
                    <circle cx="1100" cy="55" r="1" className="fill-slate-400/40 dark:fill-white/40" />
                </svg>

                {/* Atmospheric glow effects */}
                <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-violet-400/20 dark:bg-violet-600/20 blur-3xl" />
                <div className="absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-indigo-400/15 dark:bg-indigo-600/15 blur-3xl" />

                {/* Edit Profile Button */}
                <div className="absolute right-4 top-4 z-10 flex gap-2 sm:right-6 sm:top-6">
                    {isEditing ? (
                        <>
                            <Button size="sm" variant="outline" onClick={onCancel} className="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300 hover:bg-violet-500/20 dark:hover:bg-violet-500/20">
                                <X className="mr-1.5 h-4 w-4" /> Cancel
                            </Button>
                            <Button size="sm" onClick={onSave} disabled={isSaving} className="bg-violet-600 text-white hover:bg-violet-500">
                                {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                                {isSaving ? 'Saving' : 'Save'}
                            </Button>
                        </>
                    ) : (
                        <Button size="sm" onClick={onStartEdit} className="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300 hover:bg-violet-500/20 dark:hover:bg-violet-500/20">
                            <Edit2 className="mr-1.5 h-4 w-4" /> Edit Profile
                        </Button>
                    )}
                </div>
            </div>

            <div className="px-4 pb-8 sm:px-8 md:px-12">
                <div className="-mt-20 flex flex-col gap-6 sm:-mt-24 md:-mt-28 md:flex-row md:items-end">
                    {/* Premium Avatar with Glow */}
                    <div className="relative mx-auto group md:mx-0">
                        <div className="relative">
                            {/* Glow effect */}
                            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-400 to-indigo-400 dark:from-violet-600 dark:to-indigo-600 blur opacity-50 group-hover:opacity-75 transition-opacity" />
                            <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-white dark:border-slate-950 bg-slate-100 dark:bg-slate-900 shadow-xl">
                                {profile.image ? (
                                    <img src={profile.image} alt={`${displayName} profile`} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-400 to-indigo-400 dark:from-violet-600 dark:to-indigo-600 text-5xl font-black text-white">
                                        {displayInitial}
                                    </div>
                                )}
                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                        aria-label="Upload profile photo"
                                    >
                                        <Camera className="h-8 w-8" />
                                    </button>
                                )}
                            </div>
                        </div>
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

                    {/* User Info */}
                    <div className="min-w-0 flex-1 text-center md:pb-2 md:text-left">
                        {isEditing ? (
                            <Input
                                value={editName}
                                onChange={(event) => onEditName(event.target.value)}
                                className="mx-auto h-14 max-w-md text-3xl font-black tracking-tight bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white md:mx-0"
                                placeholder="Your name"
                            />
                        ) : (
                            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl">
                                {displayName}
                            </h1>
                        )}

                        {isEditing ? (
                            <Input
                                value={profile.role}
                                onChange={(event) => onProfileChange({ ...profile, role: event.target.value })}
                                className="mx-auto mt-3 h-12 max-w-md bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white md:mx-0"
                                placeholder="Career headline, e.g. Aspiring Software Engineer"
                            />
                        ) : profile.role ? (
                            <p className="mt-3 flex items-center justify-center gap-2 text-lg font-semibold text-violet-600 dark:text-violet-300 md:justify-start">
                                <Briefcase className="h-5 w-5" />
                                {profile.role}
                            </p>
                        ) : (
                            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Add a career headline to introduce yourself.</p>
                        )}

                        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400 md:justify-start">
                            <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <Mail className="h-4 w-4 text-violet-500 dark:text-violet-400" /> {displayEmail}
                            </span>
                            {isEditing ? (
                                <Input
                                    value={profile.location}
                                    onChange={(event) => onProfileChange({ ...profile, location: event.target.value })}
                                    className="h-9 w-48 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                    placeholder="Location"
                                />
                            ) : profile.location ? (
                                <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                    <MapPin className="h-4 w-4 text-violet-500 dark:text-violet-400" /> {profile.location}
                                </span>
                            ) : null}
                            <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <Calendar className="h-4 w-4 text-violet-500 dark:text-violet-400" /> Joined {profile.joined}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Premium Stats Cards */}
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        { label: 'Saved resumes', value: stats.resumes, icon: FileText, color: 'from-blue-400 to-cyan-400 dark:from-blue-500 dark:to-cyan-500' },
                        { label: 'Badges unlocked', value: stats.badges, icon: Award, color: 'from-violet-400 to-purple-400 dark:from-violet-500 dark:to-purple-500' },
                        { label: 'Day streak', value: stats.streak, icon: Flame, color: 'from-orange-400 to-amber-400 dark:from-orange-500 dark:to-amber-500' },
                        { label: 'Skills listed', value: stats.skills, icon: Star, color: 'from-emerald-400 to-teal-400 dark:from-emerald-500 dark:to-teal-500' },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50 backdrop-blur-sm px-5 py-4"
                        >
                            <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br ${item.color} opacity-10 blur-xl`} />
                            <div className="relative flex items-center justify-between">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{item.label}</p>
                                <item.icon className={`h-5 w-5 bg-gradient-to-br ${item.color} bg-clip-text text-transparent`} />
                            </div>
                            <p className="relative mt-2 text-3xl font-black text-slate-900 dark:text-white" aria-label={item.value === null ? `${item.label} unavailable` : `${item.label}: ${item.value}`}>
                                {item.value === null ? '—' : item.value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Biography and Contact */}
                <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Biography</h2>
                        {isEditing ? (
                            <Textarea
                                value={profile.bio}
                                onChange={(event) => onProfileChange({ ...profile, bio: event.target.value })}
                                className="mt-3 min-h-[120px] bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                placeholder="Share your career story, interests, and what you are working toward."
                            />
                        ) : (
                            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                {profile.bio || 'No biography yet. Edit your profile to add one.'}
                            </p>
                        )}
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Contact & social</h2>
                        {isEditing ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <Phone className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                                    <Input value={profile.phone} onChange={(event) => onProfileChange({ ...profile, phone: event.target.value })} placeholder="Phone" className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <Linkedin className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                                    <Input value={profile.socials.linkedin} onChange={(event) => onProfileChange({ ...profile, socials: { ...profile.socials, linkedin: event.target.value } })} placeholder="LinkedIn URL" className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <Github className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                                    <Input value={profile.socials.github} onChange={(event) => onProfileChange({ ...profile, socials: { ...profile.socials, github: event.target.value } })} placeholder="GitHub URL" className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <Globe className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                                    <Input value={profile.socials.portfolio} onChange={(event) => onProfileChange({ ...profile, socials: { ...profile.socials, portfolio: event.target.value } })} placeholder="Portfolio URL" className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-3">
                                {profile.phone && (
                                    <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-600 dark:text-violet-300">
                                        <Phone className="h-4 w-4" /> {profile.phone}
                                    </span>
                                )}
                                <SocialLink href={profile.socials.linkedin} label="LinkedIn" icon={Linkedin} />
                                <SocialLink href={profile.socials.github} label="GitHub" icon={Github} />
                                <SocialLink href={profile.socials.portfolio} label="Portfolio" icon={Globe} />
                                {!profile.phone && !profile.socials.linkedin && !profile.socials.github && !profile.socials.portfolio && (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">No social links yet.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
