import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUsage } from '../context/UsageContext';
import { updateProfile as updateProfileApi } from '../services/auth';
import { uploadUserMedia } from '../services/media';
import {
    authorizeResumeDownload,
    deleteSavedResume,
    getSavedResumes,
    saveResumeToProfile,
    updateSavedResume,
    type SavedResumeRecord,
} from '../services/resumeStorage';
import { extractLimitExceededError } from '../services/api';
import UpgradeModal from '../components/UpgradeModal';
import { ProfileHeader, type ProfileFormState } from '../components/profile/ProfileHeader';
import { ProfileTabBar } from '../components/profile/ProfileTabBar';
import { OverviewTab } from '../components/profile/OverviewTab';
import { ProjectsTab } from '../components/profile/ProjectsTab';
import { AchievementsTab } from '../components/profile/AchievementsTab';
import { SkillsTab } from '../components/profile/SkillsTab';
import { ActivityTab } from '../components/profile/ActivityTab';
import { ResumesTab } from '../components/profile/ResumesTab';
import {
    asResumeData,
    duplicateResumeName,
    extractProjectsFromResumes,
    formatJoinDate,
    normalizeProfileUrl,
    parseProfileTab,
    type ProfileTab,
} from '../components/profile/profileUtils';
import {
    useProgressDashboardRuntime,
    useProgressDashboardStore,
} from '../progress-system/store/useProgressDashboardStore';
import { resolveCatalogTemplate } from './ResumeBuilder/templates';
import { buildResumeDocument } from './ResumeBuilder/export/resumeDocument';
import { exportToPDF } from './ResumeBuilder/export/pdfExport';
import { exportToDOCX } from './ResumeBuilder/export/docxExport';

const EMPTY_PROFILE: ProfileFormState = {
    role: '',
    location: '',
    joined: '',
    phone: '',
    bio: '',
    skills: [],
    socials: { linkedin: '', github: '', portfolio: '' },
    image: null,
};

function safeResumeFilename(name: string): string {
    const cleaned = name.replace(/[\\/:*?"<>|]+/g, ' ').trim();
    return cleaned || 'resume';
}

export default function Profile() {
    const { user, refreshUser } = useAuth();
    const { usage, refreshUsage, isLimitExceeded, getCounter, resolved } = useUsage();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = parseProfileTab(searchParams.get('tab'));

    useProgressDashboardRuntime();
    const badges = useProgressDashboardStore(state => state.data.badges);
    const streak = useProgressDashboardStore(state => state.data.streak);
    const activity = useProgressDashboardStore(state => state.data.activity);
    const topics = useProgressDashboardStore(state => state.data.topicMap.topics);
    const progressError = useProgressDashboardStore(state => state.error);
    const progressHydrated = useProgressDashboardStore(state => state.hasHydrated);
    const progressLoading = useProgressDashboardStore(state => state.isLoading);
    const refreshDashboard = useProgressDashboardStore(state => state.refreshDashboard);

    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfileFormState>(EMPTY_PROFILE);
    const [profileHydrated, setProfileHydrated] = useState(false);
    const [editName, setEditName] = useState('');
    const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
    const [newSkill, setNewSkill] = useState('');
    const pendingImageUrlRef = useRef<string | null>(null);

    const [savedResumes, setSavedResumes] = useState<SavedResumeRecord[]>([]);
    const [resumesLoading, setResumesLoading] = useState(true);
    const [resumesError, setResumesError] = useState<string | null>(null);
    const [previewResume, setPreviewResume] = useState<SavedResumeRecord | null>(null);
    const [resumeActionError, setResumeActionError] = useState<string | null>(null);
    const [limitModal, setLimitModal] = useState<{
        isOpen: boolean;
        counter?: 'resume_count' | 'resume_edit_monthly';
        current?: number;
        limit?: number;
        message?: string;
    }>({ isOpen: false });

    const storageLimitReached = isLimitExceeded('resume_count');
    const downloadLimitReached = isLimitExceeded('resume_edit_monthly');
    const downloadLocked = resolved && downloadLimitReached;

    const openUsageLimitModal = useCallback(
        (counter: 'resume_count' | 'resume_edit_monthly', message?: string) => {
            const counterData = getCounter(counter);
            setLimitModal({
                isOpen: true,
                counter,
                current: counterData?.current,
                limit: counterData?.limit,
                message,
            });
        },
        [getCounter],
    );

    const hydrateForm = useCallback(() => {
        if (!user?.email) return;

        const backendProfile = user.profile;
        const backendLinks = (backendProfile?.links || {}) as Record<string, string | undefined>;
        const backendHeadline = typeof backendLinks.profile_career_headline === 'string' ? backendLinks.profile_career_headline : '';
        const backendLocation = typeof backendLinks.profile_location === 'string' ? backendLinks.profile_location : '';

        let localProfile: (Partial<ProfileFormState> & { socials?: Partial<ProfileFormState['socials']> }) | null = null;
        try {
            const raw = localStorage.getItem(`user_profile_${user.email}`);
            localProfile = raw ? JSON.parse(raw) : null;
        } catch {
            localProfile = null;
        }

        setProfile({
            role: backendHeadline || localProfile?.role || '',
            location: backendLocation || localProfile?.location || '',
            joined: formatJoinDate(user.created_at),
            phone: backendProfile?.phone_number || localProfile?.phone || '',
            bio: backendProfile?.bio || localProfile?.bio || '',
            skills: backendProfile?.skills?.length ? backendProfile.skills : (localProfile?.skills || []),
            socials: {
                linkedin: backendLinks.linkedin || localProfile?.socials?.linkedin || '',
                github: backendLinks.github || localProfile?.socials?.github || '',
                portfolio: backendLinks.portfolio || localProfile?.socials?.portfolio || '',
            },
            image: backendProfile?.profile_image_url || backendProfile?.profile_photo_url || localProfile?.image || null,
        });
        setEditName(backendProfile?.full_name || user.full_name || user.email.split('@')[0] || '');
        setProfileHydrated(true);
    }, [user]);

    const bootRefreshRef = useRef(false);
    useEffect(() => {
        if (bootRefreshRef.current) return;
        bootRefreshRef.current = true;
        void refreshUser().catch(() => {
            // Cached auth data still renders the profile; the save path surfaces real failures.
        });
    }, [refreshUser]);

    useEffect(() => {
        if (!isEditing) hydrateForm();
    }, [hydrateForm, isEditing]);

    useEffect(() => () => {
        if (pendingImageUrlRef.current) {
            URL.revokeObjectURL(pendingImageUrlRef.current);
            pendingImageUrlRef.current = null;
        }
    }, []);

    const loadResumes = useCallback(async (showLoading = true) => {
        if (showLoading) setResumesLoading(true);
        setResumesError(null);
        try {
            const response = await getSavedResumes();
            setSavedResumes(Array.isArray(response?.resumes) ? response.resumes : []);
        } catch (error) {
            console.error('Error fetching saved resumes:', error);
            setResumesError('We could not load your saved resumes.');
        } finally {
            if (showLoading) setResumesLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadResumes();
    }, [loadResumes]);

    const retryResumes = () => {
        void loadResumes();
    };

    useEffect(() => {
        setPreviewResume(current => (
            current && !savedResumes.some(resume => resume.id === current.id) ? null : current
        ));
    }, [savedResumes]);

    const handleTabChange = (tab: ProfileTab) => {
        const next = new URLSearchParams(searchParams);
        if (tab === 'overview') next.delete('tab');
        else next.set('tab', tab);
        setSearchParams(next);
    };

    const handleStartEdit = () => {
        setSaveError(null);
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setSaveError(null);
        setPendingImageFile(null);
        setNewSkill('');
        if (pendingImageUrlRef.current) {
            URL.revokeObjectURL(pendingImageUrlRef.current);
            pendingImageUrlRef.current = null;
        }
        hydrateForm();
    };

    const handleSave = async () => {
        if (!user?.email) return;

        const phone = profile.phone.trim();
        if (phone && !/^[\d+\-() ]+$/.test(phone)) {
            setSaveError('Phone number can only contain digits, spaces, and + - ( ) characters.');
            return;
        }

        const socialInputs = [
            { label: 'LinkedIn', raw: profile.socials.linkedin },
            { label: 'GitHub', raw: profile.socials.github },
            { label: 'Portfolio', raw: profile.socials.portfolio },
        ];
        const normalizedSocials = { linkedin: '', github: '', portfolio: '' };
        for (const item of socialInputs) {
            const raw = item.raw.trim();
            if (!raw) continue;
            const normalized = normalizeProfileUrl(raw);
            if (!normalized) {
                setSaveError(`${item.label} must be a valid web address, for example https://${item.label.toLowerCase()}.com/your-name.`);
                return;
            }
            if (item.label === 'LinkedIn') normalizedSocials.linkedin = normalized;
            if (item.label === 'GitHub') normalizedSocials.github = normalized;
            if (item.label === 'Portfolio') normalizedSocials.portfolio = normalized;
        }

        setIsSaving(true);
        setSaveError(null);
        try {
            let profileImageUrl = profile.image;
            if (pendingImageFile) {
                const uploadResult = await uploadUserMedia(pendingImageFile, 'profile_image');
                profileImageUrl = uploadResult.secure_url;
            }

            await updateProfileApi({
                full_name: editName.trim() || undefined,
                phone_number: phone,
                bio: profile.bio,
                skills: profile.skills,
                links: {
                    ...normalizedSocials,
                    profile_career_headline: profile.role.trim(),
                    profile_location: profile.location.trim(),
                },
                profile_image_url: profileImageUrl || undefined,
            });

            const nextProfile: ProfileFormState = {
                ...profile,
                phone,
                socials: normalizedSocials,
                image: profileImageUrl || null,
            };

            if (pendingImageUrlRef.current) {
                URL.revokeObjectURL(pendingImageUrlRef.current);
                pendingImageUrlRef.current = null;
            }
            setPendingImageFile(null);
            setProfile(nextProfile);
            localStorage.setItem(`user_profile_${user.email}`, JSON.stringify(nextProfile));

            try {
                await refreshUser();
            } catch {
                setSaveError('Your changes were saved, but your session could not be refreshed. Reload the page to see them everywhere.');
            }
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to save profile:', error);
            setSaveError('We could not save your profile changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleImageUpload = (file: File) => {
        if (pendingImageUrlRef.current) {
            URL.revokeObjectURL(pendingImageUrlRef.current);
        }
        const objectUrl = URL.createObjectURL(file);
        pendingImageUrlRef.current = objectUrl;
        setPendingImageFile(file);
        setProfile(current => ({ ...current, image: objectUrl }));
    };

    const handleAddSkill = () => {
        const value = newSkill.trim();
        if (!value || profile.skills.includes(value)) return;
        setProfile(current => ({ ...current, skills: [...current.skills, value] }));
        setNewSkill('');
    };

    const handleRemoveSkill = (skillToRemove: string) => {
        setProfile(current => ({
            ...current,
            skills: current.skills.filter(skill => skill !== skillToRemove),
        }));
    };

    const handleEditResume = (resume: SavedResumeRecord) => {
        navigate('/resume-builder', { state: { editResume: resume } });
    };

    const handleOpenProjectResume = (resumeId: string) => {
        const resume = savedResumes.find(item => item.id === resumeId);
        if (resume) handleEditResume(resume);
    };

    const handleResumeError = (error: unknown, action: string) => {
        const limitInfo = extractLimitExceededError(error);
        if (limitInfo) {
            setLimitModal({
                isOpen: true,
                counter: limitInfo.counter === 'resume_count' ? 'resume_count' : 'resume_edit_monthly',
                current: limitInfo.current,
                limit: limitInfo.limit,
                message: limitInfo.message,
            });
            return;
        }
        console.error(`Error trying to ${action}:`, error);
        setResumeActionError(`We could not ${action}. Please try again.`);
    };

    const authorizeDownload = async (resume: SavedResumeRecord): Promise<boolean> => {
        if (downloadLocked) {
            openUsageLimitModal(
                'resume_edit_monthly',
                'You have used all resume downloads for this month. You can still edit your saved resumes, but downloading another file requires the next monthly reset or a higher plan.',
            );
            return false;
        }
        await authorizeResumeDownload(resume.id);
        await refreshUsage();
        return true;
    };

    const handleDownloadPdf = async (resume: SavedResumeRecord) => {
        setResumeActionError(null);
        try {
            if (!(await authorizeDownload(resume))) return;
            const template = resolveCatalogTemplate(resume.template_id);
            const documentModel = buildResumeDocument(
                asResumeData(resume.resume_data),
                template.base,
                resume.theme || '#5c52d2',
            );
            await exportToPDF(documentModel, `${safeResumeFilename(resume.resume_name)}.pdf`);
        } catch (error) {
            handleResumeError(error, 'export this resume as PDF');
        }
    };

    const handleDownloadDocx = async (resume: SavedResumeRecord) => {
        setResumeActionError(null);
        try {
            if (!(await authorizeDownload(resume))) return;
            const template = resolveCatalogTemplate(resume.template_id);
            const documentModel = buildResumeDocument(
                asResumeData(resume.resume_data),
                template.base,
                resume.theme || '#5c52d2',
            );
            await exportToDOCX(documentModel, `${safeResumeFilename(resume.resume_name)}.docx`);
        } catch (error) {
            handleResumeError(error, 'export this resume as DOCX');
        }
    };

    const handleRenameResume = async (resume: SavedResumeRecord, name: string) => {
        setResumeActionError(null);
        try {
            await updateSavedResume(resume.id, { resume_name: name });
            setSavedResumes(current => current.map(item => (
                item.id === resume.id ? { ...item, resume_name: name } : item
            )));
        } catch (error) {
            console.error('Error renaming resume:', error);
            throw new Error('Could not rename this resume. Please try again.');
        }
    };

    const handleDuplicateResume = async (resume: SavedResumeRecord) => {
        setResumeActionError(null);
        if (resolved && storageLimitReached) {
            openUsageLimitModal(
                'resume_count',
                'You have reached the saved-resume limit for your plan. Delete a resume or upgrade to save another copy.',
            );
            return;
        }
        try {
            await saveResumeToProfile({
                resume_name: duplicateResumeName(resume.resume_name),
                resume_data: resume.resume_data,
                template_id: resume.template_id,
                theme: resume.theme,
                target_role: resume.target_role || undefined,
                ats_score: resume.ats_score ?? undefined,
                is_primary: false,
            });
            await refreshUsage();
            await loadResumes(false);
        } catch (error) {
            const limitInfo = extractLimitExceededError(error);
            if (limitInfo) {
                setLimitModal({
                    isOpen: true,
                    counter: limitInfo.counter === 'resume_count' ? 'resume_count' : 'resume_edit_monthly',
                    current: limitInfo.current,
                    limit: limitInfo.limit,
                    message: limitInfo.message,
                });
                return;
            }
            console.error('Error duplicating resume:', error);
            throw new Error('Could not duplicate this resume. Please try again.');
        }
    };

    const handleDeleteResume = async (resume: SavedResumeRecord) => {
        setResumeActionError(null);
        try {
            await deleteSavedResume(resume.id);
            setSavedResumes(current => current.filter(item => item.id !== resume.id));
            setPreviewResume(current => (current?.id === resume.id ? null : current));
            await refreshUsage();
        } catch (error) {
            console.error('Error deleting resume:', error);
            throw new Error('Could not delete this resume. Please try again.');
        }
    };

    const displayName = isEditing
        ? (editName || user?.email?.split('@')[0] || 'Your Profile')
        : (user?.profile?.full_name || user?.full_name || user?.email?.split('@')[0] || 'Your Profile');
    const displayEmail = user?.email || '';
    const displayInitial = (displayName && displayName !== 'Your Profile' ? displayName[0] : displayEmail[0] || 'U').toUpperCase();

    const projects = useMemo(() => extractProjectsFromResumes(savedResumes), [savedResumes]);
    const stats = useMemo(() => ({
        resumes: resumesLoading ? null : savedResumes.length,
        badges: progressHydrated ? badges.totalUnlocked : null,
        streak: progressHydrated ? streak.currentStreak : null,
        skills: profile.skills.length,
    }), [resumesLoading, savedResumes.length, progressHydrated, badges.totalUnlocked, streak.currentStreak, profile.skills.length]);

    const retryProgress = () => {
        void refreshDashboard({ forceRefresh: true, showLoading: false });
    };

    const progressTabActive = activeTab === 'overview'
        || activeTab === 'achievements'
        || activeTab === 'skills'
        || activeTab === 'activity';

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans dark:bg-slate-950">
            <main className="mx-auto max-w-6xl space-y-6 px-3 pt-6 sm:px-6 sm:pt-10">
                {profileHydrated ? (
                    <ProfileHeader
                        displayName={displayName}
                        displayEmail={displayEmail}
                        displayInitial={displayInitial}
                        profile={profile}
                        editName={editName}
                        isEditing={isEditing}
                        isSaving={isSaving}
                        stats={stats}
                        onStartEdit={handleStartEdit}
                        onCancel={handleCancel}
                        onSave={handleSave}
                        onEditName={setEditName}
                        onProfileChange={setProfile}
                        onImageUpload={handleImageUpload}
                    />
                ) : (
                    <div className="h-[420px] animate-pulse rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" aria-label="Loading profile" />
                )}

                {saveError && (
                    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="flex-1">{saveError}</span>
                        <button type="button" onClick={() => setSaveError(null)} className="font-semibold hover:underline">Dismiss</button>
                    </div>
                )}

                <ProfileTabBar active={activeTab} onChange={handleTabChange} resumeCount={resumesLoading ? undefined : savedResumes.length} />

                <div
                    role="tabpanel"
                    id={`profile-panel-${activeTab}`}
                    aria-labelledby={`profile-tab-${activeTab}`}
                    tabIndex={0}
                    className="focus:outline-none"
                >
                    {progressTabActive && progressError && (
                        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            <span>
                                Progress data could not be refreshed. Badge, streak, and activity figures may be unavailable or stale.
                            </span>
                            <button type="button" onClick={retryProgress} className="font-bold text-amber-900 underline">
                                Retry
                            </button>
                        </div>
                    )}

                    {resumeActionError && (
                        <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span className="flex-1">{resumeActionError}</span>
                            <button type="button" onClick={() => setResumeActionError(null)} className="font-semibold hover:underline">Dismiss</button>
                        </div>
                    )}

                    {activeTab === 'overview' && (
                        <OverviewTab
                            bio={profile.bio}
                            projects={projects}
                            recentBadges={badges.recentlyUnlocked}
                            skills={profile.skills}
                            resumes={savedResumes}
                            loading={resumesLoading}
                            badgesUnavailable={Boolean(progressError) && !progressHydrated}
                            onOpenTab={handleTabChange}
                        />
                    )}

                    {activeTab === 'projects' && (
                        <ProjectsTab projects={projects} onOpenResume={handleOpenProjectResume} />
                    )}

                    {activeTab === 'achievements' && (
                        <AchievementsTab
                            data={badges}
                            loading={progressLoading}
                            error={progressError}
                            onRetry={retryProgress}
                        />
                    )}

                    {activeTab === 'skills' && (
                        <SkillsTab
                            skills={profile.skills}
                            isEditing={isEditing}
                            newSkill={newSkill}
                            onNewSkillChange={setNewSkill}
                            onAddSkill={handleAddSkill}
                            onRemoveSkill={handleRemoveSkill}
                            topics={topics}
                        />
                    )}

                    {activeTab === 'activity' && (
                        <ActivityTab
                            summary={activity}
                            loading={progressLoading || (!progressHydrated && !progressError)}
                            unavailable={Boolean(progressError) && !progressHydrated}
                            onRetry={retryProgress}
                        />
                    )}

                    {activeTab === 'resumes' && (
                        <ResumesTab
                            resumes={savedResumes}
                            loading={resumesLoading}
                            error={resumesError}
                            planLabel={(usage?.plan || 'free').toUpperCase()}
                            downloadLocked={downloadLocked}
                            storageLimitReached={resolved && storageLimitReached}
                            downloadLimitReached={resolved && downloadLimitReached}
                            previewResume={previewResume}
                            onRetry={retryResumes}
                            onEdit={handleEditResume}
                            onPreview={setPreviewResume}
                            onDownloadPdf={handleDownloadPdf}
                            onDownloadDocx={handleDownloadDocx}
                            onRename={handleRenameResume}
                            onDuplicate={handleDuplicateResume}
                            onDelete={handleDeleteResume}
                        />
                    )}
                </div>
            </main>

            {isSaving && (
                <div className="pointer-events-none fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving profile
                </div>
            )}

            <UpgradeModal
                isOpen={limitModal.isOpen}
                onClose={() => setLimitModal({ isOpen: false })}
                counter={limitModal.counter}
                current={limitModal.current}
                limit={limitModal.limit}
                message={limitModal.message}
            />
        </div>
    );
}
