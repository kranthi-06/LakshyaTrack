// Base template components
export { ModernTemplate } from './ModernTemplate';
export { ClassicTemplate } from './ClassicTemplate';
export { CreativeTemplate } from './CreativeTemplate';
export { DeveloperTemplate } from './DeveloperTemplate';
export { MinimalATSTemplate } from './MinimalATSTemplate';
export { AcademicTemplate } from './AcademicTemplate';
export { ExecutiveTemplate } from './ExecutiveTemplate';
export { TwoColumnTemplate } from './TwoColumnTemplate';
export { PortfolioTemplate } from './PortfolioTemplate';
export { CompactTemplate } from './CompactTemplate';
export { TimelineTemplate } from './TimelineTemplate';
export { ElegantTemplate } from './ElegantTemplate';
export { BoldHeaderTemplate } from './BoldHeaderTemplate';
export { InfographicTemplate } from './InfographicTemplate';
export { CorporateTemplate } from './CorporateTemplate';
export { FreshTemplate } from './FreshTemplate';

// Template catalog (50+ templates)
export { TEMPLATE_CATALOG, TEMPLATE_CATEGORIES, getTemplatesByCategory, resolveBaseTemplate, resolveCatalogTemplate } from './templateCatalog';
export type { CatalogTemplate, TemplateCategory, BaseTemplate, ATSPriority, LayoutType } from './templateCatalog';

// Color themes
export const THEME_COLORS: { id: string; label: string; color: string }[] = [
    { id: 'purple', label: 'Purple', color: '#5c52d2' },
    { id: 'blue', label: 'Blue', color: '#3b82f6' },
    { id: 'rose', label: 'Rose', color: '#e11d48' },
    { id: 'emerald', label: 'Emerald', color: '#10b981' },
    { id: 'slate', label: 'Slate', color: '#334155' },
    { id: 'amber', label: 'Amber', color: '#d97706' },
    { id: 'sky', label: 'Sky', color: '#0ea5e9' },
    { id: 'violet', label: 'Violet', color: '#8b5cf6' },
];
