import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Target,
    Map,
    Search,
    Code,
    DollarSign,
    Megaphone,
    Building2,
    Grid,
    ChevronRight,
    Sparkles,
    Briefcase,
    Lock,
    Unlock,
    Crown,
    ArrowUpRight,
    CheckCircle2,
    BookOpen,
    Play,
    Loader2,
    Plus,
    X,
    ChevronDown,
} from 'lucide-react';
import {
    generateRoadmap,
    getActiveRoadmap,
    getLearningResources,
    getAllRoadmaps,
    setActiveRoadmap,
    deleteRoadmap as deleteRoadmapApi,
} from '../services/careerPlatform';
import { useFeatureGate } from '../hooks/useFeatureGate';
import PremiumGate from '../components/PremiumGate';
import UpgradeModal from '../components/UpgradeModal';
import { extractLimitExceededError } from '../services/api';
import { getUsageStatus } from '../services/usage';
import { useUsage } from '../context/UsageContext';

type Step = 'domains' | 'roles' | 'analysis' | 'roadmap';

const domains = [
    {
        id: 'it',
        title: 'Information Technology',
        icon: Code,
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        desc: 'Software development, cybersecurity, data science, and tech innovation',
        roles: ['Software Engineer', 'Data Scientist', 'DevOps Engineer', 'Product Manager']
    },
    {
        id: 'finance',
        title: 'Finance & Banking',
        icon: DollarSign,
        color: 'text-green-500',
        bgColor: 'bg-green-50',
        desc: 'Financial analysis, investment banking, accounting, and fintech',
        roles: ['Financial Analyst', 'Investment Banker', 'Risk Manager', 'Accountant']
    },
    {
        id: 'sales',
        title: 'Sales & Marketing',
        icon: Megaphone,
        color: 'text-rose-500',
        bgColor: 'bg-rose-50',
        desc: 'Business development, digital marketing, customer relations, and growth',
        roles: ['Sales Manager', 'Marketing Specialist', 'Business Developer', 'Account Executive']
    },
    {
        id: 'govt',
        title: 'Government & Public Sector',
        icon: Building2,
        color: 'text-purple-500',
        bgColor: 'bg-purple-50',
        desc: 'Public administration, policy making, civil services, and governance',
        roles: ['Civil Servant', 'Policy Analyst', 'Public Administrator', 'Government Consultant']
    },
    {
        id: 'other',
        title: 'Other Industries',
        icon: Grid,
        color: 'text-orange-500',
        bgColor: 'bg-orange-50',
        desc: 'Healthcare, education, manufacturing, consulting, and more',
        roles: ['Healthcare Professional', 'Teacher', 'Consultant', 'Operations Manager']
    }
];

const jobRoles = [
    {
        id: 'se',
        title: 'Software Engineer',
        demand: 'High Demand',
        desc: 'Design, develop, and maintain software applications and systems',
        exp: '2-5 years',
        salary: '$75,000 - $120,000',
        skills: ['JavaScript', 'Python', 'React', 'Node.js'],
        icon: Code
    },
    {
        id: 'ds',
        title: 'Data Scientist',
        demand: 'High Demand',
        desc: 'Analyze complex data to help organizations make informed decisions',
        exp: '3-6 years',
        salary: '$85,000 - $140,000',
        skills: ['Python', 'R', 'Machine Learning', 'SQL'],
        icon: Code
    },
    {
        id: 'devops',
        title: 'DevOps Engineer',
        demand: 'High Demand',
        desc: 'Manage infrastructure, deployment pipelines, and system reliability',
        exp: '3-7 years',
        salary: '$80,000 - $130,000',
        skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD'],
        icon: Code
    },
    {
        id: 'pm',
        title: 'Product Manager',
        demand: 'Medium Demand',
        desc: 'Define product strategy and coordinate development teams',
        exp: '4-8 years',
        salary: '$90,000 - $150,000',
        skills: ['Product Strategy', 'Agile', 'Analytics', 'User Research'],
        icon: Briefcase
    }
];

// ─── Types ─────────────────────────────────────────
interface RoadmapSummary {
    id: string;
    target_role: string;
    topic_name: string;
    is_active: boolean;
    created_at: string;
    last_opened: string;
}

export default function CareerIntelligence() {
    const navigate = useNavigate();

    // ── Subscription gate for roadmap generation ──
    const { isLocked, guardAction, gateProps, openGate } = useFeatureGate(
        'roadmap_generate',
        'AI Learning Roadmaps',
        1,
        'Generate personalized AI learning roadmaps to achieve your career goals. Upgrade to unlock.',
    );
    const { refreshUsage, getCounter, isLimitExceeded, resolved } = useUsage();

    const [step, setStep] = useState<Step>('domains');
    const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // ── Roadmap state ──────────────────────
    const [roadmapData, setRoadmapData] = useState<any>(null);
    const [roadmapId, setRoadmapId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [learningResources, setLearningResources] = useState<any[]>([]);
    const [selectedSkillForLearn, setSelectedSkillForLearn] = useState<any>(null);
    const [loadingResources, setLoadingResources] = useState(false);

    // ── Multi-roadmap state ───────────────
    const [allRoadmaps, setAllRoadmaps] = useState<RoadmapSummary[]>([]);
    const [showNewRoadmapModal, setShowNewRoadmapModal] = useState(false);
    const [newTopic, setNewTopic] = useState('');
    const [newDifficulty, setNewDifficulty] = useState('');
    const [isSwitching, setIsSwitching] = useState(false);
    const [activeTopicName, setActiveTopicName] = useState<string | null>(null);
    const [limitModal, setLimitModal] = useState<{
        isOpen: boolean;
        counter?: string;
        current?: number;
        limit?: number;
        message?: string;
    }>({ isOpen: false });
    const [roadmapRestoreAttempted, setRoadmapRestoreAttempted] = useState(false);
    const showRoadmapUpgradeGate = isLocked && !roadmapData;
    const roadmapCounter = getCounter('plan_count');
    const roadmapLimitReached = isLimitExceeded('plan_count');

    const loadRoadmapIntoView = useCallback((roadmap: {
        id: string;
        target_role: string;
        topic_name?: string | null;
        roadmap_data: any;
    }) => {
        setRoadmapData(roadmap.roadmap_data);
        setRoadmapId(roadmap.id);
        setSelectedRole(roadmap.target_role);
        setActiveTopicName(roadmap.topic_name || roadmap.target_role);
        setStep('roadmap');
    }, []);

    const redirectToRoadmapUpgrade = useCallback((options?: {
        current?: number;
        limit?: number;
        message?: string;
    }) => {
        navigate('/plans', {
            state: {
                limitPopup: {
                    title: 'Roadmap Limit Reached',
                    counter: 'plan_count',
                    current: options?.current ?? roadmapCounter?.current,
                    limit: options?.limit ?? roadmapCounter?.limit,
                    message: options?.message || 'Your free roadmap quota is already used. Upgrade your plan or choose a quick access pass to create another roadmap.',
                },
            },
        });
    }, [navigate, roadmapCounter]);

    const shouldBlockRoadmapCreation = useCallback(async (message?: string) => {
        try {
            const freshUsage = await getUsageStatus();
            const counter = freshUsage.counters.plan_count;

            if (counter && counter.limit !== -1 && counter.current >= counter.limit) {
                redirectToRoadmapUpgrade({
                    current: counter.current,
                    limit: counter.limit,
                    message,
                });
                return true;
            }
        } catch {
            if (resolved && roadmapLimitReached) {
                redirectToRoadmapUpgrade({ message });
                return true;
            }
        }

        return false;
    }, [redirectToRoadmapUpgrade, resolved, roadmapLimitReached]);

    // ── Fetch all roadmaps ────────────────
    const fetchAllRoadmaps = useCallback(async (bypassCache = false) => {
        try {
            const res = await getAllRoadmaps({ bypassCache });
            setAllRoadmaps(res.roadmaps || []);
        } catch {
            // silent
        }
    }, []);

    const restoreExistingRoadmap = useCallback(async (bypassCache = false) => {
        try {
            const res = await getActiveRoadmap({ bypassCache });
            if (res.roadmap) {
                loadRoadmapIntoView(res.roadmap);
                return true;
            }
        } catch {
            // Fall back to all roadmaps below.
        }

        try {
            const allRes = await getAllRoadmaps({ bypassCache });
            const roadmaps = allRes.roadmaps || [];
            setAllRoadmaps(roadmaps);

            if (roadmaps.length > 0) {
                const restored = await setActiveRoadmap(roadmaps[0].id);
                loadRoadmapIntoView({
                    id: restored.id,
                    target_role: restored.target_role,
                    topic_name: restored.topic_name,
                    roadmap_data: restored.roadmap_data,
                });
                return true;
            }
        } catch {
            // No roadmap to restore.
        }

        return false;
    }, [loadRoadmapIntoView]);

    // Check for existing roadmap on mount
    useEffect(() => {
        const checkExistingRoadmap = async () => {
            await restoreExistingRoadmap(true);
            setRoadmapRestoreAttempted(true);
        };
        checkExistingRoadmap();
        fetchAllRoadmaps(true);
    }, [fetchAllRoadmaps, restoreExistingRoadmap]);

    useEffect(() => {
        if (!roadmapRestoreAttempted || !resolved || isGenerating) return;
        if (roadmapLimitReached && !roadmapData) {
            redirectToRoadmapUpgrade(
                'You have already used your roadmap slot. Upgrade your plan or use a quick access pass to create a new roadmap.',
            );
        }
    }, [roadmapRestoreAttempted, resolved, isGenerating, roadmapLimitReached, roadmapData, redirectToRoadmapUpgrade]);

    const filteredRoles = jobRoles.filter(role =>
        role.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Generate roadmap when role is selected
    const handleRoleSelect = async (roleTitle: string) => {
        if (await shouldBlockRoadmapCreation(
            'You already have the maximum roadmaps for your current plan. Upgrade your plan or use a quick access pass to create another roadmap.',
        )) {
            return;
        }
        guardAction(async () => {
            const previousStep = step;
            const previousRole = selectedRole;
            const previousRoadmapData = roadmapData;
            const previousRoadmapId = roadmapId;
            const previousTopicName = activeTopicName;
            setSelectedRole(roleTitle);
            setIsGenerating(true);
            setStep('roadmap');

            try {
                const role = jobRoles.find(r => r.title === roleTitle);
                const res = await generateRoadmap(
                    roleTitle,
                    role?.skills || [],
                    []
                );
                await refreshUsage();
                setRoadmapData(res.roadmap_data);
                setRoadmapId(res.id);
                setActiveTopicName(res.topic_name || roleTitle);
                await fetchAllRoadmaps(true);
            } catch (error) {
                const limitInfo = extractLimitExceededError(error);
                if (limitInfo) {
                    setSelectedRole(previousRole);
                    if (previousRoadmapData) {
                        setRoadmapData(previousRoadmapData);
                        setRoadmapId(previousRoadmapId);
                        setActiveTopicName(previousTopicName);
                        setStep('roadmap');
                    } else {
                        const restored = await restoreExistingRoadmap(true);
                        if (!restored) {
                            setStep(previousStep);
                        }
                    }
                    redirectToRoadmapUpgrade({
                        current: limitInfo.current,
                        limit: limitInfo.limit,
                        message: limitInfo.message,
                    });
                } else {
                    console.error('Failed to generate roadmap:', error);
                    window.location.href = '/dashboard';
                }
            } finally {
                setIsGenerating(false);
            }
        });
    };

    // ── Create a new custom roadmap from the modal ─────
    const handleCreateNewRoadmap = async () => {
        if (!newTopic.trim()) return;
        if (await shouldBlockRoadmapCreation(
            'You already have the maximum roadmaps for your current plan. Upgrade your plan or use a quick access pass to create another roadmap.',
        )) {
            return;
        }
        guardAction(async () => {
            const previousStep = step;
            const previousRole = selectedRole;
            const previousRoadmapData = roadmapData;
            const previousRoadmapId = roadmapId;
            const previousTopicName = activeTopicName;
            setShowNewRoadmapModal(false);
            setIsGenerating(true);
            setStep('roadmap');
            setSelectedRole(newTopic.trim());

            try {
                const res = await generateRoadmap(
                    newTopic.trim(),
                    [],
                    [],
                    newTopic.trim(),
                    newDifficulty || undefined
                );
                await refreshUsage();
                setRoadmapData(res.roadmap_data);
                setRoadmapId(res.id);
                setActiveTopicName(res.topic_name || newTopic.trim());
                setSelectedRole(res.target_role);
                await fetchAllRoadmaps(true);
            } catch (error) {
                const limitInfo = extractLimitExceededError(error);
                if (limitInfo) {
                    setSelectedRole(previousRole);
                    if (previousRoadmapData) {
                        setRoadmapData(previousRoadmapData);
                        setRoadmapId(previousRoadmapId);
                        setActiveTopicName(previousTopicName);
                        setStep('roadmap');
                    } else {
                        const restored = await restoreExistingRoadmap(true);
                        if (!restored) {
                            setStep(previousStep);
                        }
                    }
                    redirectToRoadmapUpgrade({
                        current: limitInfo.current,
                        limit: limitInfo.limit,
                        message: limitInfo.message,
                    });
                } else {
                    console.error('Failed to generate custom roadmap:', error);
                }
            } finally {
                setIsGenerating(false);
                setNewTopic('');
                setNewDifficulty('');
            }
        });
    };

    // ── Switch active roadmap ────────────────
    const handleSwitchRoadmap = async (roadmap: RoadmapSummary) => {
        if (roadmap.id === roadmapId) return; // already active
        setIsSwitching(true);
        try {
            const res = await setActiveRoadmap(roadmap.id);
            loadRoadmapIntoView({
                id: res.id,
                target_role: res.target_role,
                topic_name: res.topic_name,
                roadmap_data: res.roadmap_data,
            });
            await fetchAllRoadmaps(true);
        } catch (error) {
            console.error('Failed to switch roadmap:', error);
        } finally {
            setIsSwitching(false);
        }
    };

    // ── Delete a roadmap ────────────────
    const handleDeleteRoadmap = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this roadmap? This cannot be undone.')) return;
        try {
            await deleteRoadmapApi(id);
            await fetchAllRoadmaps(true);
            // If we deleted the active one, reload active
            if (id === roadmapId) {
                const restored = await restoreExistingRoadmap(true);
                if (!restored) {
                    setRoadmapData(null);
                    setRoadmapId(null);
                    setSelectedRole(null);
                    setActiveTopicName(null);
                    setStep('domains');
                }
            }
        } catch (error) {
            console.error('Failed to delete roadmap:', error);
        }
    };

    // Fetch learning resources for a skill
    const handleLearnSkill = async (skill: any, levelName: string) => {
        setSelectedSkillForLearn(skill);
        setLoadingResources(true);
        try {
            const res = await getLearningResources(skill.name, levelName);
            setLearningResources(res.resources || []);
        } catch (e) {
            setLearningResources([]);
        } finally {
            setLoadingResources(false);
        }
    };

    // Navigate to quiz for a skill
    const handleTakeQuiz = (skill: any, levelName: string) => {
        window.location.href = `/quiz?skill_id=${skill.id}&skill_name=${encodeURIComponent(skill.name)}&level=${levelName}&roadmap_id=${roadmapId}`;
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
            case 'unlocked': return <Unlock className="w-5 h-5 text-[#5c52d2]" />;
            case 'locked': return <Lock className="w-5 h-5 text-slate-300" />;
            default: return <Lock className="w-5 h-5 text-slate-300" />;
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'completed': return 'border-emerald-200 bg-emerald-50/50';
            case 'unlocked': return 'border-purple-200 bg-white hover:shadow-xl hover:shadow-purple-100/50 cursor-pointer';
            case 'locked': return 'border-slate-100 bg-slate-50/30 opacity-60';
            default: return 'border-slate-100 bg-slate-50/30 opacity-60';
        }
    };

    const getLevelColor = (name: string) => {
        switch (name) {
            case 'Beginner': return { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', accent: 'from-blue-500 to-cyan-500' };
            case 'Intermediate': return { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', accent: 'from-orange-500 to-amber-500' };
            case 'Advanced': return { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', accent: 'from-rose-500 to-pink-500' };
            default: return { text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', accent: 'from-slate-500 to-gray-500' };
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] font-sans pb-20">
<main className="max-w-7xl mx-auto px-3 sm:px-6 pt-8 sm:pt-16">
                <AnimatePresence mode="wait">
                    {step === 'domains' && (
                        <motion.div
                            key="domains"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-12"
                        >
                            <div className="text-center space-y-6">
                                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto shadow-sm">
                                    <Target className="w-8 h-8 text-rose-500" />
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-3xl sm:text-4xl font-[900] text-slate-900 tracking-tight">Select Your Domain of Interest</h1>
                                    <p className="text-slate-400 text-lg font-medium max-w-2xl mx-auto leading-relaxed">
                                        Choose the industry domain that aligns with your career goals. This helps us provide more targeted job matching and skill recommendations.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
                                {domains.map((domain) => (
                                    <Card
                                        key={domain.id}
                                        onClick={() => {
                                            setSelectedDomain(domain.id);
                                            setStep('roles');
                                        }}
                                        className="group p-8 border-none shadow-sm hover:shadow-xl hover:shadow-indigo-100 transition-all cursor-pointer rounded-[2.5rem] bg-white space-y-6"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 ${domain.bgColor} ${domain.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                                <domain.icon className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-xl font-black text-slate-900">{domain.title}</h3>
                                        </div>
                                        <p className="text-slate-400 font-bold text-sm leading-relaxed">
                                            {domain.desc}
                                        </p>
                                        <div className="space-y-4 pt-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Popular Roles:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {domain.roles.map((role) => (
                                                    <span key={role} className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                        {role}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {step === 'roles' && (
                        <motion.div
                            key="roles"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-12"
                        >
                            <div className="text-center space-y-6">
                                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto shadow-sm">
                                    <Target className="w-8 h-8 text-rose-500" />
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-3xl sm:text-4xl font-[900] text-slate-900 tracking-tight">Select Your Desired Job Role</h1>
                                    <p className="text-slate-400 text-lg font-medium max-w-2xl mx-auto leading-relaxed">
                                        Choose the specific role you're targeting. We'll generate a personalized AI roadmap to help you achieve your career goals.
                                    </p>
                                </div>
                            </div>

                            <div className="max-w-2xl mx-auto relative">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search job roles, skills, or keywords..."
                                    className="h-16 pl-14 pr-6 rounded-[1.25rem] border-slate-100 bg-white shadow-sm focus:ring-rose-500/20 focus:border-rose-500/50 font-medium"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
                                {filteredRoles.map((role) => (
                                    <Card
                                        key={role.id}
                                        onClick={() => handleRoleSelect(role.title)}
                                        className="group p-8 border-none shadow-sm hover:shadow-xl hover:shadow-rose-100 transition-all cursor-pointer rounded-[2.5rem] bg-white space-y-6"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-rose-50 group-hover:text-rose-500 transition-all">
                                                    <role.icon className="w-5 h-5" />
                                                </div>
                                                <h3 className="text-lg font-black text-slate-900">{role.title}</h3>
                                            </div>
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${role.demand === 'High Demand' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                                                }`}>
                                                {role.demand}
                                            </span>
                                        </div>
                                        <p className="text-slate-400 font-bold text-sm leading-relaxed line-clamp-2">
                                            {role.desc}
                                        </p>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-8 text-[11px] font-black text-slate-400">
                                                <div className="flex items-center gap-2">
                                                    <ChevronRight className="w-4 h-4 text-blue-400" />
                                                    {role.exp}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <DollarSign className="w-4 h-4 text-green-400" />
                                                    {role.salary}
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Key Skills Required:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {role.skills.map((skill) => (
                                                        <span key={skill} className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black">
                                                            {skill}
                                                        </span>
                                                    ))}
                                                    <span className="text-[10px] font-black text-slate-300 ml-1">+2 more</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ── NEW: Roadmap View ───────────────────── */}
                    {step === 'roadmap' && (
                        <motion.div
                            key="roadmap"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-12"
                        >
                            {isGenerating ? (
                                <div className="text-center py-32 space-y-8">
                                    <div className="w-24 h-24 bg-white shadow-xl rounded-[3rem] flex items-center justify-center mx-auto ring-8 ring-purple-50">
                                        <Loader2 className="w-12 h-12 text-[#5c52d2] animate-spin" />
                                    </div>
                                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">Generating Your AI Roadmap...</h2>
                                    <p className="text-lg font-medium text-slate-400 max-w-xl mx-auto">
                                        Our AI is creating a personalized learning path for <span className="text-[#5c52d2] font-black">{selectedRole}</span>. This may take a moment.
                                    </p>
                                </div>
                            ) : roadmapData ? (
                                <>
                                    {/* ── LOCKED OVERLAY: Free plan users see upgrade prompt ── */}
                                    {showRoadmapUpgradeGate && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="relative"
                                        >
                                            <Card className="p-0 border-none shadow-2xl rounded-[3rem] overflow-hidden relative">
                                                {/* Gradient Header */}
                                                <div className="relative bg-gradient-to-br from-[#5c52d2] via-[#7c3aed] to-[#a855f7] p-10 pb-14 text-white overflow-hidden">
                                                    <div className="absolute -top-8 -right-8 w-36 h-36 bg-white/10 rounded-full" />
                                                    <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-white/5 rounded-full" />
                                                    <div className="absolute top-6 right-8 w-20 h-20 bg-white/5 rounded-full" />
                                                    <div className="relative z-10 text-center space-y-5">
                                                        <div className="w-20 h-20 bg-white/15 backdrop-blur-md rounded-[2rem] flex items-center justify-center mx-auto border border-white/20 shadow-xl shadow-purple-900/20">
                                                            <Lock className="w-10 h-10" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <h2 className="text-3xl sm:text-4xl font-[900] tracking-tight">Roadmap Locked</h2>
                                                            <p className="text-white/70 text-base font-medium max-w-md mx-auto leading-relaxed">
                                                                AI Learning Roadmaps are a premium feature. Upgrade your plan to generate, view, and interact with personalized career roadmaps.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Feature Highlights */}
                                                <div className="p-8 bg-white space-y-6">
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                        <div className="p-5 rounded-2xl bg-purple-50/80 border border-purple-100 text-center space-y-3">
                                                            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mx-auto">
                                                                <Map className="w-5 h-5 text-purple-600" />
                                                            </div>
                                                            <h4 className="text-sm font-black text-slate-900">AI Roadmaps</h4>
                                                            <p className="text-[11px] font-medium text-slate-400 leading-relaxed">Personalized learning paths for any skill or role</p>
                                                        </div>
                                                        <div className="p-5 rounded-2xl bg-blue-50/80 border border-blue-100 text-center space-y-3">
                                                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mx-auto">
                                                                <Target className="w-5 h-5 text-blue-600" />
                                                            </div>
                                                            <h4 className="text-sm font-black text-slate-900">Skill Quizzes</h4>
                                                            <p className="text-[11px] font-medium text-slate-400 leading-relaxed">Track progress with gated skill assessments</p>
                                                        </div>
                                                        <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-100 text-center space-y-3">
                                                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto">
                                                                <Sparkles className="w-5 h-5 text-emerald-600" />
                                                            </div>
                                                            <h4 className="text-sm font-black text-slate-900">Learn & Grow</h4>
                                                            <p className="text-[11px] font-medium text-slate-400 leading-relaxed">Curated YouTube resources for each skill</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                                                        <Button
                                                            onClick={() => navigate('/plans')}
                                                            className="w-full sm:flex-1 h-14 bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] text-white font-black text-sm rounded-2xl shadow-xl shadow-purple-200/50 hover:shadow-purple-300/70 hover:scale-[1.02] transition-all group"
                                                        >
                                                            <Crown className="w-5 h-5 mr-2" />
                                                            Upgrade to Unlock
                                                            <ArrowUpRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                                        </Button>
                                                        <Button
                                                            onClick={() => openGate()}
                                                            variant="outline"
                                                            className="w-full sm:w-auto h-14 px-8 rounded-2xl border-2 border-slate-200 font-black text-slate-500 text-xs uppercase tracking-widest hover:border-purple-300 hover:text-purple-600 transition-all"
                                                        >
                                                            View Options
                                                        </Button>
                                                    </div>
                                                </div>
                                            </Card>
                                        </motion.div>
                                    )}

                                    {/* ── Unlocked: Show full roadmap content ── */}
                                    {!showRoadmapUpgradeGate && (<>
                                    <div className="text-center space-y-6">
                                        <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto shadow-sm">
                                            <Map className="w-8 h-8 text-[#5c52d2]" />
                                        </div>
                                        <div className="space-y-2">
                                            <h1 className="text-3xl sm:text-4xl font-[900] text-slate-900 tracking-tight">Your AI Learning Roadmap</h1>
                                            <p className="text-slate-400 text-lg font-medium max-w-2xl mx-auto leading-relaxed">
                                                Personalized path to become a <span className="text-[#5c52d2] font-black">{activeTopicName || selectedRole}</span>. Complete skills, pass quizzes, and unlock the next level.
                                            </p>
                                        </div>

                                        {/* ── Action Buttons: Change Target Role + Add Roadmap ── */}
                                        <div className="flex items-center justify-center gap-3 flex-wrap">
                                            <Button
                                                onClick={() => { setStep('domains'); }}
                                                variant="outline"
                                                className="h-12 px-8 rounded-xl border-slate-200 font-black text-slate-500 text-xs uppercase tracking-widest"
                                            >
                                                Change Target Role
                                            </Button>
                                            <Button
                                                id="add-roadmap-btn"
                                                onClick={() => setShowNewRoadmapModal(true)}
                                                className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#5c52d2] to-[#7c3aed] text-white shadow-lg shadow-purple-200/50 hover:shadow-purple-300/60 hover:scale-105 transition-all flex items-center justify-center p-0"
                                                title="Add New Roadmap"
                                            >
                                                <Plus className="w-5 h-5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* ── FEATURE 4: Roadmap Switcher ─────────────── */}
                                    {allRoadmaps.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="relative"
                                        >
                                            <div className="flex items-center gap-2 mb-3">
                                                <Sparkles className="w-4 h-4 text-[#5c52d2]" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Your Roadmaps</span>
                                            </div>
                                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                                {allRoadmaps.map((rm) => (
                                                    <motion.div
                                                        key={rm.id}
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => handleSwitchRoadmap(rm)}
                                                        className={`
                                                            group relative flex-shrink-0 px-5 py-3 rounded-2xl cursor-pointer transition-all border-2
                                                            ${rm.id === roadmapId
                                                                ? 'bg-gradient-to-br from-[#5c52d2] to-[#7c3aed] text-white border-transparent shadow-lg shadow-purple-200/50'
                                                                : 'bg-white border-slate-100 text-slate-600 hover:border-purple-200 hover:shadow-md hover:shadow-purple-50'
                                                            }
                                                        `}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            {rm.id === roadmapId && isSwitching ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : rm.id === roadmapId ? (
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            ) : (
                                                                <Map className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                                                            )}
                                                            <span className="font-black text-xs whitespace-nowrap">{rm.topic_name}</span>
                                                        </div>
                                                        {/* Delete button (not on the active one if it's the only one) */}
                                                        {allRoadmaps.length > 1 && (
                                                            <button
                                                                onClick={(e) => handleDeleteRoadmap(rm.id, e)}
                                                                className={`
                                                                    absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center
                                                                    opacity-0 group-hover:opacity-100 transition-all
                                                                    ${rm.id === roadmapId
                                                                        ? 'bg-white/30 hover:bg-white/50 text-white'
                                                                        : 'bg-red-100 hover:bg-red-200 text-red-500'
                                                                    }
                                                                `}
                                                                title="Delete roadmap"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </motion.div>
                                                ))}

                                                {/* Inline "+" pill to add new roadmap */}
                                                <motion.div
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => setShowNewRoadmapModal(true)}
                                                    className="flex-shrink-0 px-4 py-3 rounded-2xl cursor-pointer bg-slate-50 border-2 border-dashed border-slate-200 text-slate-400 hover:border-purple-300 hover:text-purple-500 hover:bg-purple-50/30 transition-all flex items-center gap-2"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    <span className="font-black text-xs whitespace-nowrap">Add Roadmap</span>
                                                </motion.div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Roadmap Levels */}
                                    <div className="space-y-16">
                                        {roadmapData.levels?.map((level: any, levelIdx: number) => {
                                            const colors = getLevelColor(level.name);
                                            const completedCount = level.skills?.filter((s: any) => s.status === 'completed').length || 0;
                                            const totalCount = level.skills?.length || 0;
                                            const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

                                            return (
                                                <div key={levelIdx} className="space-y-6 cv-auto">
                                                    {/* Level Header */}
                                                    <div className="flex items-center gap-4">
                                                        <div className={`px-6 py-2 rounded-xl bg-gradient-to-r ${colors.accent} text-white text-sm font-black uppercase tracking-widest shadow-lg`}>
                                                            Level {levelIdx + 1}
                                                        </div>
                                                        <h2 className="text-2xl font-[900] text-slate-900 tracking-tight">{level.name}</h2>
                                                        <span className={`ml-auto px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${colors.bg} ${colors.text}`}>
                                                            {completedCount}/{totalCount} completed
                                                        </span>
                                                    </div>
                                                    {/* Level Progress Bar */}
                                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${progressPct}%` }}
                                                            className={`h-full bg-gradient-to-r ${colors.accent} rounded-full`}
                                                        />
                                                    </div>
                                                    {/* Skill Grid */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                                        {level.skills?.map((skill: any, skillIdx: number) => (
                                                            <Card
                                                                key={skill.id}
                                                                className={`p-6 rounded-[2rem] border-2 transition-all cv-auto ${getStatusStyle(skill.status)}`}
                                                            >
                                                                <div className="space-y-4">
                                                                    <div className="flex items-start justify-between">
                                                                        <div className="flex items-center gap-3">
                                                                            {getStatusIcon(skill.status)}
                                                                            <h4 className="font-black text-slate-900 text-sm leading-tight">{skill.name}</h4>
                                                                        </div>
                                                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">
                                                                            ~{skill.estimated_hours}h
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-slate-400 text-xs font-medium leading-relaxed">{skill.description}</p>

                                                                    {skill.status === 'unlocked' && (
                                                                        <div className="flex gap-2 pt-2">
                                                                            <Button
                                                                                onClick={() => handleLearnSkill(skill, level.name)}
                                                                                className="flex-1 h-10 rounded-xl bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 shadow-none"
                                                                            >
                                                                                <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Learn
                                                                            </Button>
                                                                            <Button
                                                                                onClick={() => handleTakeQuiz(skill, level.name)}
                                                                                className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-purple-100"
                                                                            >
                                                                                <Play className="w-3.5 h-3.5 mr-1.5" /> Take Quiz
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                    {skill.status === 'completed' && (
                                                                        <div className="text-center pt-2">
                                                                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">✓ Skill Mastered</span>
                                                                        </div>
                                                                    )}
                                                                    {skill.status === 'locked' && (
                                                                        <div className="text-center pt-2">
                                                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Complete prerequisites to unlock</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </Card>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Learning Resources Modal */}
                                    {selectedSkillForLearn && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-6"
                                        >
                                            <Card className="p-8 rounded-[2.5rem] border-none shadow-xl bg-white/90 backdrop-blur-sm border border-white/20">
                                                <div className="flex items-center justify-between mb-6">
                                                    <div className="flex items-center gap-3">
                                                        <BookOpen className="w-6 h-6 text-[#5c52d2]" />
                                                        <h3 className="text-xl font-[900] text-slate-900">Learn: {selectedSkillForLearn.name}</h3>
                                                    </div>
                                                    <button onClick={() => { setSelectedSkillForLearn(null); setLearningResources([]); }} className="text-slate-400 hover:text-slate-600 font-black text-sm">✕ Close</button>
                                                </div>
                                                {loadingResources ? (
                                                    <div className="text-center py-12">
                                                        <Loader2 className="w-8 h-8 text-[#5c52d2] animate-spin mx-auto mb-4" />
                                                        <p className="text-slate-400 font-bold">Fetching real YouTube videos...</p>
                                                    </div>
                                                ) : learningResources.length > 0 ? (
                                                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                                        {learningResources.map((res: any, idx: number) => (
                                                            <a
                                                                key={idx}
                                                                href={res.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="group rounded-2xl overflow-hidden border-2 border-slate-100 hover:border-purple-300 hover:shadow-xl transition-all block bg-white"
                                                            >
                                                                {/* Thumbnail */}
                                                                <div className="relative w-full aspect-video bg-slate-100 overflow-hidden">
                                                                    {res.thumbnail ? (
                                                                        <img
                                                                            src={res.thumbnail}
                                                                            alt={res.title}
                                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                            loading="lazy"
                                                                            decoding="async"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center bg-slate-200">
                                                                            <Play className="w-10 h-10 text-slate-400" />
                                                                        </div>
                                                                    )}
                                                                    {/* YouTube Play Overlay */}
                                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                                                                        <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-xl">
                                                                            <Play className="w-6 h-6 text-white ml-0.5" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {/* Info */}
                                                                <div className="p-4 space-y-1.5">
                                                                    <h4 className="font-black text-slate-900 text-sm leading-tight line-clamp-2 group-hover:text-[#5c52d2] transition-colors">{res.title}</h4>
                                                                    <p className="text-[11px] font-bold text-slate-400 truncate">{res.channel}</p>
                                                                </div>
                                                            </a>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-10">
                                                        <p className="text-slate-400 font-bold text-lg">No videos available right now</p>
                                                        <p className="text-slate-300 text-sm mt-1">Try again later or search YouTube directly.</p>
                                                    </div>
                                                )}
                                            </Card>
                                        </motion.div>
                                    )}
                                </>)}
                                </>
                            ) : null}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* ═══════════════════════════════════════════════════════════════
                FEATURE 1: Create New Roadmap Modal
               ═══════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {showNewRoadmapModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={() => setShowNewRoadmapModal(false)}
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="relative bg-white rounded-[2.5rem] shadow-2xl shadow-purple-200/30 p-8 w-full max-w-lg space-y-6"
                        >
                            {/* Close X */}
                            <button
                                onClick={() => setShowNewRoadmapModal(false)}
                                className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* Header */}
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-[#5c52d2] to-[#7c3aed] rounded-2xl flex items-center justify-center shadow-lg shadow-purple-200/50">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-[900] text-slate-900 tracking-tight">Create New Learning Roadmap</h2>
                                    <p className="text-slate-400 text-sm font-medium">AI-powered personalized learning path</p>
                                </div>
                            </div>

                            {/* Input */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    Topic / Skill / Role
                                </label>
                                <Input
                                    id="new-roadmap-topic-input"
                                    value={newTopic}
                                    onChange={(e) => setNewTopic(e.target.value)}
                                    placeholder="Enter any skill, tool, topic, or role (e.g. Machine Learning, Docker, Cybersecurity)"
                                    className="h-14 px-5 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-purple-200 focus:border-purple-300 font-medium text-slate-700 placeholder:text-slate-300"
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateNewRoadmap()}
                                />
                            </div>

                            {/* Difficulty dropdown */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    Difficulty Level <span className="text-slate-300">(optional)</span>
                                </label>
                                <div className="relative">
                                    <select
                                        id="new-roadmap-difficulty-select"
                                        value={newDifficulty}
                                        onChange={(e) => setNewDifficulty(e.target.value)}
                                        className="w-full h-12 px-5 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-purple-200 focus:border-purple-300 font-bold text-sm text-slate-600 appearance-none cursor-pointer outline-none transition-all"
                                    >
                                        <option value="">Auto (All Levels)</option>
                                        <option value="Beginner">Beginner</option>
                                        <option value="Intermediate">Intermediate</option>
                                        <option value="Advanced">Advanced</option>
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    onClick={() => { setShowNewRoadmapModal(false); setNewTopic(''); setNewDifficulty(''); }}
                                    variant="outline"
                                    className="flex-1 h-12 rounded-xl border-slate-200 font-black text-slate-500 text-xs uppercase tracking-widest"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    id="generate-roadmap-btn"
                                    onClick={handleCreateNewRoadmap}
                                    disabled={!newTopic.trim()}
                                    className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#5c52d2] to-[#7c3aed] text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-purple-200/50 hover:shadow-purple-300/70 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Generate Roadmap
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Premium Gate Modal */}
            <PremiumGate {...gateProps} />
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
