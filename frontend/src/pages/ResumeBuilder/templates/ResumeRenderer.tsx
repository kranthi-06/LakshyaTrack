import type { BaseTemplate } from './templateCatalog';
import type { ResumeData } from '../types';
import { AcademicTemplate } from './AcademicTemplate';
import { BoldHeaderTemplate } from './BoldHeaderTemplate';
import { ClassicTemplate } from './ClassicTemplate';
import { CompactTemplate } from './CompactTemplate';
import { CorporateTemplate } from './CorporateTemplate';
import { CreativeTemplate } from './CreativeTemplate';
import { DeveloperTemplate } from './DeveloperTemplate';
import { ElegantTemplate } from './ElegantTemplate';
import { ExecutiveTemplate } from './ExecutiveTemplate';
import { FreshTemplate } from './FreshTemplate';
import { InfographicTemplate } from './InfographicTemplate';
import { MinimalATSTemplate } from './MinimalATSTemplate';
import { ModernTemplate } from './ModernTemplate';
import { PortfolioTemplate } from './PortfolioTemplate';
import { TimelineTemplate } from './TimelineTemplate';
import { TwoColumnTemplate } from './TwoColumnTemplate';

/**
 * Single mapping from a catalogued template to its component. Every surface that
 * draws a resume — editor preview, saved-resume cards, PDF print export and the
 * regression harness — renders through here so a template can never differ
 * between them.
 */
export function ResumeRenderer({ base, data, color }: { base: BaseTemplate; data: ResumeData; color: string }) {
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
