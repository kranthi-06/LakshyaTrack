import { describe, expect, it } from 'vitest';
import { TEMPLATE_CATALOG, resolveCatalogTemplate } from './templateCatalog';
import type { BaseTemplate } from './templateCatalog';

const BASE_ENGINES: BaseTemplate[] = [
    'modern', 'classic', 'creative', 'developer', 'minimal-ats', 'academic',
    'executive', 'two-column', 'portfolio', 'compact', 'timeline', 'elegant',
    'bold-header', 'infographic', 'corporate', 'fresh',
];

describe('TEMPLATE_CATALOG', () => {
    it('lists 52+ catalog entries mapped to known base engines', () => {
        expect(TEMPLATE_CATALOG.length).toBeGreaterThanOrEqual(52);
        for (const entry of TEMPLATE_CATALOG) {
            expect(BASE_ENGINES).toContain(entry.base);
            expect(entry.template_id.length).toBeGreaterThan(0);
            expect(entry.name.length).toBeGreaterThan(0);
        }
    });

    it('resolves catalog ids and legacy base engine names', () => {
        const byId = resolveCatalogTemplate('ats-clean');
        expect(byId.template_id).toBe('ats-clean');
        expect(byId.base).toBe('minimal-ats');

        const byBase = resolveCatalogTemplate('corporate');
        expect(byBase.base).toBe('corporate');

        expect(resolveCatalogTemplate('unknown-template').template_id).toBe(TEMPLATE_CATALOG[0].template_id);
    });
});
