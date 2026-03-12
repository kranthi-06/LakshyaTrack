import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '../context/AuthContext';
import { updateProfile as updateProfileApi } from '../services/auth';
import {
    User, Mail, Phone, MapPin, Briefcase, Calendar,
    Linkedin, Github, Globe, FileText, Award, Star,
    Edit2, Camera, Save, X, Plus, Trash2, Eye, Download, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSavedResumes, deleteSavedResume } from '../services/resumeStorage';
import {
    ModernTemplate, ClassicTemplate, CreativeTemplate, DeveloperTemplate,
    MinimalATSTemplate, AcademicTemplate, ExecutiveTemplate, TwoColumnTemplate,
    PortfolioTemplate, CompactTemplate, TimelineTemplate, ElegantTemplate,
    BoldHeaderTemplate, InfographicTemplate, CorporateTemplate, FreshTemplate
} from './ResumeBuilder/templates';
import { exportToPDF } from './ResumeBuilder/exportUtils';
import type { BaseTemplate } from './ResumeBuilder/templates';
import type { ResumeData } from './ResumeBuilder/types';

function RenderTemplate({ base, data, color }: { base: BaseTemplate; data: ResumeData; color: string }) {
    const p = { data, accentColor: color };
    switch (base) {
        case 'modern': return <ModernTemplate {...p} />;
        case 'classic': return <ClassicTemplate {...p} />;
        case 'creative': return <CreativeTemplate {...p} />;
        case 'developer': return <DeveloperTemplate {...p} />;
        case 'minimal-ats': return <MinimalATSTemplate {...p} />;
        case 'academic': return <AcademicTemplate {...p} />;
        case 'executive': return <ExecutiveTemplate {...p} />;
        case 'two-column': return <TwoColumnTemplate {...p} />;
        case 'portfolio': return <PortfolioTemplate {...p} />;
        case 'compact': return <CompactTemplate {...p} />;
        case 'timeline': return <TimelineTemplate {...p} />;
        case 'elegant': return <ElegantTemplate {...p} />;
        case 'bold-header': return <BoldHeaderTemplate {...p} />;
        case 'infographic': return <InfographicTemplate {...p} />;
        case 'corporate': return <CorporateTemplate {...p} />;
        case 'fresh': return <FreshTemplate {...p} />;
        default: return <ModernTemplate {...p} />;
    }
}

/* Lazy-rendered resume card — only renders the heavy template when visible */
function LazyResumePreview({ resume, onDelete, onDownload, onEdit }: {
    resume: any;
    onDelete: (id: string) => void;
    onDownload: (resume: any) => void;
    onEdit: (resume: any) => void;
}) {
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect(); // only need to trigger once
                }
            },
            { rootMargin: '200px' } // start rendering 200px before it enters viewport
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden group cv-auto">
            {/* Action Bar */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h4 className="font-bold text-slate-800 text-lg">{resume.resume_name}</h4>
                    <p className="text-xs font-semibold text-slate-400">Template: <span className="uppercase text-[#5c52d2]">{resume.template_id}</span> • {new Date(resume.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 shadow-sm text-[#5c52d2] hover:text-[#4a42b8] hover:bg-purple-50 border-purple-200"
                        onClick={() => onEdit(resume)}
                    >
                        <Edit2 className="w-4 h-4 mr-1.5" /> Edit
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 shadow-sm text-slate-600 hover:text-[#5c52d2] hover:bg-purple-50"
                        onClick={() => onDownload(resume)}
                    >
                        <Download className="w-4 h-4 mr-1.5" /> PDF
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-50"
                        onClick={() => onDelete(resume.id)}
                        title="Delete Resume"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Visual Render — only render template when visible */}
            <div className="bg-gray-200 p-6 flex flex-col items-center justify-center relative overscroll-contain overflow-hidden" style={{ minHeight: '600px' }}>
                {isVisible ? (
                    <div
                        className="bg-white shadow-2xl overflow-hidden pointer-events-none transform origin-top"
                        style={{ width: '794px', height: '1123px', transform: 'scale(0.5)', marginBottom: '-550px' }}
                    >
                        <div id={`resume-preview-${resume.id}`} className="w-full h-full">
                            <RenderTemplate
                                base={resume.template_id as BaseTemplate}
                                data={resume.resume_data}
                                color={resume.theme || '#5c52d2'}
                            />
                        </div>
                    </div>
                ) : (
                    /* Lightweight skeleton placeholder */
                    <div className="bg-white shadow-lg rounded-lg overflow-hidden" style={{ width: '397px', height: '280px' }}>
                        <div className="p-6 space-y-4 animate-pulse">
                            <div className="h-4 bg-slate-200 rounded w-2/3" />
                            <div className="h-3 bg-slate-100 rounded w-1/2" />
                            <div className="space-y-2 mt-6">
                                <div className="h-2 bg-slate-100 rounded w-full" />
                                <div className="h-2 bg-slate-100 rounded w-5/6" />
                                <div className="h-2 bg-slate-100 rounded w-4/6" />
                            </div>
                            <div className="space-y-2 mt-4">
                                <div className="h-2 bg-slate-100 rounded w-full" />
                                <div className="h-2 bg-slate-100 rounded w-3/4" />
                            </div>
                            <div className="flex gap-2 mt-4">
                                <div className="h-5 w-16 bg-purple-100 rounded" />
                                <div className="h-5 w-14 bg-blue-100 rounded" />
                                <div className="h-5 w-18 bg-emerald-100 rounded" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
                    <Button size="lg" className="bg-[#5c52d2] text-white hover:bg-[#4a42b8] font-bold px-8 shadow-xl" onClick={() => onEdit(resume)}>
                        <Edit2 className="w-5 h-5 mr-2" /> Edit Resume
                    </Button>
                    <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-50 font-bold px-8 shadow-xl" onClick={() => onDownload(resume)}>
                        <Download className="w-5 h-5 mr-2" /> Download Document
                    </Button>
                </div>
            </div>
        </div>
    );
}

/** Helper: Format a date string to "MonthName Year" */
function formatJoinDate(dateStr?: string | null): string {
    if (!dateStr) return 'Recently joined';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
        return 'Recently joined';
    }
}

export default function Profile() {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Editable name — initialised from backend and updated locally
    const [editName, setEditName] = useState('');

    // Profile state — populated from backend user data
    const [profile, setProfile] = useState({
        role: "",
        location: "",
        joined: "",
        phone: "",
        bio: "",
        skills: [] as string[],
        socials: {
            linkedin: "",
            github: "",
            portfolio: ""
        },
        image: null as string | null
    });

    const [savedResumes, setSavedResumes] = useState<any[]>([]);
    const [loadingResumes, setLoadingResumes] = useState(false);

    // Refresh user data from backend on page load to guarantee latest data
    useEffect(() => {
        refreshUser();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Hydrate profile from backend user data + localStorage overrides
    useEffect(() => {
        if (!user?.email) return;

        // Start with backend data
        const backendProfile = user.profile;
        const backendLinks = backendProfile?.links || {};

        // Check for localStorage profile data (for fields not yet in backend)
        let localProfile: any = null;
        try {
            const saved = localStorage.getItem(`user_profile_${user.email}`);
            if (saved) localProfile = JSON.parse(saved);
        } catch {
            // ignore parse errors
        }

        // Initialise the editable name
        setEditName(backendProfile?.full_name || user?.full_name || '');

        setProfile({
            role: localProfile?.role || "",
            location: localProfile?.location || "",
            joined: formatJoinDate(user.created_at),
            phone: backendProfile?.phone_number || localProfile?.phone || "",
            bio: backendProfile?.bio || localProfile?.bio || "",
            skills: backendProfile?.skills?.length ? backendProfile.skills : (localProfile?.skills || []),
            socials: {
                linkedin: backendLinks.linkedin || localProfile?.socials?.linkedin || "",
                github: backendLinks.github || localProfile?.socials?.github || "",
                portfolio: backendLinks.portfolio || localProfile?.socials?.portfolio || ""
            },
            image: backendProfile?.profile_photo_url || localProfile?.image || null
        });
    }, [user?.email, user?.profile?.skills, user?.profile?.full_name, user?.profile?.bio, user?.profile?.phone_number, user?.profile?.profile_photo_url, user?.created_at]);

    useEffect(() => {
        const fetchSavedResumes = async () => {
            setLoadingResumes(true);
            try {
                const res = await getSavedResumes();
                if (res?.resumes) {
                    setSavedResumes(res.resumes);
                }
            } catch (err) {
                console.error("Error fetching resumes:", err);
            }
            setLoadingResumes(false);
        };
        fetchSavedResumes();
    }, []);

    const handleDeleteResume = async (id: string) => {
        try {
            await deleteSavedResume(id);
            setSavedResumes(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            console.error("Error deleting resume:", err);
        }
    };

    const handleDownloadPDF = async (resume: any) => {
        const name = resume.resume_name.replace(/\s+/g, '_') || 'resume';
        await exportToPDF(`resume-preview-${resume.id}`, `${name}.pdf`);
    };

    const handleEditResume = (resume: any) => {
        navigate('/resume-builder', {
            state: { editResume: resume }
        });
    };

    const handleSave = async () => {
        if (!user?.email) return;
        setIsSaving(true);
        try {
            // 1. Save to backend (name, phone, bio, skills, links)
            await updateProfileApi({
                full_name: editName.trim() || undefined,
                phone_number: profile.phone || undefined,
                bio: profile.bio || undefined,
                skills: profile.skills.length > 0 ? profile.skills : undefined,
                links: {
                    linkedin: profile.socials.linkedin,
                    github: profile.socials.github,
                    portfolio: profile.socials.portfolio,
                },
            });

            // 2. Save local-only fields (role, location, image) to localStorage
            localStorage.setItem(`user_profile_${user.email}`, JSON.stringify(profile));

            // 3. Refresh user from backend so every component sees the new name
            await refreshUser();

            setIsEditing(false);
        } catch (error) {
            console.error("Failed to save profile:", error);
            alert("Failed to save changes. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const [newSkill, setNewSkill] = useState("");

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfile(prev => ({ ...prev, image: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddSkill = () => {
        if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
            setProfile(prev => ({
                ...prev,
                skills: [...prev.skills, newSkill.trim()]
            }));
            setNewSkill("");
        }
    };

    const handleRemoveSkill = (skillToRemove: string) => {
        setProfile(prev => ({
            ...prev,
            skills: prev.skills.filter(skill => skill !== skillToRemove)
        }));
    };

    // Derived display values
    const displayName = isEditing ? editName : (user?.profile?.full_name || user?.full_name || 'Your Profile');
    const displayEmail = user?.email || '';
    const displayInitial = (displayName && displayName !== 'Your Profile' ? displayName[0] : displayEmail[0] || 'U').toUpperCase();

    return (
        <div className="min-h-screen bg-[#f8fafc] font-sans pb-20">
<main className="max-w-5xl mx-auto px-3 sm:px-6 pt-6 sm:pt-10">
                <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100 relative">
                    {/* Header Banner */}
                    <div className="h-32 sm:h-48 bg-gradient-to-r from-[#5c52d2] to-[#7c66dc] relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-[80px]"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24 blur-[60px]"></div>

                        {/* Edit Button */}
                        <div className="absolute top-6 right-6 z-10">
                            {isEditing ? (
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => setIsEditing(false)}
                                        className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-md"
                                        size="sm"
                                    >
                                        <X className="w-4 h-4 mr-2" /> Cancel
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        className="bg-white text-[#5c52d2] hover:bg-gray-100 border-none shadow-lg"
                                        size="sm"
                                        disabled={isSaving}
                                    >
                                        {isSaving ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                                        ) : (
                                            <><Save className="w-4 h-4 mr-2" /> Save Changes</>
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    onClick={() => setIsEditing(true)}
                                    className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-md transition-all"
                                    size="sm"
                                >
                                    <Edit2 className="w-4 h-4 mr-2" /> Edit Profile
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="px-4 sm:px-8 md:px-12 pb-8 sm:pb-12">
                        {/* Profile Image & Basic Info */}
                        <div className="relative -mt-14 sm:-mt-20 mb-6 sm:mb-8 flex flex-col md:flex-row items-center md:items-end gap-4 sm:gap-6 text-center md:text-left">
                            <div className="relative group">
                                <div className="w-28 h-28 sm:w-40 sm:h-40 bg-white p-1.5 sm:p-2 rounded-2xl sm:rounded-[2.5rem] shadow-lg relative z-10">
                                    <div className="w-full h-full bg-slate-100 rounded-xl sm:rounded-[2rem] flex items-center justify-center overflow-hidden relative">
                                        {profile.image ? (
                                            <img src={profile.image} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                                <span className="text-4xl font-bold text-white">{displayInitial}</span>
                                            </div>
                                        )}

                                        {/* Image Upload Overlay */}
                                        {isEditing && (
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Camera className="w-8 h-8 text-white" />
                                            </div>
                                        )}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 pb-2 space-y-2 w-full md:w-auto">
                                {isEditing ? (
                                    <Input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="max-w-sm mx-auto md:mx-0 font-black text-2xl sm:text-3xl md:text-4xl h-11 sm:h-14 border-slate-200 tracking-tight"
                                        placeholder="Your Name"
                                    />
                                ) : (
                                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                                        {displayName}
                                    </h1>
                                )}

                                {isEditing ? (
                                    <Input
                                        value={profile.role}
                                        onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                                        className="max-w-xs mx-auto md:mx-0 font-bold text-lg h-10 border-slate-200"
                                        placeholder="Current Role / Title"
                                    />
                                ) : profile.role ? (
                                    <p className="text-slate-500 font-bold text-lg flex items-center justify-center md:justify-start gap-2">
                                        <Briefcase className="w-4 h-4" /> {profile.role}
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6 sm:gap-8 md:gap-12">
                            {/* Left Column: Contact & Socials */}
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                        <User className="w-5 h-5 text-[#5c52d2]" /> Contact Info
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 text-slate-500 font-medium text-sm">
                                            <Mail className="w-4 h-4 shrink-0" />
                                            <span className="truncate">{displayEmail}</span>
                                        </div>

                                        <div className="flex items-center gap-3 text-slate-500 font-medium text-sm">
                                            <Phone className="w-4 h-4 shrink-0" />
                                            {isEditing ? (
                                                <Input
                                                    value={profile.phone}
                                                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                                    className="h-8 text-sm"
                                                    placeholder="Phone Number"
                                                />
                                            ) : (
                                                <span>{profile.phone || 'Not set'}</span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 text-slate-500 font-medium text-sm">
                                            <MapPin className="w-4 h-4 shrink-0" />
                                            {isEditing ? (
                                                <Input
                                                    value={profile.location}
                                                    onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                                                    className="h-8 text-sm"
                                                    placeholder="Location"
                                                />
                                            ) : (
                                                <span>{profile.location || 'Not set'}</span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 text-slate-500 font-medium text-sm">
                                            <Calendar className="w-4 h-4 shrink-0" />
                                            <span>Joined {profile.joined}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                        <Globe className="w-5 h-5 text-[#5c52d2]" /> Social Presence
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
                                                <Linkedin className="w-4 h-4 shrink-0" />
                                                {isEditing ? (
                                                    <Input
                                                        value={profile.socials.linkedin}
                                                        onChange={(e) => setProfile({
                                                            ...profile,
                                                            socials: { ...profile.socials, linkedin: e.target.value }
                                                        })}
                                                        className="h-8 text-sm"
                                                        placeholder="LinkedIn URL"
                                                    />
                                                ) : profile.socials.linkedin ? (
                                                    <a href={`https://${profile.socials.linkedin}`} target="_blank" rel="noreferrer" className="hover:text-[#0077b5] transition-colors hover:underline">
                                                        LinkedIn
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400">Not set</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
                                                <Github className="w-4 h-4 shrink-0" />
                                                {isEditing ? (
                                                    <Input
                                                        value={profile.socials.github}
                                                        onChange={(e) => setProfile({
                                                            ...profile,
                                                            socials: { ...profile.socials, github: e.target.value }
                                                        })}
                                                        className="h-8 text-sm"
                                                        placeholder="GitHub URL"
                                                    />
                                                ) : profile.socials.github ? (
                                                    <a href={`https://${profile.socials.github}`} target="_blank" rel="noreferrer" className="hover:text-slate-900 transition-colors hover:underline">
                                                        GitHub
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400">Not set</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
                                                <FileText className="w-4 h-4 shrink-0" />
                                                {isEditing ? (
                                                    <Input
                                                        value={profile.socials.portfolio}
                                                        onChange={(e) => setProfile({
                                                            ...profile,
                                                            socials: { ...profile.socials, portfolio: e.target.value }
                                                        })}
                                                        className="h-8 text-sm"
                                                        placeholder="Portfolio URL"
                                                    />
                                                ) : profile.socials.portfolio ? (
                                                    <a href={`https://${profile.socials.portfolio}`} target="_blank" rel="noreferrer" className="hover:text-emerald-500 transition-colors hover:underline">
                                                        Portfolio
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400">Not set</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Bio & Skills */}
                            <div className="md:col-span-2 space-y-6 sm:space-y-8 border-t md:border-t-0 md:border-l border-slate-100 pt-6 sm:pt-8 md:pt-0 md:pl-8 lg:pl-12">
                                <div className="space-y-4">
                                    <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-[#5c52d2]" /> About Me
                                    </h3>
                                    {isEditing ? (
                                        <Textarea
                                            value={profile.bio}
                                            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                                            className="min-h-[120px] text-slate-600 font-medium"
                                            placeholder="Write a short bio about yourself..."
                                        />
                                    ) : (
                                        <p className="text-slate-500 leading-relaxed font-medium">
                                            {profile.bio || 'No bio yet. Click "Edit Profile" to add one!'}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                        <Award className="w-5 h-5 text-[#5c52d2]" /> Core Skills
                                    </h3>

                                    <div className="flex flex-wrap gap-2">
                                        {profile.skills.length > 0 ? (
                                            profile.skills.map((skill, index) => (
                                                <span
                                                    key={index}
                                                    className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider border border-slate-100 flex items-center gap-2 group cursor-default"
                                                >
                                                    {skill}
                                                    {isEditing && (
                                                        <button
                                                            onClick={() => handleRemoveSkill(skill)}
                                                            className="hover:text-red-500 transition-colors"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </span>
                                            ))
                                        ) : !isEditing ? (
                                            <p className="text-slate-400 text-sm">No skills added yet. Click "Edit Profile" to add some!</p>
                                        ) : null}

                                        {isEditing && (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={newSkill}
                                                    onChange={(e) => setNewSkill(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                                                    className="h-8 w-32 text-xs"
                                                    placeholder="Add skill..."
                                                />
                                                <Button
                                                    onClick={handleAddSkill}
                                                    size="icon"
                                                    className="h-8 w-8 rounded-xl bg-[#5c52d2] hover:bg-[#4a42b8]"
                                                >
                                                    <Plus className="w-4 h-4 text-white" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── SAVED RESUMES SECTION ── */}
                <div className="mt-8 mb-16">
                    <h3 className="font-black text-slate-900 text-2xl mb-6 flex items-center gap-3">
                        <FileText className="w-6 h-6 text-[#5c52d2]" /> Saved Resumes
                    </h3>

                    {loadingResumes ? (
                        <div className="text-center text-slate-400 py-10">Loading your resumes...</div>
                    ) : savedResumes.length === 0 ? (
                        <div className="bg-white rounded-3xl p-10 text-center shadow-lg border border-slate-100">
                            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h4 className="text-xl font-bold text-slate-700 mb-2">No Saved Resumes</h4>
                            <p className="text-slate-500 max-w-sm mx-auto">Create and save your beautiful resumes from the builder to display them here.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
                            {savedResumes.map((resume: any) => (
                                <LazyResumePreview
                                    key={resume.id}
                                    resume={resume}
                                    onDelete={handleDeleteResume}
                                    onDownload={handleDownloadPDF}
                                    onEdit={handleEditResume}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
