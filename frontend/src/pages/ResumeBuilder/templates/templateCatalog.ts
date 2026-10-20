/**
 * Template Catalog — 50+ resume template variations
 * Each entry maps to a base template engine with unique styling.
 * Templates are grouped by category for the marketplace UI.
 */

export type BaseTemplate =
    | 'modern' | 'classic' | 'creative' | 'developer'
    | 'minimal-ats' | 'academic' | 'executive' | 'two-column' | 'portfolio'
    | 'compact' | 'timeline' | 'elegant' | 'bold-header' | 'infographic' | 'corporate' | 'fresh';

export type TemplateCategory =
    | 'ATS / Recruiter'
    | 'Student / Academic'
    | 'Software / Tech'
    | 'Creative / Designer'
    | 'Executive / Management'
    | 'Portfolio / Visual'
    | 'Minimal / One-page';

export type LayoutType = 'single-column' | 'two-column' | 'visual';
export type ATSPriority = 'high' | 'medium' | 'low';

export interface CatalogTemplate {
    template_id: string;
    name: string;
    category: TemplateCategory;
    base: BaseTemplate;
    layout_type: LayoutType;
    ats_priority: ATSPriority;
    recommended_for_roles: string[];
    default_color: string;
}

export const TEMPLATE_CATALOG: CatalogTemplate[] = [
    // ═════════════════════════════════════
    // ATS / Recruiter  (8)
    // ═════════════════════════════════════
    { template_id: 'ats-clean', name: 'ATS Clean', category: 'ATS / Recruiter', base: 'minimal-ats', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Any', 'Corporate', 'Finance'], default_color: '#111827' },
    { template_id: 'ats-modern', name: 'ATS Modern', category: 'ATS / Recruiter', base: 'modern', layout_type: 'two-column', ats_priority: 'high', recommended_for_roles: ['Any', 'Tech', 'Marketing'], default_color: '#3b82f6' },
    { template_id: 'ats-classic', name: 'ATS Classic', category: 'ATS / Recruiter', base: 'classic', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Legal', 'Banking', 'Consulting'], default_color: '#1f2937' },
    { template_id: 'ats-sharp', name: 'ATS Sharp', category: 'ATS / Recruiter', base: 'minimal-ats', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Engineering', 'Operations'], default_color: '#334155' },
    { template_id: 'ats-professional', name: 'ATS Professional', category: 'ATS / Recruiter', base: 'corporate', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['HR', 'Admin', 'Corporate'], default_color: '#1e3a5f' },
    { template_id: 'ats-compact', name: 'ATS Compact', category: 'ATS / Recruiter', base: 'compact', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Fresh Graduate', 'Entry Level'], default_color: '#374151' },
    { template_id: 'ats-blue', name: 'ATS Blue', category: 'ATS / Recruiter', base: 'minimal-ats', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Healthcare', 'Pharma'], default_color: '#1d4ed8' },
    { template_id: 'ats-standard', name: 'ATS Standard', category: 'ATS / Recruiter', base: 'classic', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Government', 'Public Sector'], default_color: '#0f172a' },

    // ═════════════════════════════════════
    // Student / Academic  (8)
    // ═════════════════════════════════════
    { template_id: 'student-classic', name: 'Student Classic', category: 'Student / Academic', base: 'academic', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Student', 'Fresh Graduate'], default_color: '#1e40af' },
    { template_id: 'student-modern', name: 'Student Modern', category: 'Student / Academic', base: 'fresh', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Student', 'Intern'], default_color: '#06b6d4' },
    { template_id: 'student-compact', name: 'Student Compact', category: 'Student / Academic', base: 'compact', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Student', 'Entry Level'], default_color: '#4b5563' },
    { template_id: 'student-academic', name: 'Academic Serif', category: 'Student / Academic', base: 'academic', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Research', 'PhD', 'Academic'], default_color: '#7c3aed' },
    { template_id: 'student-fresh', name: 'Fresh Start', category: 'Student / Academic', base: 'fresh', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Student', 'First Job'], default_color: '#10b981' },
    { template_id: 'student-timeline', name: 'Academic Timeline', category: 'Student / Academic', base: 'timeline', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Student', 'Intern'], default_color: '#6366f1' },
    { template_id: 'student-minimal', name: 'Student Minimal', category: 'Student / Academic', base: 'minimal-ats', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Student', 'Entry Level'], default_color: '#0f172a' },
    { template_id: 'student-elegant', name: 'Student Elegant', category: 'Student / Academic', base: 'elegant', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Liberal Arts', 'Humanities'], default_color: '#78716c' },

    // ═════════════════════════════════════
    // Software / Tech  (8)
    // ═════════════════════════════════════
    { template_id: 'tech-developer', name: 'Developer Terminal', category: 'Software / Tech', base: 'developer', layout_type: 'single-column', ats_priority: 'low', recommended_for_roles: ['Developer', 'Engineer', 'DevOps'], default_color: '#10b981' },
    { template_id: 'tech-modern', name: 'Tech Modern', category: 'Software / Tech', base: 'modern', layout_type: 'two-column', ats_priority: 'high', recommended_for_roles: ['Software Engineer', 'Tech Lead'], default_color: '#3b82f6' },
    { template_id: 'tech-infographic', name: 'Tech Infographic', category: 'Software / Tech', base: 'infographic', layout_type: 'two-column', ats_priority: 'medium', recommended_for_roles: ['Full Stack', 'Data Scientist'], default_color: '#0891b2' },
    { template_id: 'tech-two-column', name: 'Tech Two-Column', category: 'Software / Tech', base: 'two-column', layout_type: 'two-column', ats_priority: 'medium', recommended_for_roles: ['Backend', 'Frontend', 'Mobile'], default_color: '#2563eb' },
    { template_id: 'tech-bold', name: 'Tech Bold', category: 'Software / Tech', base: 'bold-header', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Tech Lead', 'CTO', 'Architect'], default_color: '#dc2626' },
    { template_id: 'tech-minimal', name: 'Tech Minimal', category: 'Software / Tech', base: 'minimal-ats', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Engineer', 'QA', 'SRE'], default_color: '#0f172a' },
    { template_id: 'tech-fresh', name: 'Tech Fresh', category: 'Software / Tech', base: 'fresh', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Junior Dev', 'Bootcamp Grad'], default_color: '#8b5cf6' },
    { template_id: 'tech-timeline', name: 'Tech Timeline', category: 'Software / Tech', base: 'timeline', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Developer', 'Engineer'], default_color: '#4f46e5' },

    // ═════════════════════════════════════
    // Creative / Designer  (7)
    // ═════════════════════════════════════
    { template_id: 'creative-colorful', name: 'Creative Colorful', category: 'Creative / Designer', base: 'creative', layout_type: 'two-column', ats_priority: 'medium', recommended_for_roles: ['Designer', 'Artist', 'Illustrator'], default_color: '#e11d48' },
    { template_id: 'creative-portfolio', name: 'Creative Portfolio', category: 'Creative / Designer', base: 'portfolio', layout_type: 'visual', ats_priority: 'low', recommended_for_roles: ['UI/UX', 'Graphic Designer'], default_color: '#8b5cf6' },
    { template_id: 'creative-bold', name: 'Creative Bold', category: 'Creative / Designer', base: 'bold-header', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Art Director', 'Creative Director'], default_color: '#f43f5e' },
    { template_id: 'creative-modern', name: 'Creative Modern', category: 'Creative / Designer', base: 'modern', layout_type: 'two-column', ats_priority: 'medium', recommended_for_roles: ['Content Creator', 'Brand Manager'], default_color: '#d946ef' },
    { template_id: 'creative-timeline', name: 'Creative Timeline', category: 'Creative / Designer', base: 'timeline', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Filmmaker', 'Photographer'], default_color: '#f97316' },
    { template_id: 'creative-infographic', name: 'Creative Visual', category: 'Creative / Designer', base: 'infographic', layout_type: 'two-column', ats_priority: 'low', recommended_for_roles: ['UX Researcher', 'Product Designer'], default_color: '#ec4899' },
    { template_id: 'creative-elegant', name: 'Creative Elegant', category: 'Creative / Designer', base: 'elegant', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Writer', 'Editor', 'Copywriter'], default_color: '#a3a3a3' },

    // ═════════════════════════════════════
    // Executive / Management  (7)
    // ═════════════════════════════════════
    { template_id: 'exec-dark', name: 'Executive Dark', category: 'Executive / Management', base: 'executive', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['CEO', 'VP', 'Director'], default_color: '#0f172a' },
    { template_id: 'exec-navy', name: 'Executive Navy', category: 'Executive / Management', base: 'executive', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['CFO', 'COO', 'SVP'], default_color: '#1e3a5f' },
    { template_id: 'exec-corporate', name: 'Executive Corporate', category: 'Executive / Management', base: 'corporate', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Manager', 'Senior Manager'], default_color: '#1e3a5f' },
    { template_id: 'exec-modern', name: 'Executive Modern', category: 'Executive / Management', base: 'modern', layout_type: 'two-column', ats_priority: 'high', recommended_for_roles: ['Director', 'VP of Engineering'], default_color: '#0f172a' },
    { template_id: 'exec-elegant', name: 'Executive Elegant', category: 'Executive / Management', base: 'elegant', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Partner', 'Managing Director'], default_color: '#44403c' },
    { template_id: 'exec-bold', name: 'Executive Bold', category: 'Executive / Management', base: 'bold-header', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['CTO', 'CPO', 'Head of Dept'], default_color: '#0f172a' },
    { template_id: 'exec-two-column', name: 'Executive Two-Col', category: 'Executive / Management', base: 'two-column', layout_type: 'two-column', ats_priority: 'medium', recommended_for_roles: ['GM', 'VP', 'SVP'], default_color: '#1e293b' },

    // ═════════════════════════════════════
    // Portfolio / Visual  (7)
    // ═════════════════════════════════════
    { template_id: 'portfolio-visual', name: 'Portfolio Hero', category: 'Portfolio / Visual', base: 'portfolio', layout_type: 'visual', ats_priority: 'low', recommended_for_roles: ['Designer', 'Creative Dir'], default_color: '#8b5cf6' },
    { template_id: 'portfolio-rose', name: 'Portfolio Rose', category: 'Portfolio / Visual', base: 'portfolio', layout_type: 'visual', ats_priority: 'low', recommended_for_roles: ['Photographer', 'Artist'], default_color: '#e11d48' },
    { template_id: 'portfolio-infographic', name: 'Portfolio Infographic', category: 'Portfolio / Visual', base: 'infographic', layout_type: 'two-column', ats_priority: 'low', recommended_for_roles: ['Data Viz', 'Analyst'], default_color: '#0d9488' },
    { template_id: 'portfolio-bold', name: 'Portfolio Bold', category: 'Portfolio / Visual', base: 'bold-header', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Brand Strategist'], default_color: '#ea580c' },
    { template_id: 'portfolio-timeline', name: 'Portfolio Timeline', category: 'Portfolio / Visual', base: 'timeline', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Freelancer', 'Consultant'], default_color: '#a855f7' },
    { template_id: 'portfolio-fresh', name: 'Portfolio Fresh', category: 'Portfolio / Visual', base: 'fresh', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Content Creator', 'Marketer'], default_color: '#06b6d4' },
    { template_id: 'portfolio-creative', name: 'Portfolio Creative', category: 'Portfolio / Visual', base: 'creative', layout_type: 'two-column', ats_priority: 'low', recommended_for_roles: ['UI Designer', 'Motion Designer'], default_color: '#f43f5e' },

    // ═════════════════════════════════════
    // Minimal / One-page  (7)
    // ═════════════════════════════════════
    { template_id: 'min-clean', name: 'Minimal Clean', category: 'Minimal / One-page', base: 'minimal-ats', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Any Role'], default_color: '#111827' },
    { template_id: 'min-compact', name: 'Minimal Compact', category: 'Minimal / One-page', base: 'compact', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Experienced Pro'], default_color: '#334155' },
    { template_id: 'min-elegant', name: 'Minimal Elegant', category: 'Minimal / One-page', base: 'elegant', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Writer', 'Professor'], default_color: '#78716c' },
    { template_id: 'min-modern', name: 'Minimal Modern', category: 'Minimal / One-page', base: 'modern', layout_type: 'two-column', ats_priority: 'high', recommended_for_roles: ['Any Role'], default_color: '#64748b' },
    { template_id: 'min-fresh', name: 'Minimal Fresh', category: 'Minimal / One-page', base: 'fresh', layout_type: 'single-column', ats_priority: 'medium', recommended_for_roles: ['Startup', 'Tech'], default_color: '#0ea5e9' },
    { template_id: 'min-classic', name: 'Minimal Classic', category: 'Minimal / One-page', base: 'classic', layout_type: 'single-column', ats_priority: 'high', recommended_for_roles: ['Traditional', 'Corporate'], default_color: '#1f2937' },
    { template_id: 'min-two-col', name: 'Minimal Two-Col', category: 'Minimal / One-page', base: 'two-column', layout_type: 'two-column', ats_priority: 'medium', recommended_for_roles: ['Balanced Layout'], default_color: '#475569' },
];

const BASE_TEMPLATES: readonly BaseTemplate[] = [
    'modern', 'classic', 'creative', 'developer',
    'minimal-ats', 'academic', 'executive', 'two-column', 'portfolio',
    'compact', 'timeline', 'elegant', 'bold-header', 'infographic', 'corporate', 'fresh',
];

/**
 * Resolve a stored `template_id` to the base engine that renders it.
 *
 * Saved resumes store the catalog id (for example `ats-modern`), while older
 * records may contain the base engine name (`modern`). Both forms are accepted
 * so profile previews and downloads keep using the same layout as the editor.
 */
export function resolveBaseTemplate(templateId: string | null | undefined): BaseTemplate {
    if (!templateId) return 'modern';
    const catalog = TEMPLATE_CATALOG.find(template => template.template_id === templateId);
    if (catalog) return catalog.base;
    if ((BASE_TEMPLATES as readonly string[]).includes(templateId)) {
        return templateId as BaseTemplate;
    }
    return 'modern';
}

/** All available categories, ordered */
export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
    'ATS / Recruiter',
    'Student / Academic',
    'Software / Tech',
    'Creative / Designer',
    'Executive / Management',
    'Portfolio / Visual',
    'Minimal / One-page',
];

/** Get templates by category */
export function getTemplatesByCategory(category: TemplateCategory): CatalogTemplate[] {
    return TEMPLATE_CATALOG.filter(t => t.category === category);
}
