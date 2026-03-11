import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Search,
    MapPin,
    Briefcase,
    ExternalLink,
    Star,
    Globe,
    Clock,
    ChevronDown,
    Loader2,
    Sparkles,
    RefreshCw,
    GraduationCap,
    Award,
    BookOpen,
    Filter,
    X,
    ArrowRight,
    TrendingUp,
    Zap,
    Calendar,
    Tag,
    ChevronLeft,
    ChevronRight,
    Radar,
    Database,
    Cpu,
    ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    browseOpportunities,
    getFilterOptions,
    getRecommendations,
    discoverOpportunities,
    fetchExternalSources,
    liveSearchOpportunities,
} from '../services/careerPlatform';

// ════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════

interface Opportunity {
    id: string;
    title: string;
    company: string;
    provider: string;
    opportunity_type: string;
    category: string;
    description: string;
    url: string;
    source: string;
    skill_tags: string[];
    level: string;
    location: string;
    salary_range: string;
    deadline: string | null;
    created_at: string;
    match_score?: number;
}

interface FilterOptions {
    locations: string[];
    categories: Record<string, number>;
    top_skills: string[];
}

// ════════════════════════════════════════════════════════════
// CATEGORY CONFIG
// ════════════════════════════════════════════════════════════

const CATEGORIES = [
    { key: 'all', label: 'All', icon: Globe, color: '#5c52d2' },
    { key: 'course', label: 'Courses', icon: BookOpen, color: '#3b82f6' },
    { key: 'internship', label: 'Internships', icon: TrendingUp, color: '#f59e0b' },
    { key: 'certification', label: 'Certifications', icon: Award, color: '#10b981' },
    { key: 'job', label: 'Jobs', icon: Briefcase, color: '#8b5cf6' },
];

const getCategoryIcon = (cat: string) => {
    const found = CATEGORIES.find(c => c.key === cat);
    return found?.icon || Globe;
};

const getCategoryColor = (cat: string) => {
    const found = CATEGORIES.find(c => c.key === cat);
    return found?.color || '#5c52d2';
};

const getCategoryBg = (cat: string) => {
    const colors: Record<string, string> = {
        course: 'bg-blue-50 text-blue-700 border-blue-200',
        internship: 'bg-amber-50 text-amber-700 border-amber-200',
        certification: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        job: 'bg-violet-50 text-violet-700 border-violet-200',
    };
    return colors[cat] || 'bg-slate-50 text-slate-700 border-slate-200';
};

// ════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════

export default function Jobs() {
    // ── State ────────────────────────────────────────────
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [skillFilter, setSkillFilter] = useState('');
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [recommendations, setRecommendations] = useState<Opportunity[]>([]);
    const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRecommending, setIsRecommending] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [hasInitialLoad, setHasInitialLoad] = useState(false);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Live Search State ────────────────────────────────
    const [isLiveSearching, setIsLiveSearching] = useState(false);
    const [liveSearchResults, setLiveSearchResults] = useState<(Opportunity & { _source_type?: string })[]>([]);
    const [liveSearchActive, setLiveSearchActive] = useState(false);
    const [liveSearchQuery, setLiveSearchQuery] = useState('');
    const [liveSearchStats, setLiveSearchStats] = useState<{ db_count: number; ai_count: number } | null>(null);

    // ── Load opportunities ───────────────────────────────
    const loadOpportunities = useCallback(async (resetPage = false) => {
        setIsLoading(true);
        const currentPage = resetPage ? 1 : page;
        if (resetPage) setPage(1);

        try {
            const data = await browseOpportunities({
                category: activeCategory !== 'all' ? activeCategory : undefined,
                skill: skillFilter || undefined,
                location: locationFilter || undefined,
                search: searchQuery || undefined,
                page: currentPage,
                per_page: 18,
            });
            setOpportunities(data.opportunities || []);
            setTotalPages(data.total_pages || 1);
            setTotalCount(data.total || 0);
        } catch (err) {
            console.error('Failed to load opportunities:', err);
            setOpportunities([]);
        } finally {
            setIsLoading(false);
            setHasInitialLoad(true);
        }
    }, [activeCategory, searchQuery, locationFilter, skillFilter, page]);

    // ── Load filter options ──────────────────────────────
    const loadFilterOptions = useCallback(async () => {
        try {
            const data = await getFilterOptions();
            setFilterOptions(data);
        } catch (err) {
            console.error('Failed to load filter options:', err);
        }
    }, []);

    // ── Load AI recommendations ──────────────────────────
    const loadRecommendations = useCallback(async () => {
        setIsRecommending(true);
        try {
            const skills = searchQuery
                ? searchQuery.split(',').map(s => s.trim()).filter(Boolean)
                : ['Python', 'JavaScript', 'React'];
            const data = await getRecommendations(skills, 'Software Engineer', 6);
            setRecommendations(data.opportunities || []);
        } catch (err) {
            console.error('Failed to load recommendations:', err);
        } finally {
            setIsRecommending(false);
        }
    }, [searchQuery]);

    // ── Initial load ─────────────────────────────────────
    useEffect(() => {
        loadOpportunities(true);
        loadFilterOptions();
    }, []);  // eslint-disable-line react-hooks/exhaustive-deps

    // ── Reload on filter change ──────────────────────────
    useEffect(() => {
        if (hasInitialLoad && !liveSearchActive) {
            loadOpportunities(true);
        }
    }, [activeCategory, locationFilter, skillFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Reload on page change ────────────────────────────
    useEffect(() => {
        if (hasInitialLoad && page > 1 && !liveSearchActive) {
            loadOpportunities(false);
        }
    }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Debounced search (only when NOT in live search mode) ─
    useEffect(() => {
        if (!hasInitialLoad || liveSearchActive) return;
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            loadOpportunities(true);
        }, 500);
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Refresh: fetch external + reload ─────────────────
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetchExternalSources();
            await loadOpportunities(true);
            await loadFilterOptions();
        } catch (err) {
            console.error('Refresh failed:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    // ── AI Discover ──────────────────────────────────────
    const handleAIDiscover = async () => {
        setIsRecommending(true);
        try {
            const skills = searchQuery
                ? searchQuery.split(',').map(s => s.trim()).filter(Boolean)
                : ['Python', 'JavaScript', 'React'];
            const data = await discoverOpportunities('Software Engineer', skills);
            if (data.opportunities?.length) {
                setRecommendations(data.opportunities);
            }
            // Also reload main grid
            await loadOpportunities(true);
        } catch (err) {
            console.error('AI discover failed:', err);
        } finally {
            setIsRecommending(false);
        }
    };

    // ── LIVE SEARCH ──────────────────────────────────────
    const handleLiveSearch = async () => {
        const query = searchQuery.trim();
        if (!query || query.length < 2) return;

        setIsLiveSearching(true);
        setLiveSearchActive(true);
        setLiveSearchQuery(query);
        setLiveSearchResults([]);
        setLiveSearchStats(null);

        try {
            const data = await liveSearchOpportunities(
                query,
                activeCategory !== 'all' ? activeCategory : undefined
            );
            setLiveSearchResults(data.opportunities || []);
            setLiveSearchStats({
                db_count: data.db_count || 0,
                ai_count: data.ai_count || 0,
            });
        } catch (err) {
            console.error('Live search failed:', err);
            setLiveSearchResults([]);
        } finally {
            setIsLiveSearching(false);
        }
    };

    const exitLiveSearch = () => {
        setLiveSearchActive(false);
        setLiveSearchResults([]);
        setLiveSearchQuery('');
        setLiveSearchStats(null);
        loadOpportunities(true);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && searchQuery.trim().length >= 2) {
            handleLiveSearch();
        }
    };

    // ── Open opportunity ─────────────────────────────────
    const handleOpen = (opp: Opportunity) => {
        if (opp.url) {
            window.open(opp.url, '_blank', 'noopener,noreferrer');
        }
    };

    const clearFilters = () => {
        setSearchQuery('');
        setLocationFilter('');
        setSkillFilter('');
        setActiveCategory('all');
        if (liveSearchActive) exitLiveSearch();
    };

    const hasActiveFilters = searchQuery || locationFilter || skillFilter || activeCategory !== 'all';

    // ════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════

    return (
        <div className="min-h-screen font-sans pb-20 relative overflow-hidden bg-slate-50 dark:bg-[#050510]">
<main className="max-w-[1400px] mx-auto px-3 sm:px-4 md:px-6 pt-4 sm:pt-6">

                    {/* ── Header ───────────────────────────────────── */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                        <div className="space-y-1">
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-[900] text-slate-900 tracking-tight flex items-center gap-2 sm:gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5c52d2] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-purple-200">
                                    <Zap className="w-5 h-5 text-white" />
                                </div>
                                Opportunity Portal
                            </h1>
                            <p className="text-slate-500 font-medium text-sm sm:text-base">
                                Discover courses, internships, certifications, & jobs — powered by AI
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                variant="outline"
                                className="h-10 px-4 rounded-xl border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider hover:border-[#5c52d2] hover:text-[#5c52d2] transition-all"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                                Refresh Sources
                            </Button>
                            <Button
                                onClick={handleAIDiscover}
                                disabled={isRecommending}
                                className="h-9 sm:h-10 px-3 sm:px-5 rounded-xl bg-gradient-to-r from-[#5c52d2] to-[#8b5cf6] text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-lg shadow-purple-200/50 hover:shadow-purple-300/50 transition-all"
                            >
                                <Sparkles className={`w-3.5 h-3.5 mr-2 ${isRecommending ? 'animate-pulse' : ''}`} />
                                AI Discover
                            </Button>
                        </div>
                    </div>

                    {/* ── Search + Filter Bar ─────────────────────── */}
                    <Card className="p-3 sm:p-4 md:p-6 rounded-2xl border border-white/30 bg-white/80 backdrop-blur-md shadow-xl shadow-slate-100/50 mb-4 sm:mb-6">
                        {/* Main Search Row */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    placeholder="Search for jobs, courses, internships, certifications... (e.g. 'React Developer', 'AWS Cloud', 'Data Science')"
                                    className="h-13 pl-11 pr-4 rounded-xl border-slate-100 bg-slate-50/50 font-medium focus:bg-white focus:border-[#5c52d2] focus:ring-2 focus:ring-purple-100 transition-all text-sm"
                                />
                            </div>
                            <Button
                                onClick={handleLiveSearch}
                                disabled={isLiveSearching || searchQuery.trim().length < 2}
                                className="h-13 px-7 rounded-xl bg-gradient-to-r from-[#5c52d2] via-[#7c3aed] to-[#8b5cf6] text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-purple-200/50 hover:shadow-purple-300/70 hover:scale-[1.02] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                            >
                                {isLiveSearching ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Searching...
                                    </>
                                ) : (
                                    <>
                                        <Radar className="w-4 h-4" />
                                        Search Market
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Hint text */}
                        {!liveSearchActive && (
                            <p className="text-[11px] text-slate-400 font-medium mb-4 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-purple-400" />
                                Hit <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-bold border border-slate-200">Enter</kbd> or click <strong>Search Market</strong> to find live opportunities from all platforms via AI
                            </p>
                        )}

                        {/* Filter Row */}
                        <div className="flex flex-col lg:flex-row gap-3">
                            {/* Location */}
                            <div className="relative w-full lg:w-52">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none z-10" />
                                <select
                                    value={locationFilter}
                                    onChange={(e) => setLocationFilter(e.target.value)}
                                    className="w-full h-11 pl-9 pr-10 rounded-xl border border-slate-100 bg-slate-50/50 font-medium appearance-none focus:border-[#5c52d2] outline-none transition-all text-sm text-slate-700"
                                >
                                    <option value="">All Locations</option>
                                    <option value="Remote">Remote</option>
                                    {filterOptions?.locations.map(loc => (
                                        <option key={loc} value={loc}>{loc}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>

                            {/* Skill Filter Dropdown */}
                            <div className="relative w-full lg:w-52">
                                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none z-10" />
                                <select
                                    value={skillFilter}
                                    onChange={(e) => setSkillFilter(e.target.value)}
                                    className="w-full h-11 pl-9 pr-10 rounded-xl border border-slate-100 bg-slate-50/50 font-medium appearance-none focus:border-[#5c52d2] outline-none transition-all text-sm text-slate-700"
                                >
                                    <option value="">All Skills</option>
                                    {filterOptions?.top_skills.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>

                            <div className="flex-1" />

                            {/* Filter toggle + Clear */}
                            {hasActiveFilters && (
                                <Button
                                    onClick={clearFilters}
                                    variant="ghost"
                                    className="h-11 px-4 text-sm text-slate-400 hover:text-red-500 font-bold"
                                >
                                    <X className="w-4 h-4 mr-1" /> Clear All
                                </Button>
                            )}
                        </div>
                    </Card>

                    {/* ── Category Tabs ────────────────────────────── */}
                    <div className="flex items-center gap-2 mb-6 sm:mb-8 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
                        {CATEGORIES.map(cat => {
                            const isActive = activeCategory === cat.key;
                            const count = cat.key === 'all'
                                ? totalCount
                                : filterOptions?.categories[cat.key] || 0;
                            return (
                                <motion.button
                                    key={cat.key}
                                    onClick={() => setActiveCategory(cat.key)}
                                    className={`
                                        flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all border
                                        ${isActive
                                            ? 'bg-white text-slate-800 border-slate-200 shadow-lg shadow-slate-200/50'
                                            : 'bg-transparent text-slate-500 border-transparent hover:bg-white/60 hover:border-slate-100'
                                        }
                                    `}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <cat.icon className="w-4 h-4" style={{ color: isActive ? cat.color : undefined }} />
                                    {cat.label}
                                    {typeof count === 'number' && count > 0 && (
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isActive ? 'bg-slate-100 text-slate-600' : 'bg-slate-100/50 text-slate-400'}`}>
                                            {count}
                                        </span>
                                    )}
                                </motion.button>
                            );
                        })}
                    </div>

                    {/* ── AI Recommendations Section ──────────────── */}
                    <AnimatePresence>
                        {recommendations.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-10"
                            >
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                                        <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                    <h2 className="text-xl font-[900] text-slate-800">AI Recommendations</h2>
                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                                        Personalized
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {recommendations.slice(0, 6).map((opp, i) => (
                                        <motion.div
                                            key={opp.id || i}
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.06 }}
                                        >
                                            <OpportunityCard opp={opp} onOpen={handleOpen} isRecommendation />
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ════════════════════════════════════════════════ */}
                    {/* ── LIVE SEARCH RESULTS MODE ─────────────────── */}
                    {/* ════════════════════════════════════════════════ */}
                    <AnimatePresence mode="wait">
                        {liveSearchActive && (
                            <motion.div
                                key="live-search-results"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                {/* Live Search Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <div className="flex items-center gap-3">
                                        <Button
                                            onClick={exitLiveSearch}
                                            variant="ghost"
                                            className="h-9 w-9 p-0 rounded-lg hover:bg-slate-100"
                                        >
                                            <ArrowLeft className="w-4 h-4 text-slate-500" />
                                        </Button>
                                        <div>
                                            <h2 className="text-xl sm:text-2xl font-[900] text-slate-800 flex items-center gap-2">
                                                <Radar className="w-6 h-6 text-[#5c52d2]" />
                                                Live Search Results
                                            </h2>
                                            <p className="text-sm text-slate-400 font-medium mt-0.5">
                                                Showing results for "<span className="text-[#5c52d2] font-bold">{liveSearchQuery}</span>"
                                            </p>
                                        </div>
                                    </div>

                                    {/* Search stats badges */}
                                    {liveSearchStats && !isLiveSearching && (
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
                                                <Database className="w-3.5 h-3.5 text-blue-500" />
                                                <span className="text-[11px] font-black text-blue-600 uppercase tracking-wider">
                                                    {liveSearchStats.db_count} from database
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-full">
                                                <Cpu className="w-3.5 h-3.5 text-purple-500" />
                                                <span className="text-[11px] font-black text-purple-600 uppercase tracking-wider">
                                                    {liveSearchStats.ai_count} AI-discovered
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Live Search Loading State */}
                                {isLiveSearching && (
                                    <div className="flex items-center justify-center py-24">
                                        <div className="text-center space-y-6">
                                            {/* Animated radar */}
                                            <div className="relative w-20 h-20 mx-auto">
                                                <div className="absolute inset-0 rounded-full border-2 border-purple-200 animate-ping" style={{ animationDuration: '1.5s' }} />
                                                <div className="absolute inset-2 rounded-full border-2 border-purple-300 animate-ping" style={{ animationDuration: '2s' }} />
                                                <div className="absolute inset-4 rounded-full border-2 border-purple-400 animate-ping" style={{ animationDuration: '2.5s' }} />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <Radar className="w-8 h-8 text-[#5c52d2] animate-pulse" />
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-[800] text-slate-700 mb-1">
                                                    Scanning the market for "{liveSearchQuery}"
                                                </h3>
                                                <p className="text-slate-400 text-sm font-medium">
                                                    Searching databases & generating AI-curated results from all platforms...
                                                </p>
                                            </div>
                                            {/* Progress steps */}
                                            <div className="flex items-center justify-center gap-6 text-xs font-bold text-slate-400">
                                                <div className="flex items-center gap-1.5">
                                                    <Database className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                                                    Checking database
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Cpu className="w-3.5 h-3.5 text-purple-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
                                                    AI scanning platforms
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" style={{ animationDelay: '1s' }} />
                                                    Curating results
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Live Search Results Grid */}
                                {!isLiveSearching && liveSearchResults.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                        {liveSearchResults.map((opp, i) => (
                                            <motion.div
                                                key={opp.id || `live-${i}`}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                            >
                                                <OpportunityCard
                                                    opp={opp}
                                                    onOpen={handleOpen}
                                                    sourceType={opp._source_type}
                                                />
                                            </motion.div>
                                        ))}
                                    </div>
                                )}

                                {/* Live Search Empty State */}
                                {!isLiveSearching && liveSearchResults.length === 0 && (
                                    <div className="flex items-center justify-center py-24">
                                        <div className="text-center space-y-4 max-w-md">
                                            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
                                                <Search className="w-7 h-7 text-slate-300" />
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-700">No results found</h3>
                                            <p className="text-slate-400 text-sm">
                                                Try a different search term or broaden your query.
                                            </p>
                                            <Button
                                                onClick={exitLiveSearch}
                                                variant="outline"
                                                className="h-11 px-6 rounded-xl border-slate-200 font-bold text-sm"
                                            >
                                                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Browse
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ════════════════════════════════════════════════ */}
                    {/* ── REGULAR BROWSE MODE ──────────────────────── */}
                    {/* ════════════════════════════════════════════════ */}
                    {!liveSearchActive && (
                        <>
                    {/* ── Results Header ───────────────────────────── */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl sm:text-2xl font-[900] text-slate-800">
                                {isLoading ? 'Loading...' : `${totalCount} Opportunities`}
                            </h2>
                            {hasActiveFilters && (
                                <span className="text-[10px] font-black text-[#5c52d2] uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                                    Filtered
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ── Loading State ────────────────────────────── */}
                    {isLoading && (
                        <div className="flex items-center justify-center py-24">
                            <div className="text-center space-y-4">
                                <Loader2 className="w-10 h-10 text-[#5c52d2] animate-spin mx-auto" />
                                <p className="text-slate-400 font-bold text-sm">Searching opportunities...</p>
                            </div>
                        </div>
                    )}

                    {/* ── Empty State ──────────────────────────────── */}
                    {!isLoading && opportunities.length === 0 && hasInitialLoad && (
                        <div className="flex items-center justify-center py-24">
                            <div className="text-center space-y-4 max-w-md">
                                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
                                    <Search className="w-7 h-7 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-700">No opportunities found</h3>
                                <p className="text-slate-400 text-sm">
                                    Try searching for something like "React Developer" or "Data Science" and click <strong>Search Market</strong> to discover live opportunities.
                                </p>
                                <Button
                                    onClick={handleAIDiscover}
                                    className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#5c52d2] to-[#8b5cf6] text-white font-bold text-sm"
                                >
                                    <Sparkles className="w-4 h-4 mr-2" /> AI Discover
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── Opportunities Grid ──────────────────────── */}
                    {!isLoading && opportunities.length > 0 && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {opportunities.map((opp, i) => (
                                    <motion.div
                                        key={opp.id || i}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.04 }}
                                    >
                                        <OpportunityCard opp={opp} onOpen={handleOpen} />
                                    </motion.div>
                                ))}
                            </div>

                            {/* ── Pagination ─────────────────────────── */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-3 mt-10">
                                    <Button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page <= 1}
                                        variant="outline"
                                        className="h-10 px-4 rounded-xl border-slate-200 text-slate-400 font-bold text-xs disabled:opacity-30"
                                    >
                                        <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                                    </Button>
                                    <span className="text-sm font-bold text-slate-500">
                                        Page {page} of {totalPages}
                                    </span>
                                    <Button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page >= totalPages}
                                        variant="outline"
                                        className="h-10 px-4 rounded-xl border-slate-200 text-slate-400 font-bold text-xs disabled:opacity-30"
                                    >
                                        Next <ChevronRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                        </>
                    )}
                </main>        </div>
    );
}


// ════════════════════════════════════════════════════════════
// OPPORTUNITY CARD COMPONENT
// ════════════════════════════════════════════════════════════

function OpportunityCard({
    opp,
    onOpen,
    isRecommendation = false,
    sourceType,
}: {
    opp: Opportunity;
    onOpen: (opp: Opportunity) => void;
    isRecommendation?: boolean;
    sourceType?: string;
}) {
    const category = opp.category || opp.opportunity_type || 'job';
    const CatIcon = getCategoryIcon(category);
    const catColor = getCategoryColor(category);

    const formatDeadline = (d: string | null) => {
        if (!d) return null;
        try {
            const date = new Date(d);
            const now = new Date();
            const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return 'Expired';
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Tomorrow';
            if (diffDays <= 7) return `${diffDays} days left`;
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch {
            return null;
        }
    };

    const deadline = formatDeadline(opp.deadline);

    return (
        <Card className={`
            group relative flex flex-col h-full overflow-hidden rounded-2xl transition-all duration-300
            bg-white/90 backdrop-blur-sm border hover:shadow-xl
            ${isRecommendation
                ? 'border-amber-200/60 hover:border-amber-300 shadow-md shadow-amber-50'
                : 'border-white/30 hover:border-slate-200 shadow-lg shadow-slate-100/40'
            }
            hover:scale-[1.01] hover:-translate-y-0.5
        `}>
            {/* Category badge + Recommendation star */}
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getCategoryBg(category)}`}>
                    <CatIcon className="w-3 h-3" />
                    {category}
                </div>
                {isRecommendation && (
                    <div className="flex items-center gap-1 text-amber-500">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span className="text-[10px] font-black uppercase tracking-wider">AI Pick</span>
                    </div>
                )}
                {sourceType === 'ai_generated' && !isRecommendation && (
                    <div className="flex items-center gap-1 text-purple-500">
                        <Cpu className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-wider">AI Found</span>
                    </div>
                )}
                {sourceType === 'database' && !isRecommendation && (
                    <div className="flex items-center gap-1 text-blue-500">
                        <Database className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Verified</span>
                    </div>
                )}
                {opp.match_score && opp.match_score > 0 && !isRecommendation && !sourceType && (
                    <div className="flex items-center gap-1 text-emerald-500">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black">{opp.match_score}% match</span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="px-5 pb-5 flex flex-col flex-1">
                {/* Title */}
                <h3 className="text-base font-[800] text-slate-800 leading-snug mb-2 line-clamp-2 group-hover:text-[#5c52d2] transition-colors">
                    {opp.title}
                </h3>

                {/* Provider + Source */}
                <div className="flex items-center gap-2 mb-3 text-xs text-slate-400 font-semibold">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-black" style={{ backgroundColor: catColor }}>
                        {(opp.provider || opp.company || '?')[0]?.toUpperCase()}
                    </div>
                    <span className="truncate max-w-[140px]">{opp.provider || opp.company || 'Unknown'}</span>
                    {opp.source && (
                        <>
                            <span className="opacity-30">•</span>
                            <Globe className="w-3 h-3 text-slate-300" />
                            <span className="truncate max-w-[80px]">{opp.source}</span>
                        </>
                    )}
                </div>

                {/* Description */}
                <p className="text-slate-500 text-xs font-medium leading-relaxed mb-4 line-clamp-2 flex-grow">
                    {opp.description || 'Click to view details on the original platform.'}
                </p>

                {/* Skills */}
                {opp.skill_tags && opp.skill_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {opp.skill_tags.slice(0, 4).map(skill => (
                            <span
                                key={skill}
                                className="px-2.5 py-0.5 bg-slate-50 text-slate-500 rounded-md text-[10px] font-bold border border-slate-100"
                            >
                                {skill}
                            </span>
                        ))}
                        {opp.skill_tags.length > 4 && (
                            <span className="px-2 py-0.5 text-slate-400 text-[10px] font-bold">
                                +{opp.skill_tags.length - 4}
                            </span>
                        )}
                    </div>
                )}

                {/* Meta row */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                    {opp.location && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                            <MapPin className="w-3 h-3 text-[#5c52d2]" />
                            {opp.location}
                        </div>
                    )}
                    {deadline && (
                        <div className={`flex items-center gap-1 text-[10px] font-bold ${deadline === 'Expired' ? 'text-red-400' : 'text-slate-400'}`}>
                            <Calendar className="w-3 h-3" />
                            {deadline}
                        </div>
                    )}
                    {opp.salary_range && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                            <span>{opp.salary_range}</span>
                        </div>
                    )}
                </div>

                {/* CTA */}
                <Button
                    onClick={() => onOpen(opp)}
                    className="w-full h-10 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all group/btn shadow-md"
                    style={{ background: `linear-gradient(135deg, ${catColor}, ${catColor}dd)` }}
                >
                    <span className="flex items-center gap-2">
                        {category === 'course' ? 'Enroll Now' :
                            category === 'certification' ? 'Get Certified' :
                                category === 'internship' ? 'Apply Now' : 'Apply Now'}
                        <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover/btn:translate-x-0.5 transition-transform" />
                    </span>
                </Button>
            </div>
        </Card>
    );
}
